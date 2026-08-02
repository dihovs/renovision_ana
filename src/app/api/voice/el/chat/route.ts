import crypto from "crypto";
import {
  appendTurns,
  callerTurns,
  endCall,
  markEscalated,
  setCallLocale,
  type CallTurn,
} from "@/lib/crm/calls";
import { fallbackLine, replyToStream } from "@/lib/voice/agent";
import { shouldEscalate } from "@/lib/voice/escalation";
import { detectLocale } from "@/lib/voice/locale";

/**
 * ElevenLabs Agents — custom LLM endpoint.
 *
 * ElevenLabs hosts the whole call (STT, orchestration, TTS); the one thing it
 * doesn't own is what Ana actually says, which is this endpoint. It calls
 * here on every turn shaped exactly like an OpenAI /v1/chat/completions
 * request, and requires the response back as Server-Sent Events — non-
 * streaming replies are rejected outright, per ElevenLabs' custom-LLM docs.
 *
 * This is the direct replacement for /api/voice/turn (the turn-based TwiML
 * path, kept as the rollback route) and for the ConversationRelay bridge that
 * was cancelled before it shipped (Docs/Voice-Architecture-History.md) — same
 * brain (Claude, escalation, transcript), different transport.
 *
 * call_sid extraction below is best-effort (confirmed unreliable on the first
 * real test call — see the comment above `priorTurns` for why that no longer
 * matters for what Claude actually sees). It is still attempted because
 * Supabase persistence (the CRM transcript, escalation stickiness, ending the
 * call on hangup) is keyed on it — when it's missing, those writes silently
 * no-op rather than breaking the call, but the transcript won't show up in
 * /admin/calls for that conversation.
 *
 * UNVERIFIED, confirm on a call with call_sid logging enabled:
 *   - That the configured "API key" arrives as `Authorization: Bearer <key>`
 *     (this one appears to work — Forbidden responses would show in ElevenLabs'
 *     call logs as the agent going silent immediately).
 *   - Exactly where call_sid lands in the request body. The dashboard flow
 *     is: our /api/voice/el/init response sets `dynamic_variables.call_sid`,
 *     and enabling "Custom LLM extra body" in the agent's Security tab is
 *     what causes it to round-trip into every request — if that toggle was
 *     never enabled, extractCallSid() always returns null.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TURNS = 40;

type OpenAIMessage = { role: "system" | "user" | "assistant" | "tool"; content: string };

function verifyBearer(request: Request): boolean {
  const secret = process.env.ELEVENLABS_CUSTOM_LLM_SECRET;
  if (!secret) {
    console.error("[voice-el] ELEVENLABS_CUSTOM_LLM_SECRET is not set — refusing the request");
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/i, "");
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Best-effort extraction — see the UNVERIFIED note above. */
function extractCallSid(body: Record<string, unknown>): string | null {
  const extra = body.elevenlabs_extra_body as Record<string, unknown> | undefined;
  const dynamic = body.dynamic_variables as Record<string, unknown> | undefined;
  return (
    (extra?.call_sid as string) ??
    (dynamic?.call_sid as string) ??
    (body.call_sid as string) ??
    null
  );
}

/**
 * Locale and escalation state, recomputed from the conversation rather than
 * read back from Supabase.
 *
 * Both used to come from a getCallBySid() round-trip taken *before* Claude was
 * called — a blocking database read sitting in front of every single turn, and
 * the caller pays for it in silence. Neither value needs the database:
 * ElevenLabs sends the whole conversation on every request, and both
 * detectLocale() and shouldEscalate() are pure functions of it. Folding them
 * over the history is microseconds of string comparison against at most 40
 * short turns, and it takes a network hop off the hot path entirely.
 *
 * Escalation is sticky by design — shouldEscalate() short-circuits to true when
 * alreadyEscalated is set — so folding reproduces exactly what the stored
 * escalated_at flag meant: once this call has needed Sonnet, it keeps Sonnet.
 */
function deriveCallState(callerTurnTexts: string[]): {
  locale: "fr" | "en";
  alreadyEscalated: boolean;
} {
  let locale: "fr" | "en" = "fr";
  let alreadyEscalated = false;

  for (let i = 0; i < callerTurnTexts.length; i++) {
    const turn = callerTurnTexts[i];
    locale = detectLocale(turn, locale);
    if (!alreadyEscalated) {
      alreadyEscalated = shouldEscalate(turn, callerTurnTexts.slice(0, i)).escalate;
    }
  }

  return { locale, alreadyEscalated };
}

function sseChunk(delta: Record<string, unknown>, finishReason: string | null = null) {
  const payload = {
    id: `chatcmpl-ana`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(request: Request) {
  if (!verifyBearer(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !Array.isArray(body.messages)) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const messages = body.messages as OpenAIMessage[];
  const callSid = extractCallSid(body);
  if (!callSid) {
    console.error("[voice-el] no call_sid on this request — see UNVERIFIED note in this file");
  }

  // ElevenLabs sends the full running conversation on every turn — that, not
  // a Supabase read keyed on call_sid, is the authoritative record of what
  // Ana has already said. The previous version read history back from
  // Supabase instead: a single failed call_sid round-trip (which is what was
  // actually happening) made every turn look like the first, so priorTurns
  // came back empty and Ana re-asked her opening question for the entire
  // call. Supabase is still written to below for the CRM transcript — it's
  // just no longer read back to decide what Claude sees.
  //
  // After ElevenLabs runs a system tool (language_detection, below) it calls
  // straight back with a `tool` role message appended. The caller has not said
  // anything new on that turn — the last *user* message is still the one that
  // triggered the switch — so "what was just spoken" has to be found by role
  // rather than by position. Reading the last message blindly would see the
  // tool result, treat the turn as silence, and answer with the fallback line
  // in the language the caller just switched away from.
  const isToolResultTurn = messages.at(-1)?.role === "tool";

  const conversational = messages.filter((m) => m.role === "user" || m.role === "assistant");
  const lastUserIndex = conversational.map((m) => m.role).lastIndexOf("user");
  const spoken = lastUserIndex >= 0 ? (conversational[lastUserIndex].content?.trim() ?? "") : "";
  const priorTurns: CallTurn[] = conversational
    .slice(0, Math.max(lastUserIndex, 0))
    .filter((m) => (m.content ?? "").trim().length > 0)
    .map((m) => ({
      role: m.role === "user" ? "caller" : "agent",
      text: m.content ?? "",
      at: new Date().toISOString(),
    }));

  const priorCallerTexts = callerTurns({ turns: priorTurns });
  const { locale: priorLocale, alreadyEscalated } = deriveCallState(priorCallerTexts);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (text: string) => controller.enqueue(encoder.encode(text));

      if (!spoken) {
        send(sseChunk({ role: "assistant", content: fallbackLine(priorLocale) }, "stop"));
        send("data: [DONE]\n\n");
        controller.close();
        return;
      }

      let locale: "fr" | "en" = priorLocale;

      try {
        if (priorTurns.length >= MAX_TURNS) {
          if (callSid) await endCall(callSid, { status: "completed" }).catch(() => {});
          const closing =
            locale === "fr"
              ? "Merci, j'ai ce qu'il me faut. Notre estimateur vous rappelle très bientôt. Bonne journée!"
              : "Thank you, I have what I need. Our estimator will call you back very soon. Have a great day!";
          send(sseChunk({ role: "assistant", content: closing }, "stop"));
          send("data: [DONE]\n\n");
          return;
        }

        const detected = detectLocale(spoken, locale);
        const localeChanged = detected !== locale;
        locale = detected;

        // The caller has switched language. Announce it through the
        // language_detection system tool rather than simply replying in the
        // new language, because the conversation's language is what selects
        // the voice: without this call ElevenLabs keeps speaking through the
        // French voice, so English comes out with a French accent — exactly
        // the thing the owner rejected. Emitting a tool call means no text
        // this turn; ElevenLabs runs the tool and immediately calls back, and
        // the reply is generated on that second pass.
        //
        // Skipped on a tool-result turn so a detectLocale that stays
        // unconvinced cannot bounce the call between languages forever.
        if (localeChanged && !isToolResultTurn) {
          send(
            sseChunk({
              role: "assistant",
              tool_calls: [
                {
                  index: 0,
                  id: `call_lang_${Date.now()}`,
                  type: "function",
                  function: { name: "language_detection", arguments: "" },
                },
              ],
            }),
          );
          send(
            sseChunk({
              tool_calls: [
                {
                  index: 0,
                  function: {
                    arguments: JSON.stringify({
                      reason: "the caller switched language",
                      language: locale,
                    }),
                  },
                },
              ],
            }),
          );
          send(sseChunk({}, "tool_calls"));
          send("data: [DONE]\n\n");
          if (callSid) await setCallLocale(callSid, locale).catch(() => {});
          return;
        }

        const verdict = shouldEscalate(spoken, priorCallerTexts, { alreadyEscalated });

        const callerTurn: CallTurn = { role: "caller", text: spoken, at: new Date().toISOString() };

        // Streamed token-by-token so ElevenLabs can start speaking on the
        // first few words instead of waiting for the whole reply — the
        // single-chunk version this replaced added Claude's entire
        // generation time to every turn's silence before Ana said anything.
        let sentAny = false;
        const reply = await replyToStream([...priorTurns, callerTurn], { locale, escalated: verdict.escalate }, (delta) => {
          if (!delta) return;
          send(sseChunk(sentAny ? { content: delta } : { role: "assistant", content: delta }));
          sentAny = true;
        });
        if (!sentAny) {
          send(sseChunk({ role: "assistant", content: fallbackLine(locale) }));
        }
        send(sseChunk({}, "stop"));
        send("data: [DONE]\n\n");

        const agentTurn: CallTurn = {
          role: "agent",
          text: reply.text,
          at: new Date().toISOString(),
          model: reply.model,
          escalated: verdict.escalate || undefined,
        };

        // Every Supabase write happens here, after the caller has already heard
        // the reply — nothing the CRM needs is worth adding silence to a live
        // call. Settled together rather than awaited in sequence, and each
        // failure is swallowed: a dropped transcript row is a reporting gap,
        // not a reason to break a phone call.
        if (callSid) {
          await Promise.allSettled([
            appendTurns(callSid, [callerTurn, agentTurn]),
            localeChanged ? setCallLocale(callSid, locale) : null,
            verdict.escalate && !alreadyEscalated && verdict.reason
              ? markEscalated(callSid, verdict.reason)
              : null,
          ]);
        }
      } catch (err) {
        console.error("[voice-el] chat failed:", err);
        if (callSid) await endCall(callSid, { status: "failed" }).catch(() => {});
        send(sseChunk({ role: "assistant", content: fallbackLine(locale) }, "stop"));
        send("data: [DONE]\n\n");
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
