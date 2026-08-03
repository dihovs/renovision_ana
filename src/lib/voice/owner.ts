import crypto from "crypto";

/**
 * Recognising the owner on the phone.
 *
 * Ana normally talks to strangers. When the owner calls he wants the other
 * side of the business — how many leads came in, what's on the schedule, what
 * is owed — and that is company data being read aloud to whoever is holding
 * the phone. So this module exists to be paranoid on purpose.
 *
 * TWO FACTORS, BOTH REQUIRED:
 *   1. The call comes from a number on OWNER_PHONE_NUMBERS.
 *   2. The caller speaks the OWNER_VOICE_PIN.
 *
 * Neither is strong alone and it is worth being blunt about why. Caller ID is
 * trivially spoofable, so the allowlist is a filter, not proof. A PIN spoken
 * aloud can be overheard, and a voice is no longer evidence of anything given
 * how good cloning has become. Requiring both means an attacker needs to spoof
 * the right number *and* know the PIN, which is a meaningfully higher bar than
 * either alone — but this is deliberately gated to READ access and capturing
 * notes. Nothing in owner mode sends money, deletes records, emails a customer
 * or changes the public website, and that boundary is the actual security
 * control here. The auth is good enough for "read me today's numbers"; it is
 * not good enough to authorise anything irreversible, and it should not be
 * extended to cover that without a real second channel.
 *
 * Fails closed: if either environment variable is missing, owner mode simply
 * does not exist and Ana behaves like she does for any other caller.
 */

/** Wrong guesses allowed before owner mode is dead for the rest of the call. */
export const MAX_PIN_ATTEMPTS = 3;

/** Spelled-out digits, because ASR transcribes a spoken PIN either way. */
const SPOKEN_DIGITS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4",
  five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  zéro: "0", un: "1", une: "1", deux: "2", trois: "3",
  quatre: "4", cinq: "5", sept: "7", huit: "8", neuf: "9",
  // "six" is spelled identically in both languages and is already above.
  // "neuf" is only French; English "nine" is above.
};

function envList(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Digits only, from either "1234" or "one two three four". */
export function spokenDigits(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/);

  return words
    .map((w) => (/^\d+$/.test(w) ? w : (SPOKEN_DIGITS[w] ?? "")))
    .join("");
}

/**
 * Is this number allowed to *attempt* owner mode?
 *
 * Compared loosely on digits, because the same line shows up as "+15799903077"
 * from Twilio and as "5799903077" or "(579) 990-3077" when a human types it
 * into an env var. Only the last ten digits are compared, so a country-code
 * prefix on one side and not the other doesn't lock the owner out of his own
 * phone system.
 */
export function isOwnerNumber(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const allowed = envList("OWNER_PHONE_NUMBERS");
  if (allowed.length === 0) return false;

  const tail = (value: string) => value.replace(/\D/g, "").slice(-10);
  const callerTail = tail(phone);
  if (callerTail.length < 10) return false;

  return allowed.some((entry) => tail(entry) === callerTail);
}

/** True when owner mode is configured at all. */
export function ownerModeConfigured(): boolean {
  return Boolean(process.env.OWNER_VOICE_PIN) && envList("OWNER_PHONE_NUMBERS").length > 0;
}

/**
 * Does this utterance contain the PIN?
 *
 * Searched as a substring of the digits rather than matched exactly, because
 * the caller says "my code is four two four two", and the surrounding words
 * contribute nothing. Timing-safe on the candidate windows so the comparison
 * itself leaks nothing about how much of the PIN was right.
 */
export function utteranceHasOwnerPin(text: string): boolean {
  const pin = process.env.OWNER_VOICE_PIN;
  if (!pin) return false;

  const target = pin.replace(/\D/g, "");
  if (target.length < 4) {
    console.error("[voice-owner] OWNER_VOICE_PIN must be at least 4 digits — refusing to match");
    return false;
  }

  const heard = spokenDigits(text);
  if (heard.length < target.length) return false;

  const expected = Buffer.from(target);
  for (let i = 0; i + target.length <= heard.length; i++) {
    const window = Buffer.from(heard.slice(i, i + target.length));
    if (crypto.timingSafeEqual(window, expected)) return true;
  }
  return false;
}

/**
 * Strip the PIN out of anything on its way to storage.
 *
 * Call transcripts are written to Supabase and rendered in /admin/calls, so
 * without this every owner call would file the PIN in plaintext next to the
 * number it authenticates — the two things you least want stored together.
 * Any run of digits as long as the PIN is replaced, not just exact matches:
 * over-redacting a phone number in one owner-mode turn is a trivial cost, and
 * it means a mis-heard PIN doesn't leak the near-miss either.
 */
export function redactOwnerPin(text: string): string {
  const pin = process.env.OWNER_VOICE_PIN;
  if (!pin) return text;
  const width = pin.replace(/\D/g, "").length;
  if (width < 4) return text;

  const digitRun = new RegExp(`(?:\\d[\\s-]*){${width},}`, "g");
  return text.replace(digitRun, "[redacted]");
}

/**
 * Owner-mode auth state for one call.
 *
 * Rebuilt from the transcript on each turn rather than held in memory: the
 * route is a serverless function with no continuity between turns, and
 * ElevenLabs re-sends the whole conversation every time anyway. That also
 * means it cannot be forged by anything except the actual transcript.
 */
export type OwnerSession = {
  /** The caller's number is on the allowlist. Not yet authenticated. */
  eligible: boolean;
  /** Both factors satisfied — owner tools are available. */
  authenticated: boolean;
  /** Wrong PIN this many times; at MAX_PIN_ATTEMPTS owner mode is locked. */
  failedAttempts: number;
  lockedOut: boolean;
};

/**
 * Work out where this call stands, from the caller's number and everything
 * they have said so far.
 *
 * A failed attempt is any pre-authentication turn containing four or more
 * digits that aren't the PIN. That is a blunt rule and worth stating honestly:
 * an owner who reads a customer's phone number aloud three times *before*
 * giving his code would lock himself out. It is left blunt because the
 * alternative — guessing which utterances "look like" an auth attempt — is
 * exactly the kind of cleverness an attacker gets to probe, and because the
 * real flow puts the PIN in the first breath. Counting stops the moment the
 * PIN matches, so nothing said afterwards can lock an authenticated call.
 */
export function ownerSession(phone: string | null | undefined, callerTurns: string[]): OwnerSession {
  const eligible = ownerModeConfigured() && isOwnerNumber(phone);
  if (!eligible) {
    return { eligible: false, authenticated: false, failedAttempts: 0, lockedOut: false };
  }

  let failedAttempts = 0;
  for (const turn of callerTurns) {
    if (utteranceHasOwnerPin(turn)) {
      return { eligible, authenticated: true, failedAttempts, lockedOut: false };
    }
    // Four or more digits with no match reads as a failed attempt.
    if (spokenDigits(turn).length >= 4) failedAttempts++;
  }

  return {
    eligible,
    authenticated: false,
    failedAttempts,
    lockedOut: failedAttempts >= MAX_PIN_ATTEMPTS,
  };
}
