import { findClientForPhone } from "@/lib/sms/attribution";
import {
  clearOptOut,
  isStartRequest,
  isStopRequest,
  recordInbound,
  recordOptOut,
  toE164,
} from "@/lib/sms/send";
import { storeInboundMedia } from "@/lib/sms/media";
import { notifyNewMessage } from "@/lib/notify/owner";
import { publicUrlVariants, readTwilioParams, verifyTwilioSignature } from "@/lib/voice/twiml";

/**
 * Somebody texted the business number.
 *
 * Two jobs, in this order, and the order is the whole design:
 *
 *   1. If it is a withdrawal of consent, honour it BEFORE anything else can
 *      fail. CASL s.11(2) allows ten business days; that is a ceiling for
 *      businesses processing paperwork, not a target for a system that can do
 *      it in one statement. Written first means a later crash cannot leave us
 *      having received "STOP" and done nothing with it.
 *   2. Store the message so it is readable in the admin.
 *
 * Always answers 200, even when the body is unparseable or the handler throws.
 * A non-2xx makes Twilio retry, and a retry cannot fix a malformed request — it
 * just produces the same failure again, plus a duplicate if the first attempt
 * had already half-succeeded. Same reasoning as the WhatsApp webhook.
 *
 * The reply is an empty TwiML document rather than no body at all: Twilio reads
 * the response as instructions, and an empty <Response/> is how you say "I have
 * this, send nothing back". A missing body logs a warning on their side.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function twiml(): Response {
  return new Response(EMPTY_TWIML, {
    status: 200,
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  let params: Record<string, string>;
  try {
    params = await readTwilioParams(request);
  } catch {
    // Unparseable. Nothing to act on and nothing a retry would improve.
    return twiml();
  }

  if (
    !verifyTwilioSignature({
      signature: request.headers.get("x-twilio-signature"),
      url: publicUrlVariants(request),
      params,
      authToken: process.env.TWILIO_AUTH_TOKEN,
    })
  ) {
    // The one case that is NOT 200: an unsigned request is not from Twilio,
    // and there is no retry to protect.
    return new Response("Forbidden", { status: 403 });
  }

  const from = toE164(params.From ?? null);
  const body = (params.Body ?? "").trim();
  const hasMedia = Number(params.NumMedia ?? "0") > 0;

  if (!from) {
    console.error("[sms] inbound message with no usable From", { sid: params.MessageSid });
    return twiml();
  }

  try {
    // FIRST, and deliberately before the message is stored.
    if (isStopRequest(body)) {
      await recordOptOut(from, body);
      console.info("[sms] opt-out recorded", { sid: params.MessageSid });
    } else if (isStartRequest(body)) {
      await clearOptOut(from);
      console.info("[sms] opt-out cleared on an explicit start", { sid: params.MessageSid });
    }

    // Pictures first, then the row, so the message is never stored claiming
    // to have media it does not have. Slow — Twilio has to serve each file —
    // but this handler always answers 200 anyway, and a retry would only
    // re-download what already arrived.
    const mediaPaths = hasMedia ? await storeInboundMedia(params) : [];
    if (hasMedia && mediaPaths.length === 0) {
      // Worth saying out loud: the customer sent a photo and we have the
      // text without it, which is exactly the failure that looked like
      // "MMS doesn't work".
      console.error("[sms] inbound media could not be stored", {
        sid: params.MessageSid,
        count: params.NumMedia,
      });
    }

    // Looked up once and used twice: the row wants the id, the notification
    // wants the name, and asking the same question twice would double the
    // work on a handler that already waits on Twilio for every photo.
    const attributed = await findClientForPhone(from).catch(() => null);

    await recordInbound({
      phone: from,
      body,
      clientId: attributed?.id ?? null,
      providerSid: params.MessageSid ?? null,
      mediaPaths,
    });
  } catch (err) {
    // Logged, not retried. See the note at the top.
    console.error("[sms] could not handle an inbound message:", err);
  }

  return twiml();
}
