/**
 * The number a customer reads back to Ana.
 *
 * The estimator hands one out at the end of a chat; the caller says it over the
 * phone; Ana looks it up and says where the request stands. That round trip —
 * screen to mouth to microphone to database — is what dictates every choice
 * here, and it rules out the obvious candidates.
 *
 * NOT THE UUID. `leads.id` is `gen_random_uuid()`, which nobody can read aloud
 * and no speech-to-text will survive intact.
 *
 * NOT SEQUENTIAL. A counter would be shorter still, and it would publish the
 * business's lead volume to anyone who requested two estimates a week apart.
 * Random costs nothing here and leaks nothing.
 *
 * DIGITS ONLY, AND THIS IS THE SUBTLE ONE. Letters look friendlier in
 * "RVA-4K2P", and they are a liability on a bilingual phone line: the French
 * and English names for E, I, G and J collide with each other across the two
 * languages, and the caller is reading to a machine. Digits are the one
 * alphabet that transcribes the same in both.
 *
 * SIX OF THEM, first never zero. Six is short enough to say in one breath and
 * gives 900,000 values. A leading zero is dropped by people the moment they
 * say a number out loud, so the space starts at 100000 rather than pretending
 * 042913 will come back with its zero attached.
 *
 * On guessability: 900,000 values, guessed one at a time by voice, against a
 * reply that discloses only that a request exists and someone will call. There
 * is no name, address, price or phone number in what Ana says — see
 * estimateStatus.ts, where that restraint is the actual protection. The number
 * keeps honest callers out of each other's business; it is not a password and
 * nothing behind it is worth one.
 */

/** How many digits a reference has. */
export const REFERENCE_DIGITS = 6;

/** What the customer sees on screen and in the confirmation email. */
export function formatReference(reference: string): string {
  return `RVA-${reference}`;
}

/**
 * A fresh reference. Uniqueness is the caller's problem — `saveLead` retries on
 * the unique constraint, which is the only check that is actually free of races.
 */
export function generateReference(random: () => number = Math.random): string {
  const min = 10 ** (REFERENCE_DIGITS - 1); // 100000 — never a leading zero
  const max = 10 ** REFERENCE_DIGITS - 1; // 999999
  return String(min + Math.floor(random() * (max - min + 1)));
}

/**
 * Pull a reference out of something a person said.
 *
 * Transcription of a spoken number is not one shape, it is several: "482913",
 * "4 8 2 9 1 3", "482 913", "RVA 482913", and — because the estimator prints
 * the prefix — sometimes "R V A 4 8 2 9 1 3". Digits are joined back together
 * before anything is matched, which collapses all of those into one string.
 *
 * THE FALSE POSITIVE THAT MATTERS is a phone number. Ten digits contain five
 * different six-digit windows, so "514-555-0188" would otherwise read as a
 * reference every time somebody left a callback number — and the intake asks
 * for one on nearly every call. Any run of 7 or more digits is therefore not a
 * reference and disqualifies the whole utterance: a caller saying their phone
 * number is not asking about an estimate, and guessing wrong here means Ana
 * announces a stranger's request to them.
 */
export function parseSpokenReference(text: string): string | null {
  const said = (text ?? "").trim();
  if (!said) return null;

  // Join digits that were transcribed apart: "4 8 2 9 1 3" and "482 913" both
  // become "482913". Only separators BETWEEN digits collapse, so "7144 rue" and
  // a following number stay two runs rather than fusing into one long one.
  const joined = said.replace(/(\d)[\s.\-‑–]+(?=\d)/g, "$1");

  const runs = joined.match(/\d+/g);
  if (!runs) return null;

  // A phone number, a postal code with digits, a year and a dimension all live
  // in the same sentence as a reference might. Anything longer than a reference
  // is one of those, and its presence means this utterance is not a lookup.
  if (runs.some((run) => run.length > REFERENCE_DIGITS)) return null;

  const hits = runs.filter((run) => run.length === REFERENCE_DIGITS);
  // Two candidates and there is no way to tell which one was meant, so ask
  // rather than pick. One is the only unambiguous case.
  if (hits.length !== 1) return null;

  const found = hits[0];
  // A leading zero means it was never one of ours — generateReference cannot
  // produce it — and quietly accepting it would send a wrong number to the
  // database as though it were plausible.
  if (found.startsWith("0")) return null;

  return found;
}
