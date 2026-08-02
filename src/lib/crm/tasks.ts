import { db, isMissingTable } from "./db";

/**
 * The owner's dictated to-do list (migration 0017).
 *
 * One spoken sentence, optionally with a date. This is the only write the voice
 * agent can perform in owner mode, and it is deliberately the least destructive
 * thing a compromised PIN could reach: appending a line to a private list.
 *
 * MIGRATIONS HERE ARE RUN BY HAND. Until the owner runs 0017 the table does not
 * exist, and this module has to say so rather than throw — a missing table must
 * cost the note, never the phone call. Every function therefore reports its
 * outcome instead of raising, and the caller decides what Ana says.
 */

export type OwnerTask = {
  id: string;
  created_at: string;
  body: string;
  due_date: string | null;
  done_at: string | null;
  source: string;
  call_sid: string | null;
};

/**
 * Why a write did not happen. Kept as three distinct values because they need
 * three different sentences out of Ana: "the database isn't connected" is a
 * deployment problem, "the migration hasn't run" is a one-command fix the owner
 * himself performs, and "it failed" is worth him writing the note down now.
 */
export type TaskWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: "unconfigured" | "migration_pending" | "failed"; detail?: string };

export async function createOwnerTask(input: {
  body: string;
  dueDate?: string | null;
  callSid?: string | null;
  source?: string;
}): Promise<TaskWriteResult> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const body = input.body.trim();
  if (!body) return { ok: false, reason: "failed", detail: "empty task" };

  const { data, error } = await supabase
    .from("owner_tasks")
    .insert({
      body,
      due_date: input.dueDate || null,
      call_sid: input.callSid || null,
      source: input.source ?? "voice",
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingTable(error)) {
      console.warn("[tasks] owner_tasks is missing — run supabase/migrations/0017_owner_tasks.sql");
      return { ok: false, reason: "migration_pending" };
    }
    console.error("[tasks] could not save the task:", error.message);
    return { ok: false, reason: "failed", detail: error.message };
  }

  return { ok: true, id: data.id as string };
}

/**
 * Everything still outstanding, newest first.
 *
 * Returns null — not an empty array — when the table isn't there, because "no
 * tasks" and "no task list" must not read the same. Same distinction the
 * dashboard draws for visits.
 */
export async function listOpenOwnerTasks(limit = 25): Promise<OwnerTask[] | null> {
  const supabase = db();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("owner_tasks")
    .select("*")
    .is("done_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTable(error)) return null;
    console.error("[tasks] could not load tasks:", error.message);
    return null;
  }
  return (data ?? []) as OwnerTask[];
}

export async function setOwnerTaskDone(id: string, done: boolean): Promise<void> {
  const supabase = db();
  if (!supabase) return;
  const { error } = await supabase
    .from("owner_tasks")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) console.error("[tasks] could not update the task:", error.message);
}
