import { db, isMissingTable, MigrationPendingError } from "./db";
import { resolveCrewToken } from "./crewView";
import type { TeamMember } from "./teamTypes";

/**
 * The clock (migration 0055): Start / Stop against a visit, per person, and
 * the office's weekly approval.
 *
 * Crew-side functions take the crew link's token and re-resolve it on every
 * call, exactly like the crew page's other writes: the visit must belong to
 * the token's job, and the person must be an active team member. Nothing on
 * the crew side reads or writes money.
 */

const DAY = 86_400_000;

/** Whole minutes between two instants, never less than one: a Start and
    Stop a few seconds apart still recorded somebody turning up. */
export function clockedMinutes(startedAt: string | Date, endedAt: string | Date): number {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return Math.max(1, Math.round(ms / 60_000));
}

/** Monday 00:00 (local) of the week containing `date`, and the next Monday. */
export function weekBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (start.getDay() + 6) % 7; // Monday = 0
  start.setDate(start.getDate() - offset);
  const end = new Date(start.getTime() + 7 * DAY);
  end.setHours(0, 0, 0, 0);
  return { start, end };
}

/** "2026-11-02" for a local date, without a time zone shifting it. */
export function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The calendar day in Québec. The server runs on UTC, where an evening
    clock-in in Montréal is already tomorrow. */
export function shopDay(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

// ---------------------------------------------------------------------------
// Crew side
// ---------------------------------------------------------------------------

export type CrewClockPerson = {
  id: string;
  name: string;
  /** The running clock, when there is one. */
  open: { entryId: string; visitId: string | null; startedAt: string } | null;
};

/**
 * Who can clock in on this job: the crew assigned to its visits, or — when
 * nobody has been assigned — every active crew member, so the timer is never
 * locked out by an office that has not set up assignments yet. Empty before
 * migration 0053 runs, and the crew page then simply has no timer.
 */
export async function crewClockPeople(token: string): Promise<CrewClockPerson[]> {
  const client = db();
  if (!client) return [];
  const jobId = await resolveCrewToken(token);
  if (!jobId) return [];

  const visits = await client.from("visits").select("id").eq("job_id", jobId);
  const visitIds = ((visits.data ?? []) as { id: string }[]).map((v) => v.id);

  let members: Pick<TeamMember, "id" | "display_name">[] = [];
  if (visitIds.length) {
    const assigned = await client
      .from("visit_assignees")
      .select("team_members(id, display_name, active)")
      .in("visit_id", visitIds);
    if (!assigned.error) {
      const seen = new Map<string, Pick<TeamMember, "id" | "display_name">>();
      for (const row of (assigned.data ?? []) as unknown as { team_members: (TeamMember & { active: boolean }) | null }[]) {
        if (row.team_members?.active) seen.set(row.team_members.id, row.team_members);
      }
      members = [...seen.values()];
    }
  }
  if (members.length === 0) {
    const all = await client.from("team_members").select("id, display_name").eq("active", true).order("display_name");
    if (all.error) return [];
    members = (all.data ?? []) as Pick<TeamMember, "id" | "display_name">[];
  }
  if (members.length === 0) return [];

  const open = await client
    .from("time_entries")
    .select("id, team_member_id, visit_id, started_at")
    .in("team_member_id", members.map((m) => m.id))
    .not("started_at", "is", null)
    .is("ended_at", null);
  const openBy = new Map(
    ((open.data ?? []) as { id: string; team_member_id: string; visit_id: string | null; started_at: string }[]).map(
      (row) => [row.team_member_id, { entryId: row.id, visitId: row.visit_id, startedAt: row.started_at }],
    ),
  );

  return members
    .map((m) => ({ id: m.id, name: m.display_name, open: openBy.get(m.id) ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type ClockResult = { ok: true } | { ok: false; reason: string };

/** Start a clock for one person on one visit of the token's job. */
export async function startCrewClock(
  token: string,
  visitId: string,
  memberId: string,
  now: Date = new Date(),
): Promise<ClockResult> {
  const client = db();
  if (!client) return { ok: false, reason: "offline" };
  const jobId = await resolveCrewToken(token, now);
  if (!jobId) return { ok: false, reason: "link" };

  const [visit, member] = await Promise.all([
    client.from("visits").select("id").eq("id", visitId).eq("job_id", jobId).maybeSingle(),
    client.from("team_members").select("id, display_name, active").eq("id", memberId).maybeSingle(),
  ]);
  if (!visit.data) return { ok: false, reason: "visit" };
  const person = member.data as { id: string; display_name: string; active: boolean } | null;
  if (!person?.active) return { ok: false, reason: "person" };

  const { error } = await client.from("time_entries").insert({
    job_id: jobId,
    visit_id: visitId,
    team_member_id: person.id,
    person: person.display_name,
    started_at: now.toISOString(),
    worked_on: shopDay(now),
    source: "clock",
  });
  if (error) {
    // 23505 = the one-open-clock index: they are already clocked in.
    if (error.code === "23505") return { ok: false, reason: "running" };
    return { ok: false, reason: "save" };
  }
  return { ok: true };
}

/** Stop a running clock. The entry must belong to the token's job. */
export async function stopCrewClock(token: string, entryId: string, now: Date = new Date()): Promise<ClockResult> {
  const client = db();
  if (!client) return { ok: false, reason: "offline" };
  const jobId = await resolveCrewToken(token, now);
  if (!jobId) return { ok: false, reason: "link" };

  const { data } = await client
    .from("time_entries")
    .select("id, started_at")
    .eq("id", entryId)
    .eq("job_id", jobId)
    .is("ended_at", null)
    .maybeSingle();
  const row = data as { id: string; started_at: string } | null;
  if (!row) return { ok: false, reason: "entry" };

  const { error } = await client
    .from("time_entries")
    .update({ ended_at: now.toISOString(), minutes: clockedMinutes(row.started_at, now) })
    .eq("id", row.id)
    .eq("job_id", jobId);
  return error ? { ok: false, reason: "save" } : { ok: true };
}

// ---------------------------------------------------------------------------
// Office side
// ---------------------------------------------------------------------------

export type TimesheetEntry = {
  id: string;
  team_member_id: string | null;
  person: string;
  job_id: string;
  job_number: number | null;
  job_title: string | null;
  visit_id: string | null;
  worked_on: string;
  started_at: string | null;
  ended_at: string | null;
  minutes: number | null;
  approved_at: string | null;
  source: "manual" | "clock";
  note: string | null;
};

/** Every entry in a week, running clocks included, oldest first. */
export async function listTimesheet(weekStart: Date): Promise<TimesheetEntry[]> {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  const { start, end } = weekBounds(weekStart);
  const { data, error } = await client
    .from("time_entries")
    .select(
      "id, team_member_id, person, job_id, visit_id, worked_on, started_at, ended_at, minutes, approved_at, source, note, jobs(job_number, title)",
    )
    .gte("worked_on", isoDay(start))
    .lt("worked_on", isoDay(end))
    .order("worked_on")
    .order("started_at", { ascending: true, nullsFirst: true });
  if (error) {
    if (isMissingTable(error) || /column .* does not exist/i.test(error.message)) {
      throw new MigrationPendingError("time_entries.started_at", error.message);
    }
    throw new Error(`Could not load the timesheet: ${error.message}`);
  }
  return ((data ?? []) as unknown as (Omit<TimesheetEntry, "job_number" | "job_title"> & {
    jobs: { job_number: number; title: string | null } | null;
  })[]).map(({ jobs, ...row }) => ({ ...row, job_number: jobs?.job_number ?? null, job_title: jobs?.title ?? null }));
}

/** Approve (or un-approve) entries. Running clocks are never approved. */
export async function setEntriesApproved(ids: string[], approved: boolean, now: Date = new Date()): Promise<void> {
  if (ids.length === 0) return;
  const client = db();
  if (!client) throw new Error("Database is not configured");
  const { error } = await client
    .from("time_entries")
    .update({ approved_at: approved ? now.toISOString() : null })
    .in("id", ids)
    .not("minutes", "is", null);
  if (error) throw new Error(`Could not approve: ${error.message}`);
}

/** The office stops a clock somebody forgot, at a time the office chooses. */
export async function stopClockAt(entryId: string, endedAt: Date): Promise<void> {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  const { data } = await client.from("time_entries").select("started_at").eq("id", entryId).is("ended_at", null).maybeSingle();
  const row = data as { started_at: string } | null;
  if (!row) return;
  const end = endedAt.getTime() > new Date(row.started_at).getTime() ? endedAt : new Date();
  const { error } = await client
    .from("time_entries")
    .update({ ended_at: end.toISOString(), minutes: clockedMinutes(row.started_at, end) })
    .eq("id", entryId);
  if (error) throw new Error(`Could not stop the clock: ${error.message}`);
}
