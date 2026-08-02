import {
  appendTurns,
  callerTurns,
  endCall,
  getCallBySid,
  markEscalated,
  setCallLocale,
  type CallTurn,
} from "@/lib/crm/calls";
import { fallbackLine, replyTo } from "@/lib/voice/agent";
import { shouldEscalate } from "@/lib/voice/escalation";
import { detectLocale } from "@/lib/voice/twiml";
import { verifyRelaySecret } from "@/lib/voice/relayAuth";

/**
 * One turn of the conversation, ConversationRelay flavour.
 *
 * Same brain as /api/voice/turn (Claude, escalation, transcript, language
 * detection) — this only exists because the transport is different. The
 * turn-based path gets Twilio's SpeechResult inside a signed HTTP POST and
 * answers with TwiML; ConversationRelay instead holds one WebSocket open for
 * the whole call, which Vercel cannot terminate itself (see relay-incoming's
 * route comment), so a small always-on bridge holds that socket and calls
 * this endpoint per utterance instead. It gets back plain JSON — no TwiML,
 * no <Gather>, no silence handling, because ConversationRelay's own
 * speech-to-text only calls the bridge once it has a finished utterance.
 *
 * Deliberately not signed with Twilio's HMAC scheme (verifyTwilioSignature) —
 * Twilio never calls this URL directly, only the bridge does, so a shared
 * secret between the two is what's being checked here.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A long call is a stuck loop, not a chatty customer. Matches the turn-based path. */
const MAX_TURNS = 40;

export async function POST(request: Request) {
  if (!verifyRelaySecret(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const callSid: string | undefined = body?.callSid;
  const spoken: string = (body?.spoken ?? "").trim();

  if (!callSid || !spoken) {
    return Response.json({ error: "callSid and spoken are required" }, { status: 400 });
  }

  let call = await getCallBySid(callSid).catch(() => null);
  let locale: "fr" | "en" = call?.locale ?? (body?.locale === "en" ? "en" : "fr");

  try {
    const priorTurns = call?.turns ?? [];

    if (priorTurns.length >= MAX_TURNS) {
      await endCall(callSid, { status: "completed" });
      return Response.json({
        reply:
          locale === "fr"
            ? "Merci, j'ai ce qu'il me faut. Artush vous rappelle très bientôt."
            : "Thank you, I have what I need. Artush will call you back very soon.",
        locale,
        end: true,
      });
    }

    // Follow the caller's language, same rule as the turn-based path: detected
    // from what they just said, switched only on a clear margin.
    const detected = detectLocale(spoken, locale);
    if (detected !== locale) {
      locale = detected;
      await setCallLocale(callSid, locale).catch(() => {});
    }

    const verdict = shouldEscalate(spoken, callerTurns({ turns: priorTurns }), {
      alreadyEscalated: Boolean(call?.escalated_at),
    });
    if (verdict.escalate && !call?.escalated_at && verdict.reason) {
      await markEscalated(callSid, verdict.reason).catch(() => {});
    }

    const callerTurn: CallTurn = {
      role: "caller",
      text: spoken,
      at: new Date().toISOString(),
    };

    const reply = await replyTo([...priorTurns, callerTurn], {
      locale,
      escalated: verdict.escalate,
    });

    const agentTurn: CallTurn = {
      role: "agent",
      text: reply.text,
      at: new Date().toISOString(),
      model: reply.model,
      escalated: verdict.escalate || undefined,
    };

    // Written after the reply so a failed Claude call doesn't leave a caller
    // turn in the transcript with no answer beside it.
    await appendTurns(callSid, [callerTurn, agentTurn]).catch(() => {});

    return Response.json({ reply: reply.text || fallbackLine(locale), locale, end: false });
  } catch (err) {
    console.error("[voice-relay] turn failed:", err);
    await endCall(callSid, { status: "failed" }).catch(() => {});

    // The caller is still on the line. They get an apology and a promise of a
    // callback rather than dead air.
    return Response.json({ reply: fallbackLine(locale), locale, end: true });
  }
}
