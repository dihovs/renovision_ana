import { SITE_PHONE_TEL } from "@/lib/constants";
import { toE164 } from "@/lib/sms/send";
import { publicUrl, readTwilioParams, verifyTwilioSignature } from "@/lib/voice/twiml";

/**
 * What Twilio should do when the admin's browser places a call.
 *
 * The TwiML Application configured in the Twilio console points its Voice URL
 * here. The browser calls `device.connect({ params: { To } })`, Twilio POSTs
 * those params to this route, and the document returned below is what bridges
 * the browser leg to the customer's phone.
 *
 * THE callerId LINE IS THE WHOLE FEATURE. Without it the customer sees
 * "client:renovision-admin" or an anonymous number; with it they see the
 * company. It is hardcoded from SITE_PHONE_TEL rather than taken from the
 * request, and that is deliberate — a caller ID accepted from the client would
 * let anyone who reached this endpoint spoof any number Twilio has verified.
 *
 * SIGNATURE-VERIFIED, so this cannot be driven by anyone but Twilio. That
 * matters more here than on a webhook that only records something: this one
 * spends money. It is also why the response never echoes anything back on
 * failure — a 403 is the whole answer.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function say(message: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="en-CA">${message}</Say></Response>`,
    { status: 200, headers: { "content-type": "text/xml; charset=utf-8" } },
  );
}

/**
 * Both numbers are E.164 by this point, so this should never alter a
 * character. It exists for the day something upstream widens — an unescaped
 * quote here would be an injected TwiML verb.
 */
function xmlAttr(value: string): string {
  return value.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export async function POST(request: Request) {
  let params: Record<string, string>;
  try {
    params = await readTwilioParams(request);
  } catch {
    return say("Sorry, that call could not be set up.");
  }

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

  const to = toE164(params.To ?? null);
  if (!to) {
    console.error("[voice-softphone] no dialable number on the request");
    // Spoken rather than silent: the owner is holding a headset waiting for a
    // ring, and dead air tells him nothing about what went wrong.
    return say("Sorry, that number could not be dialled. Please check it and try again.");
  }

  const business = toE164(process.env.SMS_FROM_NUMBER?.trim() || SITE_PHONE_TEL);
  if (!business) return say("Sorry, the business number is not configured.");

  // answerOnBridge so he hears a real ringback instead of silence, and the
  // customer's leg is not billed as answered before they pick up. record is
  // left off deliberately — Quebec is a one-party-consent province, but Ana
  // announces recording on her calls and these are not announced, so recording
  // them would be a promise the business has not made.
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Response><Dial answerOnBridge="true" callerId="${xmlAttr(business)}" timeout="30">` +
      `<Number>${xmlAttr(to)}</Number></Dial></Response>`,
    { status: 200, headers: { "content-type": "text/xml; charset=utf-8" } },
  );
}
