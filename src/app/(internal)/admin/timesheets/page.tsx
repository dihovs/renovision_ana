import Link from "next/link";
import { approveEntriesAction, stopClockNowAction } from "./actions";
import AdminNotice from "@/components/admin/AdminNotice";
import { Card, SectionHeader, StatTile, StatusPill } from "@/components/admin/ui/Hub";
import { isConfigured, MigrationPendingError } from "@/lib/crm/db";
import { formatMinutes, isoDay, listTimesheet, weekBounds, type TimesheetEntry } from "@/lib/crm/timeClock";

export const dynamic = "force-dynamic";

/**
 * Timesheets: the week, per person — clocked and typed hours together — and
 * one button per person to approve their week.
 */
export default async function TimesheetsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const anchor = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? new Date(`${week}T12:00:00`) : new Date();
  const { start, end } = weekBounds(anchor);
  const prev = isoDay(new Date(start.getTime() - 3 * 86_400_000));
  const next = isoDay(new Date(end.getTime() + 3 * 86_400_000));

  if (!isConfigured) {
    return <AdminNotice title="No database connected yet">Set the Supabase environment variables to turn this on.</AdminNotice>;
  }

  let entries: TimesheetEntry[];
  try {
    entries = await listTimesheet(start);
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="Migrations left to run">
          Run <code className="font-mono text-brand-blue">0053_team_members.sql</code>,{" "}
          <code className="font-mono text-brand-blue">0054_visit_crew_status.sql</code> and{" "}
          <code className="font-mono text-brand-blue">0055_time_clock.sql</code> in the Supabase SQL editor, in that order.
        </AdminNotice>
      );
    }
    throw err;
  }

  const byPerson = new Map<string, TimesheetEntry[]>();
  for (const entry of entries) {
    const key = entry.team_member_id ?? `name:${entry.person}`;
    (byPerson.get(key) ?? byPerson.set(key, []).get(key)!).push(entry);
  }
  const people = [...byPerson.values()].sort((a, b) => a[0].person.localeCompare(b[0].person));
  const totalMinutes = entries.reduce((sum, e) => sum + (e.minutes ?? 0), 0);
  const unapproved = entries.filter((e) => e.minutes !== null && !e.approved_at).length;
  const running = entries.filter((e) => e.minutes === null).length;

  const range = `${start.toLocaleDateString("en-CA", { month: "short", day: "numeric" })} – ${new Date(end.getTime() - 86_400_000).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`;

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/admin/timesheets?week=${prev}`} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-bold text-charcoal">
          ‹ Previous
        </Link>
        <span className="font-heading text-base font-bold text-charcoal">{range}</span>
        <Link href={`/admin/timesheets?week=${next}`} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-bold text-charcoal">
          Next ›
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Hours" value={formatMinutes(totalMinutes)} />
        <StatTile label="To approve" value={String(unapproved)} tone={unapproved ? "red" : undefined} />
        <StatTile label="Clocks running" value={String(running)} />
      </div>

      {people.length === 0 && (
        <Card className="p-4 sm:p-5">
          <p className="text-sm text-charcoal/45">No hours this week. Crew clock in from their job link; typed hours are on Expenses.</p>
        </Card>
      )}

      {people.map((rows) => {
        const minutes = rows.reduce((sum, e) => sum + (e.minutes ?? 0), 0);
        const toApprove = rows.filter((e) => e.minutes !== null && !e.approved_at).map((e) => e.id);
        const approvedIds = rows.filter((e) => e.approved_at).map((e) => e.id);
        return (
          <Card key={rows[0].team_member_id ?? rows[0].person}>
            <SectionHeader
              title={`${rows[0].person} · ${formatMinutes(minutes)}`}
              action={
                toApprove.length > 0 ? (
                  <form action={approveEntriesAction.bind(null, toApprove, true)}>
                    <button type="submit" className="cursor-pointer rounded-lg bg-brand-green px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-green-dark">
                      Approve week
                    </button>
                  </form>
                ) : approvedIds.length > 0 ? (
                  <form action={approveEntriesAction.bind(null, approvedIds, false)}>
                    <button type="submit" className="cursor-pointer rounded-lg px-2 py-1 text-xs font-bold text-charcoal/45 hover:text-charcoal">
                      Undo approval
                    </button>
                  </form>
                ) : null
              }
            />
            <ul className="divide-y divide-black/[0.05] border-t border-black/[0.05]">
              {rows.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5 text-sm sm:px-5">
                  <span className="w-20 shrink-0 text-charcoal/55">
                    {new Date(`${entry.worked_on}T12:00:00`).toLocaleDateString("en-CA", { weekday: "short", day: "numeric" })}
                  </span>
                  <Link href={`/admin/jobs/${entry.job_id}`} className="min-w-0 flex-1 truncate font-semibold text-charcoal hover:text-brand-blue">
                    {entry.job_number ? `#${entry.job_number}` : "Job"}
                    {entry.job_title ? ` · ${entry.job_title}` : ""}
                  </Link>
                  {entry.started_at && (
                    <span className="hidden shrink-0 text-xs tabular-nums text-charcoal/45 sm:inline">
                      {clock(entry.started_at)}–{entry.ended_at ? clock(entry.ended_at) : "…"}
                    </span>
                  )}
                  {entry.minutes === null ? (
                    <form action={stopClockNowAction.bind(null, entry.id)} className="flex items-center gap-2">
                      <StatusPill tone="blue">Running</StatusPill>
                      <button type="submit" className="cursor-pointer text-xs font-bold text-red-700">
                        Stop now
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="w-16 shrink-0 text-right font-bold tabular-nums text-charcoal">{formatMinutes(entry.minutes)}</span>
                      {entry.approved_at ? <StatusPill tone="green">OK</StatusPill> : <StatusPill tone="amber">New</StatusPill>}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Toronto" });
}
