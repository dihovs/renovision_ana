"use server";

import { revalidatePath } from "next/cache";
import { isSignedIn } from "@/lib/adminAuth";
import { setEntriesApproved, stopClockAt } from "@/lib/crm/timeClock";

async function requireSession() {
  if (!(await isSignedIn())) throw new Error("Not authorised");
}

/** Approve every listed entry (a person's week), or take approval back. */
export async function approveEntriesAction(ids: string[], approved: boolean): Promise<void> {
  await requireSession();
  await setEntriesApproved(ids, approved);
  revalidatePath("/admin/timesheets");
}

/** Stop a clock somebody forgot to stop, now. */
export async function stopClockNowAction(entryId: string): Promise<void> {
  await requireSession();
  await stopClockAt(entryId, new Date());
  revalidatePath("/admin/timesheets");
}
