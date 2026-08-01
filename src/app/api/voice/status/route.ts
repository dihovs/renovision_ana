import { endCall } from "@/lib/crm/calls";
import {
  publicUrl,
  readTwilioParams,
  verifyTwilioSignature,
} from "@/lib/voice/twiml";

/**
 * The call ended.
 *
 * Twilio posts here when the call completes, whatever the reason — hang-up,
 * failure, busy. Closing the transcript from this webhook rather than from the
 * conversation loop means a caller who simply hangs up mid-sentence still ends
 * with a closed record and a duration, instead of a row stuck at "in progress"
 * forever.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const params = await readTwilioParams(request);

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

  const callSid = params.CallSid;
  if (!callSid) return new Response(null, { status: 204 });

  const duration = Number(params.CallDuration);
  // Twilio's own vocabulary: completed, busy, failed, no-answer, canceled.
  // Anything that isn't "completed" is worth being able to filter for later.
  const twilioStatus = params.CallStatus ?? "completed";
  const status =
    twilioStatus === "completed"
      ? "completed"
      : twilioStatus === "failed"
        ? "failed"
        : "abandoned";

  await endCall(callSid, {
    status,
    durationSeconds: Number.isFinite(duration) ? duration : null,
  }).catch((err) => console.error("[voice] could not close the transcript:", err));

  // `null`, not `""`: 204 is a null-body status and the Response constructor
  // throws on any body at all, empty string included. That threw a 500 on every
  // completed call, which Twilio retries — and the transcript stayed open.
  return new Response(null, { status: 204 });
}
