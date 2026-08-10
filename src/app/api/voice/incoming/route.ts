import { startCall } from "@/lib/crm/calls";
import { greeting } from "@/lib/voice/agent";
import {
  publicUrlVariants,
  readTwilioParams,
  sayAndGather,
  twimlResponse,
  verifyTwilioSignature,
} from "@/lib/voice/twiml";

/**
 * The phone rings.
 *
 * Twilio POSTs here, we greet the caller and start listening. The transcript
 * row is created now so that even a call that drops after one word leaves a
 * record with a number on it — a missed call you can return is worth more than
 * a clean database.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const params = await readTwilioParams(request);

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

  // French default: the site's default language is French and this is Laval.
  // The agent switches the moment the caller answers in English.
  const locale = "fr" as const;
  const callSid = params.CallSid;

  if (callSid) {
    // Failing soft: if the database is unreachable the customer still gets a
    // working phone line, and the transcript is what we lose rather than the
    // call.
    try {
      await startCall({
        callSid,
        from: params.From,
        to: params.To,
        locale,
      });
    } catch (err) {
      console.error("[voice] could not open the transcript:", err);
    }
  }

  return twimlResponse(
    sayAndGather({
      text: greeting(locale),
      locale,
      action: "/api/voice/turn",
    }),
  );
}
