import crypto from "crypto";
import { SITE_PHONE_TEL } from "@/lib/constants";
import { callerLocale, startCall } from "@/lib/crm/calls";
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
  const from: string | null = body?.caller_id ?? null;

  // OUTBOUND MUST NEVER GET THE RECEPTIONIST'S GREETING.
  //
  // ElevenLabs documents this webhook as inbound-only — their Twilio
  // personalization page scopes it to "when receiving inbound Twilio calls" —
  // and it makes structural sense that it is, because the outbound endpoint
  // takes conversation_initiation_client_data directly in its request body.
  // The outbound agent is also configured with no initiation webhook at all,
  // which closes the question by construction.
  //
  // This is the belt-and-braces guard for the day somebody points both agents
  // at the same URL. Without it, an outbound call reaching here would: look up
  // callerLocale() on our own number and get the wrong language; open a SECOND
  // calls row for a conversation that already has one, keyed on ElevenLabs'
  // Twilio SID rather than the task_ correlation id everything else uses; and
  // — the dangerous one — return first_message: greeting(), which is applied
  // after the dispatch payload and would therefore overwrite the mandatory
  // outbound opening. Ana would ring a customer and say "Renovision AnA,
  // comment puis-je vous aider?", which is not merely wrong, it is a UTR 4(d)
  // identification failure on a call the customer did not place.
  //
  // Returning the bare envelope is the documented no-op: "omit any fields you
  // don't want to override rather than setting them to empty strings".
  // The agent id is the cleanest discriminator, and outboundDialer.ts now
  // dials with this same ELEVENLABS_OUTBOUND_AGENT_ID — one variable, checked
  // in both places, so the guard cannot drift from what was dialled. It is
  // still only as good as that variable being set, which is why the fallbacks
  // below stay: an unset id must not silently disable the guard.
  //
  // WE ARE THE CALLER is the one that always holds: on an inbound call
  // `caller_id` is the customer's number, and on a call we placed it is our
  // own. Unlike comparing `called_number`, this stays correct the day the
  // business adds a second line — a new inbound number changes what was
  // dialled, never who dialled.
  const agentId: string | undefined = body?.agent_id;
  const outboundAgentId = process.env.ELEVENLABS_OUTBOUND_AGENT_ID;
  const digits = (value: unknown): string =>
    typeof value === "string" ? value.replace(/\D/g, "") : "";
  const ourNumber = digits(SITE_PHONE_TEL);

  const outbound =
    (!!outboundAgentId && agentId === outboundAgentId) ||
    (!!ourNumber && digits(from) === ourNumber) ||
    // Our own correlation ids carry the task_ prefix, and nothing else mints
    // them; a real Twilio SID starts CA.
    (typeof callSid === "string" && callSid.startsWith("task_")) ||
    body?.mode === "outbound" ||
    body?.direction === "outbound";

  if (outbound) {
    console.info("[voice-el] initiation webhook fired for an OUTBOUND call — declining to override", {
      agentId,
      callSid,
    });
    return Response.json({ type: "conversation_initiation_client_data" });
  }

  // Have we spoken to this number before? If so, open in the language they
  // used last time and skip the "French or English?" question — asking a
  // regular the same thing on every call is exactly the kind of small friction
  // that makes an assistant feel like a phone tree. A caller we don't know
  // gets French with a bilingual offer, and whatever they answer becomes the
  // preference for next time, because /api/voice/el/chat writes the settled
  // locale back onto this call row.
  //
  // Best-effort: if the lookup fails or the database is unset we fall through
  // to the first-time path, which is always safe to serve.
  const known = await callerLocale(from).catch(() => null);
  const locale = known ?? ("fr" as const);

  if (callSid) {
    try {
      await startCall({
        callSid,
        from,
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
      agent: {
        first_message: greeting(locale, { askLanguage: known === null }),
        language: locale,
      },
    },
    // TWO channels carrying the same two facts, because they reach different
    // destinations and neither covers the other:
    //
    //   - custom_llm_extra_body is what ElevenLabs forwards to the Custom LLM
    //     on EVERY turn, arriving as `elevenlabs_extra_body` in the chat
    //     request. This is the only way /api/voice/el/chat learns which call
    //     it is speaking for and which number is on the line. Proven on a real
    //     call (2026-08-02): with only dynamic_variables set, every turn
    //     logged "no call_sid on this request", and owner mode refused the
    //     owner's own number and correct PIN — the number simply never
    //     arrived. The "Custom LLM extra body" toggle in the agent's Security
    //     tab was already on; the missing half was us not sending this field.
    //
    //   - dynamic_variables is what comes back on the POST-CALL webhook, which
    //     is how /api/voice/el/completed finds the calls row to close.
    //
    // caller_phone rides along for the same reason call_sid does: owner mode
    // checks the number against an allowlist before it will even consider a
    // PIN, and looking it up from Supabase instead would put a database read
    // back on the hot path of every turn — the exact thing that was taken off
    // it. Trustworthy to the same degree as call_sid: only ElevenLabs can
    // reach these routes (bearer secret / signed header), and it is echoing
    // what Twilio told it. A caller cannot influence either value.
    custom_llm_extra_body: { call_sid: callSid ?? null, caller_phone: from },
    dynamic_variables: { call_sid: callSid ?? null, caller_phone: from },
  });
}
