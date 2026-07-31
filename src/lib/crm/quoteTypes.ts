import type { LineForTotals } from "./money";
import type { TaxRate } from "./settings";

/**
 * Quote record shapes.
 *
 * Column names stay snake_case to match Postgres, as everywhere else in the
 * CRM. The line item is a discriminated union on `kind` — modelling a text
 * line as a priced line with null money is how NaN reaches a customer's total.
 */

export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "approved",
  "changes_requested",
  "declined",
  "converted",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  approved: "Approved",
  changes_requested: "Changes requested",
  declined: "Declined",
  converted: "Converted",
};

/**
 * A quote is editable only while it is a draft, or after the customer has
 * asked for changes.
 *
 * Everything else is a document somebody has already been shown. Editing a
 * sent quote in place would mean the copy in the customer's inbox and the copy
 * in the system disagree, with no record that they ever differed — and the
 * customer's copy is the one that was relied on.
 */
export function isEditable(status: QuoteStatus): boolean {
  return status === "draft" || status === "changes_requested";
}

/** Draft totals follow live settings; everything else totals from its snapshot. */
export function isFrozen(status: QuoteStatus): boolean {
  return status !== "draft";
}

export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["sent"],
  // Viewed is recorded by the public page, not chosen by the operator; the
  // other two let the owner record an answer given over the phone.
  sent: ["viewed", "approved", "declined", "changes_requested"],
  viewed: ["approved", "declined", "changes_requested"],
  approved: ["converted"],
  // Reworking after a change request drops back to draft so the numbers
  // re-resolve against current settings.
  changes_requested: ["draft", "sent"],
  declined: ["draft"],
  converted: [],
};

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return QUOTE_TRANSITIONS[from]?.includes(to) ?? false;
}

export type DiscountKind = "none" | "amount" | "percent";

/** Frozen copy of who the quote was addressed to. */
export type ClientSnapshot = {
  displayName: string;
  personName: string | null;
  email: string | null;
  phone: string | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
};

export type PropertySnapshot = {
  street1: string | null;
  street2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  accessNotes: string | null;
};

export type QuoteLineKind = "item" | "text";

export type QuoteLineItem = {
  id: string;
  quote_id: string;
  position: number;
  kind: QuoteLineKind;
  name: string;
  description: string | null;
  quantity_milli: number | null;
  unit: string | null;
  unit_cost_cents: number | null;
  unit_price_cents: number | null;
  taxable: boolean;
  optional: boolean;
  selected: boolean;
  labor_hours: number | null;
  price_book_item_id: string | null;
};

export type Quote = {
  id: string;
  created_at: string;
  updated_at: string;
  quote_number: number;
  client_id: string;
  property_id: string | null;
  lead_id: string | null;
  title: string | null;
  status: QuoteStatus;
  tax_rate_id: string | null;
  tax_snapshot: TaxRate | null;
  discount_kind: DiscountKind;
  discount_value: number;
  deposit_kind: DiscountKind;
  deposit_value: number;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  deposit_cents: number | null;
  client_snapshot: ClientSnapshot | null;
  property_snapshot: PropertySnapshot | null;
  client_message: string | null;
  contract_terms: string | null;
  internal_notes: string | null;
  show_quantities: boolean;
  show_unit_prices: boolean;
  show_line_totals: boolean;
  show_totals_footer: boolean;
  require_signature: boolean;
  valid_until: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  approved_at: string | null;
  declined_at: string | null;
  converted_at: string | null;
  archived_at: string | null;
  public_token: string | null;
  approved_by_name: string | null;
  approved_signature: string | null;
  approved_ip: string | null;
  approved_user_agent: string | null;
  language: "fr" | "en";
  french_version_remitted_at: string | null;
  english_express_wish: boolean;
  electronic_delivery_consent_at: string | null;
  is_itinerant: boolean;
  signing_address: string | null;
  signing_date: string | null;
  contract_copy_delivered_at: string | null;
  custom: Record<string, unknown>;
};

export type QuoteWithLines = Quote & { lines: QuoteLineItem[] };

/**
 * Map a stored line to the shape the money engine wants.
 *
 * Text lines are filtered out by the caller, not handled here — a text line
 * has no money to contribute and giving it a zero would make it look like a
 * priced line worth nothing.
 */
export function toLineForTotals(line: QuoteLineItem): LineForTotals {
  return {
    quantityMilli: line.quantity_milli ?? 0,
    unitPriceCents: line.unit_price_cents ?? 0,
    taxable: line.taxable,
    optional: line.optional,
    selected: line.selected,
  };
}

export function pricedLines(lines: QuoteLineItem[]): QuoteLineItem[] {
  return lines.filter((line) => line.kind === "item");
}

/** "Quote #1042" — the number the customer quotes back to you on the phone. */
export function quoteLabel(quote: Pick<Quote, "quote_number">): string {
  return `Quote #${quote.quote_number}`;
}

export type PriceBookItem = {
  id: string;
  created_at: string;
  updated_at: string;
  item_code: string | null;
  name: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  unit: string | null;
  unit_cost_cents: number | null;
  unit_price_cents: number;
  labor_hours_per_unit: number | null;
  labor_class: string | null;
  taxable: boolean;
  keywords: string | null;
  exclusions: string | null;
  archived_at: string | null;
};

/**
 * Margin on a price book item, as hundredths of a percent — or null when cost
 * is unknown.
 *
 * Null rather than zero, deliberately. The seeded catalog has no cost data at
 * all, and a zero would render as "100% margin" on every line, which is a
 * confident lie. An empty cell is honest.
 */
export function marginHundredths(item: Pick<PriceBookItem, "unit_cost_cents" | "unit_price_cents">): number | null {
  if (item.unit_cost_cents === null || item.unit_price_cents <= 0) return null;
  const profit = item.unit_price_cents - item.unit_cost_cents;
  return Math.round((profit / item.unit_price_cents) * 1_000_000) / 100;
}
