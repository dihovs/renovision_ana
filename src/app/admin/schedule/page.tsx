import Link from "next/link";
import AdminNotice from "@/components/admin/AdminNotice";
import { MigrationPendingError, isConfigured } from "@/lib/crm/db";
import { listVisitsBetween, type ScheduledVisit } from "@/lib/crm/jobs";

export const dynamic = "force-dynamic";

/** The business runs on Montreal time; the server runs on UTC. */
const TZ = "America/Toronto";

/**
 * Visits only carry `completed_at` in the data model — there is no separate
 * "in progress" or "cancelled" state to draw from. What the calendar CAN tell
 * on its own is whether an uncompleted visit's day has already gone by, which
 * is the one distinction a field-service owner actually needs at a glance:
 * done, overdue (should have happened, wasn't ticked off), or still ahead.
 */
type VisitState = "done" | "overdue" | "scheduled";

const VISIT_STATE: Record<VisitState, { label: string; pill: string; border: string }> = {
  scheduled: {
    label: "Scheduled",
    pill: "bg-brand-blue/[0.08] text-brand-blue",
    border: "border-brand-blue bg-brand-blue/[0.04]",
  },
  done: {
    label: "Done",
    pill: "bg-green-100 text-green-800",
    border: "border-brand-green bg-brand-green/[0.05]",
  },
  overdue: {
    label: "Overdue",
    pill: "bg-red-100 text-red-800",
    border: "border-red-500 bg-red-50",
  },
};

function visitState(visit: ScheduledVisit, todayKey: string): VisitState {
  if (visit.completed_at) return "done";
  return dayKey(new Date(visit.starts_at)) < todayKey ? "overdue" : "scheduled";
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;

  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set the Supabase environment variables to turn this on.
      </AdminNotice>
    );
  }

  // Monday-start week. Anchored on a date string rather than an offset so
  // paging back and forth is idempotent — an offset accumulates rounding
  // errors across a daylight-saving boundary.
  const anchor = week ? new Date(`${week}T12:00:00`) : new Date();
  const monday = startOfWeek(anchor);
  const nextMonday = addDays(monday, 7);

  let visits: ScheduledVisit[] = [];
  try {
    visits = await listVisitsBetween(monday.toISOString(), nextMonday.toISOString());
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration left to run">
          Run{" "}
          <code className="font-mono text-brand-blue">
            supabase/migrations/0007_jobs_invoices.sql
          </code>
          .
        </AdminNotice>
      );
    }
    return (
      <AdminNotice title="Could not reach the database">
        {err instanceof Error ? err.message : "Unknown error"}.
      </AdminNotice>
    );
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const todayKey = dayKey(new Date());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-bold text-charcoal">
            {monday.toLocaleDateString("en-CA", { day: "numeric", month: "long", timeZone: TZ })} –{" "}
            {addDays(monday, 6).toLocaleDateString("en-CA", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: TZ,
            })}
          </h2>
          <p className="text-xs text-charcoal/45">
            {visits.length === 0
              ? "No visits this week"
              : `${visits.length} visit${visits.length === 1 ? "" : "s"} this week`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <NavLink
            href={`/admin/schedule?week=${isoDate(addDays(monday, -7))}`}
            label="←"
            ariaLabel="Previous week"
          />
          <NavLink href="/admin/schedule" label="Today" />
          <NavLink
            href={`/admin/schedule?week=${isoDate(nextMonday)}`}
            label="→"
            ariaLabel="Next week"
          />
        </div>
      </div>

      {visits.length === 0 ? (
        <AdminNotice title="Nothing on the calendar this week">
          Visits are scheduled from a job. Open a{" "}
          <Link href="/admin/jobs" className="font-semibold text-brand-blue">
            job
          </Link>{" "}
          and add one — it lands here automatically.
        </AdminNotice>
      ) : (
        <>
          {/* Full week grid, from lg up — seven columns need the width to stay
              readable. Below that it collapses to squeezed, unreadable cells
              rather than a usable calendar, so a real agenda list takes over. */}
          <div className="hidden gap-2 lg:grid lg:grid-cols-7">
            {days.map((day) => (
              <DayCard
                key={dayKey(day)}
                day={day}
                visits={visitsOn(visits, day)}
                isToday={dayKey(day) === todayKey}
                todayKey={todayKey}
              />
            ))}
          </div>

          <ul className="space-y-2 lg:hidden">
            {days.map((day) => (
              <AgendaDay
                key={dayKey(day)}
                day={day}
                visits={visitsOn(visits, day)}
                isToday={dayKey(day) === todayKey}
                todayKey={todayKey}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function visitsOn(visits: ScheduledVisit[], day: Date): ScheduledVisit[] {
  const key = dayKey(day);
  return visits.filter((v) => dayKey(new Date(v.starts_at)) === key);
}

function visitTime(visit: ScheduledVisit): string {
  return visit.all_day
    ? "All day"
    : new Date(visit.starts_at).toLocaleTimeString("en-CA", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: TZ,
      });
}

/** Desktop calendar cell: one weekday, compact visit chips. */
function DayCard({
  day,
  visits,
  isToday,
  todayKey,
}: {
  day: Date;
  visits: ScheduledVisit[];
  isToday: boolean;
  todayKey: string;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-3 shadow-sm ${
        isToday ? "border-brand-blue/30 ring-1 ring-brand-blue/15" : "border-black/5"
      }`}
    >
      <div className="mb-1 flex items-baseline justify-between">
        <span
          aria-hidden
          className={`text-xs font-bold uppercase tracking-wide ${
            isToday ? "text-brand-blue" : "text-charcoal/45"
          }`}
        >
          {day.toLocaleDateString("en-CA", { weekday: "short", timeZone: TZ })}
        </span>
        <span
          aria-hidden
          className={`font-heading text-lg font-bold ${isToday ? "text-brand-blue" : "text-charcoal/70"}`}
        >
          {day.toLocaleDateString("en-CA", { day: "numeric", timeZone: TZ })}
        </span>
      </div>
      <span className="sr-only">
        {day.toLocaleDateString("en-CA", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: TZ,
        })}
      </span>
      {isToday && (
        <span className="mb-2 inline-block rounded-full bg-brand-blue/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-blue">
          Today
        </span>
      )}

      {visits.length === 0 ? (
        <p className="py-2 text-center text-[11px] text-charcoal/35">No visits</p>
      ) : (
        <ul className="space-y-1.5">
          {visits.map((visit) => {
            const state = VISIT_STATE[visitState(visit, todayKey)];
            return (
              <li key={visit.id}>
                <Link
                  href={`/admin/jobs/${visit.job_id}`}
                  className={`block rounded-lg border-l-[3px] p-2 transition-colors hover:bg-black/[0.06] ${state.border}`}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold tabular-nums text-charcoal/60">
                      {visitTime(visit)}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${state.pill}`}
                    >
                      {state.label}
                    </span>
                  </span>
                  <span className="block truncate text-xs font-semibold text-charcoal">
                    {visit.title || visit.job_title || `Job #${visit.job_number}`}
                  </span>
                  <span className="block truncate text-[11px] text-charcoal/50">
                    {visit.client_name}
                  </span>
                  {visit.address && (
                    <span className="block truncate text-[11px] text-charcoal/40">
                      {visit.address}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Mobile/tablet fallback: one full-width row per day instead of a seven-column
 * grid squeezed below its usable width. Same data, laid out for a thumb.
 */
function AgendaDay({
  day,
  visits,
  isToday,
  todayKey,
}: {
  day: Date;
  visits: ScheduledVisit[];
  isToday: boolean;
  todayKey: string;
}) {
  return (
    <li
      className={`rounded-xl border bg-white p-3 shadow-sm ${
        isToday ? "border-brand-blue/30 ring-1 ring-brand-blue/15" : "border-black/5"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`font-heading text-sm font-bold ${isToday ? "text-brand-blue" : "text-charcoal"}`}>
          {day.toLocaleDateString("en-CA", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: TZ,
          })}
        </span>
        {isToday && (
          <span className="rounded-full bg-brand-blue/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-blue">
            Today
          </span>
        )}
      </div>

      {visits.length === 0 ? (
        <p className="mt-2 text-sm text-charcoal/35">No visits scheduled</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {visits.map((visit) => {
            const state = VISIT_STATE[visitState(visit, todayKey)];
            return (
              <li key={visit.id}>
                <Link
                  href={`/admin/jobs/${visit.job_id}`}
                  className={`block rounded-lg border-l-[3px] p-3 transition-colors hover:bg-black/[0.04] ${state.border}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold tabular-nums text-charcoal/60">
                      {visitTime(visit)}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${state.pill}`}
                    >
                      {state.label}
                    </span>
                  </div>
                  <span className="mt-1 block text-sm font-semibold text-charcoal">
                    {visit.title || visit.job_title || `Job #${visit.job_number}`}
                  </span>
                  <span className="block text-xs text-charcoal/50">{visit.client_name}</span>
                  {visit.address && (
                    <span className="block text-xs text-charcoal/40">{visit.address}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function NavLink({ href, label, ariaLabel }: { href: string; label: string; ariaLabel?: string }) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
    >
      {label}
    </Link>
  );
}

/** Monday of the week containing `date`, at local midnight. */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // getDay() is 0 for Sunday; shifting by 6 puts Sunday at the END of the week,
  // which is how a trades week actually reads.
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Group key in Montreal time, so a 9pm visit doesn't land on tomorrow. */
function dayKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TZ });
}
