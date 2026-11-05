import { QUANTITY_SCALE, isIncluded, lineTotalCents } from "./money";
import { lineForTotals, type DocumentLine, type Invoice, type InvoiceWithLines } from "./opsTypes";

/**
 * Invoices out of this CRM and into QuickBooks Online, as a CSV file.
 *
 * This is deliberately not the API integration. The Intuit App Partner
 * Program is open to partners in "the US, UK, Australia, and Canada
 * (excluding Quebec)", and production API keys are gated behind an app
 * assessment even for a private app talking to your own company file — so
 * until Intuit answers whether a Laval business can hold production keys at
 * all, there is nothing to authenticate against. See
 * `Docs/Automation-Blockers.md` §3. A CSV is worse than a live sync and it is
 * real today.
 *
 * The shape is QuickBooks Online's own invoice import: **one row per line
 * item**, with the invoice's header fields repeated on every row of that
 * invoice. QBO shows a column-mapping screen on import, so the headers below
 * are a convenience that makes most fields map themselves — not a contract.
 * The two columns worth getting right are `*ItemAmount` and `*ItemTaxCode`,
 * because QBO does not import our tax figures: it recomputes tax from the tax
 * code against the amounts in the file. Anything wrong in the taxable base is
 * wrong money in the books.
 */

const COLUMNS = [
  "*InvoiceNo",
  "*Customer",
  "*InvoiceDate",
  "*DueDate",
  "*Item(Product/Service)",
  "ItemDescription",
  "ItemQuantity",
  "ItemRate",
  "*ItemAmount",
  "*ItemTaxCode",
  "Currency",
  "Memo",
  "Email",
] as const;

/** What QBO should charge no tax on. Their own code name, in every region. */
const EXEMPT_CODE = "Exempt";

/** The label a discount row carries into the books. */
const DISCOUNT_ITEM = "Discount";

export type QuickBooksExportRow = Record<(typeof COLUMNS)[number], string>;

export type QuickBooksExport = {
  csv: string;
  /** Invoices actually written, not rows. */
  invoiceCount: number;
  rowCount: number;
  /**
   * Invoices whose rows do not add back up to the total that was issued.
   * These are still in the file — silently dropping an invoice from an
   * accounting export is worse than exporting one that needs a look — but
   * they are named so nobody imports them believing they reconcile.
   */
  warnings: string[];
};

/** Excel-safe CSV: quote everything, double internal quotes. */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Cents as a plain decimal. No symbol, no separators, always a dot. */
function amount(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Thousandths as a decimal with no trailing zeroes: 1500 -> "1.5". */
function quantity(milli: number): string {
  const whole = milli / QUANTITY_SCALE;
  return String(Number(whole.toFixed(3)));
}

/**
 * The tax code for one line.
 *
 * Taken from the invoice's frozen snapshot rather than from today's settings,
 * so re-exporting a two-year-old invoice books it at the rate it was actually
 * issued under. An invoice raised while the company was not tax-registered has
 * no components at all, and every line on it is exempt regardless of its own
 * taxable flag.
 */
function taxCode(invoice: Pick<Invoice, "tax_snapshot">, taxable: boolean): string {
  const components = invoice.tax_snapshot?.components ?? [];
  if (components.length === 0) return EXEMPT_CODE;
  return taxable ? (invoice.tax_snapshot?.label ?? EXEMPT_CODE) : EXEMPT_CODE;
}

/**
 * The customer name QBO will match on.
 *
 * The snapshot wins over the live client record for the same reason the tax
 * rate does: this is a document that was issued to a named person, and a
 * client who has since married or rebranded must not retroactively change who
 * an old invoice was billed to.
 */
function customerName(invoice: InvoiceWithLines & { client_name: string }): string {
  return invoice.client_snapshot?.displayName?.trim() || invoice.client_name;
}

function rowFor(
  invoice: InvoiceWithLines & { client_name: string },
  line: Pick<DocumentLine, "name" | "description" | "quantity_milli" | "unit_price_cents" | "taxable">,
  amountCents: number,
): QuickBooksExportRow {
  return {
    "*InvoiceNo": String(invoice.invoice_number),
    "*Customer": customerName(invoice),
    "*InvoiceDate": invoice.issue_date,
    // QBO requires a due date. An invoice with none is due the day it was
    // issued, which is also how `isOverdue` would have to read it.
    "*DueDate": invoice.due_date ?? invoice.issue_date,
    "*Item(Product/Service)": line.name,
    ItemDescription: line.description ?? "",
    ItemQuantity: line.quantity_milli === null ? "" : quantity(line.quantity_milli),
    ItemRate: line.unit_price_cents === null ? "" : amount(line.unit_price_cents),
    "*ItemAmount": amount(amountCents),
    "*ItemTaxCode": taxCode(invoice, line.taxable),
    Currency: "CAD",
    Memo: invoice.title ?? "",
    Email: invoice.client_snapshot?.email ?? "",
  };
}

/**
 * Turn one invoice into its rows.
 *
 * Two things are not one-to-one with our line items:
 *
 *  1. **Unticked optional lines are dropped.** They were never charged, so
 *     they are not revenue. `isIncluded` is the same predicate the money
 *     engine uses, so the file cannot disagree with the invoice about which
 *     lines counted.
 *
 *  2. **A header discount becomes its own negative rows.** QBO's invoice
 *     import has no discount column, so a discounted invoice would otherwise
 *     import at the undiscounted total. It is split into up to two rows
 *     because our engine takes the discount off the non-taxable base first and
 *     the remainder off the taxable one — collapsing that into a single row
 *     would move money across the tax boundary and change the tax QBO
 *     computes.
 */
export function invoiceToRows(
  invoice: InvoiceWithLines & { client_name: string },
): QuickBooksExportRow[] {
  const included = invoice.lines.filter((line) => isIncluded(lineForTotals(line)));

  const rows = included.map((line) => rowFor(invoice, line, lineTotalCents(lineForTotals(line))));

  const discountCents = invoice.discount_cents;
  if (discountCents > 0) {
    // Only the non-taxable base is needed: the engine takes the discount off
    // that first, and whatever is left over necessarily comes off the taxable
    // side.
    let nonTaxableCents = 0;
    for (const line of included) {
      if (!line.taxable) nonTaxableCents += lineTotalCents(lineForTotals(line));
    }

    const fromNonTaxable = Math.min(discountCents, Math.max(0, nonTaxableCents));
    const fromTaxable = discountCents - fromNonTaxable;

    for (const [cents, taxable] of [
      [fromNonTaxable, false],
      [fromTaxable, true],
    ] as const) {
      if (cents <= 0) continue;
      rows.push(
        rowFor(
          invoice,
          {
            name: DISCOUNT_ITEM,
            description: `Discount on invoice #${invoice.invoice_number}`,
            quantity_milli: null,
            unit_price_cents: null,
            taxable,
          },
          -cents,
        ),
      );
    }
  }

  return rows;
}

/**
 * Does this invoice's file add back up to the document that was issued?
 *
 * QBO computes its own tax, so what has to be right in the CSV is the base it
 * computes from: line amounts less the discount must equal the invoice's
 * subtotal after discount. If they differ, something in the line data and the
 * stored totals has drifted apart and the export would book a different number
 * than the customer was billed.
 */
function reconciles(
  invoice: InvoiceWithLines,
  rows: QuickBooksExportRow[],
): boolean {
  const rowCents = rows.reduce((sum, row) => sum + Math.round(Number(row["*ItemAmount"]) * 100), 0);
  return rowCents === invoice.total_cents - invoice.tax_cents;
}

export function invoicesToQuickBooksCsv(
  invoices: (InvoiceWithLines & { client_name: string })[],
): QuickBooksExport {
  const warnings: string[] = [];
  const lines: string[] = [COLUMNS.map(csvCell).join(",")];
  let rowCount = 0;
  let invoiceCount = 0;

  for (const invoice of invoices) {
    const rows = invoiceToRows(invoice);
    if (rows.length === 0) {
      warnings.push(`Invoice #${invoice.invoice_number} has no billable lines and was skipped.`);
      continue;
    }
    if (!reconciles(invoice, rows)) {
      warnings.push(
        `Invoice #${invoice.invoice_number} does not reconcile — its lines and its stored total ` +
          `disagree. It is in the file; check it before you import.`,
      );
    }
    for (const row of rows) {
      lines.push(COLUMNS.map((column) => csvCell(row[column])).join(","));
      rowCount += 1;
    }
    invoiceCount += 1;
  }

  return {
    // CRLF and a BOM for the same reason the lead export has them: this file
    // gets opened in Excel on the way to QuickBooks, and "Bélanger" must not
    // arrive as "BÃ©langer" on a customer name QBO then matches on.
    csv: `﻿${lines.join("\r\n")}\r\n`,
    invoiceCount,
    rowCount,
    warnings,
  };
}
