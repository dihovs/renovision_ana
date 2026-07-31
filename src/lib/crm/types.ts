/**
 * CRM record shapes.
 *
 * Column names stay snake_case to match what Postgres returns — mapping them
 * to camelCase would mean a translation layer at every read and write, and the
 * one thing worse than two naming conventions is a half-applied mapping.
 * Input types (the `*Input` shapes) are camelCase because they come from forms.
 */

export const CONTACT_TYPES = ["main", "work", "home", "mobile", "fax", "other"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export type EmailContact = {
  address: string;
  type: ContactType;
  primary: boolean;
  /** Quotes are sent to every address with this set, not just the primary. */
  receivesQuotes: boolean;
  receivesInvoices: boolean;
};

export type PhoneContact = {
  number: string;
  type: ContactType;
  primary: boolean;
  smsAllowed: boolean;
};

export type Client = {
  id: string;
  created_at: string;
  updated_at: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  emails: EmailContact[];
  phones: PhoneContact[];
  billing_street1: string | null;
  billing_street2: string | null;
  billing_city: string | null;
  billing_province: string | null;
  billing_postal_code: string | null;
  billing_country: string | null;
  tax_rate_id: string | null;
  lead_source: string | null;
  tags: string[];
  notes: string | null;
  custom: Record<string, unknown>;
  archived_at: string | null;
};

export type Property = {
  id: string;
  created_at: string;
  updated_at: string;
  client_id: string;
  street1: string | null;
  street2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  google_place_id: string | null;
  latitude: number | null;
  longitude: number | null;
  tax_rate_id: string | null;
  access_notes: string | null;
  notes: string | null;
  custom: Record<string, unknown>;
  archived_at: string | null;
};

/** A client with its properties attached, for the detail view. */
export type ClientWithProperties = Client & { properties: Property[] };

export type AddressInput = {
  street1?: string;
  street2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  googlePlaceId?: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type ClientInput = {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  emails?: EmailContact[];
  phones?: PhoneContact[];
  billing?: AddressInput;
  taxRateId?: string | null;
  leadSource?: string | null;
  tags?: string[];
  notes?: string | null;
  custom?: Record<string, unknown>;
};

export type PropertyInput = AddressInput & {
  taxRateId?: string | null;
  accessNotes?: string | null;
  notes?: string | null;
  custom?: Record<string, unknown>;
};

/**
 * How a client is written wherever one name is needed.
 *
 * Company first when there is one: on a job list, "Gestion Ajax" identifies the
 * work and "Marc Tremblay" (whoever answered the phone that day) does not.
 */
export function clientDisplayName(client: {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
}): string {
  const company = client.company_name?.trim();
  const person = [client.first_name?.trim(), client.last_name?.trim()].filter(Boolean).join(" ");
  if (company && person) return company;
  return company || person || "Unnamed client";
}

/** The person's name, when it should be shown under the company name. */
export function clientPersonName(client: {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
}): string | null {
  const person = [client.first_name?.trim(), client.last_name?.trim()].filter(Boolean).join(" ");
  return client.company_name?.trim() && person ? person : null;
}

export function primaryEmail(client: Pick<Client, "emails">): string | null {
  const list = client.emails ?? [];
  return (list.find((e) => e.primary) ?? list[0])?.address ?? null;
}

export function primaryPhone(client: Pick<Client, "phones">): string | null {
  const list = client.phones ?? [];
  return (list.find((p) => p.primary) ?? list[0])?.number ?? null;
}

/** One-line address, skipping the parts that weren't filled in. */
export function formatAddress(
  address: Partial<
    Pick<Property, "street1" | "street2" | "city" | "province" | "postal_code">
  >,
): string {
  const street = [address.street1, address.street2].filter(Boolean).join(", ");
  const region = [address.city, address.province].filter(Boolean).join(", ");
  return [street, region, address.postal_code].filter(Boolean).join(" · ");
}
