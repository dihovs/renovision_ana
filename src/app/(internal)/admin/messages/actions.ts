"use server";

import { revalidatePath } from "next/cache";
import { isSignedIn } from "@/lib/adminAuth";
import { findClientForPhone } from "@/lib/sms/attribution";
import { createClient } from "@/lib/crm/clients";
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

/**
 * Save the stranger who texted in as a client.
 *
 * The inbox works for numbers nobody owns — that is deliberate, and half the
 * point of it. But the moment a stranger turns out to be a job, retyping their
 * number into the client form is both a waste and a chance to fat-finger the
 * one field that has to match for their next text to attribute correctly.
 * So the number comes straight from the thread, already E.164, already the
 * value `findClientForPhone` will look for.
 *
 * `smsAllowed` is true because they texted US first. That is express consent
 * under CASL — the whole conversation is the evidence, and it is sitting in
 * `sms_messages` with timestamps if anybody asks.
 *
 * Marked primary because it is the only number we have. A client created any
 * other way would have had one entered by hand.
 *
 * Returns an error sentence for the form, or null on success — same contract
 * as `sendToPhoneAction` above, so the caller handles both the same way.
 */
export async function saveAsClientAction(
  phone: string,
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  if (!(await isSignedIn())) throw new Error("Not authorised");

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();

  // The database enforces this too (`clients_have_a_name`); saying it here
  // means the owner reads a sentence rather than a constraint name.
  if (!firstName && !lastName && !companyName) {
    return "Enter a first name, last name, or company name.";
  }

  // Racing himself: two tabs, or a double-tap on a slow connection. Better to
  // land on the client that already exists than to make a second one holding
  // the same number, which would then split the thread's attribution.
  const existing = await findClientForPhone(phone).catch(() => null);
  if (existing) {
    revalidatePath(`/admin/messages/${phone.replace(/^\+/, "")}`);
    return null;
  }

  try {
    await createClient({
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      companyName: companyName || undefined,
      phones: [{ number: phone, type: "mobile", primary: true, smsAllowed: true }],
    });
  } catch (err) {
    return err instanceof Error ? err.message : "Could not save the contact.";
  }

  revalidatePath(`/admin/messages/${phone.replace(/^\+/, "")}`);
  revalidatePath("/admin/messages");
  revalidatePath("/admin/clients");
  return null;
}
