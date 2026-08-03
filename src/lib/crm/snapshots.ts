import { db } from "./db";
import type { ClientSnapshot, PropertySnapshot } from "./quoteTypes";
import { clientDisplayName, clientPersonName, primaryEmail, primaryPhone } from "./types";

/**
 * Freezing who a document is addressed to, and where the work happens.
 *
 * Every document in the CRM carries its own copy of the customer's name,
 * address and contact details rather than joining to the live client row. A
 * customer who moves house next year must not silently rewrite the address on
 * an invoice they were sent in March — that document is evidence of what was
 * agreed, and its whole value is that it does not change.
 *
 * This module exists because there are now two moments that freeze: sending a
 * quote, and starting a job straight from a client with no quote at all. Two
 * copies of the field mapping is how one of them ends up missing `street2`,
 * with nobody noticing until a delivery goes to the wrong unit number.
 */

/** The columns a snapshot needs, plus the tax rate the caller resolves with. */
type ClientRow = Parameters<typeof clientDisplayName>[0] & {
  emails?: unknown;
  phones?: unknown;
  billing_street1: string | null;
  billing_street2: string | null;
  billing_city: string | null;
  billing_province: string | null;
  billing_postal_code: string | null;
  billing_country: string | null;
  tax_rate_id: string | null;
};

type PropertyRow = {
  street1: string | null;
  street2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  access_notes: string | null;
  tax_rate_id: string | null;
};

export function clientSnapshotOf(row: ClientRow): ClientSnapshot {
  return {
    displayName: clientDisplayName(row),
    personName: clientPersonName(row),
    email: primaryEmail({ emails: (row.emails ?? []) as never }),
    phone: primaryPhone({ phones: (row.phones ?? []) as never }),
    street1: row.billing_street1,
    street2: row.billing_street2,
    city: row.billing_city,
    province: row.billing_province,
    postalCode: row.billing_postal_code,
    country: row.billing_country,
  };
}

export function propertySnapshotOf(row: PropertyRow | null): PropertySnapshot | null {
  if (!row) return null;
  return {
    street1: row.street1,
    street2: row.street2,
    city: row.city,
    province: row.province,
    postalCode: row.postal_code,
    country: row.country,
    accessNotes: row.access_notes,
  };
}

export type DocumentSnapshots = {
  client: ClientSnapshot;
  property: PropertySnapshot | null;
  /** Handed back so the caller can resolve the tax rate in the same pass. */
  clientTaxRateId: string | null;
  propertyTaxRateId: string | null;
};

/**
 * Read the live client and property and freeze both.
 *
 * Throws when the client cannot be read: a document with no addressee is not a
 * document, and writing one with `null` there would produce an invoice that
 * cannot legally be issued (Revenu Québec requires the purchaser's name at $500
 * and up) and would fail silently until somebody tried to print it.
 */
export async function loadDocumentSnapshots(
  clientId: string,
  propertyId: string | null,
): Promise<DocumentSnapshots> {
  const client = db();
  if (!client) throw new Error("Database is not configured");

  const [clientRow, propertyRow] = await Promise.all([
    client.from("clients").select("*").eq("id", clientId).maybeSingle(),
    propertyId
      ? client.from("properties").select("*").eq("id", propertyId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (clientRow.error || !clientRow.data) {
    throw new Error("Could not load the client this is for.");
  }

  const c = clientRow.data as ClientRow;
  const p = (propertyRow.data ?? null) as PropertyRow | null;

  return {
    client: clientSnapshotOf(c),
    property: propertySnapshotOf(p),
    clientTaxRateId: c.tax_rate_id,
    propertyTaxRateId: p?.tax_rate_id ?? null,
  };
}
