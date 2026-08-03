import {
  cancelCallTasksForVisit,
  nextDialWindowOpening,
  queueCallTask,
  torontoWall,
  type CallTaskKind,
  type TorontoWall,
} from "./callTasks";
import { db } from "./db";
import { listVisitsBetween } from "./jobs";
import { clientDisplayName, type PhoneContact } from "./types";

/**
 * What decides that a customer is going to be phoned.
 *
 * Two entry points create work for the dialer: this file's nightly sweep over
 * the calendar, and the owner dictating an errand in owner mode. Everything
 * that answers "may we call this person, on what number, and not before when"
 * lives here, so there is one place to read when the answer turns out to be
 * wrong. `callTasks.ts` owns the row and the calling window — `canDialNow()`
 * there is the gate that decides whether a call may actually be placed, and
 * nothing in this file second-guesses it. All this module does with the clock is
 * avoid writing a `not_before` in the middle of the night.
 *
 * THE NUMBER ALWAYS COMES FROM A CRM RECORD. Every path below reads the phone
 * off a `clients` row and normalises it to E.164 before a task exists. There is
 * deliberately no way to queue a call to a number that was typed, spoken, or
 * passed in from outside — see the note above `dialableNumber`.
 *
 * Only the three kinds in migration 0018 can be created, and that narrowness is
 * a legal boundary rather than a missing feature. See
 * `Docs/Voice-Outbound-Compliance.md` §4.3.
 */

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/** The business runs on Montreal time; the server runs on UTC. */
const TZ = "America/Toronto";

const HOUR_MS = 3_600_000;

/** How far ahead of a visit the confirmation call should land. */
export const CONFIRM_LEAD_MS = 24 * HOUR_MS;

/**
 * How far down the calendar one sweep looks.
 *
 * Wider than the lead time on purpose. The task is created early and sits with
 * a future `not_before`, so a cron run that is skipped, retried, or an hour late
 * cannot silently drop a day's confirmations. Re-running is free: the unique
 * index on `(visit_id, kind)` makes the second insert a no-op.
 */
export const SWEEP_HORIZON_MS = 48 * HOUR_MS;

/**
 * Below this much notice, confirming is pointless and slightly insulting — the
 * crew is already loading the van. The visit is left alone.
 */
export const MIN_NOTICE_MS = 2 * HOUR_MS;

/**
 * Move an instant out of the small hours, forward only.
 *
 * THIS IS NOT THE PERMITTED-HOURS RULE and must not grow into one. The window,
 * the weekend narrowing, the statutory holidays and the last word on whether a
 * call may be placed all live in `canDialNow()` in `callTasks.ts`; a second
 * implementation here would be a second answer to one question. This is only
 * the queue-time courtesy of not writing a `not_before` that is plainly the
 * middle of the night — a task due at 03:00 would otherwise be claimed and
 * refused every fifteen minutes until nine.
 *
 * It is `nextDialWindowOpening` verbatim, aliased so the intent reads at the
 * call sites. Forward only: an instant already inside an open window comes back
 * unchanged.
 */
export function civilisedNotBefore(instant: Date): Date {
  return nextDialWindowOpening(instant);
}

// ---------------------------------------------------------------------------
// Saying the appointment out loud
// ---------------------------------------------------------------------------
//
// The payload carries the time already in words, because the thing that reads
// it is a text-to-speech engine. "2026-08-03T13:00Z" is read out as a string of
// digits and punctuation, and `09:00` is a coin flip between "nine o'clock" and
// "oh nine hundred". See Docs/Voice-Outbound-Conversation.md §2, note 2.
//
// Absolute rather than relative — "le lundi 3 août", never "demain". The task
// is written today and dialled tomorrow, and a payload that says "tomorrow" is
// wrong the moment the dialer retries.
//
// (`ownerTools.ts` has its own number-words tables for money. They are not
// shared: that one needs millions and a currency, this one needs nothing above
// fifty-nine, and merging them would produce a module that serves neither.)

const FR_SMALL = [
  "zéro", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept",
  "dix-huit", "dix-neuf",
];
const FR_TENS = ["", "", "vingt", "trente", "quarante", "cinquante"];

const EN_SMALL = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty"];

/** 0–59 in words. Anything outside that range never reaches here. */
function minuteWords(n: number, locale: "fr" | "en"): string {
  const small = locale === "fr" ? FR_SMALL : EN_SMALL;
  const tens = locale === "fr" ? FR_TENS : EN_TENS;
  if (n < 20) return small[n];
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  if (unit === 0) return tens[ten];
  // "vingt et une", "trente et une" — the joined form French uses for one.
  if (locale === "fr") return unit === 1 ? `${tens[ten]} et une` : `${tens[ten]}-${small[unit]}`;
  return `${tens[ten]}-${small[unit]}`;
}

function spokenClock(p: TorontoWall, locale: "fr" | "en"): string {
  if (p.minute === 0 && p.hour === 12) return locale === "fr" ? "midi" : "noon";
  if (p.minute === 0 && p.hour === 0) return locale === "fr" ? "minuit" : "midnight";

  const twelve = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const minutes = p.minute === 0 ? "" : ` ${minuteWords(p.minute, locale)}`;
  const part =
    p.hour < 12
      ? locale === "fr" ? "du matin" : "in the morning"
      : p.hour < 18
        ? locale === "fr" ? "de l'après-midi" : "in the afternoon"
        : locale === "fr" ? "du soir" : "in the evening";

  if (locale === "fr") {
    const hour = `${FR_SMALL[twelve]} heure${twelve > 1 ? "s" : ""}`;
    return `${hour}${minutes} ${part}`;
  }
  return `${EN_SMALL[twelve]}${minutes} ${part}`;
}

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** "le lundi 3 août à neuf heures du matin" / "Monday, August 3rd at nine in the morning". */
export function spokenWhen(iso: string, locale: "fr" | "en"): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";
  const p = torontoWall(instant);
  const tag = locale === "fr" ? "fr-CA" : "en-CA";
  const weekday = new Intl.DateTimeFormat(tag, { timeZone: TZ, weekday: "long" }).format(instant);
  const month = new Intl.DateTimeFormat(tag, { timeZone: TZ, month: "long" }).format(instant);

  if (locale === "fr") {
    const day = p.day === 1 ? "1er" : String(p.day);
    return `le ${weekday} ${day} ${month} à ${spokenClock(p, "fr")}`;
  }
  const capital = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capital}, ${month} ${ordinal(p.day)} at ${spokenClock(p, "en")}`;
}

/** Both languages, because the row's locale can be wrong and the script picks. */
export function spokenWhenBoth(iso: string): { fr: string; en: string } {
  return { fr: spokenWhen(iso, "fr"), en: spokenWhen(iso, "en") };
}

// ---------------------------------------------------------------------------
// The number
// ---------------------------------------------------------------------------

/**
 * A CRM phone string turned into E.164, or null.
 *
 * Null is a real answer and the caller must treat it as one: the migration's
 * check constraint would reject anything else anyway, and a task that fails to
 * insert at 3am is a customer who never got their call and nobody who knows.
 *
 * Deliberately strict for +1. The generic E.164 shape accepts `+1055...`, which
 * is a typo in the CRM rather than a number; the NANP rule that neither the
 * area code nor the exchange may start with 0 or 1 catches it before it becomes
 * a failed call. Anything with an extension is treated as unreachable — an
 * automated call cannot navigate a switchboard, and dialling the main line and
 * announcing somebody's renovation to whoever answers is exactly the disclosure
 * failure branch B2 exists to prevent.
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

/**
 * The first number on a client record we could actually dial.
 *
 * Primary first, then anything else in the order it was entered. Fax lines are
 * excluded outright — a synthesized voice calling a fax machine is a wasted
 * attempt at best and a stack of blank pages at worst.
 */
export function dialableNumber(phones: PhoneContact[] | null | undefined): string | null {
  const list = (phones ?? []).filter((phone) => phone && phone.type !== "fax");
  const ordered = [...list.filter((p) => p.primary), ...list.filter((p) => !p.primary)];
  for (const phone of ordered) {
    const number = toE164(phone.number);
    if (number) return number;
  }
  return null;
}

/** Enough of the number to catch a wrong record, without reading it all out. */
export function lastFour(e164: string): string {
  return e164.slice(-4);
}

// ---------------------------------------------------------------------------
// Who a job belongs to
// ---------------------------------------------------------------------------

/**
 * The client behind a job, with everything needed to decide whether to call.
 *
 * `clients(*)` rather than a column list so `do_not_call` comes back once
 * migration 0018 has run and is simply absent before it — naming the column
 * explicitly would turn a pending migration into a failed query, and this runs
 * on a cron nobody is watching.
 */
export type JobContact = {
  jobId: string;
  clientId: string | null;
  clientName: string;
  phone: string | null;
  doNotCall: boolean;
  jobActive: boolean;
};

type ClientRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  phones?: PhoneContact[] | null;
  do_not_call?: boolean | null;
};

function toContact(jobId: string, client: ClientRow | null, jobActive: boolean): JobContact {
  return {
    jobId,
    clientId: client?.id ?? null,
    clientName: client ? clientDisplayName(client) : "Unknown client",
    phone: dialableNumber(client?.phones),
    doNotCall: Boolean(client?.do_not_call),
    jobActive,
  };
}

async function loadJobContacts(jobIds: string[]): Promise<Map<string, JobContact>> {
  const found = new Map<string, JobContact>();
  if (jobIds.length === 0) return found;

  const supabase = db();
  if (!supabase) return found;

  const { data, error } = await supabase
    .from("jobs")
    .select("id, status, archived_at, clients(*)")
    .in("id", jobIds);

  if (error) {
    console.error("[callScheduler] could not read the jobs:", error.message);
    return found;
  }

  for (const row of (data ?? []) as {
    id: string;
    status?: string | null;
    archived_at?: string | null;
    // PostgREST hands back an object for a to-one relation, but an array is
    // what comes out when it cannot tell — accept both rather than crash.
    clients: ClientRow | ClientRow[] | null;
  }[]) {
    const client = Array.isArray(row.clients) ? (row.clients[0] ?? null) : row.clients;
    const active = row.status !== "cancelled" && !row.archived_at;
    found.set(row.id, toContact(row.id, client, active));
  }
  return found;
}

/** One client, for the owner-dictated path where there is no job to go through. */
export async function loadClientContact(clientId: string): Promise<JobContact | null> {
  const supabase = db();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    console.error("[callScheduler] could not read the client:", error.message);
    return null;
  }
  if (!data) return null;
  return toContact("", data as ClientRow, true);
}

type VisitRow = {
  id: string;
  job_id: string;
  starts_at: string;
  all_day: boolean;
  completed_at: string | null;
};

async function loadVisit(visitId: string): Promise<VisitRow | null> {
  const supabase = db();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("visits")
    .select("id, job_id, starts_at, all_day, completed_at")
    .eq("id", visitId)
    .maybeSingle();

  if (error) {
    console.error("[callScheduler] could not read the visit:", error.message);
    return null;
  }
  return (data as VisitRow | null) ?? null;
}

// ---------------------------------------------------------------------------
// The sweep
// ---------------------------------------------------------------------------

export const SWEEP_SKIP_REASONS = [
  "already_completed",
  "all_day",
  "too_soon",
  "job_inactive",
  "no_client",
  "no_phone",
  "do_not_call",
  "already_queued",
  "write_failed",
] as const;
export type SweepSkipReason = (typeof SWEEP_SKIP_REASONS)[number];

/** Why one visit did not produce a call, in enough detail to act on. */
export type SweepSkip = {
  visitId: string;
  clientName: string;
  startsAt: string;
  reason: SweepSkipReason;
  detail?: string;
};

export type SweepReport = {
  from: string;
  to: string;
  scanned: number;
  queued: number;
  skipped: SweepSkip[];
  /** Set when the sweep could not run at all, rather than per visit. */
  failure?: "unconfigured" | "migration_pending" | "failed";
  /** One line, for the cron log. */
  summary: string;
};

function countReasons(skipped: SweepSkip[]): string {
  const counts = new Map<string, number>();
  for (const skip of skipped) counts.set(skip.reason, (counts.get(skip.reason) ?? 0) + 1);
  return [...counts.entries()].map(([reason, n]) => `${n} ${reason}`).join(", ");
}

function summarise(report: Omit<SweepReport, "summary">): string {
  if (report.failure) return `[sweep] did not run: ${report.failure}`;
  const tail = report.skipped.length ? ` — skipped ${countReasons(report.skipped)}` : "";
  return `[sweep] ${report.scanned} visits in window, ${report.queued} queued${tail}`;
}

/**
 * Queue tomorrow's confirmation calls.
 *
 * Idempotent, and idempotent in the database rather than here: the unique index
 * `call_tasks_one_confirm_per_visit` is what stops a second run re-queueing, so
 * two overlapping cron invocations cannot both read "nothing queued yet" and
 * both insert. A conflict comes back as `duplicate` and is reported as a skip,
 * not an error.
 *
 * Nothing throws. This runs unattended, and a report saying what did not happen
 * is worth more than a stack trace in a log nobody opens.
 */
export async function sweepUpcomingVisits(
  now: Date = new Date(),
  options: { horizonMs?: number; leadMs?: number } = {},
): Promise<SweepReport> {
  const horizonMs = options.horizonMs ?? SWEEP_HORIZON_MS;
  const leadMs = options.leadMs ?? CONFIRM_LEAD_MS;
  const from = now.toISOString();
  const to = new Date(now.getTime() + horizonMs).toISOString();

  const skipped: SweepSkip[] = [];
  let queued = 0;

  let visits;
  try {
    visits = await listVisitsBetween(from, to);
  } catch (err) {
    const failure = /not configured/i.test(String(err)) ? "unconfigured" : "migration_pending";
    const report = { from, to, scanned: 0, queued: 0, skipped, failure } as const;
    return { ...report, summary: summarise(report) };
  }

  const candidates: typeof visits = [];
  for (const visit of visits) {
    const startsAt = new Date(visit.starts_at).getTime();
    if (visit.completed_at) {
      skipped.push(skip(visit.id, visit.client_name, visit.starts_at, "already_completed"));
    } else if (visit.all_day) {
      skipped.push(skip(visit.id, visit.client_name, visit.starts_at, "all_day"));
    } else if (startsAt - now.getTime() < MIN_NOTICE_MS) {
      skipped.push(skip(visit.id, visit.client_name, visit.starts_at, "too_soon"));
    } else {
      candidates.push(visit);
    }
  }

  const contacts = await loadJobContacts([...new Set(candidates.map((v) => v.job_id))]);

  for (const visit of candidates) {
    const contact = contacts.get(visit.job_id);
    const name = contact?.clientName ?? visit.client_name;

    if (!contact || !contact.clientId) {
      skipped.push(skip(visit.id, name, visit.starts_at, "no_client"));
      continue;
    }
    if (!contact.jobActive) {
      skipped.push(skip(visit.id, name, visit.starts_at, "job_inactive"));
      continue;
    }
    if (contact.doNotCall) {
      skipped.push(skip(visit.id, name, visit.starts_at, "do_not_call"));
      continue;
    }
    if (!contact.phone) {
      skipped.push(skip(visit.id, name, visit.starts_at, "no_phone"));
      continue;
    }

    const result = await queueCallTask({
      kind: "confirm_visit",
      visitId: visit.id,
      jobId: visit.job_id,
      clientId: contact.clientId,
      toNumber: contact.phone,
      notBefore: confirmNotBefore(now, new Date(visit.starts_at), leadMs).toISOString(),
      payload: {
        visitStartsAt: visit.starts_at,
        when: spokenWhenBoth(visit.starts_at),
        contactName: name,
        jobNumber: visit.job_number,
      },
    });

    if (result.ok) {
      queued += 1;
      continue;
    }
    if (result.reason === "duplicate") {
      skipped.push(skip(visit.id, name, visit.starts_at, "already_queued"));
      continue;
    }
    if (result.reason === "migration_pending" || result.reason === "unconfigured") {
      // Not a property of this visit — every remaining insert would fail the
      // same way, and a hundred identical skip lines is not a report.
      const report = { from, to, scanned: visits.length, queued, skipped, failure: result.reason };
      return { ...report, summary: summarise(report) };
    }
    skipped.push(skip(visit.id, name, visit.starts_at, "write_failed", result.detail));
  }

  const report = { from, to, scanned: visits.length, queued, skipped };
  return { ...report, summary: summarise(report) };
}

function skip(
  visitId: string,
  clientName: string,
  startsAt: string,
  reason: SweepSkipReason,
  detail?: string,
): SweepSkip {
  return detail ? { visitId, clientName, startsAt, reason, detail } : { visitId, clientName, startsAt, reason };
}

/**
 * When the confirmation may be dialled.
 *
 * Twenty-four hours before the visit, never in the past, never in the middle of
 * the night, and never so late that the call arrives after the crew does.
 */
export function confirmNotBefore(now: Date, startsAt: Date, leadMs = CONFIRM_LEAD_MS): Date {
  const earliest = Math.max(now.getTime(), startsAt.getTime() - leadMs);
  const latest = startsAt.getTime() - MIN_NOTICE_MS;
  const civilised = civilisedNotBefore(new Date(earliest)).getTime();
  return new Date(Math.max(earliest, Math.min(civilised, latest)));
}

// ---------------------------------------------------------------------------
// When a visit moves
// ---------------------------------------------------------------------------

export type VisitChangeResult = {
  /** Queued tasks withdrawn for this visit. */
  cancelled: number;
  /** Whether a schedule_change call replaced them. */
  queued: boolean;
  reason?:
    | SweepSkipReason
    | "unconfigured"
    | "migration_pending"
    | "duplicate"
    | "no_visit"
    | "failed";
  detail?: string;
};

/**
 * The visit is off. Withdraw anything queued about it.
 *
 * Not "delete": the dialer's own row keeps its history, and a task cancelled
 * ten minutes before it would have gone out is worth being able to see.
 */
export async function onVisitCancelled(visitId: string): Promise<VisitChangeResult> {
  const result = await cancelCallTasksForVisit(visitId);
  if (result.ok) return { cancelled: result.changed, queued: false };
  return { cancelled: 0, queued: false, reason: result.reason, detail: result.detail };
}

/**
 * The visit moved. Withdraw the stale confirmation and say so instead.
 *
 * `previousStartsAt` has to be passed in because by the time anything can react
 * to the change the old value is gone from the row, and a schedule_change call
 * that cannot say what the time used to be is a call that confuses the customer
 * rather than informing them.
 *
 * Note the one-way door: `call_tasks_one_confirm_per_visit` is unique on
 * `(visit_id, kind)` regardless of status, so cancelling the confirmation
 * consumes it — no second confirmation can ever be queued for this visit. That
 * is intended. The schedule_change call names the new time and does the same
 * job; ringing twice about one appointment is how a service call becomes a
 * nuisance call.
 */
export async function onVisitRescheduled(
  visitId: string,
  previousStartsAt: string,
  now: Date = new Date(),
): Promise<VisitChangeResult> {
  const withdrawn = await cancelCallTasksForVisit(visitId);
  const cancelled = withdrawn.ok ? withdrawn.changed : 0;
  if (!withdrawn.ok && withdrawn.reason !== "failed") {
    return { cancelled, queued: false, reason: withdrawn.reason, detail: withdrawn.detail };
  }

  const visit = await loadVisit(visitId);
  if (!visit) return { cancelled, queued: false, reason: "no_visit" };
  if (visit.completed_at) return { cancelled, queued: false, reason: "already_completed" };
  if (visit.all_day) return { cancelled, queued: false, reason: "all_day" };

  const startsAt = new Date(visit.starts_at);
  if (startsAt.getTime() - now.getTime() < MIN_NOTICE_MS) {
    return { cancelled, queued: false, reason: "too_soon" };
  }

  const contacts = await loadJobContacts([visit.job_id]);
  const contact = contacts.get(visit.job_id);
  if (!contact || !contact.clientId) return { cancelled, queued: false, reason: "no_client" };
  if (!contact.jobActive) return { cancelled, queued: false, reason: "job_inactive" };
  if (contact.doNotCall) return { cancelled, queued: false, reason: "do_not_call" };
  if (!contact.phone) return { cancelled, queued: false, reason: "no_phone" };

  const result = await queueCallTask({
    kind: "schedule_change",
    visitId: visit.id,
    jobId: visit.job_id,
    clientId: contact.clientId,
    toNumber: contact.phone,
    notBefore: civilisedNotBefore(now).toISOString(),
    payload: {
      contactName: contact.clientName,
      previousStartsAt,
      previousWhen: spokenWhenBoth(previousStartsAt),
      visitStartsAt: visit.starts_at,
      when: spokenWhenBoth(visit.starts_at),
    },
  });

  if (result.ok) return { cancelled, queued: true };
  return { cancelled, queued: false, reason: result.reason, detail: result.detail };
}

// ---------------------------------------------------------------------------
// The owner dictating one
// ---------------------------------------------------------------------------

const KINDS: readonly CallTaskKind[] = ["confirm_visit", "crew_on_way", "schedule_change"];

/**
 * Whether a string names one of the three kinds migration 0018 allows.
 *
 * Typed against `CallTaskKind` on purpose: if the schema ever grows a kind and
 * the union changes, this array stops compiling instead of quietly rejecting a
 * legitimate errand.
 */
export function isCallTaskKind(value: unknown): value is CallTaskKind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value);
}

export type DictatedCall = {
  clientId: string;
  kind: CallTaskKind;
  /** The owner's own words, already in a shape Ana can say. */
  message: string;
  locale?: "fr" | "en";
};

export type DictatedCallResult =
  | { ok: true; clientName: string; toNumber: string; notBefore: string }
  | {
      ok: false;
      reason: "no_client" | "do_not_call" | "no_phone" | "unconfigured" | "migration_pending" | "duplicate" | "failed";
      clientName?: string;
      detail?: string;
    };

/**
 * Queue a call the owner asked for out loud.
 *
 * Takes a client id, never a phone number. The caller resolves a spoken name to
 * a CRM record; this reloads that record and reads the number off it. Between
 * those two facts there is no path by which digits spoken on a phone call
 * become a number this system dials, which is the property that lets owner mode
 * cause phone calls without owner mode becoming a way to place them anywhere.
 */
export async function queueDictatedCall(
  input: DictatedCall,
  now: Date = new Date(),
): Promise<DictatedCallResult> {
  const contact = await loadClientContact(input.clientId);
  if (!contact) return { ok: false, reason: "no_client" };
  if (contact.doNotCall) {
    return { ok: false, reason: "do_not_call", clientName: contact.clientName };
  }
  if (!contact.phone) {
    return { ok: false, reason: "no_phone", clientName: contact.clientName };
  }

  const notBefore = civilisedNotBefore(now).toISOString();
  const result = await queueCallTask({
    kind: input.kind,
    clientId: input.clientId,
    toNumber: contact.phone,
    locale: input.locale ?? "fr",
    notBefore,
    payload: {
      contactName: contact.clientName,
      message: input.message,
      source: "owner_voice",
    },
  });

  if (result.ok) {
    return { ok: true, clientName: contact.clientName, toNumber: contact.phone, notBefore };
  }
  return {
    ok: false,
    reason: result.reason,
    clientName: contact.clientName,
    detail: result.detail,
  };
}
