"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/adminAuth";
import {
  conversionError,
  type ConversionResult,
  type ConversionState,
} from "@/lib/crm/conversions";
import { ensureHubToken, revokeHubToken } from "@/lib/crm/hub";
import { createJobForClient } from "@/lib/crm/jobs";
import { parseMoneyToCents } from "@/lib/crm/money";
import { sendSms } from "@/lib/sms/send";
import {
  archiveProperty,
  convertLeadToClient,
  createClient,
  createProperty,
  hasAnyAddress,
  setClientArchived,
  updateClient,
  updateProperty,
} from "@/lib/crm/clients";
import type { AddressInput, ClientInput, EmailContact, PhoneContact, PropertyInput } from "@/lib/crm/types";
import { CONTACT_TYPES } from "@/lib/crm/types";

export type ClientFormState = { error?: string };

/**
 * The UI already sits behind the layout's auth check, but a server action is a
 * public endpoint — hiding a form is not access control.
 */
async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) throw new Error("Not authorised");
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string): number | null {
  const raw = str(formData, key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function address(formData: FormData, prefix: string): AddressInput {
  return {
    street1: str(formData, `${prefix}Street1`),
    street2: str(formData, `${prefix}Street2`),
    city: str(formData, `${prefix}City`),
    province: str(formData, `${prefix}Province`),
    postalCode: str(formData, `${prefix}PostalCode`),
    country: str(formData, `${prefix}Country`),
    googlePlaceId: str(formData, `${prefix}PlaceId`),
    latitude: num(formData, `${prefix}Latitude`),
    longitude: num(formData, `${prefix}Longitude`),
  };
}

/**
 * Contacts arrive as one JSON blob per kind rather than as indexed form
 * fields, because the rows are added and removed client-side and reindexing
 * `emails[2][type]` on every delete is a bug factory. Everything is re-checked
 * here: the JSON came from a browser, so its shape is a claim, not a fact.
 */
function contacts(formData: FormData): { emails: EmailContact[]; phones: PhoneContact[] } {
  let emails: EmailContact[] = [];
  let phones: PhoneContact[] = [];

  try {
    const raw = JSON.parse(str(formData, "emails") || "[]") as unknown[];
    emails = raw.flatMap((entry) => {
      const e = entry as Partial<EmailContact>;
      const value = String(e.address ?? "").trim();
      if (!value) return [];
      return [
        {
          address: value.slice(0, 320),
          type: CONTACT_TYPES.includes(e.type as never) ? e.type! : "main",
          primary: Boolean(e.primary),
          receivesQuotes: e.receivesQuotes !== false,
          receivesInvoices: e.receivesInvoices !== false,
        },
      ];
    });
  } catch {
    emails = [];
  }

  try {
    const raw = JSON.parse(str(formData, "phones") || "[]") as unknown[];
    phones = raw.flatMap((entry) => {
      const p = entry as Partial<PhoneContact>;
      const value = String(p.number ?? "").trim();
      if (!value) return [];
      return [
        {
          number: value.slice(0, 40),
          type: CONTACT_TYPES.includes(p.type as never) ? p.type! : "mobile",
          primary: Boolean(p.primary),
          smsAllowed: Boolean(p.smsAllowed),
        },
      ];
    });
  } catch {
    phones = [];
  }

  // Exactly one primary of each kind. A list with none is as broken as a list
  // with two — "the number to call" has to resolve to something.
  if (emails.length && !emails.some((e) => e.primary)) emails[0].primary = true;
  if (phones.length && !phones.some((p) => p.primary)) phones[0].primary = true;
  let seenEmail = false;
  emails = emails.map((e) => {
    const primary = e.primary && !seenEmail;
    if (primary) seenEmail = true;
    return { ...e, primary };
  });
  let seenPhone = false;
  phones = phones.map((p) => {
    const primary = p.primary && !seenPhone;
    if (primary) seenPhone = true;
    return { ...p, primary };
  });

  return { emails, phones };
}

function clientInput(formData: FormData): ClientInput {
  const { emails, phones } = contacts(formData);
  return {
    firstName: str(formData, "firstName"),
    lastName: str(formData, "lastName"),
    companyName: str(formData, "companyName"),
    emails,
    phones,
    billing: address(formData, "billing"),
    taxRateId: str(formData, "taxRateId") || null,
    leadSource: str(formData, "leadSource") || null,
    tags: str(formData, "tags")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20),
    notes: str(formData, "notes").slice(0, 10_000) || null,
    custom: customFields(formData),
  };
}

/** Custom field values are posted as custom__<id>. */
function customFields(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("custom__")) continue;
    const id = key.slice("custom__".length);
    if (!id) continue;
    out[id] = typeof value === "string" ? value.slice(0, 2000) : "";
  }
  return out;
}

function propertyInput(formData: FormData, prefix: string): PropertyInput {
  return {
    ...address(formData, prefix),
    taxRateId: str(formData, "propertyTaxRateId") || null,
    accessNotes: str(formData, "accessNotes").slice(0, 5000) || null,
  };
}

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await requireSession();

  let id: string;
  try {
    const input = clientInput(formData);
    // "Same as billing" is resolved in the browser, which copies the billing
    // fields into the property block, so by this point there is one answer.
    const property = propertyInput(formData, "property");
    id = await createClient(input, hasAnyAddress(property) ? property : undefined);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create client." };
  }

  revalidatePath("/admin/clients");
  // Outside the try: redirect signals by throwing, and catching it here would
  // turn a successful save into an error message.
  redirect(`/admin/clients/${id}`);
}

export async function updateClientAction(
  id: string,
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await requireSession();

  try {
    await updateClient(id, clientInput(formData));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save client." };
  }

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
  redirect(`/admin/clients/${id}`);
}

export async function addPropertyAction(
  clientId: string,
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await requireSession();

  const input = propertyInput(formData, "property");
  if (!hasAnyAddress(input)) return { error: "Enter an address." };

  try {
    await createProperty(clientId, input);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not add property." };
  }

  revalidatePath(`/admin/clients/${clientId}`);
  return {};
}

export async function updatePropertyAction(
  clientId: string,
  propertyId: string,
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await requireSession();

  try {
    await updateProperty(propertyId, propertyInput(formData, "property"));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save property." };
  }

  revalidatePath(`/admin/clients/${clientId}`);
  return {};
}

export async function removePropertyAction(clientId: string, propertyId: string): Promise<void> {
  await requireSession();
  await archiveProperty(propertyId);
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function setArchivedAction(id: string, archived: boolean): Promise<void> {
  await requireSession();
  await setClientArchived(id, archived);
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
}

/**
 * Promote a lead to a client. The lead row is kept and linked, not consumed —
 * it is the record of what the customer actually asked for.
 *
 * Idempotent: a lead already converted opens the client it became. The refusal
 * comes back as data rather than thrown, because Next replaces a server
 * action's error message with a generic digest in production and the whole
 * value of these messages is that they say what to do instead.
 */
export async function convertLeadAction(leadId: string): Promise<ConversionState> {
  await requireSession();

  let client: ConversionResult;
  try {
    client = await convertLeadToClient(leadId);
  } catch (err) {
    return conversionError(err, "Could not convert the lead.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${client.id}`);
}

/**
 * Start a job for a client with no quote in front of it.
 *
 * The phone rings, the work is agreed, the crew goes out. This is that path,
 * and it exists because forcing it through the quote screens would mean
 * recording an estimate nobody wrote and an approval nobody gave.
 *
 * One optional price. Most of these calls are "the usual, about eight hundred"
 * — a single figure the owner can break into lines later. Left blank the job is
 * still created; it simply cannot be invoiced until it is worth something,
 * which the invoice button says in as many words.
 */
export async function startJobAction(
  clientId: string,
  _prev: ConversionState,
  formData: FormData,
): Promise<ConversionState> {
  await requireSession();

  const title = str(formData, "title");
  if (!title) return { error: "Say what the job is." };

  const rawAmount = str(formData, "amount");
  const amountCents = rawAmount ? parseMoneyToCents(rawAmount) : null;
  if (rawAmount && amountCents === null) {
    return { error: "That amount doesn't look like a number." };
  }

  let job: ConversionResult;
  try {
    job = await createJobForClient(clientId, {
      propertyId: str(formData, "propertyId") || null,
      title,
      instructions: str(formData, "instructions").slice(0, 5000) || null,
      lines:
        amountCents === null
          ? []
          : [{ name: title, unitPriceCents: amountCents, quantityMilli: 1000 }],
    });
  } catch (err) {
    return conversionError(err, "Could not start the job.");
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/jobs");
  redirect(`/admin/jobs/${job.id}`);
}

export async function createHubLinkAction(clientId: string): Promise<void> {
  await requireSession();
  await ensureHubToken(clientId);
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function revokeHubLinkAction(clientId: string): Promise<void> {
  await requireSession();
  await revokeHubToken(clientId);
  revalidatePath(`/admin/clients/${clientId}`);
}

/**
 * Text a client, from the owner's own hands.
 *
 * Returns a sentence instead of throwing, because every way this fails is
 * something he can act on — an unsubscribed number, a number Twilio will not
 * accept, an environment missing its credentials — and a thrown error would
 * replace the page with an error boundary and lose what he had typed.
 *
 * Deliberately has no "send to everyone" sibling and no automated caller. See
 * the header of lib/sms/send.ts: this path relies on CASL's implied consent
 * from an existing business relationship, which is a claim about a person the
 * owner is already dealing with, not about a list.
 */
export async function sendSmsAction(
  clientId: string,
  phone: string,
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  await requireSession();

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return "Write something first.";

  const result = await sendSms({ to: phone, body, clientId });
  revalidatePath(`/admin/clients/${clientId}`);

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
