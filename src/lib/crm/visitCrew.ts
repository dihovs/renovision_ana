import { db, isMissingTable, MigrationPendingError } from "./db";
import type { TeamMember } from "./teamTypes";

/**
 * Crew on visits (migration 0054).
 *
 * Reads degrade quietly: before the migration runs a job page simply has no
 * crew to show, rather than failing — the same rule every newer table here
 * follows.
 */

export const VISIT_STATUSES = ["unscheduled", "scheduled", "dispatched", "completed"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const VISIT_STATUS_LABEL: Record<VisitStatus, string> = {
  unscheduled: "Unscheduled",
  scheduled: "Scheduled",
  dispatched: "Crew told",
  completed: "Done",
};

export type VisitCrew = Record<string, TeamMember[]>;

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

/** visitId → the team members on it, for many visits in one read. */
export async function listVisitCrew(visitIds: string[]): Promise<VisitCrew> {
  const out: VisitCrew = {};
  if (visitIds.length === 0) return out;
  const client = db();
  if (!client) return out;
  const { data, error } = await client
    .from("visit_assignees")
    .select("visit_id, team_members(*)")
    .in("visit_id", visitIds);
  if (error) {
    if (!isMissingTable(error)) console.warn("[visitCrew] could not read crew:", error.message);
    return out;
  }
  for (const row of (data ?? []) as unknown as { visit_id: string; team_members: TeamMember | null }[]) {
    if (!row.team_members) continue;
    (out[row.visit_id] ??= []).push(row.team_members);
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.display_name.localeCompare(b.display_name));
  return out;
}

/** Replace a visit's crew with exactly these people. */
export async function setVisitCrew(visitId: string, memberIds: string[]): Promise<void> {
  const client = requireDb();
  const unique = [...new Set(memberIds.filter(Boolean))];

  const removal = client.from("visit_assignees").delete().eq("visit_id", visitId);
  const { error: delError } = unique.length
    ? await removal.not("team_member_id", "in", `(${unique.join(",")})`)
    : await removal;
  if (delError) {
    if (isMissingTable(delError)) throw new MigrationPendingError("visit_assignees", delError.message);
    throw new Error(`Could not change the crew: ${delError.message}`);
  }
  if (unique.length === 0) return;

  const { error } = await client
    .from("visit_assignees")
    .upsert(
      unique.map((team_member_id) => ({ visit_id: visitId, team_member_id })),
      { onConflict: "visit_id,team_member_id", ignoreDuplicates: true },
    );
  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("visit_assignees", error.message);
    throw new Error(`Could not change the crew: ${error.message}`);
  }
}

/**
 * After a dispatch actually went out: every upcoming, unfinished visit on the
 * job is now "crew told". Best effort — a failed bookkeeping write must never
 * make a sent message look unsent.
 */
export async function markJobVisitsDispatched(jobId: string, now = new Date()): Promise<void> {
  const client = db();
  if (!client) return;
  const { error } = await client
    .from("visits")
    .update({ status: "dispatched", dispatched_at: now.toISOString() })
    .eq("job_id", jobId)
    .is("completed_at", null)
    .gte("starts_at", new Date(now.getTime() - 12 * 3600_000).toISOString());
  if (error && !isMissingTable(error) && !/column .*status|dispatched_at/i.test(error.message)) {
    console.warn("[visitCrew] could not mark visits dispatched:", error.message);
  }
}

/** The WhatsApp contacts of everyone on any of these visits — what the
    "Tell the crew" panel pre-ticks. */
export function crewContactIds(crew: VisitCrew): string[] {
  const ids = new Set<string>();
  for (const members of Object.values(crew)) {
    for (const m of members) if (m.whatsapp_contact_id) ids.add(m.whatsapp_contact_id);
  }
  return [...ids];
}
