"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/adminAuth";
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
 */
export async function convertLeadAction(leadId: string): Promise<void> {
  await requireSession();
  const clientId = await convertLeadToClient(leadId);
  revalidatePath("/admin");
  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${clientId}`);
}
