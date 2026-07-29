"use server";

import { revalidatePath } from "next/cache";
import { isSignedIn, signIn, signOut, verifyPassword } from "@/lib/adminAuth";
import { LEAD_STATUSES, updateLeadNotes, updateLeadStatus, type LeadStatus } from "@/lib/leadStore";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "Enter your password." };
  if (!verifyPassword(password)) {
    // Deliberately vague: don't reveal whether a password is configured.
    return { error: "Incorrect password." };
  }
  await signIn();
  revalidatePath("/admin");
  return {};
}

export async function logoutAction(): Promise<void> {
  await signOut();
  revalidatePath("/admin");
}

/**
 * Every mutation re-checks the session server-side. The UI already hides these
 * behind the login screen, but a server action is a public endpoint — hiding
 * the button is not access control.
 */
async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) throw new Error("Not authorised");
}

export async function setStatusAction(id: string, status: string): Promise<void> {
  await requireSession();
  if (!LEAD_STATUSES.includes(status as LeadStatus)) {
    throw new Error(`Unknown status: ${status}`);
  }
  await updateLeadStatus(id, status as LeadStatus);
  revalidatePath("/admin");
}

export async function setNotesAction(id: string, notes: string): Promise<void> {
  await requireSession();
  await updateLeadNotes(id, notes.slice(0, 5000));
  revalidatePath("/admin");
}
