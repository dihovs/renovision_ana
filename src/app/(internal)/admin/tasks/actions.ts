"use server";

import { revalidatePath } from "next/cache";
import { isSignedIn } from "@/lib/adminAuth";
import { cancelCallTask } from "@/lib/crm/callTasks";
import { setOwnerTaskDone } from "@/lib/crm/tasks";

/**
 * Two mutations, both subtractive.
 *
 * There is no create form on THIS screen, and that is not an oversight: a note
 * is typed into the header task bar (see components/admin/TaskBar.tsx) or
 * dictated to Ana on the phone, both of which work from wherever he already
 * is. A second create form on the page he has to navigate to would be the
 * least useful of the three. Calls are queued by the scheduler, never by hand,
 * so the only thing this screen can do to one is stop it.
 *
 * There is deliberately no "place this call now". Whether a number may be
 * dialled at this minute depends on permitted calling hours, the do-not-call
 * flag and the per-number daily caps, all of which live in the dialer; an
 * action here would be a way around every one of them.
 */

async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) throw new Error("Not authorised");
}

const FAILURE_MESSAGE: Record<string, string> = {
  unconfigured: "No database is connected, so nothing was saved.",
  migration_pending: "The task list table doesn't exist yet — run migration 0017.",
  failed: "The database refused the change.",
};

export async function setTaskDoneAction(id: string, done: boolean): Promise<void> {
  await requireSession();

  const result = await setOwnerTaskDone(id, done);
  if (!result.ok) {
    // Thrown rather than returned: the tick is optimistic-looking, and a
    // silent no-op would leave the owner believing he had cleared something.
    throw new Error(FAILURE_MESSAGE[result.reason] ?? "Could not update the task.");
  }

  revalidatePath("/admin/tasks");
  // Home carries the open count.
  revalidatePath("/admin");
}

const CANCEL_FAILURE_MESSAGE: Record<string, string> = {
  unconfigured: "No database is connected, so the call was not stopped.",
  migration_pending: "The call queue table doesn't exist yet — run migration 0018.",
  not_cancellable: "Too late — that call has already gone out.",
  failed: "The database refused the change.",
};

/**
 * Stop a queued call before it is placed.
 *
 * The session is re-checked here rather than relied upon from the layout: the
 * layout decides what renders, and a server action is a public endpoint that
 * anyone can post to. Hiding the button is not access control.
 *
 * Restricted to `queued` rather than the default `["queued", "dialing"]`, and
 * that restriction is the race guard as much as it is a rule: between the
 * render that drew the button and the click, the dialer may have claimed the
 * row. Zero rows changed means exactly that, and the owner is told the call
 * already went out rather than shown a success he did not get.
 *
 * Cancelled, never deleted — a phone call the business placed or nearly placed
 * is history, and this table does not rewrite it.
 */
export async function cancelCallTaskAction(id: string): Promise<void> {
  await requireSession();

  const result = await cancelCallTask(id, "cancelled from the dashboard", ["queued"]);

  // Thrown, not returned: the row leaves the queue on success, and a silent
  // no-op would leave the owner believing a call had been stopped while it sat
  // waiting to be dialled.
  if (!result.ok) {
    throw new Error(CANCEL_FAILURE_MESSAGE[result.reason] ?? CANCEL_FAILURE_MESSAGE.failed);
  }
  if (result.changed === 0) throw new Error(CANCEL_FAILURE_MESSAGE.not_cancellable);

  revalidatePath("/admin/tasks");
}
