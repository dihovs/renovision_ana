import { randomBytes } from "crypto";
import { isDuplicateKey, refuse, type ConversionResult } from "./conversions";
import { db, isMissingTable, MigrationPendingError } from "./db";
import { calculateQuoteTotals, formatMoney, type Discount, type QuoteTotals } from "./money";
import type {
  DocumentLine,
  Invoice,
  InvoiceStatus,
  InvoiceWithLines,
  JobWithLines,
  Payment,
  PaymentMethod,
} from "./opsTypes";
import { lineForTotals, priced } from "./opsTypes";
import { createJobFromQuote, getJob } from "./jobs";
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
    if (isMissingTable(error)) throw new MigrationPendingError("invoices", error.message);
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
    if (isMissingTable(error)) throw new MigrationPendingError("invoices", error.message);
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

// ---------------------------------------------------------------------------
// Billing a job
// ---------------------------------------------------------------------------
//
// THE RULE THIS SECTION EXISTS TO KEEP: an invoice raised against a job must
// come to exactly what the customer was quoted, to the cent, or it must refuse
// to exist. Not "close enough" — the same integers.
//
// It is invoiced FROM THE JOB, never from the quote, even when the operator
// pressed a button on the quote screen. The job is what was actually agreed to
// be built: it already holds a frozen copy of the approved lines, the tax rate
// as it stood when the quote was sent, the customer's name and address as they
// were then, and the discount resolved to an integer number of cents. Billing
// the quote directly would produce a statement of account for work that has no
// job behind it — nothing scheduled, nothing completed, nothing to point an
// auditor at — and would need a second implementation of the same copy.
//
// So the chain is always quote → job → invoice, and pressing "invoice" on an
// approved quote simply walks both hops (see `createInvoiceFromQuote`).
//
// WHAT CARRIES: every line verbatim (name, description, quantity, unit, cost,
// price, taxable flag), the tax snapshot, the client and property snapshots,
// and the discount — as `{ amount, job.discount_cents }` rather than as the
// original percentage. That matters. Re-resolving "10%" against the line list
// would give a different answer the moment anything about the lines moved;
// re-applying the frozen cents cannot.
//
// WHAT IS RECOMPUTED: the subtotal, each tax component and the total, from the
// frozen inputs, through the one money engine. Recomputed and then CHECKED
// against the figures the job stored. If they disagree, the work has diverged
// from what was approved and this refuses rather than quietly issuing a
// different number.

/** The job's own money, re-derived from its lines. */
function workTotalsFor(job: JobWithLines, rate: TaxRate): QuoteTotals {
  // The discount is re-applied from the frozen cents figure, not from the
  // quote's original percentage — see the section comment above.
  const discount: Discount =
    job.discount_cents > 0 ? { kind: "amount", value: job.discount_cents } : { kind: "none", value: 0 };
  return calculateQuoteTotals(priced(job.lines).map(lineForTotals), rate, discount);
}

/**
 * Refuse if re-totalling the job's lines does not reproduce the job's own
 * stored figures.
 *
 * Those figures were written when the quote was converted and are a copy of
 * what the customer approved. If they no longer reconcile, exactly one of two
 * things has happened: somebody changed the work, or the tax basis moved
 * underneath it (the company's GST/QST registration being switched off is the
 * live example — `canChargeTax` then forces every rate to nothing). Either way
 * the honest answer is not an invoice for a different amount.
 */
function assertMatchesJob(job: JobWithLines, totals: QuoteTotals): void {
  const same =
    totals.subtotalCents === job.subtotal_cents &&
    totals.discountCents === job.discount_cents &&
    totals.totalTaxCents === job.tax_cents &&
    totals.totalCents === job.total_cents;
  if (same) return;

  const taxMoved = totals.totalTaxCents !== job.tax_cents;
  const workMoved = totals.subtotalCents !== job.subtotal_cents;

  refuse(
    "totals_diverged",
    `Job #${job.job_number} no longer totals what was agreed: it was accepted at ` +
      `${formatMoney(job.total_cents)} and its lines now come to ${formatMoney(totals.totalCents)}. ` +
      (workMoved
        ? "The line items have changed since the quote was approved. "
        : taxMoved
          ? "The tax settings have changed since the quote was approved. "
          : "") +
      "Nothing has been invoiced. Settle what the job is worth first — issuing a " +
      "different number than the customer accepted is a dispute, not a bill.",
  );
}

/** An invoice already raised against this job. */
type InvoiceStub = {
  id: string;
  invoice_number: number;
  is_deposit: boolean;
  total_cents: number;
};

async function invoicesForJob(jobId: string): Promise<InvoiceStub[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("invoices")
    .select("id, invoice_number, is_deposit, total_cents")
    .eq("job_id", jobId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("invoices", error.message);
    throw new Error(`Could not check what has already been invoiced: ${error.message}`);
  }
  return (data ?? []) as InvoiceStub[];
}

/**
 * The quote behind a job has to have been approved.
 *
 * `createJobFromQuote` already refuses to make a job from anything else, so in
 * practice this is a second lock on the same door — but a job row can be
 * edited, restored or imported, and "do not invoice work nobody agreed to" is
 * cheap enough to check twice. `converted` is the normal state here: converting
 * the quote is what set it.
 */
async function assertQuoteApproved(quoteId: string | null, jobNumber: number): Promise<void> {
  if (!quoteId) return;
  const client = requireDb();
  const { data, error } = await client
    .from("quotes")
    .select("quote_number, status")
    .eq("id", quoteId)
    .maybeSingle();

  // A purged quote is fine: `jobs.quote_id` is `on delete set null` precisely
  // because the job carries everything it needs.
  if (error || !data) return;

  const quote = data as { quote_number: number; status: string };
  if (quote.status === "approved" || quote.status === "converted") return;

  refuse(
    "wrong_status",
    `Job #${jobNumber} came from quote #${quote.quote_number}, which is ${quote.status.replace("_", " ")} — ` +
      `not approved. An unapproved quote cannot be invoiced.`,
  );
}

/** A synthetic line, for money that has no row in the job. */
function syntheticLine(
  position: number,
  name: string,
  amountCents: number,
  taxable: boolean,
): DocumentLine {
  return {
    id: `synthetic-${position}`,
    position,
    kind: "item",
    name,
    description: null,
    quantity_milli: 1000,
    unit: null,
    unit_cost_cents: null,
    // Already an integer number of cents; the quantity of one keeps the printed
    // line total and the stored figure the same number.
    unit_price_cents: amountCents,
    taxable,
    optional: false,
    selected: false,
    labor_hours: null,
    price_book_item_id: null,
  };
}

/**
 * The lines of a deposit invoice.
 *
 * A percentage of the job's POST-DISCOUNT, PRE-TAX base, split between the
 * taxable and non-taxable parts in the same proportion the job has them. Two
 * consequences, both wanted:
 *
 *   - Tax is charged on the deposit at the same rate as the work, so "30%
 *     deposit" on the invoice really is 30% of the grand total the customer was
 *     quoted, rather than 30% of the pre-tax figure dressed up as the total.
 *   - A job that mixes taxable work with exempt items does not have tax charged
 *     on the exempt share. Billing the deposit as one taxable line — which is
 *     what this used to do — overcharged exactly that case.
 *
 * Each part is rounded to the cent independently, as everywhere else. In the
 * ordinary all-taxable job this produces exactly one line.
 */
function depositLines(job: JobWithLines, work: QuoteTotals, percent: number): DocumentLine[] {
  const label = job.title?.trim() || `job #${job.job_number}`;
  const taxableCents = Math.round((work.adjustedTaxableCents * percent) / 100);
  const exemptCents = Math.round((work.adjustedNonTaxableCents * percent) / 100);

  const lines: DocumentLine[] = [];
  if (taxableCents !== 0) {
    lines.push(syntheticLine(lines.length, `Deposit — ${percent}% of ${label}`, taxableCents, true));
  }
  if (exemptCents !== 0) {
    lines.push(
      syntheticLine(
        lines.length,
        `Deposit — ${percent}% of ${label} (tax-exempt items)`,
        exemptCents,
        false,
      ),
    );
  }
  return lines;
}

/**
 * Create an invoice from a job.
 *
 * `depositPercent` bills part of the work up front; the balance follows on
 * completion. The final invoice then carries the job's whole line list at full
 * value and credits the deposit back at its GROSS amount — tax included — as a
 * single non-taxable line.
 *
 * Crediting the gross rather than the pre-tax deposit is what makes the two
 * documents reconcile to the cent. Tax is rounded per component; charging tax
 * on (work − deposit) and then adding back tax on the deposit separately can
 * land a cent apart from tax on the work alone. Crediting a tax-inclusive lump
 * leaves the final invoice showing the full GST and QST for the whole supply,
 * with the already-billed amount taken off beneath — which is both exact and
 * the way a contractor's final bill is expected to read.
 *
 * Idempotent: a second press returns the invoice that already exists rather
 * than raising another. Only combinations that cannot be satisfied — a deposit
 * asked for after the final bill has gone out, an archived counterpart, a job
 * whose figures no longer match the quote — refuse.
 */
export async function createInvoiceFromJob(
  jobId: string,
  options: { depositPercent?: number } = {},
): Promise<ConversionResult> {
  const client = requireDb();
  const job = await getJob(jobId);
  if (!job) refuse("not_found", "That job no longer exists.");

  if (job.archived_at) {
    refuse("wrong_status", `Job #${job.job_number} is archived. Restore it before invoicing.`);
  }
  if (job.status === "cancelled") {
    refuse(
      "wrong_status",
      `Job #${job.job_number} was cancelled. Cancelled work cannot be invoiced — put the job ` +
        `back to complete if it was in fact done.`,
    );
  }
  await assertQuoteApproved(job.quote_id, job.job_number);

  const percent = options.depositPercent;
  const isDeposit = percent !== undefined && percent !== null;
  if (isDeposit && (!Number.isFinite(percent) || percent <= 0 || percent >= 100)) {
    refuse("bad_request", "A deposit has to be between 1% and 99% of the job.");
  }

  // ---- already invoiced? -------------------------------------------------
  const existing = await invoicesForJob(jobId);
  const finalInvoice = existing.find((invoice) => !invoice.is_deposit) ?? null;
  const deposits = existing.filter((invoice) => invoice.is_deposit);

  if (isDeposit) {
    if (finalInvoice) {
      refuse(
        "already_converted",
        `Job #${job.job_number} has already been invoiced in full on invoice #${finalInvoice.invoice_number}. ` +
          `A deposit cannot be taken after the final bill has gone out.`,
      );
    }
    if (deposits.length > 0) return { id: deposits[0].id, created: false };
  } else if (finalInvoice) {
    return { id: finalInvoice.id, created: false };
  }

  // ---- the money ---------------------------------------------------------
  const company = await getCompany();
  const rate = canChargeTax(company) ? (job.tax_snapshot ?? NO_TAX) : NO_TAX;

  if (priced(job.lines).length === 0) {
    refuse(
      "nothing_to_bill",
      `Job #${job.job_number} has no priced work on it. Put what the job is worth on it before invoicing.`,
    );
  }

  const work = workTotalsFor(job, rate);
  assertMatchesJob(job, work);

  if (work.totalCents <= 0) {
    refuse(
      "nothing_to_bill",
      `Job #${job.job_number} comes to ${formatMoney(work.totalCents)}. There is nothing to bill.`,
    );
  }

  const creditedCents = deposits.reduce((sum, invoice) => sum + invoice.total_cents, 0);

  let lines: DocumentLine[];
  let totals: QuoteTotals;
  let discount: Discount = { kind: "none", value: 0 };

  if (isDeposit) {
    // The deposit's base is already post-discount, so no discount is applied a
    // second time here.
    lines = depositLines(job, work, percent!);
    totals = calculateQuoteTotals(priced(lines).map(lineForTotals), rate);
  } else {
    if (creditedCents >= work.totalCents) {
      refuse(
        "nothing_to_bill",
        `The deposits already invoiced against job #${job.job_number} come to ` +
          `${formatMoney(creditedCents)}, which covers the whole job. There is no balance to bill.`,
      );
    }

    discount =
      job.discount_cents > 0
        ? { kind: "amount", value: job.discount_cents }
        : { kind: "none", value: 0 };

    lines = job.lines.map((line, index) => ({ ...line, position: index, optional: false, selected: false }));
    for (const deposit of deposits) {
      lines.push(
        syntheticLine(
          lines.length,
          `Less deposit invoiced — invoice #${deposit.invoice_number} (tax included)`,
          -deposit.total_cents,
          false,
        ),
      );
    }

    totals = calculateQuoteTotals(priced(lines).map(lineForTotals), rate, discount);

    // The identity this whole design exists to guarantee: deposit + balance is
    // the job, exactly. If it does not hold — which it can when a job mixes
    // exempt items with a global discount, and the credit changes which base
    // the discount comes off — nothing is issued.
    const expected = work.totalCents - creditedCents;
    if (totals.totalCents !== expected || totals.totalTaxCents !== work.totalTaxCents) {
      refuse(
        "totals_diverged",
        `Billing the balance of job #${job.job_number} would come to ${formatMoney(totals.totalCents)} ` +
          `instead of ${formatMoney(expected)}, so the deposit and the balance would not add up to the ` +
          `job. Nothing has been invoiced — this needs to be billed by hand.`,
      );
    }
  }

  // ---- write it ----------------------------------------------------------
  const defaults = await getQuoteDefaults();
  const dueDate = new Date(Date.now() + defaults.validDays * 86_400_000).toISOString().slice(0, 10);

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
      // Stored so the document renders the same discount row the quote had,
      // rather than a subtotal that mysteriously fails to match the lines.
      discount_kind: discount.kind,
      discount_value: discount.kind === "none" ? 0 : discount.value,
      subtotal_cents: totals.subtotalCents,
      discount_cents: totals.discountCents,
      tax_cents: totals.totalTaxCents,
      total_cents: totals.totalCents,
      language: "fr",
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("invoices", error.message);
    // `invoices_one_final_per_job` / `invoices_one_deposit_per_job` fired:
    // another press won the race between the check above and this insert.
    if (isDuplicateKey(error)) {
      const winner = (await invoicesForJob(jobId)).find(
        (invoice) => invoice.is_deposit === isDeposit,
      );
      if (winner) return { id: winner.id, created: false };
      refuse("already_converted", `Job #${job.job_number} has already been invoiced.`);
    }
    throw new Error(`Could not create the invoice: ${error.message}`);
  }

  const invoiceId = data.id as string;

  const rows = lines.map((line, index) => ({
    invoice_id: invoiceId,
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

  if (rows.length > 0) {
    const { error: linesError } = await client.from("invoice_line_items").insert(rows);
    if (linesError) {
      // An invoice with a total and no lines is worse than no invoice: it is a
      // demand for money with nothing behind it. Nothing points at this row
      // yet, so take it back out and let the operator try again.
      await rollbackInvoice(invoiceId);
      throw new Error(`Could not copy the lines: ${linesError.message}`);
    }
  }

  return { id: invoiceId, created: true };
}

async function rollbackInvoice(invoiceId: string): Promise<void> {
  const client = db();
  if (!client) return;
  const { error } = await client.from("invoices").delete().eq("id", invoiceId);
  if (error) {
    console.error(
      `[invoices] the lines failed and invoice ${invoiceId} could not be removed either: ${error.message}`,
    );
  }
}

/**
 * Invoice an approved quote in one press.
 *
 * Both hops, in order, each idempotent: convert the quote to a job if that
 * hasn't happened yet, then bill that job. Pressing it twice gives the same
 * invoice back; pressing it after converting by hand bills the job that already
 * exists rather than making a second one.
 *
 * Partial failure is safe by construction. If the job is created and the
 * invoice then fails, nothing is lost — the quote is marked converted, the job
 * is on the board, and pressing the button again picks up exactly where it
 * stopped.
 */
export async function createInvoiceFromQuote(
  quoteId: string,
  options: { depositPercent?: number } = {},
): Promise<ConversionResult> {
  const job = await createJobFromQuote(quoteId);
  return createInvoiceFromJob(job.id, options);
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
    if (isMissingTable(error)) throw new MigrationPendingError("payments", error.message);
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
