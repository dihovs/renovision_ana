import type { ClientSnapshot, DiscountKind, PropertySnapshot, QuoteLineKind } from "./quoteTypes";
import type { TaxRate } from "./settings";

/** Jobs, visits, invoices and payments — the work half of the CRM. */

export const JOB_STATUSES = [
  "unscheduled",
  "scheduled",
  "in_progress",
  "complete",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  unscheduled: "Unscheduled",
  scheduled: "Scheduled",
  in_progress: "In progress",
  complete: "Complete",
  cancelled: "Cancelled",
};

/**
 * A line on a job or an invoice.
 *
 * Structurally identical to a quote line on purpose: copying between them is
 * then one mapping, and adding a field to one without the others becomes an
 * obvious omission rather than a silent divergence.
 */
export type DocumentLine = {
  id: string;
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

export type Job = {
  id: string;
  created_at: string;
  updated_at: string;
  job_number: number;
  client_id: string;
  property_id: string | null;
  quote_id: string | null;
  title: string | null;
  instructions: string | null;
  internal_notes: string | null;
  status: JobStatus;
  job_type: "one_off" | "recurring";
  starts_on: string | null;
  ends_on: string | null;
  tax_snapshot: TaxRate | null;
  client_snapshot: ClientSnapshot | null;
  property_snapshot: PropertySnapshot | null;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  completed_at: string | null;
  archived_at: string | null;
  custom: Record<string, unknown>;
};

export type Visit = {
  id: string;
  created_at: string;
  updated_at: string;
  job_id: string;
  title: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  completed_at: string | null;
  notes: string | null;
};

export type JobWithLines = Job & { lines: DocumentLine[]; visits: Visit[] };

export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "part_paid",
  "paid",
  "bad_debt",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  part_paid: "Part paid",
  paid: "Paid",
  bad_debt: "Written off",
};

export const PAYMENT_METHODS = [
  "cash",
  "cheque",
  "e_transfer",
  "card",
  "bank_transfer",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  e_transfer: "e-Transfer",
  card: "Card",
  bank_transfer: "Bank transfer",
  other: "Other",
};

export type Payment = {
  id: string;
  created_at: string;
  invoice_id: string;
  amount_cents: number;
  method: PaymentMethod;
  received_on: string;
  reference: string | null;
  notes: string | null;
};

export type Invoice = {
  id: string;
  created_at: string;
  updated_at: string;
  invoice_number: number;
  client_id: string;
  property_id: string | null;
  job_id: string | null;
  quote_id: string | null;
  title: string | null;
  status: InvoiceStatus;
  is_deposit: boolean;
  issue_date: string;
  due_date: string | null;
  tax_rate_id: string | null;
  tax_snapshot: TaxRate | null;
  discount_kind: DiscountKind;
  discount_value: number;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  client_snapshot: ClientSnapshot | null;
  property_snapshot: PropertySnapshot | null;
  client_message: string | null;
  payment_terms: string | null;
  internal_notes: string | null;
  show_quantities: boolean;
  show_unit_prices: boolean;
  show_line_totals: boolean;
  show_totals_footer: boolean;
  language: "fr" | "en";
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  public_token: string | null;
  archived_at: string | null;
  custom: Record<string, unknown>;
};

export type InvoiceWithLines = Invoice & { lines: DocumentLine[]; payments: Payment[] };

export function invoiceBalanceCents(invoice: Pick<Invoice, "total_cents" | "amount_paid_cents">): number {
  return invoice.total_cents - invoice.amount_paid_cents;
}

/**
 * Overdue means unpaid AND past the due date.
 *
 * A draft is never overdue however old it is — nobody has been asked for the
 * money yet, so chasing it would be chasing our own paperwork.
 */
export function isOverdue(invoice: Pick<Invoice, "status" | "due_date" | "total_cents" | "amount_paid_cents">): boolean {
  if (invoice.status === "draft" || invoice.status === "paid" || invoice.status === "bad_debt") {
    return false;
  }
  if (!invoice.due_date) return false;
  if (invoiceBalanceCents(invoice) <= 0) return false;
  return invoice.due_date < new Date().toISOString().slice(0, 10);
}

/** Map a document line to the money engine's input shape. */
export function lineForTotals(line: DocumentLine) {
  return {
    quantityMilli: line.quantity_milli ?? 0,
    unitPriceCents: line.unit_price_cents ?? 0,
    taxable: line.taxable,
    optional: line.optional,
    selected: line.selected,
  };
}

export function priced(lines: DocumentLine[]): DocumentLine[] {
  return lines.filter((line) => line.kind === "item");
}
