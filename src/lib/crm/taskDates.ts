/**
 * Reading a due date out of a typed task.
 *
 * The point of the task bar is that a note costs one line of typing, and
 * "order the membrane for Thursday" is how that line actually gets typed —
 * nobody stops to open a date picker for a reminder. So the trailing date
 * phrase is parsed out of the sentence.
 *
 * Parsing dates out of free text is guessing, and guessing silently is the
 * failure mode: "call Monday Plumbing about the leak" must not quietly become
 * a task due next Monday. Three things keep that honest.
 *
 *   1. Only the END of the string is considered. A date phrase people mean as
 *      a deadline is the last thing they type; one in the middle is part of a
 *      name.
 *   2. The caller SHOWS what was parsed, as a chip, before the task is saved,
 *      and can clear it — see TaskBar. A visible guess is a correctable one.
 *   3. Bare weekday and month-day forms must be introduced by a preposition
 *      ("for Thursday", "pour jeudi") unless they are the whole input. "Monday
 *      Plumbing" therefore never parses at all, and neither does a task that
 *      merely happens to end in a weekday.
 *
 * Everything here is pure and takes `today` as an argument. Montreal's
 * calendar, not the server's — the caller passes the date it wants the answer
 * relative to, and tests can pass any day they like.
 */

/** Both languages the office works in, since he types in whichever is closer. */
const WEEKDAYS: Record<string, number> = {
  sunday: 0, dimanche: 0,
  monday: 1, lundi: 1,
  tuesday: 2, mardi: 2,
  wednesday: 3, mercredi: 3,
  thursday: 4, jeudi: 4,
  friday: 5, vendredi: 5,
  saturday: 6, samedi: 6,
};

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, janvier: 1,
  february: 2, feb: 2, fevrier: 2, fev: 2,
  march: 3, mar: 3, mars: 3,
  april: 4, apr: 4, avril: 4, avr: 4,
  may: 5, mai: 5,
  june: 6, jun: 6, juin: 6,
  july: 7, jul: 7, juillet: 7, juil: 7,
  august: 8, aug: 8, aout: 8,
  september: 9, sep: 9, sept: 9, septembre: 9,
  october: 10, oct: 10, octobre: 10,
  november: 11, nov: 11, novembre: 11,
  december: 12, dec: 12, decembre: 12,
};

const TODAY_WORDS = new Set(["today", "aujourdhui", "aujourd'hui"]);
const TOMORROW_WORDS = new Set(["tomorrow", "demain"]);

/**
 * Words that mark what follows as a deadline rather than a subject. `le`/`la`
 * are in here for "le 14 août"; they read oddly in English but only ever
 * appear immediately before something that already parsed as a date.
 */
const PREPOSITIONS = new Set(["for", "by", "on", "due", "before", "pour", "avant", "le", "la", "d'ici", "dici"]);

/**
 * Strip accents so "août" and "aout" are the same word — he types both, and
 * on a phone keyboard the accent is the one that gets skipped.
 *
 * Matched by Unicode property rather than a literal combining-mark range:
 * spelled out, a bare accent inside a character class is invisible in a diff
 * and one careless editor pass silently empties the class. `\p{M}` is plain
 * ASCII in the source and says what it means.
 */
function fold(word: string): string {
  return word
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** Midnight UTC for an ISO date, so day arithmetic never crosses a DST seam. */
function utc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = utc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** Real calendar day count, so "31 February" is rejected rather than rolled. */
function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * The next time this weekday comes round, never today.
 *
 * "Thursday" said on a Thursday means the one coming, not the one you are
 * standing in — by the time you are typing a reminder, today's Thursday is
 * already half spent.
 */
function nextWeekday(today: string, target: number): string {
  const current = utc(today).getUTCDay();
  const ahead = (target - current + 7) % 7;
  return addDays(today, ahead === 0 ? 7 : ahead);
}

/**
 * A month/day with no year, resolved to the next time it occurs.
 *
 * Typing "aug 14" in December means next August, and typing it on August 20th
 * means next year too. Today itself still counts as this year — a task due
 * today is an ordinary thing to write down.
 */
function resolveMonthDay(today: string, month: number, day: number): string | null {
  const year = utc(today).getUTCFullYear();
  for (const candidate of [year, year + 1]) {
    if (!isRealDate(candidate, month, day)) continue;
    const iso = `${candidate}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (iso >= today) return iso;
  }
  return null;
}

export type ParsedTask = {
  /** The note with the date phrase removed. Never empty if the input wasn't. */
  body: string;
  /** ISO `YYYY-MM-DD`, or null when nothing at the end read as a date. */
  dueDate: string | null;
};

/**
 * Split a typed line into the note and its due date.
 *
 * Returns the whole line as the body when no trailing date is found, which is
 * the common case and the safe one.
 */
export function parseTaskInput(input: string, today: string): ParsedTask {
  const raw = input.trim();
  if (!raw) return { body: "", dueDate: null };

  // Tokenised on whitespace, keeping the original spelling so the body can be
  // rebuilt exactly as typed minus the part that was consumed.
  const words = raw.split(/\s+/);

  // Longest match wins, so "14 august" is preferred over the bare "august"
  // that would otherwise match on its own and leave a stray number behind.
  for (const take of [3, 2, 1]) {
    if (take >= words.length + 1) continue;
    const tail = words.slice(words.length - take).map(fold);
    const dueDate = matchTail(tail, today);
    if (!dueDate) continue;

    let rest = words.slice(0, words.length - take);

    // "for Thursday" — drop the preposition too, so the body doesn't trail
    // off mid-phrase. Also the gate on bare forms: a weekday or month-day with
    // no preposition in front of it and words before it is a name, not a
    // deadline, and is left in the text.
    const lead = rest.length > 0 ? fold(rest[rest.length - 1]).replace(/[,;:]+$/, "") : null;
    if (lead !== null && PREPOSITIONS.has(lead)) {
      rest = rest.slice(0, -1);
    } else if (rest.length > 0 && needsPreposition(tail)) {
      continue;
    }

    const body = rest.join(" ").replace(/[\s,;:–—-]+$/, "").trim();
    // Never hand back an empty note. "Thursday" alone is a task called
    // Thursday, not a date with nothing attached to it.
    if (!body) return { body: raw, dueDate: null };
    return { body, dueDate };
  }

  return { body: raw, dueDate: null };
}

/**
 * Forms ambiguous enough to require a preposition when they follow other
 * words. `today`/`tomorrow` and an explicit ISO date are never anything but a
 * date, so they are exempt; a weekday or a month name can be part of a
 * company, street or person's name.
 */
function needsPreposition(tail: string[]): boolean {
  if (tail.length === 1) {
    const word = tail[0].replace(/[.,;:!?]+$/, "");
    if (TODAY_WORDS.has(word) || TOMORROW_WORDS.has(word)) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(word)) return false;
  }
  return true;
}

/** The date, if these trailing words are one. */
function matchTail(tail: string[], today: string): string | null {
  const clean = tail.map((word) => word.replace(/[.,;:!?]+$/, "")).filter(Boolean);
  if (clean.length !== tail.length) {
    // Trailing punctuation only — re-run on the cleaned words.
    if (clean.length === 0) return null;
  }

  if (clean.length === 1) {
    const word = clean[0];
    if (TODAY_WORDS.has(word)) return today;
    if (TOMORROW_WORDS.has(word)) return addDays(today, 1);
    if (word in WEEKDAYS) return nextWeekday(today, WEEKDAYS[word]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(word)) {
      const [y, m, d] = word.split("-").map(Number);
      return isRealDate(y, m, d) ? word : null;
    }
    return null;
  }

  if (clean.length === 2) {
    // "aug 14" and "14 aout" both happen, depending on which language the
    // sentence started in.
    const [first, second] = clean;
    const monthFirst = monthDay(first, second);
    if (monthFirst) return resolveMonthDay(today, monthFirst.month, monthFirst.day);
    const dayFirst = monthDay(second, first);
    if (dayFirst) return resolveMonthDay(today, dayFirst.month, dayFirst.day);
    // "next thursday" / "jeudi prochain" mean the same as the bare weekday —
    // the next one — so they resolve identically rather than skipping a week,
    // which is what people mean and what they would be annoyed to be wrong about.
    if ((first === "next" || first === "prochain") && second in WEEKDAYS) {
      return nextWeekday(today, WEEKDAYS[second]);
    }
    if ((second === "next" || second === "prochain") && first in WEEKDAYS) {
      return nextWeekday(today, WEEKDAYS[first]);
    }
    return null;
  }

  if (clean.length === 3) {
    // "august 14 2026" and "14 aout 2026".
    const [a, b, c] = clean;
    if (!/^\d{4}$/.test(c)) return null;
    const year = Number(c);
    const parsed = monthDay(a, b) ?? monthDay(b, a);
    if (!parsed) return null;
    if (!isRealDate(year, parsed.month, parsed.day)) return null;
    return `${year}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
  }

  return null;
}

function monthDay(monthWord: string, dayWord: string): { month: number; day: number } | null {
  const month = MONTHS[monthWord];
  if (!month) return null;
  // "14th" as well as "14" — an ordinal suffix is normal typing.
  const match = dayWord.match(/^(\d{1,2})(st|nd|rd|th|er|e)?$/);
  if (!match) return null;
  const day = Number(match[1]);
  if (day < 1 || day > 31) return null;
  return { month, day };
}

/**
 * How a due date reads on screen: "today", "tomorrow", "overdue", or a short
 * date. Rendered from two ISO strings rather than a Date so the server and the
 * browser cannot disagree about what day it is and blow up hydration.
 */
export function describeDue(dueDate: string, today: string, locale: "en" | "fr" = "en"): {
  label: string;
  overdue: boolean;
} {
  if (dueDate < today) {
    const label = locale === "fr" ? "En retard" : "Overdue";
    return { label, overdue: true };
  }
  if (dueDate === today) return { label: locale === "fr" ? "Aujourd'hui" : "Today", overdue: false };
  if (dueDate === addDays(today, 1)) {
    return { label: locale === "fr" ? "Demain" : "Tomorrow", overdue: false };
  }

  const date = utc(dueDate);
  // Within the week, the weekday alone is the most readable thing to show.
  const withinAWeek = dueDate <= addDays(today, 6);
  const options: Intl.DateTimeFormatOptions = withinAWeek
    ? { weekday: "long", timeZone: "UTC" }
    : { month: "short", day: "numeric", timeZone: "UTC" };

  return {
    label: date.toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", options),
    overdue: false,
  };
}
