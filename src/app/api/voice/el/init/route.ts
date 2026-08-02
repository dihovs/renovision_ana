import crypto from "crypto";
import { startCall } from "@/lib/crm/calls";
import { greeting } from "@/lib/voice/agent";

/**
 * ElevenLabs Agents — conversation initiation webhook.
 *
 * Replaces /api/voice/incoming for calls routed through ElevenLabs' native
 * Twilio integration instead of the turn-based <Gather> path. ElevenLabs
 * imports the Twilio number directly and hosts the whole call loop itself
 * (STT, LLM orchestration, TTS, the WebSocket) — nothing of ours holds a
 * connection open, which is why this needed no Fly.io/Railway bridge at all.
 * See Docs/Voice-ElevenLabs-Setup.md for the full picture, and
 * Docs/Voice-Architecture-History.md for why the ConversationRelay bridge
 * this replaced was cancelled and deleted.
 *
 * ElevenLabs POSTs here the moment a call connects, before any audio.
 * Response tells it what to say first and which voice to use — mirrors
 * exactly what /api/voice/incoming used to decide via TwiML.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NOTE: this response deliberately no longer overrides tts.voice_id.
//
// It used to pin one voice on every call, which made the dashboard's voice
// selection cosmetic. That is incompatible with speaking two languages well:
// the voice now has to be chosen per language by ElevenLabs' language presets
// (a French voice for French, an unaccented English one for English), and a
// hard per-call override would sit on top of the preset and defeat it. The
// dashboard is now the only source of truth for which voice speaks when —
// see Docs/Voice-Bilingual-Plan.md.

function verifyElevenLabsSecret(request: Request): boolean {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[voice-el] ELEVENLABS_WEBHOOK_SECRET is not set — refusing the request");
    return false;
  }
  // ElevenLabs' dashboard lets you attach an arbitrary auth header to each
  // webhook it calls — configured to send this one. Not Twilio's HMAC scheme
  // because ElevenLabs, not Twilio, is the caller here.
  const header = request.headers.get("x-el-webhook-secret");
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!verifyElevenLabsSecret(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = await request.json().catch(() => null);
  // Documented fields: caller_id, agent_id, called_number, call_sid.
  const callSid: string | undefined = body?.call_sid;

  const locale = "fr" as const;

  if (callSid) {
    try {
      await startCall({
        callSid,
        from: body?.caller_id ?? null,
        to: body?.called_number ?? null,
        locale,
      });
    } catch (err) {
      console.error("[voice-el] could not open the transcript:", err);
    }
  }

  return Response.json({
    type: "conversation_initiation_client_data",
    conversation_config_override: {
      agent: { first_message: greeting(locale), language: locale },
    },
    // Round-tripped back to us on every /api/voice/el/chat call (via
    // elevenlabs_extra_body, once "Custom LLM extra body" is enabled in the
    // agent's Security tab) and on the post-call webhook (via
    // dynamic_variables) — this is how both later hooks know which Supabase
    // row this conversation is.
    dynamic_variables: { call_sid: callSid ?? null },
  });
}
