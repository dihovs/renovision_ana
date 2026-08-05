import crypto from "crypto";

/**
 * The credential the browser needs to place a call as the business.
 *
 * Twilio's Voice JS SDK authenticates with a short-lived Access Token — a
 * JWT signed with an API Key Secret — rather than with account credentials.
 * That distinction is the entire security model here: the token goes to the
 * browser, so it must be worth little if it leaks. This one grants exactly
 * one capability (place outgoing calls through one TwiML application), is
 * useless for reading call logs or spending money any other way, and expires
 * within the hour.
 *
 * HAND-ROLLED RATHER THAN THE `twilio` PACKAGE, for the reason outboundDialer.ts
 * gives about REST: the format is three base64url segments and an HMAC, it is
 * specified by Twilio and stable, and the alternative is a multi-megabyte
 * server SDK pulled in to produce one string. The browser half of this feature
 * genuinely needs @twilio/voice-sdk (it is WebRTC); the server half does not
 * need its sibling.
 *
 * INCOMING IS EXPLICITLY DISABLED. The grant below allows outgoing only, so a
 * leaked token cannot be used to register a rogue client that answers the
 * business's calls — which would be a far worse outcome than an unauthorised
 * outbound call, because it silently intercepts customers.
 */

/**
 * One hour, which is Twilio's maximum. Shorter would mean re-minting mid-call
 * for no security gain: the SDK holds the token for the life of the Device,
 * and a call already in progress is not re-authorised.
 */
const TTL_SECONDS = 3600;

export type TokenResult =
  | { ok: true; token: string; identity: string }
  | { ok: false; missing: string[] };

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Who the browser client is, to Twilio.
 *
 * A constant rather than something derived from the session, because there is
 * exactly one admin. If that ever stops being true this has to become
 * per-user: two browsers registering the same identity is a supported Twilio
 * configuration that would route an incoming call to whichever one Twilio
 * happens to pick, and the confusion that causes is hard to diagnose from the
 * symptoms.
 */
export const SOFTPHONE_IDENTITY = "renovision-admin";

/**
 * `issuedAt` is a parameter rather than a Date.now() call so the test can pin
 * it — every claim in the payload except the signature is derived from it.
 */
export function mintVoiceToken(issuedAt: number = Math.floor(Date.now() / 1000)): TokenResult {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim();
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim();
  const appSid = process.env.TWILIO_TWIML_APP_SID?.trim();

  const missing = [
    ["TWILIO_ACCOUNT_SID", accountSid],
    ["TWILIO_API_KEY_SID", apiKeySid],
    ["TWILIO_API_KEY_SECRET", apiKeySecret],
    ["TWILIO_TWIML_APP_SID", appSid],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name as string);
  if (missing.length > 0) return { ok: false, missing };

  // `cty` identifies this as a Twilio First-Party Auth token. Twilio rejects
  // the JWT without it, and the failure surfaces in the browser as a generic
  // connection error rather than anything that points here.
  const header = { typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" };

  const payload = {
    jti: `${apiKeySid}-${issuedAt}`,
    iss: apiKeySid,
    sub: accountSid,
    nbf: issuedAt,
    exp: issuedAt + TTL_SECONDS,
    grants: {
      identity: SOFTPHONE_IDENTITY,
      voice: {
        outgoing: { application_sid: appSid },
        // See the header. Not merely omitted — stated, so that reading this
        // file answers the question rather than leaving it to a default.
        incoming: { allow: false },
      },
    },
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = base64url(
    crypto.createHmac("sha256", apiKeySecret as string).update(signingInput).digest(),
  );

  return { ok: true, token: `${signingInput}.${signature}`, identity: SOFTPHONE_IDENTITY };
}
