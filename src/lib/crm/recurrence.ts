import type { RecurrenceFrequency } from "./opsTypes";

/**
 * Occurrence generation for recurring visits.
 *
 * Pure calendar math, no database. The one rule everything below serves:
 * occurrences are stepped in America/Toronto WALL-CLOCK time and only then
 * converted to UTC instants. Adding 7×86400 seconds to an instant looks the
 * same until the clocks change, at which point every future visit silently
 * shifts an hour — the exact bug the visits table's timestamptz comment warns
 * about.
 */

const TZ = "America/Toronto";

/**
 * Never more than this many visits from one pattern, whatever the end date
 * says. Twenty-six is half a year of weekly visits — far enough ahead to plan
 * around, close enough that a typo'd end date in 2035 doesn't bury the
 * schedule. Saving the pattern again later simply extends the horizon.
 */
export const GENERATION_CAP = 26;

/** A clock-on-the-wall reading in Toronto, no timezone attached. */
type WallTime = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
};

/** What a UTC instant reads as on a Toronto wall clock. */
function wallInToronto(instant: Date): WallTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/**
 * The UTC instant at which a Toronto wall clock shows this time.
 *
 * Guess-and-correct: pretend the wall time is UTC, see what that instant reads
 * as in Toronto, shift by the difference, and check once more (the second pass
 * catches a guess that landed on the wrong side of a DST switch). A wall time
 * that doesn't exist — the skipped hour in spring — lands one hour later,
 * which is what a person rebooking around the change would do anyway.
 */
function torontoWallToUtc(wall: WallTime): Date {
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  let ts = asUtc;
  for (let i = 0; i < 2; i++) {
    const seen = wallInToronto(new Date(ts));
    const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    ts += asUtc - seenAsUtc;
  }
  return new Date(ts);
}

/** Whole days between two wall dates, ignoring the time of day. */
function wallDayDelta(from: WallTime, to: WallTime): number {
  const a = Date.UTC(from.year, from.month - 1, from.day);
  const b = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((b - a) / 86_400_000);
}

/**
 * The n-th occurrence's wall date, always computed FROM THE ANCHOR rather than
 * from the previous occurrence. Monthly is why: stepping Jan 31 → Feb 28 →
 * Mar 28 drifts and never comes back, whereas "the 31st, clamped per month"
 * gives Jan 31, Feb 28, Mar 31.
 */
function occurrenceWall(anchor: WallTime, frequency: RecurrenceFrequency, n: number): WallTime {
  if (frequency === "monthly") {
    const total = anchor.month - 1 + n;
    const year = anchor.year + Math.floor(total / 12);
    const month = (total % 12) + 1;
    // Day 0 of the following month is the last day of this one.
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { ...anchor, year, month, day: Math.min(anchor.day, daysInMonth) };
  }

  const step = frequency === "weekly" ? 7 : 14;
  // Date.UTC normalises day overflow, so this is pure calendar addition.
  const d = new Date(Date.UTC(anchor.year, anchor.month - 1, anchor.day + n * step));
  return { ...anchor, year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function wallDateKey(w: WallTime): string {
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

export type Occurrence = { startsAt: Date; endsAt: Date | null };

/**
 * Every future occurrence of a pattern, as UTC instants ready for the visits
 * table.
 *
 * The anchor itself is occurrence zero and is NOT returned — it already exists
 * as the visit the pattern was anchored on. Occurrences that fall before `now`
 * are skipped rather than generated: back-filling a schedule with visits that
 * were never booked would instantly read as a wall of "overdue".
 */
export function generateOccurrences(input: {
  anchorStartsAt: Date;
  anchorEndsAt: Date | null;
  frequency: RecurrenceFrequency;
  /** Last Toronto calendar day allowed (yyyy-mm-dd), or null for cap-only. */
  untilDate: string | null;
  now?: Date;
}): Occurrence[] {
  const now = input.now ?? new Date();
  const startWall = wallInToronto(input.anchorStartsAt);
  const endWall = input.anchorEndsAt ? wallInToronto(input.anchorEndsAt) : null;
  // An end the following wall day (rare, but a 22:00–02:00 shift is legal)
  // keeps its day offset on every occurrence.
  const endDayOffset = endWall ? wallDayDelta(startWall, endWall) : 0;

  const out: Occurrence[] = [];
  // Hard iteration bound so an anchor years in the past cannot spin forever
  // while skipping elapsed occurrences: 500 weekly steps is nearly a decade.
  for (let n = 1; n <= 500 && out.length < GENERATION_CAP; n++) {
    const wall = occurrenceWall(startWall, input.frequency, n);
    if (input.untilDate && wallDateKey(wall) > input.untilDate) break;

    const startsAt = torontoWallToUtc(wall);
    if (startsAt.getTime() <= now.getTime()) continue;

    let endsAt: Date | null = null;
    if (endWall) {
      const endDate = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + endDayOffset));
      endsAt = torontoWallToUtc({
        year: endDate.getUTCFullYear(),
        month: endDate.getUTCMonth() + 1,
        day: endDate.getUTCDate(),
        hour: endWall.hour,
        minute: endWall.minute,
      });
    }

    out.push({ startsAt, endsAt });
  }

  return out;
}
