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

/** Twilio's own voices, so no third-party TTS is needed to get a call working. */
const VOICE = "Google.fr-CA-Neural2-A";
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

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="speech" language="${language}" speechTimeout="auto" action="${xmlEscape(options.action)}" method="POST"><Say voice="${voice}" language="${language}">${xmlEscape(options.text)}</Say></Gather><Redirect method="POST">${xmlEscape(options.action)}?silent=1</Redirect></Response>`;
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
  url: string;
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

  const payload = Object.keys(options.params)
    .sort()
    .reduce((acc, key) => acc + key + options.params[key], options.url);

  const expected = crypto
    .createHmac("sha1", options.authToken)
    .update(Buffer.from(payload, "utf-8"))
    .digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(options.signature);
  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
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

/** Detect the caller's language from what they said, to switch mid-call. */
export function detectLocale(text: string, current: "fr" | "en"): "fr" | "en" {
  const normalised = text.toLowerCase();
  // Function words rather than content words: "the" and "le" identify a
  // language far more reliably than any renovation vocabulary, which is full
  // of shared borrowings ("drywall", "gyproc", "condo").
  const french = (normalised.match(/\b(je|j'ai|c'est|le|la|les|une|des|dans|pour|avec|mon|ma|est|sont|qui|pas|oui|bonjour|merci)\b/g) ?? []).length;
  const english = (normalised.match(/\b(i|the|a|is|are|my|and|with|for|in|it|that|yes|hello|thanks|have|got)\b/g) ?? []).length;

  // A clear margin is required to switch. One borrowed word should not flip a
  // French conversation into English mid-sentence.
  if (french >= english + 2) return "fr";
  if (english >= french + 2) return "en";
  return current;
}
