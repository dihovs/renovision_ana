import { torontoWallToUtc, wallInToronto } from "./recurrence";

/**
 * The shared vocabulary of the conversion chain.
 *
 *   lead → client → job → visit → invoice
 *
 * Each hop is a one-click promotion of one record into the next. They were
 * written at different times and behaved differently — one returned a bare id
 * and silently handed back an existing row, another created a duplicate every
 * time it was pressed. This module is the contract they now all keep:
 *
 *   1. EVERY conversion returns a `ConversionResult`. Never a bare id, because
 *      the caller has to be able to tell "I made this" from "this already
 *      existed" in order to say so on screen.
 *
 *   2. EVERY conversion is idempotent or refused, never half-applied. Pressing
 *      a button twice on a phone with a slow connection is the normal case, not
 *      the edge case. Where a second press can safely mean "show me the one you
 *      already made", it does. Where it cannot — the counterpart is archived,
 *      the source is in the wrong state, the money would come out different —
 *      it throws `ConversionRefused` with a sentence the owner can act on.
 *
 *   3. EVERY refusal is loud. There is no path here that quietly produces a
 *      different number, a second invoice, or a job nobody agreed to.
 */

/**
 * What a conversion hands back.
 *
 * `created: false` is not a failure. It means the target already existed and is
 * being returned unchanged — the second tap of a double tap, or an operator
 * pressing "convert" on something that was converted last week. The caller is
 * expected to say which of the two happened.
 */
export type ConversionResult = {
  id: string;
  created: boolean;
};

export const CONVERSION_REFUSALS = [
  /** The source record isn't there. */
  "not_found",
  /** Converted already, and the existing target cannot simply be handed back. */
  "already_converted",
  /** The source is in a state this conversion is not allowed to act on. */
  "wrong_status",
  /** There is no money on the record, so there is nothing to bill. */
  "nothing_to_bill",
  /** The figures would not come out the same as the document they came from. */
  "totals_diverged",
  /** The request itself is malformed — a 150% deposit, a date in the past. */
  "bad_request",
] as const;

export type ConversionRefusal = (typeof CONVERSION_REFUSALS)[number];

/**
 * A conversion that will not happen, with a reason a non-programmer can read.
 *
 * Separate from a plain Error so the action layer can tell "the owner asked for
 * something that isn't allowed" (show the message, stay on the page) from "the
 * database fell over" (a real fault). Both surface as text either way; the
 * distinction matters for logging, not for the customer.
 */
export class ConversionRefused extends Error {
  readonly refusal: ConversionRefusal;

  constructor(refusal: ConversionRefusal, message: string) {
    super(message);
    this.name = "ConversionRefused";
    this.refusal = refusal;
  }
}

/** Throw a refusal. Returns `never`, so it narrows types at the call site. */
export function refuse(refusal: ConversionRefusal, message: string): never {
  throw new ConversionRefused(refusal, message);
}

export function isConversionRefused(err: unknown): err is ConversionRefused {
  return err instanceof ConversionRefused;
}

/**
 * 23505, unique_violation — the database refusing a second conversion.
 *
 * Every guard here is checked in application code first AND backed by a partial
 * unique index in migration 0019, because a read-then-insert has a window: two
 * taps a few hundred milliseconds apart both read "no job yet" and both insert.
 * The index closes that window; this is how the loser of the race recognises
 * what happened and goes back to read the winner's row.
 */
export function isDuplicateKey(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ((error as { code?: string }).code === "23505") return true;
  const message = (error as { message?: string }).message ?? "";
  return /duplicate key value|violates unique constraint/i.test(message);
}

/**
 * True when the failure is "that column doesn't exist yet".
 *
 * Migrations here are applied by hand, so a deploy routinely runs against a
 * schema one file behind. `isMissingTable` in db.ts covers a whole table;
 * 0019 adds a single column (`clients.lead_id`), and everything that writes it
 * has to fall back to the pre-0019 behaviour rather than break lead conversion
 * until somebody remembers to run the file.
 *
 * PGRST204 is PostgREST failing to find a column in its schema cache; 42703 is
 * Postgres' own undefined_column, which surfaces on a filter rather than an
 * insert.
 */
export function isMissingColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  if (code === "PGRST204" || code === "42703") return true;
  const message = (error as { message?: string }).message ?? "";
  return /could not find the '.*' column|column .* does not exist/i.test(message);
}

// ---------------------------------------------------------------------------
// What a conversion action hands back to the screen
// ---------------------------------------------------------------------------

/**
 * The one shape every conversion action returns.
 *
 * Returned rather than thrown, and that is not a style preference. Next masks
 * the message of an error thrown out of a server action in production and
 * replaces it with a generic digest — so a thrown `ConversionRefused` would
 * reach the owner as "an error occurred", which is precisely the silent failure
 * every guard in this module exists to prevent. Coming back as data, the
 * sentence survives.
 *
 * `ok` carries the "nothing to do" case: pressing convert on something already
 * converted is a success worth a different sentence.
 */
export type ConversionState = { error?: string; ok?: string };

/**
 * Turn whatever went wrong into something the owner can read.
 *
 * A refusal is a decision and says so in its own words. Anything else is a
 * fault: it gets the caller's plain-language fallback on screen and the real
 * message in the log, where it is useful and not alarming.
 */
export function conversionError(err: unknown, fallback: string): ConversionState {
  if (isConversionRefused(err)) return { error: err.message };
  console.error(`[conversions] ${fallback}`, err);
  return { error: err instanceof Error && err.message ? err.message : fallback };
}

// ---------------------------------------------------------------------------
// The default arrival window
// ---------------------------------------------------------------------------

/**
 * When a one-click scheduled visit lands.
 *
 * 08:00–12:00 is the morning window the crew already works to, and it is a
 * WINDOW rather than an appointment on purpose: a renovation crew arrives
 * somewhere in a four-hour band, and promising 08:00 exactly is a promise that
 * gets broken by the first traffic jam on the 15.
 *
 * This is a starting point the owner edits, not a rule. The value of the button
 * is that the common case — "book them in for tomorrow morning" — costs one
 * tap instead of three form fields.
 */
export const ARRIVAL_WINDOW = { startHour: 8, endHour: 12 } as const;

/** 0 = Sunday … 6 = Saturday, from a wall date rather than an instant. */
function weekdayOf(wall: { year: number; month: number; day: number }): number {
  return new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay();
}

/**
 * The next day the crew works, as a Toronto calendar date.
 *
 * Strictly after today: "next working day" said at 07:00 on a Tuesday means
 * Wednesday, not "later this morning". Somebody who wants today picks the date
 * by hand.
 *
 * Weekends only. Statutory holidays are deliberately NOT skipped — the holiday
 * table in callTasks.ts exists to stop the dialer telephoning people on Good
 * Friday, which is a legal constraint, whereas whether this crew works the
 * Saint-Jean is a fact about this business that nobody has told the system. A
 * default that is one tap wrong twice a year beats a default that is confidently
 * wrong about the owner's calendar.
 */
export function nextWorkingDay(now: Date = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const today = wallInToronto(now);
  // Date.UTC normalises the day overflow, so this is plain calendar addition.
  for (let step = 1; step <= 7; step++) {
    const d = new Date(Date.UTC(today.year, today.month - 1, today.day + step));
    const candidate = {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
    };
    const weekday = weekdayOf(candidate);
    if (weekday !== 0 && weekday !== 6) return candidate;
  }
  // Unreachable: any seven consecutive days contain a weekday.
  throw new Error("Could not find a working day in the next week");
}

/**
 * The default visit for the one-click scheduler, as UTC instants.
 *
 * Built as a Toronto wall time and converted, never as `Date.now() + 86400000`.
 * Adding a day's worth of milliseconds is an hour wrong for the two weeks after
 * each clock change, and an hour wrong on a schedule means a crew ringing a
 * doorbell at seven in the morning.
 */
export function nextWorkingDayWindow(now: Date = new Date()): {
  startsAt: string;
  endsAt: string;
} {
  const day = nextWorkingDay(now);
  const startsAt = torontoWallToUtc({ ...day, hour: ARRIVAL_WINDOW.startHour, minute: 0 });
  const endsAt = torontoWallToUtc({ ...day, hour: ARRIVAL_WINDOW.endHour, minute: 0 });
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}
