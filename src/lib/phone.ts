/**
 * Phone numbers, as text.
 *
 * CLIENT-SAFE ON PURPOSE, and that is why this module exists at all. The strict
 * normaliser below used to live in crm/callScheduler.ts, which imports the
 * Supabase client — so the admin's dial pad could not reach it without dragging
 * a database driver into the browser bundle. It is pure string work and belongs
 * somewhere both sides can import.
 *
 * The dial pad validating with the SAME function the server dials with is the
 * point: anything the pad lights up as callable is a number the TwiML route
 * will accept, so "Call" never goes dark on a number that would have worked,
 * and never lights up on one that would fail after the click.
 *
 * NOTE — there is a second, looser toE164 in lib/sms/send.ts. It is not this
 * one and the difference is real: that one accepts +1055…, this one rejects it
 * as the typo it is. Merging them means deciding whether texting should be as
 * strict as calling, which is a question about SMS deliverability rather than a
 * cleanup, so it is left alone rather than changed in passing.
 */

/**
 * A phone string turned into E.164, or null.
 *
 * Null is a real answer and the caller must treat it as one: the call-task
 * migration's check constraint would reject anything else anyway, and a task
 * that fails to insert at 3am is a customer who never got their call and
 * nobody who knows.
 *
 * Deliberately strict for +1. The generic E.164 shape accepts `+1055...`, which
 * is a typo rather than a number; the NANP rule that neither the area code nor
 * the exchange may start with 0 or 1 catches it before it becomes a failed
 * call. Anything with an extension is treated as unreachable — an automated
 * call cannot navigate a switchboard, and dialling the main line and announcing
 * somebody's renovation to whoever answers is exactly the disclosure failure
 * branch B2 exists to prevent.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;
  if (/(?:\bext\b|\bx\b|poste|#)\s*\d/i.test(text)) return null;

  const plus = text.startsWith("+");
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;

  let candidate: string;
  if (plus) candidate = `+${digits}`;
  else if (digits.length === 10) candidate = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith("1")) candidate = `+${digits}`;
  else return null;

  // Same shape the migration's check constraint enforces.
  if (!/^\+[1-9][0-9]{7,14}$/.test(candidate)) return null;
  if (candidate.startsWith("+1") && !/^\+1[2-9][0-9]{2}[2-9][0-9]{6}$/.test(candidate)) return null;
  return candidate;
}

/* ══════════════════════════════════════════════════════════════════════════
 * The dial pad
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * The twelve keys, with the letters printed under them.
 *
 * The letters are not decoration: customers read numbers off vans and
 * business cards as words, and a pad without them means translating
 * 1-800-RENOVATE by hand before dialling.
 */
export const KEYPAD: ReadonlyArray<{ key: string; letters: string }> = [
  { key: "1", letters: "" },
  { key: "2", letters: "ABC" },
  { key: "3", letters: "DEF" },
  { key: "4", letters: "GHI" },
  { key: "5", letters: "JKL" },
  { key: "6", letters: "MNO" },
  { key: "7", letters: "PQRS" },
  { key: "8", letters: "TUV" },
  { key: "9", letters: "WXYZ" },
  { key: "*", letters: "" },
  { key: "0", letters: "+" },
  { key: "#", letters: "" },
];

/**
 * Long enough for the longest E.164 number plus the punctuation someone might
 * paste around it. A cap at all exists so a stuck key cannot grow the string
 * without bound behind a pad that only shows the tail.
 */
const MAX_LENGTH = 20;

const DIALABLE_KEY = /^[0-9*#+]$/;

/**
 * Add one keypress, returning the new number.
 *
 * `+` is accepted only as the first character, because that is the only place
 * it means anything — E.164 has exactly one, at the front. Silently dropping
 * it elsewhere beats inserting a character that guarantees the number will not
 * dial.
 */
export function appendKey(current: string, key: string): string {
  if (!DIALABLE_KEY.test(key)) return current;
  if (key === "+" && current.length > 0) return current;
  if (current.length >= MAX_LENGTH) return current;
  return current + key;
}

/** Rub out the last keypress. */
export function backspace(current: string): string {
  return current.slice(0, -1);
}

/**
 * Whatever was pasted, reduced to the characters a pad can hold.
 *
 * People paste numbers out of emails and CRM fields with spaces, dashes,
 * brackets and the odd non-breaking space in them. Stripping on the way in
 * means the display formatter below only ever sees digits.
 */
export function sanitisePasted(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return (plus + trimmed.replace(/[^0-9*#]/g, "")).slice(0, MAX_LENGTH);
}

/**
 * The number as it should read on the display while being typed.
 *
 * Formats progressively — brackets appear as soon as the area code is complete
 * rather than only once the number is whole — because the point is to let him
 * catch a wrong digit at the moment he types it, not after ten of them.
 *
 * Anything carrying * or # is left exactly as entered: those are dial codes,
 * and NANP grouping applied to *67 would be nonsense.
 */
export function formatDialed(raw: string): string {
  if (!raw) return "";
  if (/[*#]/.test(raw)) return raw;

  const plus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;

  if (plus) {
    // +1 followed by a full NANP number is worth grouping; every other country
    // code has its own conventions and guessing wrong is worse than not trying.
    if (digits.startsWith("1") && digits.length === 11) return `+1 ${groupNanp(digits.slice(1))}`;
    return `+${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) return `+1 ${groupNanp(digits.slice(1))}`;
  if (digits.length > 10) return digits;
  return groupNanp(digits);
}

/** (514) 555-0188, and every partial state on the way there. */
function groupNanp(digits: string): string {
  if (digits.length <= 3) return digits;
  const area = digits.slice(0, 3);
  const exchange = digits.slice(3, 6);
  const line = digits.slice(6, 10);
  if (digits.length <= 6) return `(${area}) ${exchange}`;
  return `(${area}) ${exchange}-${line}`;
}

/** Would this actually dial? The Call button's enabled state, and nothing else. */
export function isDialable(raw: string): boolean {
  return toE164(raw) !== null;
}
