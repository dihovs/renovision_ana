import { isMissingColumn, refuse, type ConversionResult } from "./conversions";
import { db, isMissingTable, MigrationPendingError } from "./db";
import type {
  Client,
  ClientInput,
  ClientWithProperties,
  Property,
  PropertyInput,
} from "./types";
import { clientDisplayName } from "./types";

/**
 * Clients and their properties.
 *
 * Reads use `select("*")` deliberately. The lead list is an explicit column
 * list, and twice now a field was added to the TypeScript type but not to that
 * string — the result is cast, so the column comes back `undefined` and renders
 * as nothing instead of failing. `*` cannot drift from the type. These tables
 * hold no column the operator shouldn't see, so there is nothing to withhold.
 */

/** Channel ids to the labels used in the lead-source picker. */
const LEAD_SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  phone: "Phone",
  whatsapp: "Referral",
};

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

/** Empty string from a form input means "not provided", not "set to blank". */
function orNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function billingColumns(input: ClientInput) {
  const b = input.billing ?? {};
  return {
    billing_street1: orNull(b.street1),
    billing_street2: orNull(b.street2),
    billing_city: orNull(b.city),
    billing_province: orNull(b.province),
    billing_postal_code: orNull(b.postalCode),
    billing_country: orNull(b.country) ?? "Canada",
  };
}

function clientColumns(input: ClientInput) {
  return {
    first_name: orNull(input.firstName),
    last_name: orNull(input.lastName),
    company_name: orNull(input.companyName),
    emails: input.emails ?? [],
    phones: input.phones ?? [],
    ...billingColumns(input),
    tax_rate_id: orNull(input.taxRateId),
    lead_source: orNull(input.leadSource),
    tags: input.tags ?? [],
    notes: orNull(input.notes),
    custom: input.custom ?? {},
  };
}

function propertyColumns(input: PropertyInput) {
  return {
    street1: orNull(input.street1),
    street2: orNull(input.street2),
    city: orNull(input.city),
    province: orNull(input.province),
    postal_code: orNull(input.postalCode),
    country: orNull(input.country) ?? "Canada",
    google_place_id: orNull(input.googlePlaceId),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    tax_rate_id: orNull(input.taxRateId),
    access_notes: orNull(input.accessNotes),
    notes: orNull(input.notes),
    custom: input.custom ?? {},
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type ClientListItem = Client & { property_count: number };

/**
 * Client list, most recently touched first, archived rows excluded.
 *
 * `search` matches across given name, surname and company in one pass — the
 * operator types "ajax" or "tremblay" without first deciding which field it is.
 */
export async function listClients(
  options: { search?: string; limit?: number; includeArchived?: boolean } = {},
): Promise<ClientListItem[]> {
  const client = requireDb();
  const { search, limit = 200, includeArchived = false } = options;

  let query = client
    .from("clients")
    .select("*, properties(id)")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!includeArchived) query = query.is("archived_at", null);

  const term = search?.trim();
  if (term) {
    // Escaping matters: a comma inside the term would otherwise be read as an
    // `or` separator and split the filter into malformed clauses.
    const safe = term.replace(/[,()]/g, " ");
    query = query.or(
      `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,company_name.ilike.%${safe}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("clients");
    throw new Error(`Could not load clients: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const { properties, ...rest } = row as Client & { properties: { id: string }[] };
    return { ...rest, property_count: properties?.length ?? 0 };
  });
}

export async function getClient(id: string): Promise<ClientWithProperties | null> {
  const client = requireDb();
  const { data, error } = await client
    .from("clients")
    .select("*, properties(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("clients");
    throw new Error(`Could not load client: ${error.message}`);
  }
  if (!data) return null;

  const row = data as Client & { properties: Property[] };
  return {
    ...row,
    // Newest last: the first property entered is normally the main one, and
    // reordering it under later additions makes the common case harder to find.
    properties: (row.properties ?? [])
      .filter((p) => !p.archived_at)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}

export async function countClients(): Promise<number> {
  const client = db();
  if (!client) return 0;
  const { count, error } = await client
    .from("clients")
    .select("id", { count: "exact", head: true })
    .is("archived_at", null);
  if (error) return 0;
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Create a client and, optionally, its first property in one call.
 *
 * The property is inserted second because it needs the client's id. If that
 * second insert fails the client is still created rather than rolled back —
 * losing the whole record because an address was malformed would be worse than
 * a client with no property, which the detail page can fix in one click.
 */
export async function createClient(
  input: ClientInput,
  property?: PropertyInput,
  options: { leadId?: string | null } = {},
): Promise<string> {
  const client = requireDb();
  const columns = clientColumns(input);

  let insert = options.leadId
    ? await client
        .from("clients")
        .insert({ ...columns, lead_id: options.leadId })
        .select("id")
        .single()
    : await client.from("clients").insert(columns).select("id").single();

  // `clients.lead_id` arrives with migration 0019, and these are applied by
  // hand. Until it exists, fall back to a plain insert: the lead still gets
  // linked from its own side, which is how this worked before.
  if (insert.error && options.leadId && isMissingColumn(insert.error)) {
    console.warn("[clients] clients.lead_id is missing — run supabase/migrations/0019_conversions.sql");
    insert = await client.from("clients").insert(columns).select("id").single();
  }

  const { data, error } = insert;

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("clients");
    if (error.message.includes("clients_have_a_name")) {
      throw new Error("Enter a first name, last name, or company name.");
    }
    throw new Error(`Could not create client: ${error.message}`);
  }

  const id = data!.id as string;

  if (property && hasAnyAddress(property)) {
    try {
      await createProperty(id, property);
    } catch (err) {
      console.error("[clients] client created but property insert failed:", err);
    }
  }

  return id;
}

export async function updateClient(id: string, input: ClientInput): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("clients").update(clientColumns(input)).eq("id", id);
  if (error) {
    if (error.message.includes("clients_have_a_name")) {
      throw new Error("Enter a first name, last name, or company name.");
    }
    throw new Error(`Could not save client: ${error.message}`);
  }
}

/**
 * Archive rather than delete. A client attached to an invoice has to stay
 * readable for tax purposes long after they stop being a customer.
 */
export async function setClientArchived(id: string, archived: boolean): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("clients")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(`Could not archive client: ${error.message}`);
}

export function hasAnyAddress(input: PropertyInput): boolean {
  return Boolean(
    input.street1?.trim() ||
      input.city?.trim() ||
      input.postalCode?.trim() ||
      input.notes?.trim() ||
      input.accessNotes?.trim(),
  );
}

export async function createProperty(clientId: string, input: PropertyInput): Promise<string> {
  const client = requireDb();
  const { data, error } = await client
    .from("properties")
    .insert({ client_id: clientId, ...propertyColumns(input) })
    .select("id")
    .single();
  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("properties");
    throw new Error(`Could not add property: ${error.message}`);
  }
  return data.id as string;
}

export async function updateProperty(id: string, input: PropertyInput): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("properties").update(propertyColumns(input)).eq("id", id);
  if (error) throw new Error(`Could not save property: ${error.message}`);
}

export async function archiveProperty(id: string): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("properties")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Could not remove property: ${error.message}`);
}

/** Enough of a client row to say who it is and whether it is still on the board. */
type ClientStub = Pick<Client, "id" | "first_name" | "last_name" | "company_name" | "archived_at">;

const CLIENT_STUB_COLUMNS = "id, first_name, last_name, company_name, archived_at";

async function loadClientStub(id: string): Promise<ClientStub | null> {
  const client = requireDb();
  const { data, error } = await client
    .from("clients")
    .select(CLIENT_STUB_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not read the client: ${error.message}`);
  return (data as ClientStub | null) ?? null;
}

/**
 * The client this lead was already turned into, found from the CLIENT's side.
 *
 * The link is written twice on purpose. `leads.client_id` is the one the lead
 * pipeline reads; `clients.lead_id` (migration 0019, with a unique index behind
 * it) is the one that makes a second conversion impossible even when the first
 * write failed halfway. Returns null — not an error — before 0019 is applied,
 * so lead conversion keeps working on a schema one file behind.
 */
async function findClientForLead(leadId: string): Promise<ClientStub | null> {
  const client = requireDb();
  const { data, error } = await client
    .from("clients")
    .select(CLIENT_STUB_COLUMNS)
    .eq("lead_id", leadId)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingColumn(error)) return null;
    throw new Error(`Could not check whether the lead was already converted: ${error.message}`);
  }
  return (data as ClientStub | null) ?? null;
}

/** Point the lead at its client. Best effort, retried once. */
async function linkLeadToClient(leadId: string, clientId: string): Promise<boolean> {
  const client = requireDb();
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await client.from("leads").update({ client_id: clientId }).eq("id", leadId);
    if (!error) return true;
    if (attempt === 1) {
      console.error(`[clients] client ${clientId} created but lead ${leadId} link failed:`, error.message);
    }
  }
  return false;
}

/**
 * Turn an existing lead into a client, keeping the lead row intact.
 *
 * The lead is the customer's own words and the estimator's original numbers;
 * the client is the tidied record. Replacing one with the other loses the
 * evidence of what was actually asked for, so both are kept and linked.
 *
 * Idempotent. A lead that already has a client hands that client back; a lead
 * whose client was created but never linked (the first write succeeded, the
 * second didn't) is re-linked rather than converted twice — which is what
 * `clients.lead_id` is for. A client that has since been ARCHIVED refuses
 * instead: silently reopening a record the owner deliberately filed away is
 * indistinguishable from the button doing nothing.
 */
export async function convertLeadToClient(leadId: string): Promise<ConversionResult> {
  const client = requireDb();

  const { data: lead, error: readError } = await client
    .from("leads")
    .select("id, name, email, phone, address, client_id, source")
    .eq("id", leadId)
    .maybeSingle();

  if (readError) {
    if (isMissingTable(readError)) throw new MigrationPendingError("leads");
    throw new Error(`Could not read lead: ${readError.message}`);
  }
  if (!lead) refuse("not_found", "That lead no longer exists.");

  // Either side of the link will do. The lead's own pointer is checked first
  // because it is the one that exists on every schema.
  const existing =
    (lead.client_id ? await loadClientStub(lead.client_id as string) : null) ??
    (await findClientForLead(leadId));

  if (existing) {
    if (existing.archived_at) {
      refuse(
        "already_converted",
        `This lead is already ${clientDisplayName(existing)}, whose client record is archived. ` +
          `Restore that client rather than converting the lead again.`,
      );
    }
    // Self-healing: puts the lead's own pointer back if that write was the half
    // that failed last time.
    if (!lead.client_id) await linkLeadToClient(leadId, existing.id);
    return { id: existing.id, created: false };
  }

  const name = String(lead.name ?? "").trim();
  const space = name.lastIndexOf(" ");
  const firstName = space > 0 ? name.slice(0, space) : name;
  const lastName = space > 0 ? name.slice(space + 1) : "";

  const clientId = await createClient(
    {
      firstName,
      lastName,
      emails: lead.email
        ? [
            {
              address: String(lead.email),
              type: "main",
              primary: true,
              receivesQuotes: true,
              receivesInvoices: true,
            },
          ]
        : [],
      phones: lead.phone
        ? [{ number: String(lead.phone), type: "mobile", primary: true, smsAllowed: false }]
        : [],
      // Carried from the lead rather than assumed. Hardcoding "Website"
      // silently mis-attributed every phone-originated client in reports.
      leadSource: LEAD_SOURCE_LABELS[String(lead.source ?? "website")] ?? "Website",
    },
    // The chat widget collects a single free-text address, which is the
    // service address, not a parsed billing one. It goes on the property as
    // street1 and can be corrected there; guessing at a city/postcode split
    // would put invented data in the record.
    lead.address ? { street1: String(lead.address) } : undefined,
    { leadId },
  );

  await linkLeadToClient(leadId, clientId);

  return { id: clientId, created: true };
}
