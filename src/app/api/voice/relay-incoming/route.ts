import { publicUrl, readTwilioParams, verifyTwilioSignature, xmlEscape } from "@/lib/voice/twiml";

/**
 * The phone rings — ElevenLabs-voiced path.
 *
 * A separate route from /api/voice/incoming on purpose, not a flag on it:
 * cutover is a one-line change to the Twilio number's Voice URL, and rollback
 * is the same edit in reverse. Nothing about the turn-based path is touched.
 *
 * <Connect><ConversationRelay> hands the call to a WebSocket that stays open
 * for its whole duration. Vercel cannot host that socket — Route Handlers here
 * deploy as lambda functions, and per this fork's own docs
 * (node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md):
 * "WebSockets won't work because the connection closes on timeout, or after
 * the response is generated." That is exactly why the turn-based design
 * exists elsewhere in this codebase, and exactly why ConversationRelay needs
 * a small always-on bridge (see voice-relay/) instead of another Vercel route.
 * This endpoint's only job is the one thing Vercel is good at: answer one
 * HTTP request with TwiML that points the call at that bridge.
 *
 * Voice defaults to Twilio's documented fr-CA pairing (ElevenLabs voice
 * IPgYtHTNLjC7Bq7IPHrm, Google transcription) rather than a guessed voice ID —
 * this is the one Twilio ships as the default for fr-CA specifically. English
 * callers get the SAME voice identity, not a different one: the bridge sends
 * a `language` message mid-call to switch ttsLanguage/transcriptionLanguage
 * to en-US when detectLocale() flips, since there is no en-CA default and
 * swapping to a different-sounding voice mid-conversation would be stranger
 * than an ElevenLabs voice's own English accent.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FR_CA_VOICE_ID = "IPgYtHTNLjC7Bq7IPHrm";

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

  const relayUrl = process.env.RELAY_WS_URL;
  if (!relayUrl) {
    console.error("[voice-relay] RELAY_WS_URL is not set — cannot hand off the call");
    // Fail toward a real fallback, not a dead line: this apologises and hangs
    // up rather than leaving the caller connected to a socket that won't answer.
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="fr-CA">Désolée, un problème technique nous empêche de répondre. Rappelez dans quelques minutes.</Say><Hangup/></Response>`,
      { headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" } },
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><ConversationRelay url="${xmlEscape(relayUrl)}" ttsProvider="ElevenLabs" voice="${FR_CA_VOICE_ID}" language="fr-CA" transcriptionProvider="Google" interruptible="any" dtmfDetection="false"/></Connect></Response>`;

  return new Response(xml, {
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}
