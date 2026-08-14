import { randomBytes } from "crypto";
import { db, isMissingTable, MigrationPendingError, isEmbedFailure } from "./db";
import { calculateQuoteTotals, type Discount, type QuoteTotals } from "./money";
import {
  canChargeTax,
  getCompany,
  getQuoteDefaults,
  getTaxRates,
  resolveTaxRate,
  type TaxRate,
} from "./settings";
import {
  canTransition,
  isFrozen,
  pricedLines,
  toLineForTotals,
  type ClientSnapshot,
  type DiscountKind,
  type PropertySnapshot,
  type Quote,
  type QuoteLineItem,
  type QuoteLineKind,
  type QuoteStatus,
  type QuoteTier,
  type QuoteWithLines,
} from "./quoteTypes";
import { clientSnapshotOf, propertySnapshotOf } from "./snapshots";
import { clientDisplayName } from "./types";

/**
 * Quotes.
 *
 * Two rules that the rest of this file exists to enforce:
 *
 *   A DRAFT resolves everything live — tax rate, client address, price book
 *   values — because it is still being written and should reflect reality.
 *
 *   ANYTHING ELSE totals from its own frozen snapshot. Once a customer has
 *   been shown a number, that number is what they were offered. A tax rate
 *   correction or an address fix must never retroactively rewrite a document
 *   somebody has already relied on.
 */

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

function orNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** No tax at all — used when the company is not registered to collect it. */
const NO_TAX: TaxRate = { id: "unregistered", label: "No tax", components: [] };

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

/**
 * Which tax rate actually applies to this quote.
 *
 * The registration gate comes FIRST and overrides everything. A company below
 * the $30,000 small-supplier threshold is not registered and must not collect
 * GST or QST — so no per-line taxable flag, client override or account default
 * can put tax on the document.
 */
export async function resolveQuoteTaxRate(
  quote: Pick<Quote, "status" | "tax_rate_id" | "tax_snapshot">,
  clientTaxRateId?: string | null,
  propertyTaxRateId?: string | null,
): Promise<TaxRate> {
  const company = await getCompany();
  if (!canChargeTax(company)) return NO_TAX;

  // A sent quote carries its own frozen rate and never consults settings again.
  if (isFrozen(quote.status) && quote.tax_snapshot) return quote.tax_snapshot;

  const rates = await getTaxRates();
  return resolveTaxRate(rates, quote.tax_rate_id, propertyTaxRateId, clientTaxRateId);
}

export function quoteDiscount(quote: Pick<Quote, "discount_kind" | "discount_value">): Discount {
  return { kind: quote.discount_kind, value: quote.discount_value };
}

export function quoteDeposit(quote: Pick<Quote, "deposit_kind" | "deposit_value">): Discount {
  return { kind: quote.deposit_kind, value: quote.deposit_value };
}

/**
 * Totals for a quote. All arithmetic lives in money.ts — this only assembles
 * the inputs, so there is exactly one implementation of the tax order.
 */
export function totalsFor(quote: QuoteWithLines, taxRate: TaxRate): QuoteTotals {
  return calculateQuoteTotals(
    pricedLines(quote.lines).map(toLineForTotals),
    taxRate,
    quoteDiscount(quote),
    quoteDeposit(quote),
  );
}

/** Write the computed figures back, so lists and reports don't re-total everything. */
async function persistTotals(quoteId: string, totals: QuoteTotals): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("quotes")
    .update({
      subtotal_cents: totals.subtotalCents,
      discount_cents: totals.discountCents,
      tax_cents: totals.totalTaxCents,
      total_cents: totals.totalCents,
      deposit_cents: totals.depositCents,
    })
    .eq("id", quoteId);
  if (error) throw new Error(`Could not save totals: ${error.message}`);
}

/** Recompute and store. Called after any edit that can move a number. */
export async function recalculate(quoteId: string): Promise<QuoteTotals> {
  const quote = await getQuote(quoteId);
  if (!quote) throw new Error("Quote not found");
  const rate = await resolveQuoteTaxRateForQuote(quote);
  const totals = totalsFor(quote, rate);
  await persistTotals(quoteId, totals);
  return totals;
}

/** Resolve the rate for a loaded quote, following quote → property → client. */
export async function resolveQuoteTaxRateForQuote(quote: QuoteWithLines): Promise<TaxRate> {
  const client = requireDb();

  if (isFrozen(quote.status) && quote.tax_snapshot) {
    const company = await getCompany();
    return canChargeTax(company) ? quote.tax_snapshot : NO_TAX;
  }

  // Only a draft needs the live chain, so this lookup is skipped entirely for
  // every sent document.
  const [{ data: clientRow }, { data: propertyRow }] = await Promise.all([
    client.from("clients").select("tax_rate_id").eq("id", quote.client_id).maybeSingle(),
    quote.property_id
      ? client.from("properties").select("tax_rate_id").eq("id", quote.property_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return resolveQuoteTaxRate(
    quote,
    (clientRow as { tax_rate_id: string | null } | null)?.tax_rate_id,
    (propertyRow as { tax_rate_id: string | null } | null)?.tax_rate_id,
  );
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type QuoteListItem = Quote & { client_name: string };

export async function listQuotes(
  options: { status?: QuoteStatus; clientId?: string; search?: string; limit?: number } = {},
): Promise<QuoteListItem[]> {
  const client = requireDb();
  const { status, clientId, search, limit = 200 } = options;

  // Two forms, like listProjects and listClients: the customer's name is
  // embedded, and an estimate list that will not open because that
  // relationship could not be resolved is worse than one showing an estimate
  // with no name against it.
  const build = (select: string) => {
    let q = client
      .from("quotes")
      .select(select)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (status) q = q.eq("status", status);
    if (clientId) q = q.eq("client_id", clientId);

    const term = search?.trim();
    if (term) {
      const safe = term.replace(/[,()]/g, " ");
      const asNumber = Number(safe);
      q = Number.isInteger(asNumber) ? q.eq("quote_number", asNumber) : q.ilike("title", `%${safe}%`);
    }
    return q;
  };

  let { data, error } = await build("*, clients(first_name, last_name, company_name)");

  if (error && isEmbedFailure(error)) {
    console.warn("[quotes] embed failed, falling back to a plain list", error.message);
    ({ data, error } = await build("*"));
  }

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("quotes", error.message);
    throw new Error(`Could not load quotes: ${error.message}`);
  }

  return ((data ?? []) as unknown as (Quote & {
    clients: Parameters<typeof clientDisplayName>[0] | null;
  })[]).map(
    ({ clients, ...quote }) => ({
      ...quote,
      client_name: clients ? clientDisplayName(clients) : "Unknown client",
    }),
  );
}

export async function getQuote(id: string): Promise<QuoteWithLines | null> {
  const client = requireDb();
  const { data, error } = await client
    .from("quotes")
    .select("*, quote_line_items(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("quotes", error.message);
    throw new Error(`Could not load the quote: ${error.message}`);
  }
  if (!data) return null;
  return normaliseQuote(data as Quote & { quote_line_items: QuoteLineItem[] });
}

/** Public lookup by token, for the customer-facing page. */
export async function getQuoteByToken(token: string): Promise<QuoteWithLines | null> {
  const client = requireDb();
  // Tokens are 32 random bytes; anything else is not worth a database round
  // trip and is almost certainly someone probing.
  if (!/^[a-f0-9]{40,80}$/i.test(token)) return null;

  const { data, error } = await client
    .from("quotes")
    .select("*, quote_line_items(*)")
    .eq("public_token", token)
    .maybeSingle();

  if (error || !data) return null;
  return normaliseQuote(data as Quote & { quote_line_items: QuoteLineItem[] });
}

function normaliseQuote(row: Quote & { quote_line_items: QuoteLineItem[] }): QuoteWithLines {
  const { quote_line_items, ...quote } = row;
  return {
    ...quote,
    lines: (quote_line_items ?? []).sort((a, b) => a.position - b.position),
  };
}

export async function countQuotesByStatus(): Promise<Record<string, number>> {
  const client = db();
  if (!client) return {};
  const { data, error } = await client.from("quotes").select("status").is("archived_at", null);
  if (error) return {};
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { status: string }[]) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type QuoteLineInput = {
  kind: QuoteLineKind;
  name: string;
  description?: string | null;
  quantityMilli?: number | null;
  unit?: string | null;
  unitCostCents?: number | null;
  unitPriceCents?: number | null;
  taxable?: boolean;
  optional?: boolean;
  selected?: boolean;
  laborHours?: number | null;
  priceBookItemId?: string | null;
  tier?: QuoteTier | null;
};

export type QuoteInput = {
  clientId: string;
  propertyId?: string | null;
  leadId?: string | null;
  /** The project this estimate is being built under, if any. */
  projectId?: string | null;
  title?: string | null;
  taxRateId?: string | null;
  discountKind?: DiscountKind;
  discountValue?: number;
  depositKind?: DiscountKind;
  depositValue?: number;
  clientMessage?: string | null;
  contractTerms?: string | null;
  internalNotes?: string | null;
  showQuantities?: boolean;
  showUnitPrices?: boolean;
  showLineTotals?: boolean;
  showTotalsFooter?: boolean;
  requireSignature?: boolean;
  validUntil?: string | null;
  language?: "fr" | "en";
  isItinerant?: boolean;
  custom?: Record<string, unknown>;
  lines: QuoteLineInput[];
};

function quoteColumns(input: QuoteInput) {
  return {
    client_id: input.clientId,
    property_id: input.propertyId || null,
    lead_id: input.leadId || null,
    project_id: input.projectId || null,
    title: orNull(input.title),
    tax_rate_id: orNull(input.taxRateId),
    discount_kind: input.discountKind ?? "none",
    discount_value: Math.max(0, input.discountValue ?? 0),
    deposit_kind: input.depositKind ?? "none",
    deposit_value: Math.max(0, input.depositValue ?? 0),
    client_message: orNull(input.clientMessage),
    contract_terms: orNull(input.contractTerms),
    internal_notes: orNull(input.internalNotes),
    show_quantities: input.showQuantities ?? true,
    show_unit_prices: input.showUnitPrices ?? true,
    show_line_totals: input.showLineTotals ?? true,
    show_totals_footer: input.showTotalsFooter ?? true,
    require_signature: input.requireSignature ?? false,
    valid_until: input.validUntil || null,
    language: input.language ?? "fr",
    is_itinerant: input.isItinerant ?? false,
    custom: input.custom ?? {},
  };
}

function lineColumns(quoteId: string, line: QuoteLineInput, position: number) {
  const isText = line.kind === "text";
  return {
    quote_id: quoteId,
    position,
    kind: line.kind,
    name: line.name.trim().slice(0, 500) || (isText ? "—" : "Item"),
    description: orNull(line.description),
    // The database CHECK enforces this too; doing it here as well means a
    // malformed row fails as a clear message rather than a constraint name.
    quantity_milli: isText ? null : (line.quantityMilli ?? 0),
    unit: orNull(line.unit),
    unit_cost_cents: isText ? null : (line.unitCostCents ?? null),
    unit_price_cents: isText ? null : (line.unitPriceCents ?? 0),
    taxable: line.taxable ?? true,
    optional: line.optional ?? false,
    // A non-optional line is always in; storing it as unselected would violate
    // the table's own constraint.
    selected: line.optional ? (line.selected ?? false) : false,
    labor_hours: line.laborHours ?? null,
    price_book_item_id: line.priceBookItemId || null,
    // Same guard as `selected`: a tier on a line that isn't optional would
    // violate quote_line_tier_requires_optional, so it's dropped here rather
    // than surfacing as a database error on save.
    tier: line.optional ? (line.tier ?? null) : null,
  };
}

export async function createQuote(input: QuoteInput): Promise<string> {
  const client = requireDb();
  const defaults = await getQuoteDefaults();

  // Default validity comes from settings so the owner sets it once.
  const validUntil =
    input.validUntil ||
    new Date(Date.now() + defaults.validDays * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await client
    .from("quotes")
    .insert({ ...quoteColumns(input), valid_until: validUntil })
    .select("id")
    .single();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("quotes", error.message);
    throw new Error(`Could not create the quote: ${error.message}`);
  }

  const id = data.id as string;
  await replaceLines(id, input.lines);
  await recalculate(id);
  return id;
}

export async function updateQuote(id: string, input: QuoteInput): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("quotes").update(quoteColumns(input)).eq("id", id);
  if (error) throw new Error(`Could not save the quote: ${error.message}`);
  await replaceLines(id, input.lines);
  await recalculate(id);
}

/**
 * Replace every line in one shot.
 *
 * Delete-then-insert rather than a per-row diff. The operator reorders, splits
 * and deletes rows freely, so matching old rows to new ones would mean
 * inventing stable client-side ids and reconciling them — for a table that is
 * wholly owned by its parent and never referenced from outside.
 */
async function replaceLines(quoteId: string, lines: QuoteLineInput[]): Promise<void> {
  const client = requireDb();

  const { error: deleteError } = await client
    .from("quote_line_items")
    .delete()
    .eq("quote_id", quoteId);
  if (deleteError) throw new Error(`Could not update lines: ${deleteError.message}`);

  // 100 is the practical ceiling; past that the document stops being readable
  // and the failure mode is a customer scrolling a wall of rows.
  const rows = lines.slice(0, 100).map((line, index) => lineColumns(quoteId, line, index));
  if (rows.length === 0) return;

  const { error } = await client.from("quote_line_items").insert(rows);
  if (error) throw new Error(`Could not save lines: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Freeze and issue.
 *
 * This is the moment everything stops being live: the tax rate, the client's
 * name and address, and the service address are all copied onto the quote. A
 * public token is minted so the customer has a link that reveals nothing about
 * the rest of the system.
 */
export async function sendQuote(id: string): Promise<{ token: string }> {
  const client = requireDb();
  const quote = await getQuote(id);
  if (!quote) throw new Error("Quote not found");

  if (quote.status !== "draft" && quote.status !== "changes_requested") {
    throw new Error(`A ${quote.status} quote cannot be sent again.`);
  }

  const company = await getCompany();
  // Building Act s. 57.1 requires the licence number on estimates, quotes,
  // contracts and statements of account. Issuing without it is a penal
  // offence, so this refuses rather than warns.
  if (!company.rbqLicence.trim()) {
    throw new Error(
      "Add your RBQ licence number in Settings before sending — Quebec law requires it on every quote.",
    );
  }

  const [clientRow, propertyRow] = await Promise.all([
    client.from("clients").select("*").eq("id", quote.client_id).maybeSingle(),
    quote.property_id
      ? client.from("properties").select("*").eq("id", quote.property_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (clientRow.error || !clientRow.data) throw new Error("Could not load the client to send to.");

  // The field mapping lives in snapshots.ts, shared with the job that gets
  // started straight from a client with no quote — two copies of it is how one
  // of them ends up missing a line of the address.
  const c = clientRow.data as Parameters<typeof clientSnapshotOf>[0];
  const p = (propertyRow.data ?? null) as Parameters<typeof propertySnapshotOf>[0];

  const clientSnapshot: ClientSnapshot = clientSnapshotOf(c);
  const propertySnapshot: PropertySnapshot | null = propertySnapshotOf(p);

  // Resolve the rate one last time while it is still live, then freeze it.
  const taxSnapshot = await resolveQuoteTaxRate(quote, c.tax_rate_id, p?.tax_rate_id);

  // 32 bytes of randomness, not the row id — a link built from the id would let
  // anyone who saw one guess at others.
  const token = quote.public_token ?? randomBytes(32).toString("hex");
  const now = new Date().toISOString();

  const { error } = await client
    .from("quotes")
    .update({
      status: "sent",
      sent_at: now,
      public_token: token,
      tax_snapshot: taxSnapshot,
      client_snapshot: clientSnapshot,
      property_snapshot: propertySnapshot,
      // Charter of the French Language s. 55: the French version must be
      // remitted before the parties can be bound by another-language one.
      // Sending in French satisfies that here and now; sending in English
      // requires the French version to have gone first.
      ...(quote.language === "fr" ? { french_version_remitted_at: now } : {}),
    })
    .eq("id", id);

  if (error) throw new Error(`Could not send the quote: ${error.message}`);

  // Totals recomputed against the frozen rate, so the stored figures match the
  // document from this moment on.
  await recalculate(id);

  return { token };
}

export async function setQuoteStatus(id: string, status: QuoteStatus): Promise<void> {
  const client = requireDb();
  const quote = await getQuote(id);
  if (!quote) throw new Error("Quote not found");

  if (!canTransition(quote.status, status)) {
    throw new Error(`A ${quote.status} quote cannot become ${status}.`);
  }

  const now = new Date().toISOString();
  const stamps: Record<string, string | null> = {};
  if (status === "approved") stamps.approved_at = now;
  if (status === "declined") stamps.declined_at = now;
  if (status === "converted") stamps.converted_at = now;
  // Back to draft means reworking it, so the old answer must not linger.
  if (status === "draft") {
    stamps.approved_at = null;
    stamps.declined_at = null;
  }

  const { error } = await client.from("quotes").update({ status, ...stamps }).eq("id", id);
  if (error) throw new Error(`Could not update the quote: ${error.message}`);
}

/** Record the first time the customer opened the link. Never overwrites. */
export async function recordQuoteView(token: string): Promise<void> {
  const client = db();
  if (!client) return;
  const now = new Date().toISOString();
  // Only promotes 'sent' → 'viewed'; an approved quote reopened later must not
  // fall back down the funnel.
  await client
    .from("quotes")
    .update({ viewed_at: now, status: "viewed" })
    .eq("public_token", token)
    .eq("status", "sent");
}

/**
 * The customer accepts.
 *
 * Records which optional lines they chose, because that selection is part of
 * what was agreed — not a display preference. Guarded on the quote still being
 * open, so a replayed request cannot re-approve or overwrite the first answer.
 */
export async function approveQuoteByToken(
  token: string,
  approval: {
    name: string;
    signature?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    selectedLineIds: string[];
  },
): Promise<QuoteWithLines | null> {
  const client = requireDb();
  const quote = await getQuoteByToken(token);
  if (!quote) return null;
  if (quote.status !== "sent" && quote.status !== "viewed") return null;

  // Expiry is checked against the customer's own clock-independent date.
  if (quote.valid_until && quote.valid_until < new Date().toISOString().slice(0, 10)) {
    throw new Error("This quote has expired. Please contact us for an updated price.");
  }

  const chosen = new Set(approval.selectedLineIds);
  const optional = quote.lines.filter((line) => line.optional);

  // Persist the selection before flipping status: if the second write fails,
  // an unapproved quote with the right ticks is recoverable, whereas an
  // approved quote with the wrong ones is a dispute.
  for (const line of optional) {
    const selected = chosen.has(line.id);
    if (selected === line.selected) continue;
    const { error } = await client
      .from("quote_line_items")
      .update({ selected })
      .eq("id", line.id)
      .eq("quote_id", quote.id);
    if (error) throw new Error(`Could not record your selection: ${error.message}`);
  }

  const { error } = await client
    .from("quotes")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by_name: approval.name.trim().slice(0, 200),
      approved_signature: approval.signature ?? null,
      approved_ip: approval.ip ?? null,
      approved_user_agent: approval.userAgent?.slice(0, 500) ?? null,
    })
    .eq("id", quote.id)
    // Re-checked in the WHERE clause, so two simultaneous approvals cannot
    // both win.
    .in("status", ["sent", "viewed"]);

  if (error) throw new Error(`Could not record the approval: ${error.message}`);

  await recalculate(quote.id);
  return getQuote(quote.id);
}

export async function requestChangesByToken(token: string, message: string): Promise<boolean> {
  const client = requireDb();
  const quote = await getQuoteByToken(token);
  if (!quote) return false;
  if (quote.status !== "sent" && quote.status !== "viewed") return false;

  // Appended rather than replacing internal notes — the owner's own notes are
  // not the customer's to overwrite.
  const stamp = new Date().toISOString().slice(0, 10);
  const note = `[${stamp}] Customer requested changes: ${message.trim().slice(0, 2000)}`;
  const combined = quote.internal_notes ? `${quote.internal_notes}\n\n${note}` : note;

  const { error } = await client
    .from("quotes")
    .update({ status: "changes_requested", internal_notes: combined })
    .eq("id", quote.id)
    .in("status", ["sent", "viewed"]);

  if (error) throw new Error(`Could not send your message: ${error.message}`);
  return true;
}

export async function setQuoteArchived(id: string, archived: boolean): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("quotes")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(`Could not archive the quote: ${error.message}`);
}
