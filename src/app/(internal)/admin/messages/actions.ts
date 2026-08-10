"use server";

import { revalidatePath } from "next/cache";
import { isSignedIn } from "@/lib/adminAuth";
import { findClientForPhone } from "@/lib/sms/attribution";
import { sendSms } from "@/lib/sms/send";

/**
 * Send a text from the Messages inbox — to any number, not just a saved
 * client's. The client-page action stays separate because it already knows its
 * client id; this one has to work for a stranger who texted in, so
 * attribution is looked up rather than passed in.
 *
 * Same contract as sendSmsAction: resolves to a sentence for the composer on
 * every outcome the owner can act on, never throws for those.
 */
export async function sendToPhoneAction(
  phone: string,
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  // The UI sits behind the layout's auth check, but a server action is a
  // public endpoint — hiding a form is not access control.
  if (!(await isSignedIn())) throw new Error("Not authorised");

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return "Write something first.";

  // Attributed so the message also files onto the client's own page when the
  // number is known there. A miss is ordinary: strangers are half the point
  // of this inbox.
  const attributed = await findClientForPhone(phone).catch(() => null);

  const result = await sendSms({ to: phone, body, clientId: attributed?.id ?? null });
  revalidatePath(`/admin/messages/${phone.replace(/^\+/, "")}`);
  revalidatePath("/admin/messages");
  if (attributed) revalidatePath(`/admin/clients/${attributed.id}`);

  if (result.sent) return null;
  switch (result.reason) {
    case "opted_out":
      return "That number asked us to stop texting. It has to come from them to start again.";
    case "invalid_number":
      return result.detail ?? "That does not look like a mobile number we can text.";
    case "not_configured":
      return "Texting is not switched on yet — TWILIO_ACCOUNT_SID is missing.";
    default:
      return result.detail ?? "It did not go through. Try again in a moment.";
  }
}
