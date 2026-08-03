import { randomUUID } from "node:crypto";
// adadConsent imports CallTaskKind back from here, but only as a type, so the
// cycle is erased at compile time and there is none at runtime.
import { CONSENT_REFUSAL_MESSAGE, requiresExpressConsent } from "./adadConsent";
import { consentVerdictFor } from "./consentStore";
import { db, isMissingTable } from "./db";

/**
 * The outbound call queue (migration 0018).
 *
 * Ana already answers the phone; this is the model behind her placing it. The
 * schema is the contract — every type here mirrors a column, every check
 * constraint has a matching union, and nothing invents a field the table does
 * not have.
 *
 * Three properties this module exists to guarantee:
 *
 *   1. **Two overlapping cron runs cannot dial the same person twice.**
 *      `claimDueCallTasks` is a compare-and-swap, not a read-then-write. See
 *      the comment on that function for exactly what Postgres is doing.
 *
 *   2. **A call that must not be placed is not placed.** `canDialNow` is pure,
 *      exhaustively tested, and returns a machine-readable refusal. It is the
 *      function that keeps this feature legal; see
 *      Docs/Voice-Outbound-Compliance.md §10.
 *
 *   3. **A missing migration costs the call, never the process.** Migrations
 *      here are run by hand. Until 0018 has been applied the table does not
 *      exist, and every function reports `migration_pending` rather than
 *      throwing — same convention as src/lib/crm/tasks.ts.
 *
 * There is deliberately no solicitation kind and no way to add one at runtime:
 * the three notification kinds below are the whole vocabulary, and the reason
 * is written at the top of the migration.
 */

// ---------------------------------------------------------------------------
// Types — one per constrained column in 0018_call_tasks.sql
// ---------------------------------------------------------------------------

/**
 * `kind text not null check (kind in (...))`.
 *
 * The first three are notifications: they service an appointment the recipient
 * already has with us and contain no promotion, which is what keeps them
 * outside the CRTC's telemarketing rules.
 *
 * `business_intro` (migration 0021) is the exception and is not like the
 * others. An introduction is solicitation, so it is an ADAD telemarketing call
 * and needs express consent for that specific number before it may be queued
 * OR dialled. `requiresExpressConsent` in adadConsent.ts is the boundary; do
 * not add a fourth notification-shaped kind that happens to mention what we
 * sell without walking past it first.
 */
export type CallTaskKind = "confirm_visit" | "crew_on_way" | "schedule_change" | "business_intro";

/** `status text not null default 'queued' check (status in (...))`. */
export type CallTaskStatus = "queued" | "dialing" | "done" | "failed" | "cancelled";

/** `outcome text check (outcome in (...))` — set when the call ends. */
export type CallOutcome =
  | "reached_confirmed"
  | "reached_declined"
  | "reached_reschedule_requested"
  | "reached_unresolved"
  | "reached_third_party"
  | "voicemail_left"
  | "voicemail_no_message"
  | "no_answer"
  | "wrong_number"
  | "opt_out_requested"
  | "failed";

/** One row of public.call_tasks, column for column. */
export type CallTask = {
  id: string;
  created_at: string;
  updated_at: string;
  kind: CallTaskKind;
  visit_id: string | null;
  job_id: string | null;
  client_id: string | null;
  to_number: string;
  locale: "fr" | "en";
  payload: Record<string, unknown>;
  status: CallTaskStatus;
  not_before: string;
  attempts: number;
  max_attempts: number;
  last_attempt_at: string | null;
  call_sid: string | null;
  conversation_id: string | null;
  outcome: CallOutcome | null;
  outcome_detail: Record<string, unknown>;
  completed_at: string | null;
  error: string | null;
};

/**
 * Why a call-task operation did not happen.
 *
 * Four values rather than one because they want four different responses:
 * `unconfigured` is a deployment problem, `migration_pending` is a one-command
 * fix the owner performs himself, `duplicate` is the unique index in 0018 doing
 * its job (a second confirmation for the same visit is not an error), and
 * `failed` is worth a look at the logs.
 */
export type CallTaskFailure = {
  ok: false;
  reason: "unconfigured" | "migration_pending" | "duplicate" | "failed" | "no_consent";
  detail?: string;
};

export type CallTaskWriteResult = { ok: true; task: CallTask } | CallTaskFailure;
export type CallTaskListResult = { ok: true; tasks: CallTask[] } | CallTaskFailure;
export type CallTaskUpdateResult = { ok: true; changed: number } | CallTaskFailure;

/** Every column, so a claim or a list hands back a complete row. */
const COLUMNS =
  "id, created_at, updated_at, kind, visit_id, job_id, client_id, to_number, locale, payload, " +
  "status, not_before, attempts, max_attempts, last_attempt_at, call_sid, conversation_id, " +
  "outcome, outcome_detail, completed_at, error";

/** Mirrors the `to_number` CHECK, so a bad number is a typed result not a 400. */
const E164 = /^\+[1-9][0-9]{7,14}$/;

function fail(error: { code?: string; message?: string } | null, what: string): CallTaskFailure {
  if (isMissingTable(error)) {
    console.warn(`[callTasks] call_tasks is missing — run supabase/migrations/0018_call_tasks.sql`);
    return { ok: false, reason: "migration_pending" };
  }
  if (error?.code === "23505") return { ok: false, reason: "duplicate" };
  console.error(`[callTasks] ${what}:`, error?.message);
  return { ok: false, reason: "failed", detail: error?.message };
}

// ---------------------------------------------------------------------------
// Correlation
// ---------------------------------------------------------------------------

/**
 * Our own key for the conversation, minted BEFORE the call is placed.
 *
 * ElevenLabs' outbound endpoint wants `conversation_initiation_client_data` in
 * the same request that returns the Twilio SID, so the SID cannot be the
 * correlation id — it does not exist yet. We mint one instead and pass it in
 * both `dynamic_variables` and `custom_llm_extra_body`, which means every
 * existing extraction path keyed on `call_sid` keeps working unchanged.
 *
 * The `task_` prefix exists so nobody reading the database mistakes it for a
 * Twilio SID (those start `CA`). Dashes are stripped because the value travels
 * through a dynamic-variable substitution.
 */
export function mintCallSid(): string {
  return `task_${randomUUID().replace(/-/g, "")}`;
}

// ---------------------------------------------------------------------------
// America/Toronto wall-clock arithmetic
// ---------------------------------------------------------------------------

const TZ = "America/Toronto";

/**
 * A clock-on-the-wall reading in Toronto.
 *
 * Everything about calling hours is expressed in these, never in UTC offsets.
 * Toronto changes offset twice a year; `now.getUTCHours() - 4` is correct for
 * seven months and silently an hour wrong for five. `Intl` knows the rules.
 */
export type TorontoWall = {
  year: number;
  /** 1-12. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Minutes since local midnight — what the calling window compares against. */
  minutesOfDay: number;
  /** YYYY-MM-DD, for same-calendar-day comparisons. */
  dateKey: string;
};

const WALL_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** What a UTC instant reads as on a Toronto wall clock. */
export function torontoWall(instant: Date): TorontoWall {
  const parts = WALL_FORMAT.formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  return {
    year,
    month,
    day,
    hour,
    minute,
    // Derived from the calendar date rather than read as a locale string: a
    // weekday name would have to be parsed, and Date.UTC on the *wall* date
    // gives the right answer regardless of the offset that produced it.
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    minutesOfDay: hour * 60 + minute,
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

/**
 * The UTC instant at which a Toronto wall clock shows this time.
 *
 * Guess-and-correct, the same technique as src/lib/crm/recurrence.ts: pretend
 * the wall time is UTC, see what that instant reads as in Toronto, shift by the
 * difference, then check once more — the second pass catches a first guess that
 * landed on the wrong side of a DST switch.
 *
 * A wall time that does not exist — the hour skipped each March — settles an
 * hour *before* the one asked for rather than throwing. Nothing in this module
 * ever asks for one: the only wall times converted here are the window's open
 * and close, 09:00, 10:00, 17:00 and 20:00, none of which Toronto has ever
 * skipped. The behaviour is documented so the next caller knows what they get.
 */
export function torontoWallToUtc(wall: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): Date {
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  let ts = asUtc;
  for (let i = 0; i < 2; i++) {
    const seen = torontoWall(new Date(ts));
    const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    ts += asUtc - seenAsUtc;
  }
  return new Date(ts);
}

// ---------------------------------------------------------------------------
// The calling window
// ---------------------------------------------------------------------------

/** Minutes since midnight, exclusive of `close`. `null` means never. */
export type DialWindow = { open: number; close: number } | null;

/**
 * The house calling window, in America/Toronto local time.
 *
 * **This is deliberately tighter than the law.** CRTC UTR Part IV rule 4(b)
 * permits 09:00–21:30 on weekdays and 10:00–18:00 at weekends, and Quebec adds
 * nothing more restrictive that I could find. We stop at 20:00 on weekdays,
 * 17:00 on Saturdays, and never call on a Sunday, because a renovation company
 * telephoning a customer at 21:15 on a Sunday is legal and is still a bad phone
 * call. See Docs/Voice-Outbound-Compliance.md §6.
 *
 * Indexed by `Date.getUTCDay()` semantics: 0 = Sunday … 6 = Saturday. One named
 * table rather than literals scattered through the eligibility checks, so the
 * owner can widen or narrow it in one place and the tests still mean something.
 */
export const CALLING_WINDOW: readonly DialWindow[] = [
  null, // Sunday — never.
  { open: 9 * 60, close: 20 * 60 }, // Monday
  { open: 9 * 60, close: 20 * 60 }, // Tuesday
  { open: 9 * 60, close: 20 * 60 }, // Wednesday
  { open: 9 * 60, close: 20 * 60 }, // Thursday
  { open: 9 * 60, close: 20 * 60 }, // Friday
  { open: 10 * 60, close: 17 * 60 }, // Saturday
];

// ---------------------------------------------------------------------------
// Quebec statutory holidays
// ---------------------------------------------------------------------------

type HolidayRule =
  | { kind: "fixed"; month: number; day: number }
  | { kind: "easter"; offsetDays: number }
  | { kind: "nthWeekday"; month: number; weekday: number; n: number }
  | { kind: "weekdayBefore"; month: number; day: number; weekday: number };

/**
 * The Quebec statutory holidays, as rules rather than dates so the table does
 * not age out. Kept small on purpose — this is a "do not telephone people"
 * list, not a payroll calendar.
 *
 * Good Friday and Easter Monday are both here even though an employer only owes
 * one of them: which one Renovision AnA observes is irrelevant to whether a
 * customer wants the phone to ring, and blocking both costs at most one call a
 * year. December 26 and January 2 are *not* statutory in Quebec and are not
 * listed; if the owner wants them off, they belong here and nowhere else.
 */
export const QUEBEC_STATUTORY_HOLIDAYS: ReadonlyArray<{ name: string; rule: HolidayRule }> = [
  { name: "Jour de l'An", rule: { kind: "fixed", month: 1, day: 1 } },
  { name: "Vendredi saint", rule: { kind: "easter", offsetDays: -2 } },
  { name: "Lundi de Pâques", rule: { kind: "easter", offsetDays: 1 } },
  // The Monday preceding May 25 — Journée nationale des patriotes.
  { name: "Journée nationale des patriotes", rule: { kind: "weekdayBefore", month: 5, day: 25, weekday: 1 } },
  { name: "Fête nationale du Québec", rule: { kind: "fixed", month: 6, day: 24 } },
  { name: "Fête du Canada", rule: { kind: "fixed", month: 7, day: 1 } },
  { name: "Fête du Travail", rule: { kind: "nthWeekday", month: 9, weekday: 1, n: 1 } },
  { name: "Action de grâce", rule: { kind: "nthWeekday", month: 10, weekday: 1, n: 2 } },
  { name: "Noël", rule: { kind: "fixed", month: 12, day: 25 } },
];

/** Easter Sunday (Gregorian), Meeus/Jones/Butcher. */
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return { month: Math.floor(n / 31), day: (n % 31) + 1 };
}

function dateKey(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month - 1, day));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

function resolveHoliday(rule: HolidayRule, year: number): string {
  switch (rule.kind) {
    case "fixed":
      return dateKey(year, rule.month, rule.day);
    case "easter": {
      const easter = easterSunday(year);
      return dateKey(year, easter.month, easter.day + rule.offsetDays);
    }
    case "nthWeekday": {
      const first = new Date(Date.UTC(year, rule.month - 1, 1)).getUTCDay();
      const offset = (rule.weekday - first + 7) % 7;
      return dateKey(year, rule.month, 1 + offset + (rule.n - 1) * 7);
    }
    case "weekdayBefore": {
      const anchor = new Date(Date.UTC(year, rule.month - 1, rule.day)).getUTCDay();
      // Strictly before: an anchor that already falls on the weekday steps back
      // a full week, which is what "the Monday preceding May 25" means.
      const back = ((anchor - rule.weekday + 6) % 7) + 1;
      return dateKey(year, rule.month, rule.day - back);
    }
  }
}

const holidayCache = new Map<number, Map<string, string>>();

function holidaysFor(year: number): Map<string, string> {
  let cached = holidayCache.get(year);
  if (!cached) {
    cached = new Map();
    for (const { name, rule } of QUEBEC_STATUTORY_HOLIDAYS) {
      cached.set(resolveHoliday(rule, year), name);
    }
    holidayCache.set(year, cached);
  }
  return cached;
}

/** The holiday falling on this Toronto calendar day, or null. Exported for tests. */
export function quebecHolidayOn(wall: Pick<TorontoWall, "year" | "dateKey">): string | null {
  return holidaysFor(wall.year).get(wall.dateKey) ?? null;
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/**
 * Why we are not dialling. Machine-readable so the cron can decide when to try
 * again without parsing English, and so the admin can show a badge.
 */
export type DialRefusalReason =
  | "do_not_call"
  | "attempts_exhausted"
  | "already_attempted_today"
  | "statutory_holiday"
  | "outside_calling_hours";

export type DialVerdict =
  | { ok: true }
  | { ok: false; reason: DialRefusalReason; detail?: string };

/**
 * What `canDialNow` needs to know about the person being called.
 *
 * `last_attempt_at` is NOT this task's own last attempt — it is the most recent
 * attempt across *every* call task for this customer, because the rule is one
 * attempt per customer per day, not one per task. The dialer computes it in a
 * single query per run (`loadDialClients`). The task's own `last_attempt_at` is
 * folded in as well, so passing `null` here is safe rather than permissive.
 */
export type CallTaskClient = {
  id?: string | null;
  do_not_call: boolean;
  last_attempt_at?: string | null;
};

/**
 * May we place this call, right now?
 *
 * Pure: no clock, no database, no environment. Everything it needs is an
 * argument, which is the only reason the DST cases below are testable at all.
 *
 * The five refusals come straight from Docs/Voice-Outbound-Compliance.md §10.A
 * and are checked in order of how durable they are — `do_not_call` is forever,
 * `outside_calling_hours` resolves itself in an hour — so the reason the caller
 * gets back is the most informative one available.
 *
 * `client` may be null: a task can carry a verified number with no client row
 * behind it (a one-off notice about a job with no CRM contact). That is not a
 * reason to refuse; it just means there is no do-not-call flag to consult.
 */
export function canDialNow(
  task: Pick<CallTask, "attempts" | "max_attempts" | "last_attempt_at">,
  client: CallTaskClient | null,
  now: Date,
): DialVerdict {
  // 1. Never call this person again. Set live, mid-call, by Ana herself at the
  //    moment she says she is removing them — so it is true before she has
  //    finished the sentence, and it outlives whichever call it was said on.
  if (client?.do_not_call) return { ok: false, reason: "do_not_call" };

  // 2. Three rings and we stop. §10.A.5: no more than three attempts per
  //    booking event.
  if (task.attempts >= task.max_attempts) {
    return {
      ok: false,
      reason: "attempts_exhausted",
      detail: `${task.attempts} of ${task.max_attempts} attempts used`,
    };
  }

  const wall = torontoWall(now);

  // 3. One attempt per customer per day (§10.A.5). Compared as Toronto
  //    CALENDAR DAYS, not as a 24-hour span: an attempt at 19:00 and another at
  //    09:00 the next morning are fourteen hours apart and are two different
  //    days, which is the distinction a customer actually experiences.
  const lastAttempt = mostRecent(task.last_attempt_at, client?.last_attempt_at);
  if (lastAttempt && torontoWall(lastAttempt).dateKey === wall.dateKey) {
    return {
      ok: false,
      reason: "already_attempted_today",
      detail: lastAttempt.toISOString(),
    };
  }

  // 4. Statutory holidays. Checked before the hours so the refusal says *why*
  //    the day is shut rather than just that it is.
  const holiday = quebecHolidayOn(wall);
  if (holiday) return { ok: false, reason: "statutory_holiday", detail: holiday };

  // 5. The window itself, in Toronto local time. `open` is inclusive and
  //    `close` is exclusive: a call placed at 20:00:00 sharp is a call that
  //    runs past 20:00, and the point of stopping early is not to be ringing
  //    people at the boundary.
  const window = CALLING_WINDOW[wall.weekday];
  if (!window || wall.minutesOfDay < window.open || wall.minutesOfDay >= window.close) {
    return {
      ok: false,
      reason: "outside_calling_hours",
      detail: `${wall.dateKey} ${String(wall.hour).padStart(2, "0")}:${String(wall.minute).padStart(2, "0")} America/Toronto`,
    };
  }

  return { ok: true };
}

function mostRecent(...values: Array<string | null | undefined>): Date | null {
  let best: Date | null = null;
  for (const value of values) {
    if (!value) continue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    if (!best || date > best) best = date;
  }
  return best;
}

/**
 * The next instant the calling window is open, at or after `from`.
 *
 * What the cron uses to push `not_before` out when a task is claimed and then
 * found ineligible: without it, a task refused at 03:00 is re-claimed and
 * re-refused every fifteen minutes until nine, churning the row's status for
 * nothing. Walks forward a day at a time (Sundays and holidays are simply days
 * with no opening) and gives up after two weeks, which cannot happen — the
 * longest gap in the table is a Sunday followed by a Monday holiday.
 *
 * Wall-clock arithmetic throughout, so the March and November transitions land
 * on 09:00 local and not on 08:00 or 10:00.
 */
export function nextDialWindowOpening(from: Date, skipRestOfToday = false): Date {
  const start = torontoWall(from);
  for (let offset = skipRestOfToday ? 1 : 0; offset <= 14; offset++) {
    const day = new Date(Date.UTC(start.year, start.month - 1, start.day + offset));
    const wall = {
      year: day.getUTCFullYear(),
      month: day.getUTCMonth() + 1,
      day: day.getUTCDate(),
    };
    const key = dateKey(wall.year, wall.month, wall.day);
    const window = CALLING_WINDOW[day.getUTCDay()];
    if (!window) continue;
    if (holidaysFor(wall.year).has(key)) continue;

    const opensAt = torontoWallToUtc({
      ...wall,
      hour: Math.floor(window.open / 60),
      minute: window.open % 60,
    });
    if (opensAt.getTime() >= from.getTime()) return opensAt;

    // Today, already open: now is fine, unless we were told to skip today.
    const closesAt = torontoWallToUtc({
      ...wall,
      hour: Math.floor(window.close / 60),
      minute: window.close % 60,
    });
    if (from.getTime() < closesAt.getTime()) return from;
  }
  // Unreachable with the table above; a fortnight out beats an exception.
  return new Date(from.getTime() + 14 * 86_400_000);
}

/**
 * How long to wait before the next attempt, by attempt number (1-based).
 *
 * These are floors, not promises — `canDialNow` still has the last word, and in
 * practice the one-attempt-per-customer-per-day rule means attempt two happens
 * tomorrow regardless of what this table says. The short first step exists for
 * the case the daily cap does not cover: a task whose client row is absent, or
 * a transport failure where no call was actually placed.
 */
export const RETRY_BACKOFF_MINUTES: readonly number[] = [30, 180];

function backoffFor(attemptsUsed: number): number {
  const index = Math.min(Math.max(attemptsUsed, 1), RETRY_BACKOFF_MINUTES.length) - 1;
  return RETRY_BACKOFF_MINUTES[index];
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type QueueCallTaskInput = {
  kind: CallTaskKind;
  /**
   * E.164, already verified against the CRM by the caller. Denormalized onto
   * the row at queue time on purpose (see the migration): a later edit to the
   * client record must not be able to silently redirect a queued call.
   */
  toNumber: string;
  clientId?: string | null;
  visitId?: string | null;
  jobId?: string | null;
  locale?: "fr" | "en";
  payload?: Record<string, unknown>;
  /** Earliest this may be dialled. Defaults to now. */
  notBefore?: Date | string | null;
  maxAttempts?: number;
};

/**
 * Queue a call.
 *
 * Resolves nothing: the caller supplies a number it has already verified. This
 * function's whole contribution is the correlation id and the typed failure.
 *
 * A `duplicate` result is not an anomaly — `call_tasks_one_confirm_per_visit`
 * makes the daily 24-hour sweep idempotent in the database, so re-queueing the
 * same confirmation is the expected steady state, not an error to log.
 *
 * For a soliciting kind this ALSO refuses without live express consent for the
 * number. Checked here rather than only in the UI: hiding a button is not a
 * control, and this function is the one door every caller goes through. It is
 * checked a second time at dial time, because consent can be withdrawn in
 * between and the later word is the one that counts.
 */
export async function queueCallTask(input: QueueCallTaskInput): Promise<CallTaskWriteResult> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const toNumber = input.toNumber.trim();
  if (!E164.test(toNumber)) {
    return { ok: false, reason: "failed", detail: `not an E.164 number: ${toNumber}` };
  }

  if (requiresExpressConsent(input.kind)) {
    const verdict = await consentVerdictFor(toNumber);
    if (!verdict.ok) {
      return {
        ok: false,
        reason: "no_consent",
        detail:
          verdict.reason === "consent_unavailable"
            ? (verdict.detail ?? "Consent could not be verified.")
            : CONSENT_REFUSAL_MESSAGE[verdict.reason],
      };
    }
  }

  const notBefore =
    input.notBefore instanceof Date
      ? input.notBefore.toISOString()
      : input.notBefore || new Date().toISOString();

  const { data, error } = await supabase
    .from("call_tasks")
    .insert({
      kind: input.kind,
      to_number: toNumber,
      client_id: input.clientId ?? null,
      visit_id: input.visitId ?? null,
      job_id: input.jobId ?? null,
      locale: input.locale ?? "fr",
      payload: input.payload ?? {},
      not_before: notBefore,
      call_sid: mintCallSid(),
      ...(input.maxAttempts ? { max_attempts: input.maxAttempts } : {}),
    })
    .select(COLUMNS)
    .single();

  if (error) return fail(error, "could not queue the call");
  return { ok: true, task: data as unknown as CallTask };
}

/**
 * Take exclusive ownership of up to `limit` tasks that are due.
 *
 * ── How two overlapping cron runs are kept off the same customer ────────────
 *
 * The SELECT below is *not* the guard. It is a cheap way to find candidates,
 * and by the time its rows come back another run may already own half of them.
 * Correctness rests entirely on the per-row conditional UPDATE:
 *
 *     update call_tasks set status = 'dialing'
 *      where id = $1 and status = 'queued'
 *   returning *
 *
 * Under Postgres' default READ COMMITTED isolation, an UPDATE takes a
 * row-level exclusive lock. If two transactions target the same row, the second
 * blocks until the first commits and then **re-evaluates its WHERE clause
 * against the committed version of the row** (the EvalPlanQual recheck). The
 * row now reads `status = 'dialing'`, the predicate fails, and the second
 * UPDATE affects zero rows. supabase-js returns the affected rows from
 * `.update().select()`, so an empty array is an unambiguous "someone else got
 * this one" — not an error, not a retry, just skip it.
 *
 * That is a compare-and-swap, and it is the only mutual exclusion in play.
 * There is no `SELECT ... FOR UPDATE SKIP LOCKED` and no advisory lock, for two
 * reasons: PostgREST cannot express either without a stored procedure, and the
 * migration is a fixed contract that I may not add one to. The CAS is
 * sufficient here anyway — we need at-most-once dialling, which row-level
 * locking gives us, not queue fairness.
 *
 * Deliberately NOT done at claim time: incrementing `attempts` and stamping
 * `last_attempt_at`. A claim is not an attempt. Eligibility is re-checked after
 * the claim and a task may be handed straight back (`releaseCallTask`); if the
 * claim had stamped `last_attempt_at`, that release would burn the customer's
 * one call for the day without anyone's phone ever ringing.
 */
export async function claimDueCallTasks(limit: number, now = new Date()): Promise<CallTaskListResult> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };
  if (limit <= 0) return { ok: true, tasks: [] };

  // Over-fetch a little: some candidates will be lost to a concurrent run, and
  // a second round trip to top the batch up is not worth it.
  const { data, error } = await supabase
    .from("call_tasks")
    .select("id")
    .eq("status", "queued")
    .lte("not_before", now.toISOString())
    .order("not_before", { ascending: true })
    .limit(limit * 2 + 2);

  if (error) return fail(error, "could not list due calls");

  const claimed: CallTask[] = [];
  for (const row of (data ?? []) as Array<{ id: string }>) {
    if (claimed.length >= limit) break;

    const { data: updated, error: claimError } = await supabase
      .from("call_tasks")
      .update({ status: "dialing" })
      .eq("id", row.id)
      .eq("status", "queued") // ← the compare half of the compare-and-swap
      .select(COLUMNS);

    if (claimError) {
      // One row failing to claim must not abandon the rest of the batch.
      console.error("[callTasks] could not claim a call task:", claimError.message);
      continue;
    }
    const rows = (updated ?? []) as unknown as CallTask[];
    if (rows.length === 1) claimed.push(rows[0]);
  }

  return { ok: true, tasks: claimed };
}

/**
 * Hand a claimed task back, unattempted.
 *
 * The counterpart to a claim that turned out not to be dialable — the customer
 * asked not to be called since the task was queued, or it is 03:00. Neither
 * costs an attempt and neither touches `last_attempt_at`, so nothing about the
 * customer's day is consumed by a call we decided against.
 *
 * Guarded on `status = 'dialing'` so it cannot resurrect a task that a webhook
 * has meanwhile completed or that the owner has cancelled.
 */
export async function releaseCallTask(
  id: string,
  options: { notBefore?: Date | null; note?: string | null } = {},
): Promise<CallTaskUpdateResult> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const patch: Record<string, unknown> = { status: "queued", error: options.note ?? null };
  if (options.notBefore) patch.not_before = options.notBefore.toISOString();

  const { data, error } = await supabase
    .from("call_tasks")
    .update(patch)
    .eq("id", id)
    .eq("status", "dialing")
    .select("id");

  if (error) return fail(error, "could not release the call task");
  return { ok: true, changed: (data ?? []).length };
}

/**
 * A call was actually handed to the provider.
 *
 * This — not the claim — is where the attempt is counted and the customer's
 * one-a-day is spent, because this is the point at which a phone rings.
 */
export async function recordCallTaskDispatch(
  id: string,
  dispatch: { conversationId?: string | null; attemptsBefore: number },
  now = new Date(),
): Promise<CallTaskUpdateResult> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { data, error } = await supabase
    .from("call_tasks")
    .update({
      attempts: dispatch.attemptsBefore + 1,
      last_attempt_at: now.toISOString(),
      conversation_id: dispatch.conversationId ?? null,
      error: null,
    })
    .eq("id", id)
    .eq("status", "dialing")
    .select("id");

  if (error) return fail(error, "could not record the dispatch");
  return { ok: true, changed: (data ?? []).length };
}

/**
 * The call ended. Keyed on `call_sid` because that is what comes back from the
 * provider — the post-call webhook knows the correlation id, not our row id.
 *
 * `status` is `done` for anything that was a conversation, however it went; the
 * `failed` outcome is the one value that describes a call which never became
 * one, and it takes the matching status so the two columns cannot disagree.
 */
export async function completeCallTask(
  callSid: string,
  result: {
    outcome: CallOutcome;
    outcomeDetail?: Record<string, unknown>;
    conversationId?: string | null;
  },
  now = new Date(),
): Promise<CallTaskUpdateResult> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const patch: Record<string, unknown> = {
    status: result.outcome === "failed" ? "failed" : "done",
    outcome: result.outcome,
    outcome_detail: result.outcomeDetail ?? {},
    completed_at: now.toISOString(),
  };
  if (result.conversationId) patch.conversation_id = result.conversationId;

  const { data, error } = await supabase
    .from("call_tasks")
    .update(patch)
    .eq("call_sid", callSid)
    // Never reopen a task the owner cancelled while the call was in flight.
    .in("status", ["queued", "dialing"])
    .select("id");

  if (error) return fail(error, "could not complete the call task");
  return { ok: true, changed: (data ?? []).length };
}

/**
 * The dial did not happen. Counts the attempt, then either backs off or gives
 * up — and never leaves the row in `dialing`, which is the state nothing else
 * rescues.
 */
export async function failCallTask(
  id: string,
  error: string,
  now = new Date(),
): Promise<CallTaskUpdateResult> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { data: current, error: readError } = await supabase
    .from("call_tasks")
    .select("attempts, max_attempts")
    .eq("id", id)
    .maybeSingle();

  if (readError) return fail(readError, "could not read the call task");
  if (!current) return { ok: true, changed: 0 };

  const row = current as { attempts: number; max_attempts: number };
  const attempts = row.attempts + 1;
  const exhausted = attempts >= row.max_attempts;

  const patch: Record<string, unknown> = {
    attempts,
    last_attempt_at: now.toISOString(),
    error: error.slice(0, 2000),
    status: exhausted ? "failed" : "queued",
  };
  if (exhausted) {
    patch.outcome = "failed";
    patch.completed_at = now.toISOString();
  } else {
    // A floor, not a promise: canDialNow still decides.
    patch.not_before = new Date(now.getTime() + backoffFor(attempts) * 60_000).toISOString();
  }

  const { data, error: writeError } = await supabase
    .from("call_tasks")
    .update(patch)
    .eq("id", id)
    .in("status", ["queued", "dialing"])
    .select("id");

  if (writeError) return fail(writeError, "could not fail the call task");
  return { ok: true, changed: (data ?? []).length };
}

/**
 * Reclaim tasks stuck in `dialing`.
 *
 * The migration has no lease column, so the backstop is `updated_at`, which the
 * `call_tasks_touch` trigger maintains on every write. A row that has been
 * `dialing` for longer than this had its provider result lost — the post-call
 * webhook never arrived, or the cron died between the claim and the POST. Left
 * alone it would sit there forever, silently consuming one of the two
 * concurrency slots and never telling the owner the call did not happen.
 *
 * Each stalled row goes through `failCallTask`, so it either backs off for
 * another go or lands in `failed` with an explanation.
 */
export async function sweepStalledCallTasks(
  olderThanMinutes = 30,
  now = new Date(),
): Promise<{ ok: true; swept: number } | CallTaskFailure> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const cutoff = new Date(now.getTime() - olderThanMinutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from("call_tasks")
    .select("id")
    .eq("status", "dialing")
    .lt("updated_at", cutoff)
    .limit(50);

  if (error) return fail(error, "could not sweep stalled calls");

  let swept = 0;
  for (const row of (data ?? []) as Array<{ id: string }>) {
    const result = await failCallTask(
      row.id,
      `no result ${olderThanMinutes} minutes after dialling — provider webhook never arrived`,
      now,
    );
    if (result.ok) swept += result.changed;
  }
  return { ok: true, swept };
}

/**
 * Call it off.
 *
 * Distinct from `failCallTask` and not a synonym for it: `failed` means we
 * tried and could not get through, `cancelled` means we decided not to try.
 * The do-not-call list is the important caller — a task for someone who has
 * opted out must not sit in the queue backing off and being refused every
 * morning until its attempts run out. It is over.
 */
export async function cancelCallTask(
  id: string,
  reason?: string,
  /**
   * Which states may still be called off. Defaults to both, which is what an
   * automatic caller wants — an opted-out customer's task should be stopped
   * whatever state it is in.
   *
   * The admin Cancel button passes `["queued"]` instead, deliberately. Once a
   * task is `dialing` the phone is already ringing, and flipping the row to
   * cancelled would neither stop it nor be true: the call happens, the
   * post-call webhook arrives, and it lands on a row that claims it was called
   * off. Restricting the button to `queued` also makes the update itself the
   * race guard for a row the dialer claimed between render and click.
   */
  cancellableFrom: CallTaskStatus[] = ["queued", "dialing"],
): Promise<CallTaskUpdateResult> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { data, error } = await supabase
    .from("call_tasks")
    .update({ status: "cancelled", error: reason?.slice(0, 2000) ?? null })
    .eq("id", id)
    .in("status", cancellableFrom)
    .select("id");

  if (error) return fail(error, "could not cancel the call task");
  return { ok: true, changed: (data ?? []).length };
}

/**
 * The visit moved, or was deleted. Everything still pending about it is off.
 *
 * Only non-terminal rows: a call that already happened is history, and history
 * about a phone call the business placed is the one thing this table must never
 * quietly rewrite. `dialing` is included because a visit cancelled while the
 * phone is ringing is exactly when you most want the row to stop pretending.
 */
export async function cancelCallTasksForVisit(visitId: string): Promise<CallTaskUpdateResult> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { data, error } = await supabase
    .from("call_tasks")
    .update({ status: "cancelled" })
    .eq("visit_id", visitId)
    .in("status", ["queued", "dialing"])
    .select("id");

  if (error) return fail(error, "could not cancel the visit's calls");
  return { ok: true, changed: (data ?? []).length };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Newest first, for the dashboard. */
export async function listRecentCallTasks(limit = 50): Promise<CallTaskListResult> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { data, error } = await supabase
    .from("call_tasks")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return fail(error, "could not list call tasks");
  return { ok: true, tasks: (data ?? []) as unknown as CallTask[] };
}

/** How many calls are in flight right now — the concurrency budget's numerator. */
/**
 * How many calls we have actually dispatched today, Toronto time.
 *
 * The circuit breaker behind `MAX_CALLS_PER_DAY`. Concurrency caps how many
 * ring at once; this caps how many can ring at all, which is the limit that
 * matters when something is wrong rather than merely busy. A requeue loop, a
 * sweep that stops deduplicating, a clock bug that makes every visit look
 * imminent — none of those are stopped by a concurrency cap, because two at a
 * time all day is still hundreds of calls and a drained account.
 *
 * Counts dispatches, not outcomes: a call that failed still rang a phone and
 * still cost money, so it spends from the day's allowance like any other.
 * Returns null when the table is absent or unreadable, and the caller treats
 * null as "stop", never as "plenty left".
 */
export async function countCallsDispatchedToday(now: Date = new Date()): Promise<number | null> {
  const supabase = db();
  if (!supabase) return null;

  // Midnight in Toronto, expressed as an instant. The window has to be the
  // owner's day rather than UTC's, or the ceiling silently resets at 8pm.
  const wall = torontoWall(now);
  const startOfDay = new Date(now.getTime() - (wall.hour * 60 + wall.minute) * 60_000);

  const { count, error } = await supabase
    .from("call_tasks")
    .select("id", { count: "exact", head: true })
    .not("last_attempt_at", "is", null)
    .gte("last_attempt_at", startOfDay.toISOString());

  if (error) {
    if (!isMissingTable(error)) {
      console.error("[callTasks] could not count today's calls:", error.message);
    }
    return null;
  }
  return count ?? 0;
}

export async function countInFlightCallTasks(): Promise<number | null> {
  const supabase = db();
  if (!supabase) return null;

  const { count, error } = await supabase
    .from("call_tasks")
    .select("id", { count: "exact", head: true })
    .eq("status", "dialing");

  if (error) {
    if (!isMissingTable(error)) console.error("[callTasks] could not count in-flight calls:", error.message);
    return null;
  }
  return count ?? 0;
}

/**
 * Everything `canDialNow` needs about a batch of customers, in two queries.
 *
 * The do-not-call flag comes off `clients`; the "attempted today" signal is an
 * aggregate over `call_tasks` that no single row carries. Forty-eight hours of
 * history is enough for a Toronto calendar-day comparison at any offset.
 */
export async function loadDialClients(
  clientIds: string[],
  now = new Date(),
): Promise<Map<string, CallTaskClient>> {
  const out = new Map<string, CallTaskClient>();
  const ids = [...new Set(clientIds.filter(Boolean))];
  if (ids.length === 0) return out;

  const supabase = db();
  if (!supabase) return out;

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, do_not_call")
    .in("id", ids);

  if (error) {
    // A missing do_not_call column means 0018 has not been applied. Fail
    // CLOSED: without the suppression list we do not know who opted out, and
    // "we could not read the flag" is not a reason to ring them.
    console.error("[callTasks] could not read do_not_call:", error.message);
    for (const id of ids) out.set(id, { id, do_not_call: true });
    return out;
  }

  for (const row of (clients ?? []) as Array<{ id: string; do_not_call: boolean | null }>) {
    out.set(row.id, { id: row.id, do_not_call: Boolean(row.do_not_call) });
  }

  const since = new Date(now.getTime() - 48 * 3_600_000).toISOString();
  const { data: attempts } = await supabase
    .from("call_tasks")
    .select("client_id, last_attempt_at")
    .in("client_id", ids)
    .gte("last_attempt_at", since);

  for (const row of (attempts ?? []) as Array<{ client_id: string | null; last_attempt_at: string | null }>) {
    if (!row.client_id || !row.last_attempt_at) continue;
    const entry = out.get(row.client_id) ?? { id: row.client_id, do_not_call: false };
    if (!entry.last_attempt_at || row.last_attempt_at > entry.last_attempt_at) {
      entry.last_attempt_at = row.last_attempt_at;
    }
    out.set(row.client_id, entry);
  }

  return out;
}
