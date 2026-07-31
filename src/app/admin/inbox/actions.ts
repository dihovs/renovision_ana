"use server";

import { revalidatePath } from "next/cache";
import { isSignedIn } from "@/lib/adminAuth";
import { fileMessage } from "@/lib/whatsapp/store";
import { summariseJobThread } from "@/lib/whatsapp/summarise";

export type InboxState = { error?: string; ok?: string };

async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) throw new Error("Not authorised");
}

/** File an unmatched WhatsApp message against a job. */
export async function fileMessageAction(messageId: string, jobId: string): Promise<void> {
  await requireSession();
  await fileMessage(messageId, jobId);
  revalidatePath("/admin/inbox");
  revalidatePath(`/admin/jobs/${jobId}`);
}

/** Re-read the thread. The summary is cached against the message count, so
 *  this is the escape hatch for wanting a fresh read of unchanged messages. */
export async function refreshSummaryAction(jobId: string): Promise<void> {
  await requireSession();
  await summariseJobThread(jobId, { force: true });
  revalidatePath(`/admin/jobs/${jobId}`);
}
