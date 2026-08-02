import crypto from "crypto";

/**
 * Authenticating the relay bridge, not Twilio.
 *
 * /api/voice/relay/* is never called by Twilio directly — only by the small
 * always-on WebSocket bridge that Twilio's ConversationRelay talks to (Vercel
 * cannot host that connection itself; see the comment in relay-incoming's
 * route for why). So this is not a Twilio-signature check, just a shared
 * secret both sides hold, same shape as CRON_SECRET elsewhere in this repo.
 */
export function verifyRelaySecret(request: Request): boolean {
  const secret = process.env.RELAY_SHARED_SECRET;
  if (!secret) {
    console.error("[voice-relay] RELAY_SHARED_SECRET is not set — refusing the request");
    return false;
  }

  const header = request.headers.get("x-relay-secret");
  if (!header) return false;

  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
