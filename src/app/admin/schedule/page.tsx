import Link from "next/link";
import AdminNotice from "@/components/admin/AdminNotice";
import { MigrationPendingError, isConfigured } from "@/lib/crm/db";
import { listVisitsBetween, type ScheduledVisit } from "@/lib/crm/jobs";

export const dynamic = "force-dynamic";

/** The business runs on Montreal time; the server runs on UTC. */
const TZ = "America/Toronto";

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
            {visits.length} visit{visits.length === 1 ? "" : "s"} this week
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <NavLink href={`/admin/schedule?week=${isoDate(addDays(monday, -7))}`} label="←" />
          <NavLink href="/admin/schedule" label="Today" />
          <NavLink href={`/admin/schedule?week=${isoDate(nextMonday)}`} label="→" />
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-7">
        {days.map((day) => {
          const key = dayKey(day);
          const dayVisits = visits.filter((v) => dayKey(new Date(v.starts_at)) === key);
          const isToday = key === todayKey;

          return (
            <div
              key={key}
              className={`rounded-xl border bg-white p-3 shadow-sm ${
                isToday ? "border-brand-blue/30 ring-1 ring-brand-blue/15" : "border-black/5"
              }`}
            >
              <div className="mb-2 flex items-baseline justify-between">
                <span
                  className={`text-xs font-bold uppercase tracking-wide ${
                    isToday ? "text-brand-blue" : "text-charcoal/45"
                  }`}
                >
                  {day.toLocaleDateString("en-CA", { weekday: "short", timeZone: TZ })}
                </span>
                <span
                  className={`font-heading text-lg font-bold ${
                    isToday ? "text-brand-blue" : "text-charcoal/70"
                  }`}
                >
                  {day.toLocaleDateString("en-CA", { day: "numeric", timeZone: TZ })}
                </span>
              </div>

              {dayVisits.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-charcoal/25">—</p>
              ) : (
                <ul className="space-y-1.5">
                  {dayVisits.map((visit) => (
                    <li key={visit.id}>
                      <Link
                        href={`/admin/jobs/${visit.job_id}`}
                        className={`block rounded-lg border-l-[3px] p-2 transition-colors hover:bg-black/[0.03] ${
                          visit.completed_at
                            ? "border-brand-green bg-brand-green/[0.05]"
                            : "border-brand-blue bg-brand-blue/[0.04]"
                        }`}
                      >
                        <span className="block text-[11px] font-bold tabular-nums text-charcoal/60">
                          {visit.all_day
                            ? "All day"
                            : new Date(visit.starts_at).toLocaleTimeString("en-CA", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                                timeZone: TZ,
                              })}
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
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
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
