import crypto from "crypto";

/**
 * TwiML helpers and Twilio request verification.
 *
 * The <Gather input="speech"> design is deliberate: each turn is one ordinary
 * HTTP request that lasts about as long as a Claude call, so nothing here holds
 * a socket open and nothing depends on a beta API. It costs some naturalness —
 * the caller cannot interrupt mid-sentence the way they could over a streamed
 * connection — and buys the ability to run the phone system on the same
 * infrastructure as the website, with no second host to keep alive.
 */

/** Escape for XML. A caller called "Marie & Sons" must not break the document. */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Twilio's own voices, so no third-party TTS is needed to get a call working.
 *
 * French is Amazon Polly's Gabrielle — a genuine fr-CA neural voice, and the
 * warmest of Twilio's built-ins for Québécois French; the Google Neural2
 * voice it replaces read like a kiosk. English stays on Google because Polly
 * has no Canadian-English neural voice and a US accent would be a worse trade.
 * The real fix is the ElevenLabs path (src/app/api/voice/el/*), which replaces
 * both; these are the best the <Say>-based fallback path can sound.
 */
const VOICE = "Polly.Gabrielle-Neural";
const VOICE_EN = "Google.en-CA-Neural2-A";

export function voiceFor(locale: "fr" | "en"): string {
  return locale === "fr" ? VOICE : VOICE_EN;
}

export function languageFor(locale: "fr" | "en"): string {
  return locale === "fr" ? "fr-CA" : "en-CA";
}

/**
 * Say something, then listen.
 *
 * `speechTimeout="auto"` lets Twilio decide the caller has stopped rather than
 * waiting a fixed number of seconds — the difference between a conversation and
 * an interrogation.
 */
/**
 * Domain vocabulary for the recogniser. Twilio's speech-to-text weights these
 * phrases up, which is the difference between hearing "dégât d'eau" and
 * hearing "des gars dodo". Both languages in one list because Quebec callers
 * switch mid-sentence. Twilio caps hints at 500 characters.
 */
const SPEECH_HINTS = [
  "dégât d'eau", "infiltration d'eau", "sous-sol", "salle de bain", "cuisine",
  "plancher", "gypse", "moisissure", "rénovation", "soumission", "estimation",
  "chauffe-eau", "refoulement", "plafond", "fuite", "Laval", "Montréal",
  "water damage", "basement", "bathroom", "kitchen", "flooring", "drywall",
  "mold", "renovation", "estimate", "leak", "ceiling", "water heater",
].join(", ");

export function sayAndGather(options: {
  text: string;
  locale: "fr" | "en";
  action: string;
  /** Ends the call politely instead of listening again. */
  hangUpAfter?: boolean;
}): string {
  const voice = voiceFor(options.locale);
  const language = languageFor(options.locale);
  const say = `<Say voice="${voice}" language="${language}">${xmlEscape(options.text)}</Say>`;

  if (options.hangUpAfter) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response>${say}<Hangup/></Response>`;
  }

  // speechModel="phone_call" enhanced="true" is Google's premium telephony
  // recogniser — tuned for exactly this audio, and the only model that also
  // honours the hints list. The default model was mishearing callers until
  // they repeated themselves louder, which is the one thing a distressed
  // caller should never have to do.
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="speech" language="${language}" speechTimeout="auto" speechModel="phone_call" enhanced="true" hints="${xmlEscape(SPEECH_HINTS)}" action="${xmlEscape(options.action)}" method="POST"><Say voice="${voice}" language="${language}">${xmlEscape(options.text)}</Say></Gather><Redirect method="POST">${xmlEscape(options.action)}?silent=1</Redirect></Response>`;
}

export function twimlResponse(xml: string): Response {
  return new Response(xml, {
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * Verify the request really came from Twilio.
 *
 * These endpoints are public by necessity — Twilio has to be able to reach them
 * — so the signature is the only thing standing between the phone system and
 * anyone who guesses the URL. Without it, a stranger could POST fabricated
 * turns and fill the transcript table with whatever they liked.
 *
 * Twilio signs the full URL plus the POST body's sorted key/value pairs.
 * https://www.twilio.com/docs/usage/security#validating-signatures
 */
export function verifyTwilioSignature(options: {
  signature: string | null;
  /**
   * The URL to verify against, or every URL it could legitimately have been
   * signed as — see publicUrlVariants() for why more than one is both
   * necessary and safe.
   */
  url: string | string[];
  params: Record<string, string>;
  authToken: string | undefined;
}): boolean {
  if (!options.authToken) {
    // Refuse rather than default open. An unverifiable endpoint that accepts
    // anything is worse than one that accepts nothing.
    console.error("[voice] TWILIO_AUTH_TOKEN is not set — rejecting the request");
    return false;
  }
  if (!options.signature) return false;

  // Trimmed, because the token arrives here from an env var that was pasted
  // into a dashboard by a human, and a single invisible trailing newline
  // changes every HMAC this function will ever compute. The token itself can
  // never legitimately contain whitespace, so trimming cannot turn a wrong
  // key into a right one — it can only stop a right key from failing.
  const authToken = options.authToken.trim();

  const candidates = Array.isArray(options.url) ? options.url : [options.url];
  const provided = Buffer.from(options.signature.trim());
  const sortedKeys = Object.keys(options.params).sort();

  for (const candidate of candidates) {
    const payload = sortedKeys.reduce((acc, key) => acc + key + options.params[key], candidate);
    const expected = Buffer.from(
      crypto.createHmac("sha1", authToken).update(Buffer.from(payload, "utf-8")).digest("base64"),
    );
    // Length check first: timingSafeEqual throws on a mismatch rather than
    // returning false.
    if (expected.length === provided.length && crypto.timingSafeEqual(expected, provided)) {
      return true;
    }
  }

  // Everything a failure needs to be diagnosed from the log alone, and not one
  // character of the secret. The three token fields answer the question this
  // line exists for — "is the configured token malformed, or simply the wrong
  // token?": a live Twilio auth token is exactly 32 hex characters, so
  // length 32 + hex true + whitespace false means the token is WELL-FORMED and
  // wrong (copied from another account, or from Test credentials — the Twilio
  // console shows both and the test one signs nothing real), while anything
  // else means the paste itself is damaged. Without this line the only symptom
  // is a bare 403 and a caller hearing "an application error has occurred" —
  // which is exactly how long this took to diagnose the first time.
  console.error("[voice] Twilio signature did not match any candidate URL", {
    candidates,
    paramCount: sortedKeys.length,
    tokenLength: authToken.length,
    tokenIsHex32: /^[0-9a-f]{32}$/i.test(authToken),
    tokenHadWhitespace: authToken !== options.authToken,
  });
  return false;
}

/** Form-encoded body to a plain object, as Twilio posts it. */
export async function readTwilioParams(request: Request): Promise<Record<string, string>> {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }
  return params;
}

/**
 * The URL Twilio signed.
 *
 * Behind Vercel's proxy the request URL reports the internal host, and a
 * signature computed over the wrong host never matches. The forwarded headers
 * are what Twilio actually dialled.
 */
export function publicUrl(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) {
    url.host = host;
    url.protocol = `${proto}:`;
  }
  return url.toString();
}

/**
 * Every URL this request could legitimately have been signed as.
 *
 * WHY THIS EXISTS. Twilio computes its signature over the URL *configured in
 * the console*, character for character — not over the URL the request finally
 * arrives at. When the two spellings of our own domain disagree, the HMAC does
 * too, and the endpoint returns 403 to a genuinely authentic Twilio request.
 * That is not hypothetical: it is what made the softphone answer every call
 * with "we are sorry, an application error has occurred" on 2026-08-09. The
 * console had one spelling, `publicUrl()` reconstructed the other, and the
 * only visible symptom was a bare 403 with no message.
 *
 * THIS DOES NOT WEAKEN THE CHECK, and that is worth being precise about. The
 * signature is an HMAC keyed on the auth token; the URL is only part of the
 * signed payload, never a credential. Offering two candidate spellings of a
 * host WE ALREADY SERVE lets in nobody who could not already forge the HMAC —
 * an attacker's problem is the key, and the key has not moved. What it removes
 * is a purely cosmetic reason to reject a real Twilio request.
 *
 * Deliberately limited to the www/apex pair and the two schemes, rather than
 * anything clever. `http://` is in the list for the same reason the apex is:
 * a URL typed into the console without the "s" is signed exactly as typed,
 * redirected to https by the CDN, and fails identically. Every candidate is a
 * spelling of THIS deployment; a wildcard, or anything derived from a
 * caller-supplied header other than the proxy's own host, would be a
 * different thing entirely and must not be added here.
 *
 * The real request's own spelling is always first, so the common case costs
 * one HMAC and the rest are never computed.
 */
export function publicUrlVariants(request: Request): string[] {
  const primary = publicUrl(request);
  const url = new URL(primary);
  const hosts = [
    url.hostname,
    url.hostname.startsWith("www.") ? url.hostname.slice(4) : `www.${url.hostname}`,
  ];

  const candidates: string[] = [];
  for (const protocol of [url.protocol, url.protocol === "https:" ? "http:" : "https:"]) {
    for (const hostname of hosts) {
      const variant = new URL(primary);
      variant.protocol = protocol;
      variant.hostname = hostname;
      const href = variant.toString();
      if (!candidates.includes(href)) candidates.push(href);
    }
  }
  return candidates;
}
