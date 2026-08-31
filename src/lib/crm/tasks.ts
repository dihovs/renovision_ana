import { db, isMissingTable } from "./db";

/**
 * The owner's dictated to-do list (migration 0017).
 *
 * One sentence, optionally with a date — spoken to Ana in owner mode, or typed
 * into the header task bar. Writing a task is still the only thing the VOICE
 * agent can do to this database, and it is deliberately the least destructive
 * thing a compromised PIN could reach: appending a line to a private list.
 * `source` records which way a row came in, so the two never blur together.
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
export type TaskFailure = {
  ok: false;
  reason: "unconfigured" | "migration_pending" | "failed";
  detail?: string;
};

export type TaskWriteResult = { ok: true; id: string } | TaskFailure;

/** Same three-way outcome for a read, so the admin screen can say which it is. */
export type TaskLoadResult = { ok: true; tasks: OwnerTask[] } | TaskFailure;

/** And for a tick, so the button can report why it didn't take. */
export type TaskUpdateResult = { ok: true } | TaskFailure;

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

/**
 * The whole list, open and ticked off alike, newest first.
 *
 * What /admin/tasks reads. Distinct from `listOpenOwnerTasks` on two counts:
 * it keeps the finished ones — a to-do list the owner cannot see he has
 * cleared is a list he stops trusting — and it names the failure instead of
 * collapsing everything to null, because "no database", "no migration" and
 * "no tasks" each want a different sentence on screen.
 */
export async function loadOwnerTasks(limit = 200): Promise<TaskLoadResult> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { data, error } = await supabase
    .from("owner_tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTable(error)) return { ok: false, reason: "migration_pending" };
    console.error("[tasks] could not load tasks:", error.message);
    return { ok: false, reason: "failed", detail: error.message };
  }
  return { ok: true, tasks: (data ?? []) as OwnerTask[] };
}

/**
 * How many are still outstanding, for the dashboard card.
 *
 * Null — not zero — when the table isn't reachable, so Home can leave the card
 * out rather than claim an empty list the same way it does for visits. Counted
 * head-only: the dashboard wants the number, not two hundred rows of text.
 */
export async function countOpenOwnerTasks(): Promise<number | null> {
  const supabase = db();
  if (!supabase) return null;

  const { count, error } = await supabase
    .from("owner_tasks")
    .select("id", { count: "exact", head: true })
    .is("done_at", null);

  if (error) {
    if (!isMissingTable(error)) {
      console.error("[tasks] could not count tasks:", error.message);
    }
    return null;
  }
  return count ?? 0;
}

/**
 * What the task bar in the admin header shows: everything open, plus the
 * handful ticked off in the last day.
 *
 * The recently-done tail is not decoration. A checkbox that makes a row vanish
 * is a checkbox people are afraid to press — the row has to stay visible long
 * enough to be un-ticked, and a day covers "I cleared the wrong one" without
 * the panel filling up with history. The full record lives on /admin/tasks.
 *
 * One query, not two: the bar mounts on every admin page and the difference
 * between one round trip and two is the difference between it appearing with
 * the page and appearing after it.
 */
export async function loadTaskBar(
  doneWindowHours = 24,
  limit = 60,
): Promise<TaskLoadResult> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const cutoff = new Date(Date.now() - doneWindowHours * 3600_000).toISOString();

  const { data, error } = await supabase
    .from("owner_tasks")
    .select("*")
    .or(`done_at.is.null,done_at.gte.${cutoff}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTable(error)) return { ok: false, reason: "migration_pending" };
    console.error("[tasks] could not load the task bar:", error.message);
    return { ok: false, reason: "failed", detail: error.message };
  }
  return { ok: true, tasks: (data ?? []) as OwnerTask[] };
}

export async function setOwnerTaskDone(id: string, done: boolean): Promise<TaskUpdateResult> {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { error } = await supabase
    .from("owner_tasks")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) {
    if (isMissingTable(error)) return { ok: false, reason: "migration_pending" };
    console.error("[tasks] could not update the task:", error.message);
    return { ok: false, reason: "failed", detail: error.message };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Matching a spoken sentence to an open task (ANA-10)
// ---------------------------------------------------------------------------

export type TaskMatch =
  | { kind: "none" }
  | { kind: "one"; task: OwnerTask }
  | { kind: "many"; tasks: OwnerTask[] };

/**
 * Words that carry no meaning about WHICH task — both languages, because he
 * dictates in either. Without this, "the Tremblay one" scores a hit on every
 * task containing "the", and the matcher starts asking about tasks that share
 * nothing but an article.
 */
const TASK_STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "about", "one", "task", "thing",
  "les", "des", "une", "pour", "avec", "chez", "dans", "cette", "tache",
]);

/** Lowercased, unaccented, split into words — the shape speech survives in. */
function taskTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !TASK_STOPWORDS.has(word));
}

/**
 * Which open task the owner means, from what he said.
 *
 * The same philosophy as contactMatch: fail towards asking. Ticking off the
 * wrong task un-remembers something he still had to do, which is worse than
 * any amount of "which one did you mean" — so a clear winner needs every
 * meaningful spoken word to appear in exactly one task. Anything else is a
 * question, never a guess. Pure, so the deciding is testable without a
 * database.
 */
export function rankTaskMatches(spoken: string, tasks: OwnerTask[]): TaskMatch {
  const wanted = taskTokens(spoken);
  if (wanted.length === 0 || tasks.length === 0) return { kind: "none" };

  const scored = tasks
    .map((task) => {
      const body = taskTokens(task.body);
      const hits = wanted.filter((word) => body.some((b) => b.includes(word))).length;
      return { task, hits, complete: hits === wanted.length };
    })
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  if (scored.length === 0) return { kind: "none" };

  const full = scored.filter((entry) => entry.complete);
  if (full.length === 1) return { kind: "one", task: full[0].task };
  if (full.length > 1) return { kind: "many", tasks: full.map((entry) => entry.task) };

  // Nothing contained every word: offer the best partials rather than nothing,
  // but never act on them.
  return { kind: "many", tasks: scored.slice(0, 3).map((entry) => entry.task) };
}
