"use server";

import { revalidatePath } from "next/cache";
import { isSignedIn } from "@/lib/adminAuth";
import { parseTaskInput } from "@/lib/crm/taskDates";
import {
  createOwnerTask,
  loadTaskBar,
  setOwnerTaskDone,
  type OwnerTask,
} from "@/lib/crm/tasks";

/**
 * The three things the header task bar can do.
 *
 * Separate from `tasks/actions.ts` because the audience is different: that file
 * serves one screen and throws on failure, which is right when the owner is
 * looking straight at the list. This bar is mounted on every admin page, so a
 * missing migration or a paused database must not throw an error boundary over
 * whatever he was actually doing. Every function here RETURNS its outcome and
 * the bar renders it in a line of small text.
 *
 * Authorisation is the exception and is thrown, because a signed-out caller
 * hitting these is not a state to render — it is a request that should never
 * have been made. Re-checked here rather than trusted from the layout: the
 * layout decides what renders, and a server action is a public endpoint.
 */

/** The business runs on Montreal time; the server runs on UTC. */
const TZ = "America/Toronto";

export type TaskBarFailure = {
  ok: false;
  reason: "unconfigured" | "migration_pending" | "failed";
  detail?: string;
};

export type TaskBarData = {
  ok: true;
  /** Still outstanding, newest first. */
  open: OwnerTask[];
  /** Ticked off within the last day, so the tick stays undoable. */
  done: OwnerTask[];
  /** Montreal's calendar date, so the client's due labels match the office's. */
  today: string;
};

export type TaskBarResult = TaskBarData | TaskBarFailure;

async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) throw new Error("Not authorised");
}

/** Montreal's date as `YYYY-MM-DD`. `en-CA` formats in exactly that shape. */
function montrealToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export async function loadTaskBarAction(): Promise<TaskBarResult> {
  await requireSession();

  const result = await loadTaskBar();
  if (!result.ok) return result;

  return {
    ok: true,
    open: result.tasks.filter((task) => !task.done_at),
    done: result.tasks.filter((task) => task.done_at),
    today: montrealToday(),
  };
}

export type AddTaskResult = { ok: true; task: OwnerTask } | TaskBarFailure;

/**
 * Add a note typed into the bar.
 *
 * The due date is read out of the sentence rather than picked from a calendar
 * — see taskDates.ts for why that is safe to do here and what stops it
 * guessing. `dueDateOverride` carries the user's correction: `undefined` means
 * "use whatever you parsed", `null` means "I cleared the chip, this has no
 * date" and a string means "I set it myself". A plain optional would collapse
 * the first two, and clearing the chip would silently do nothing.
 */
export async function addTaskAction(
  text: string,
  dueDateOverride?: string | null,
): Promise<AddTaskResult> {
  await requireSession();

  const today = montrealToday();
  const parsed = parseTaskInput(text, today);
  // Only drop the date phrase from the note when the date is actually being
  // used. If the chip was cleared, the words go back — "for Thursday" was
  // apparently part of what he meant to write.
  const keepParsedDate = dueDateOverride === undefined;
  const body = keepParsedDate ? parsed.body : text.trim();
  const dueDate = keepParsedDate ? parsed.dueDate : dueDateOverride;

  if (!body) return { ok: false, reason: "failed", detail: "Nothing to save." };

  const written = await createOwnerTask({ body, dueDate, source: "web" });
  if (!written.ok) return written;

  // Both screens that count these. The bar updates itself from the returned
  // row; this is for the page underneath it.
  revalidatePath("/admin/tasks");
  revalidatePath("/admin");

  // Echoed back rather than re-fetched: the bar can splice one row into the
  // list it already has, which is one round trip instead of two and no flash
  // of the whole panel reloading.
  return {
    ok: true,
    task: {
      id: written.id,
      created_at: new Date().toISOString(),
      body,
      due_date: dueDate ?? null,
      done_at: null,
      source: "web",
      call_sid: null,
    },
  };
}

export type ToggleTaskResult = { ok: true } | TaskBarFailure;

export async function toggleTaskAction(id: string, done: boolean): Promise<ToggleTaskResult> {
  await requireSession();

  const result = await setOwnerTaskDone(id, done);
  if (!result.ok) return result;

  revalidatePath("/admin/tasks");
  revalidatePath("/admin");
  return { ok: true };
}
