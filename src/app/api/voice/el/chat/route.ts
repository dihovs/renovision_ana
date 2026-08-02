import crypto from "crypto";
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

/**
 * ElevenLabs Agents — custom LLM endpoint.
 *
 * ElevenLabs hosts the whole call (STT, orchestration, TTS); the one thing it
 * doesn't own is what Ana actually says, which is this endpoint. It calls
 * here on every turn shaped exactly like an OpenAI /v1/chat/completions
 * request, and requires the response back as Server-Sent Events — non-
 * streaming replies are rejected outright, per ElevenLabs' custom-LLM docs.
 *
 * This is the direct replacement for BOTH /api/voice/turn (the turn-based
 * TwiML path) and /api/voice/relay/turn (the shelved ConversationRelay
 * bridge) — same brain (Claude, escalation, transcript), third transport.
 *
 * UNVERIFIED, confirm on the first real test call and adjust if wrong:
 *   - That the configured "API key" arrives as `Authorization: Bearer <key>`.
 *   - Exactly where call_sid lands in the request body. The dashboard flow
 *     is: our /api/voice/el/init response sets `dynamic_variables.call_sid`,
 *     and enabling "Custom LLM extra body" in the agent's Security tab is
 *     what causes it to round-trip into every request. Documented arrival
 *     point is `elevenlabs_extra_body`, but the exact key path inside it
 *     isn't nailed down by ElevenLabs' docs — so this checks several
 *     plausible shapes and logs when none match, rather than 500ing a call.
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

  // The caller's most recent turn, and every earlier one, oldest first — the
  // exact shape shouldEscalate() and callerTurns() already expect. ElevenLabs
  // sends the full running history each time, so this is reconstructed from
  // the request itself rather than a Supabase read on the hot path.
  const userMessages = messages.filter((m) => m.role === "user");
  const spoken = userMessages.at(-1)?.content?.trim() ?? "";
  const priorCallerTurns = userMessages.slice(0, -1).map((m) => m.content);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (text: string) => controller.enqueue(encoder.encode(text));

      let call = callSid ? await getCallBySid(callSid).catch(() => null) : null;
      let locale: "fr" | "en" = call?.locale ?? "fr";

      try {
        if (!spoken) {
          send(sseChunk({ role: "assistant", content: fallbackLine(locale) }, "stop"));
          send("data: [DONE]\n\n");
          controller.close();
          return;
        }

        const priorTurns = call?.turns ?? [];

        if (priorTurns.length >= MAX_TURNS) {
          if (callSid) await endCall(callSid, { status: "completed" }).catch(() => {});
          const closing =
            locale === "fr"
              ? "Merci, j'ai ce qu'il me faut. Artush vous rappelle très bientôt."
              : "Thank you, I have what I need. Artush will call you back very soon.";
          send(sseChunk({ role: "assistant", content: closing }, "stop"));
          send("data: [DONE]\n\n");
          controller.close();
          return;
        }

        const detected = detectLocale(spoken, locale);
        if (detected !== locale) {
          locale = detected;
          if (callSid) await setCallLocale(callSid, locale).catch(() => {});
        }

        const verdict = shouldEscalate(spoken, [...priorCallerTurns, ...callerTurns({ turns: priorTurns })], {
          alreadyEscalated: Boolean(call?.escalated_at),
        });
        if (verdict.escalate && !call?.escalated_at && verdict.reason && callSid) {
          await markEscalated(callSid, verdict.reason).catch(() => {});
        }

        const callerTurn: CallTurn = { role: "caller", text: spoken, at: new Date().toISOString() };
        const reply = await replyTo([...priorTurns, callerTurn], { locale, escalated: verdict.escalate });

        const agentTurn: CallTurn = {
          role: "agent",
          text: reply.text,
          at: new Date().toISOString(),
          model: reply.model,
          escalated: verdict.escalate || undefined,
        };
        if (callSid) await appendTurns(callSid, [callerTurn, agentTurn]).catch(() => {});

        // One chunk carrying the whole reply, not real token streaming.
        // ElevenLabs requires the SSE *shape*; Claude's own reply here is a
        // single non-streaming call (see replyTo()), so this satisfies the
        // contract without pretending to stream what isn't. True
        // token-by-token would shave more off the latency budget — worth
        // revisiting if the current cut isn't enough.
        send(sseChunk({ role: "assistant", content: reply.text || fallbackLine(locale) }, "stop"));
        send("data: [DONE]\n\n");
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
