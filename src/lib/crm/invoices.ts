import { randomBytes } from "crypto";
import { db, isMissingTable, MigrationPendingError } from "./db";
import { calculateQuoteTotals } from "./money";
import type {
  DocumentLine,
  Invoice,
  InvoiceStatus,
  InvoiceWithLines,
  Payment,
  PaymentMethod,
} from "./opsTypes";
import { lineForTotals, priced } from "./opsTypes";
import { getJob } from "./jobs";
import { canChargeTax, getCompany, getQuoteDefaults, type TaxRate } from "./settings";
import { clientDisplayName } from "./types";

/**
 * Invoices and payments.
 *
 * An invoice is the only document here with a legal content list attached to
 * it. Revenu Québec requires the supplier's GST and QST registration numbers
 * on any invoice of $100 or more, the purchaser's name and payment terms at
 * $500 or more, and the tax amounts shown. Those are rendered from the frozen
 * snapshot, so reprinting an old invoice reproduces the document that was
 * actually issued.
 */

const NO_TAX: TaxRate = { id: "unregistered", label: "No tax", components: [] };

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

function orNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type InvoiceListItem = Invoice & { client_name: string };

export async function listInvoices(
  options: { status?: InvoiceStatus; clientId?: string; limit?: number } = {},
): Promise<InvoiceListItem[]> {
  const client = requireDb();
  const { status, clientId, limit = 200 } = options;

  let query = client
    .from("invoices")
    .select("*, clients(first_name, last_name, company_name)")
    .is("archived_at", null)
    .order("issue_date", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);

  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("invoices");
    throw new Error(`Could not load invoices: ${error.message}`);
  }

  return ((data ?? []) as (Invoice & {
    clients: Parameters<typeof clientDisplayName>[0] | null;
  })[]).map(({ clients, ...invoice }) => ({
    ...invoice,
    client_name: clients ? clientDisplayName(clients) : "Unknown client",
  }));
}

export async function getInvoice(id: string): Promise<InvoiceWithLines | null> {
  const client = requireDb();
  const { data, error } = await client
    .from("invoices")
    .select("*, invoice_line_items(*), payments(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("invoices");
    throw new Error(`Could not load the invoice: ${error.message}`);
  }
  if (!data) return null;
  return normalise(data as Invoice & { invoice_line_items: DocumentLine[]; payments: Payment[] });
}

export async function getInvoiceByToken(token: string): Promise<InvoiceWithLines | null> {
  const client = requireDb();
  if (!/^[a-f0-9]{40,80}$/i.test(token)) return null;

  const { data, error } = await client
    .from("invoices")
    .select("*, invoice_line_items(*), payments(*)")
    .eq("public_token", token)
    .maybeSingle();

  if (error || !data) return null;
  return normalise(data as Invoice & { invoice_line_items: DocumentLine[]; payments: Payment[] });
}

function normalise(
  row: Invoice & { invoice_line_items: DocumentLine[]; payments: Payment[] },
): InvoiceWithLines {
  const { invoice_line_items, payments, ...invoice } = row;
  return {
    ...invoice,
    lines: (invoice_line_items ?? []).sort((a, b) => a.position - b.position),
    payments: (payments ?? []).sort((a, b) => b.received_on.localeCompare(a.received_on)),
  };
}

/** The rate an invoice is charged at — frozen once issued, gated on registration. */
export async function invoiceTaxRate(invoice: Pick<Invoice, "status" | "tax_snapshot">): Promise<TaxRate> {
  const company = await getCompany();
  if (!canChargeTax(company)) return NO_TAX;
  return invoice.tax_snapshot ?? NO_TAX;
}

/**
 * Create an invoice from a job.
 *
 * `depositPercent` bills part of the total up front; the rest follows on
 * completion. A deposit invoice carries the job's whole line list for context
 * but bills a single percentage line, because "50% deposit on the work below"
 * is what the customer needs to see, not half a quantity of every item.
 */
export async function createInvoiceFromJob(
  jobId: string,
  options: { depositPercent?: number } = {},
): Promise<string> {
  const client = requireDb();
  const job = await getJob(jobId);
  if (!job) throw new Error("Job not found");

  const defaults = await getQuoteDefaults();
  const company = await getCompany();
  const rate = canChargeTax(company) ? (job.tax_snapshot ?? NO_TAX) : NO_TAX;

  const isDeposit = Boolean(options.depositPercent && options.depositPercent > 0);

  const lines: Omit<DocumentLine, "id">[] = isDeposit
    ? [
        {
          position: 0,
          kind: "item",
          name: `Deposit — ${options.depositPercent}% of ${job.title ?? `job #${job.job_number}`}`,
          description: null,
          quantity_milli: 1000,
          unit: null,
          unit_cost_cents: null,
          // Rounded to the cent here so the stored line total and the printed
          // one are the same number.
          unit_price_cents: Math.round((job.subtotal_cents * options.depositPercent!) / 100),
          taxable: true,
          optional: false,
          selected: false,
          labor_hours: null,
          price_book_item_id: null,
        },
      ]
    : job.lines.map((line, index) => ({
        position: index,
        kind: line.kind,
        name: line.name,
        description: line.description,
        quantity_milli: line.quantity_milli,
        unit: line.unit,
        unit_cost_cents: line.unit_cost_cents,
        unit_price_cents: line.unit_price_cents,
        taxable: line.taxable,
        optional: false,
        selected: false,
        labor_hours: line.labor_hours,
        price_book_item_id: line.price_book_item_id,
      }));

  const totals = calculateQuoteTotals(priced(lines as DocumentLine[]).map(lineForTotals), rate);

  const dueDate = new Date(Date.now() + defaults.validDays * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await client
    .from("invoices")
    .insert({
      client_id: job.client_id,
      property_id: job.property_id,
      job_id: job.id,
      quote_id: job.quote_id,
      title: job.title,
      is_deposit: isDeposit,
      due_date: dueDate,
      tax_snapshot: rate,
      client_snapshot: job.client_snapshot,
      property_snapshot: job.property_snapshot,
      subtotal_cents: totals.subtotalCents,
      discount_cents: totals.discountCents,
      tax_cents: totals.totalTaxCents,
      total_cents: totals.totalCents,
      language: "fr",
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("invoices");
    throw new Error(`Could not create the invoice: ${error.message}`);
  }

  const invoiceId = data.id as string;

  if (lines.length > 0) {
    const { error: linesError } = await client
      .from("invoice_line_items")
      .insert(lines.map((line) => ({ ...line, invoice_id: invoiceId })));
    if (linesError) throw new Error(`Could not copy the lines: ${linesError.message}`);
  }

  return invoiceId;
}

export async function updateInvoice(
  id: string,
  input: {
    title?: string | null;
    dueDate?: string | null;
    clientMessage?: string | null;
    paymentTerms?: string | null;
    internalNotes?: string | null;
    language?: "fr" | "en";
  },
): Promise<void> {
  const client = requireDb();
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = orNull(input.title);
  if (input.dueDate !== undefined) patch.due_date = input.dueDate || null;
  if (input.clientMessage !== undefined) patch.client_message = orNull(input.clientMessage);
  if (input.paymentTerms !== undefined) patch.payment_terms = orNull(input.paymentTerms);
  if (input.internalNotes !== undefined) patch.internal_notes = orNull(input.internalNotes);
  if (input.language !== undefined) patch.language = input.language;

  const { error } = await client.from("invoices").update(patch).eq("id", id);
  if (error) throw new Error(`Could not save the invoice: ${error.message}`);
}

/**
 * Issue the invoice.
 *
 * Refuses without the RBQ licence number: a statement of account is one of the
 * documents Building Act s. 57.1 names explicitly. Also refuses when the
 * company is marked tax-registered but has no numbers on file, because
 * Revenu Québec requires both to appear on any invoice of $100 or more and an
 * invoice missing them cannot support the customer's own tax claim.
 */
export async function sendInvoice(id: string): Promise<{ token: string }> {
  const client = requireDb();
  const invoice = await getInvoice(id);
  if (!invoice) throw new Error("Invoice not found");

  const company = await getCompany();
  if (!company.rbqLicence.trim()) {
    throw new Error(
      "Add your RBQ licence number in Settings before sending — Quebec law requires it on every statement of account.",
    );
  }
  if (company.taxRegistered && (!company.gstNumber.trim() || !company.qstNumber.trim())) {
    throw new Error(
      "Add both your GST and QST registration numbers in Settings — an invoice of $100 or more must show them.",
    );
  }

  const token = invoice.public_token ?? randomBytes(32).toString("hex");

  const { error } = await client
    .from("invoices")
    .update({
      status: invoice.amount_paid_cents > 0 ? invoice.status : "sent",
      sent_at: invoice.sent_at ?? new Date().toISOString(),
      public_token: token,
    })
    .eq("id", id);

  if (error) throw new Error(`Could not send the invoice: ${error.message}`);
  return { token };
}

export async function recordInvoiceView(token: string): Promise<void> {
  const client = db();
  if (!client) return;
  await client
    .from("invoices")
    .update({ viewed_at: new Date().toISOString(), status: "viewed" })
    .eq("public_token", token)
    .eq("status", "sent");
}

export async function setInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("invoices").update({ status }).eq("id", id);
  if (error) throw new Error(`Could not update the invoice: ${error.message}`);
}

export async function setInvoiceArchived(id: string, archived: boolean): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("invoices")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(`Could not archive the invoice: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

/**
 * Record money received.
 *
 * The invoice's paid total and status are maintained by a database trigger,
 * not here — an application that forgets to recalculate on one code path
 * leaves an invoice reading unpaid when it is settled, and somebody gets
 * chased for money they already sent.
 */
export async function recordPayment(
  invoiceId: string,
  input: {
    amountCents: number;
    method: PaymentMethod;
    receivedOn?: string;
    reference?: string | null;
    notes?: string | null;
  },
): Promise<string> {
  const client = requireDb();
  if (input.amountCents === 0) throw new Error("Enter an amount.");

  const { data, error } = await client
    .from("payments")
    .insert({
      invoice_id: invoiceId,
      amount_cents: input.amountCents,
      method: input.method,
      received_on: input.receivedOn || new Date().toISOString().slice(0, 10),
      reference: orNull(input.reference),
      notes: orNull(input.notes),
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("payments");
    throw new Error(`Could not record the payment: ${error.message}`);
  }
  return data.id as string;
}

export async function deletePayment(id: string): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("payments").delete().eq("id", id);
  if (error) throw new Error(`Could not remove the payment: ${error.message}`);
}

/** Outstanding money, for the dashboard. */
export async function receivablesSummary(): Promise<{
  outstandingCents: number;
  overdueCents: number;
  count: number;
}> {
  const client = db();
  if (!client) return { outstandingCents: 0, overdueCents: 0, count: 0 };

  const { data, error } = await client
    .from("invoices")
    .select("total_cents, amount_paid_cents, due_date, status")
    .is("archived_at", null)
    .not("status", "in", "(draft,bad_debt)");

  if (error) return { outstandingCents: 0, overdueCents: 0, count: 0 };

  const today = new Date().toISOString().slice(0, 10);
  let outstandingCents = 0;
  let overdueCents = 0;
  let count = 0;

  for (const row of (data ?? []) as {
    total_cents: number;
    amount_paid_cents: number;
    due_date: string | null;
    status: string;
  }[]) {
    const balance = row.total_cents - row.amount_paid_cents;
    if (balance <= 0) continue;
    outstandingCents += balance;
    count += 1;
    if (row.due_date && row.due_date < today) overdueCents += balance;
  }

  return { outstandingCents, overdueCents, count };
}
