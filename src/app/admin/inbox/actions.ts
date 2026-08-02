"use server";

import { revalidatePath } from "next/cache";
import { isSignedIn } from "@/lib/adminAuth";
import { fileMessage } from "@/lib/whatsapp/store";

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
