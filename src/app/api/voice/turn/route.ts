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
import { detectLocale } from "@/lib/voice/locale";
import {
  publicUrl,
  readTwilioParams,
  sayAndGather,
  twimlResponse,
  verifyTwilioSignature,
} from "@/lib/voice/twiml";

/**
 * One turn of the conversation.
 *
 * Twilio posts what the caller said, we answer, and we hand back a fresh
 * <Gather> to listen again. Each invocation lasts about as long as one Claude
 * call — a couple of seconds — so this sits far inside any serverless timeout
 * and needs no persistent connection.
 *
 * Everything is wrapped: a failure here happens while somebody is holding a
 * phone to their ear, so the worst case has to be a polite apology and a
 * callback, never silence or a Twilio error tone.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A long call is a stuck loop, not a chatty customer. */
const MAX_TURNS = 40;
/** Two silences in a row means they have gone. */
const MAX_CONSECUTIVE_SILENCES = 2;

export async function POST(request: Request) {
  const params = await readTwilioParams(request);
  const url = new URL(request.url);

  if (
    !verifyTwilioSignature({
      signature: request.headers.get("x-twilio-signature"),
      url: publicUrl(request),
      params,
      authToken: process.env.TWILIO_AUTH_TOKEN,
    })
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const callSid = params.CallSid ?? "";
  const spoken = (params.SpeechResult ?? "").trim();
  const silent = url.searchParams.get("silent") === "1" || !spoken;

  const call = await getCallBySid(callSid).catch(() => null);
  let locale: "fr" | "en" = call?.locale ?? "fr";

  // --- Nobody said anything ------------------------------------------------
  if (silent) {
    const silences = Number(url.searchParams.get("silences") ?? "0") + 1;

    if (silences >= MAX_CONSECUTIVE_SILENCES) {
      await endCall(callSid, { status: "abandoned" }).catch(() => {});
      return twimlResponse(
        sayAndGather({
          text:
            locale === "fr"
              ? "Je ne vous entends pas. Rappelez-nous quand vous voulez. Bonne journée."
              : "I can't hear you. Do call us back any time. Have a good day.",
          locale,
          action: "/api/voice/turn",
          hangUpAfter: true,
        }),
      );
    }

    // The most common "silence" is not a quiet caller — it is an anglophone
    // being parsed by the French recogniser (or the reverse). Failed
    // recognition arrives as an empty SpeechResult, and a caller in the wrong
    // language can never produce the clean text that would trigger the
    // language switch. So the retry listens in the OTHER language, with a
    // bilingual prompt: the wrong-language caller is rescued on attempt two
    // instead of never.
    const retryLocale = locale === "fr" ? ("en" as const) : ("fr" as const);
    return twimlResponse(
      sayAndGather({
        text:
          locale === "fr"
            ? "Pardon, je ne vous ai pas bien entendu. You can also speak English — allez-y, je vous écoute."
            : "Sorry, I didn't catch that. Vous pouvez aussi parler français — go ahead, I'm listening.",
        locale: retryLocale,
        action: `/api/voice/turn?silences=${silences}`,
      }),
    );
  }

  // --- The caller said something ------------------------------------------
  try {
    const priorTurns = call?.turns ?? [];

    if (priorTurns.length >= MAX_TURNS) {
      await endCall(callSid, { status: "completed" });
      return twimlResponse(
        sayAndGather({
          text:
            locale === "fr"
              ? "Merci, j'ai ce qu'il me faut. Artush vous rappelle très bientôt."
              : "Thank you, I have what I need. Artush will call you back very soon.",
          locale,
          action: "/api/voice/turn",
          hangUpAfter: true,
        }),
      );
    }

    // Follow the caller's language. Detected from what they just said, and only
    // switched on a clear margin so one borrowed word doesn't flip the call.
    const detected = detectLocale(spoken, locale);
    if (detected !== locale) {
      locale = detected;
      await setCallLocale(callSid, locale).catch(() => {});
    }

    // Is the cheap model failing to land? Sticky once true — dropping back to
    // Haiku after one good answer would rebuild the frustration that caused it.
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

    return twimlResponse(
      sayAndGather({
        text: reply.text || fallbackLine(locale),
        locale,
        action: "/api/voice/turn",
      }),
    );
  } catch (err) {
    console.error("[voice] turn failed:", err);
    await endCall(callSid, { status: "failed" }).catch(() => {});

    // The caller is still on the line. They get an apology and a promise of a
    // callback rather than a dial tone.
    return twimlResponse(
      sayAndGather({
        text: fallbackLine(locale),
        locale,
        action: "/api/voice/turn",
        hangUpAfter: true,
      }),
    );
  }
}
