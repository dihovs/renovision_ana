import http from "node:http";
import { WebSocketServer } from "ws";

/**
 * The one thing Vercel can't host: a WebSocket that stays open for the whole
 * call.
 *
 * Twilio's ConversationRelay opens a single WebSocket per call and holds it
 * for the call's entire duration. Vercel deploys Route Handlers as lambda
 * functions, which close on timeout or once a response is sent — exactly the
 * limitation documented in this repo's own Next.js fork
 * (node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md):
 * "WebSockets won't work because the connection closes on timeout, or after
 * the response is generated." So this one small always-on service exists
 * purely to hold that socket open; it carries no secrets that matter beyond
 * RELAY_SHARED_SECRET, and it makes no decisions.
 *
 * Everything that actually thinks lives on renovisionana.ca:
 *   - Claude, escalation, language detection: /api/voice/relay/turn
 *   - Opening the transcript row, the greeting: /api/voice/relay/setup
 * This file's whole job is translating between Twilio's WebSocket message
 * protocol and two HTTPS calls to those endpoints. If this service is ever
 * lost or redeployed from scratch, nothing about a caller's conversation
 * history goes with it — that all lives in Supabase, reached only through
 * the Vercel app.
 *
 * Message shapes verified directly against Twilio's current docs
 * (docs.twilio.com/voice/conversationrelay/websocket-messages) rather than
 * assumed, because a wrong field name here means Ana never hears anything —
 * `prompt` carries the caller's speech in a flat `voicePrompt` field, not
 * nested under `payload`.
 */

const PORT = process.env.PORT ?? 8080;
const APP_ORIGIN = process.env.APP_ORIGIN ?? "https://www.renovisionana.ca";
const RELAY_SHARED_SECRET = process.env.RELAY_SHARED_SECRET;

if (!RELAY_SHARED_SECRET) {
  console.error("RELAY_SHARED_SECRET is not set. Refusing to start: without it, this bridge");
  console.error("would either reject every request from the Vercel app or, worse, run with no");
  console.error("authentication between the two at all.");
  process.exit(1);
}

/** Same TTS/STT language codes the ConversationRelay TwiML already declares. */
const LANG = { fr: "fr-CA", en: "en-US" };

async function callVercel(path, body) {
  const response = await fetch(`${APP_ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Relay-Secret": RELAY_SHARED_SECRET,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${path} responded ${response.status}`);
  }
  return response.json();
}

/** Bilingual, generic, and only ever spoken if the Vercel app itself is unreachable. */
function transportFailureLine(locale) {
  return locale === "en"
    ? "Sorry, I'm having a technical problem. Please call back in a few minutes."
    : "Désolée, j'ai un problème technique. Rappelez dans quelques minutes.";
}

const server = http.createServer((request, response) => {
  // Fly (and most platforms) health-check over plain HTTP before routing any
  // traffic to this machine — without this, the app never reports healthy.
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end("ok");
    return;
  }
  response.writeHead(404);
  response.end();
});

const wss = new WebSocketServer({ server, path: "/relay" });

wss.on("connection", (ws) => {
  // One connection = one call. Twilio opens a fresh socket per call, so
  // per-call state lives in this closure rather than a shared map — there is
  // nothing to key it by that the closure doesn't already give for free.
  let callSid = null;
  let currentLocale = "fr";
  let ended = false;

  function send(message) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
  }

  /** Speaks a line, then ends the session a beat later so Twilio finishes playing it first. */
  function speakThenEnd(text, locale, reason) {
    send({ type: "text", token: text, last: true, lang: LANG[locale] ?? LANG.fr });
    ended = true;
    setTimeout(() => {
      send({ type: "end", handoffData: JSON.stringify({ reason }) });
      ws.close();
    }, 4000);
  }

  ws.on("message", async (raw) => {
    if (ended) return;

    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      console.error("[relay] non-JSON frame, ignoring");
      return;
    }

    try {
      switch (data.type) {
        case "setup": {
          callSid = data.callSid;
          console.log(`[relay] setup callSid=${callSid} from=${data.from}`);
          const { greeting, locale } = await callVercel("/api/voice/relay/setup", {
            callSid,
            from: data.from,
            to: data.to,
          });
          currentLocale = locale;
          send({ type: "text", token: greeting, last: true, lang: LANG[currentLocale] });
          break;
        }

        case "prompt": {
          // partialPrompts is off in the TwiML (the default), so `last` should
          // always be true here — checked anyway rather than assumed, since a
          // half-sentence sent to Claude mid-utterance would answer the wrong
          // question.
          if (data.last === false) return;
          if (!callSid) {
            console.error("[relay] prompt arrived before setup — dropping it");
            return;
          }

          const { reply, locale, end } = await callVercel("/api/voice/relay/turn", {
            callSid,
            spoken: data.voicePrompt ?? "",
            locale: currentLocale,
          });

          // Same ElevenLabs voice speaks both languages — there is no en-CA
          // default to swap to, and a different-sounding voice mid-call would
          // be a stranger experience than this one voice's English accent.
          if (locale !== currentLocale) {
            send({ type: "language", ttsLanguage: LANG[locale], transcriptionLanguage: LANG[locale] });
            currentLocale = locale;
          }

          if (end) {
            speakThenEnd(reply, currentLocale, "conversation complete");
          } else {
            send({ type: "text", token: reply, last: true, lang: LANG[currentLocale] });
          }
          break;
        }

        case "interrupt":
          // Twilio has already stopped playing our last utterance on its own
          // side; nothing here streams token-by-token, so there is no
          // in-flight speech on our end to cancel in response.
          console.log(`[relay] interrupt callSid=${callSid}`);
          break;

        case "dtmf":
          // No keypad menu in this design; logged in case a caller's touch
          // tones turn out to mean something worth handling later.
          console.log(`[relay] dtmf callSid=${callSid} digit=${data.digit}`);
          break;

        case "error":
          console.error(`[relay] Twilio reported an error callSid=${callSid}:`, data.description);
          break;

        default:
          console.log(`[relay] unhandled message type "${data.type}"`);
      }
    } catch (err) {
      console.error(`[relay] turn failed callSid=${callSid}:`, err);
      // The caller is still on the line — an apology and a hangup, never dead air.
      speakThenEnd(transportFailureLine(currentLocale), currentLocale, "relay error");
    }
  });

  ws.on("close", () => {
    console.log(`[relay] socket closed callSid=${callSid}`);
    // Deliberately nothing else here: Twilio calls /api/voice/status
    // independently as the call's Status Callback, and that is what closes
    // the transcript row. Duplicating that here would race it.
  });

  ws.on("error", (err) => {
    console.error(`[relay] socket error callSid=${callSid}:`, err);
  });
});

server.listen(PORT, () => {
  console.log(`[relay] listening on :${PORT} (proxying to ${APP_ORIGIN})`);
});
