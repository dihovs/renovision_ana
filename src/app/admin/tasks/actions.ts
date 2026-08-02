"use server";

import { revalidatePath } from "next/cache";
import { isSignedIn } from "@/lib/adminAuth";
import { setOwnerTaskDone } from "@/lib/crm/tasks";

/**
 * The only mutation this screen has. Tasks are dictated, never typed here —
 * there is no create form on purpose, because the whole point of the table is
 * that the owner's hands are busy when he thinks of these.
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
