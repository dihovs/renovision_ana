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
import { fallbackLine, replyToStream } from "@/lib/voice/agent";
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
  const conversational = messages.filter((m) => m.role === "user" || m.role === "assistant");
  const last = conversational.at(-1);
  const spoken = last?.role === "user" ? (last.content?.trim() ?? "") : "";
  const priorTurns: CallTurn[] = conversational.slice(0, -1).map((m) => ({
    role: m.role === "user" ? "caller" : "agent",
    text: m.content ?? "",
    at: new Date().toISOString(),
  }));

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (text: string) => controller.enqueue(encoder.encode(text));

      if (!spoken) {
        send(sseChunk({ role: "assistant", content: fallbackLine("fr") }, "stop"));
        send("data: [DONE]\n\n");
        controller.close();
        return;
      }

      let call = callSid ? await getCallBySid(callSid).catch(() => null) : null;
      let locale: "fr" | "en" = call?.locale ?? "fr";

      try {
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

        const verdict = shouldEscalate(spoken, callerTurns({ turns: priorTurns }), {
          alreadyEscalated: Boolean(call?.escalated_at),
        });
        if (verdict.escalate && !call?.escalated_at && verdict.reason && callSid) {
          await markEscalated(callSid, verdict.reason).catch(() => {});
        }

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
        if (callSid) await appendTurns(callSid, [callerTurn, agentTurn]).catch(() => {});
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
