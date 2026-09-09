import { SOFTPHONE_IDENTITY } from "@/lib/voice/accessToken";
import { ownerMobile } from "@/lib/voice/bridge";
import { SITE_PHONE_TEL } from "@/lib/constants";
import { publicUrlVariants, readTwilioParams, verifyTwilioSignature } from "@/lib/voice/twiml";
import { toE164 } from "@/lib/sms/send";

/**
 * The line of last resort.
 *
 * Built the night Ana went silent for reasons that had nothing to do with
 * this codebase: ElevenLabs' own subscription payment failed, so their side
 * accepted every call and dropped it a second later — /api/voice/el/init
 * answered 200 all three times; /api/voice/el/chat was never once reached.
 * Nothing here could have caught that, because the number is imported
 * natively into ElevenLabs (Provider: Twilio, on their phone-numbers page) —
 * they own the Voice URL, not us, and their own number settings have no
 * fallback/forwarding field at all. There was no code path to intercept.
 *
 * WHAT THIS BUYS: a phone that still rings SOMEWHERE the moment Ana can't be
 * reached, without waiting on a customer complaint to find out. It requires
 * one manual step, on purpose — see the runbook below — rather than silent
 * automatic failover, because failover that nobody knows fired is how a
 * business finds out three weeks later that half its calls went nowhere.
 *
 * RINGS BOTH AT ONCE: the admin softphone (if the tab is open and the Device
 * is registered — /admin/phone) and the owner's own mobile, from bridge.ts's
 * existing ownerMobile(). Whichever answers first wins; an unregistered
 * Client leg fails instantly rather than hanging the dial, so leaving it in
 * costs nothing on a day nobody has the admin open.
 *
 * ═══════════════════════ THE MANUAL SWITCH ═══════════════════════
 * Twilio Console → Phone Numbers → Manage → Active Numbers →
 * +1 579-999-5979 → Voice Configuration → "A call comes in" →
 * Webhook → https://www.renovisionana.ca/api/voice/fallback → Save.
 *
 * Twilio owns the number account-side regardless of who last configured its
 * Voice URL, so this always works — it does not need ElevenLabs' cooperation
 * or even a working ElevenLabs account. To switch back once the real problem
 * is fixed: re-open the number in ElevenLabs' phone-numbers page and reassign
 * the agent — that is what set the webhook the first time, and setting it
 * again should retake it. NOT verified against a live outage; the day this
 * is actually used, confirm the switch-back landed rather than assuming it.
 * ═══════════════════════════════════════════════════════════════════
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function xmlAttr(value: string): string {
  return value.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function say(message: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="en-CA">${message}</Say></Response>`,
    { status: 200, headers: { "content-type": "text/xml; charset=utf-8" } },
  );
}

export async function POST(request: Request) {
  let params: Record<string, string>;
  try {
    params = await readTwilioParams(request);
  } catch {
    return say("Sorry, that call could not be connected.");
  }

  if (
    !verifyTwilioSignature({
      signature: request.headers.get("x-twilio-signature"),
      url: publicUrlVariants(request),
      params,
      authToken: process.env.TWILIO_AUTH_TOKEN,
    })
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const business = toE164(process.env.SMS_FROM_NUMBER?.trim() || SITE_PHONE_TEL);
  const mine = ownerMobile();

  // Ring whatever exists rather than refuse the call outright. A Client leg
  // alone (no OWNER_MOBILE / OWNER_PHONE_NUMBERS set) still reaches the admin
  // softphone if it happens to be open — better than nothing on a line that
  // by definition has already failed once tonight.
  if (!mine && !business) {
    console.error("[voice-fallback] nothing to ring — no owner mobile and no business caller ID");
    return say("Sorry, no one is available to take this call right now.");
  }

  const legs =
    `<Client>${xmlAttr(SOFTPHONE_IDENTITY)}</Client>` + (mine ? `<Number>${xmlAttr(mine)}</Number>` : "");

  // answerOnBridge: a real ringback while both legs are tried, not dead air
  // the caller assumes is a dropped call — the last thing this line needs
  // tonight is to feel like it failed a second time.
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Response><Dial answerOnBridge="true" timeout="25"${
        business ? ` callerId="${xmlAttr(business)}"` : ""
      }>${legs}</Dial></Response>`,
    { status: 200, headers: { "content-type": "text/xml; charset=utf-8" } },
  );
}
