import { describe, expect, it } from "vitest";
import { invoiceToRows, invoicesToQuickBooksCsv } from "./quickbooksCsv";
import type { DocumentLine, InvoiceWithLines } from "./opsTypes";
import type { TaxRate } from "./settings";

/**
 * The QuickBooks export.
 *
 * QBO does not import our tax figures — it recomputes tax from the tax code
 * against the amounts in the file. So the thing under test is not "does a CSV
 * come out", it is **does the taxable base in the file match the taxable base
 * the customer was billed on**. Every test here is that question in a
 * different shape.
 */

const QC: TaxRate = {
  id: "qc",
  label: "GST + QST (Quebec)",
  components: [
    { name: "GST", rate: 50_000 },
    { name: "QST", rate: 99_750 },
  ],
};

function line(over: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id: "l1",
    position: 0,
    kind: "item",
    name: "Drywall repair",
    description: null,
    quantity_milli: 1000,
    unit: null,
    unit_cost_cents: null,
    unit_price_cents: 100_00,
    taxable: true,
    optional: false,
    selected: false,
    labor_hours: null,
    price_book_item_id: null,
    ...over,
  } as DocumentLine;
}

function invoice(
  over: Partial<InvoiceWithLines> & { lines: DocumentLine[] },
): InvoiceWithLines & { client_name: string } {
  const lines = over.lines;
  return {
    id: "i1",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    invoice_number: 1042,
    client_id: "c1",
    property_id: null,
    job_id: null,
    quote_id: null,
    title: "Water damage — basement",
    status: "sent",
    is_deposit: false,
    issue_date: "2026-08-01",
    due_date: "2026-08-31",
    tax_rate_id: "qc",
    tax_snapshot: QC,
    discount_kind: "none",
    discount_value: 0,
    subtotal_cents: 0,
    discount_cents: 0,
    tax_cents: 0,
    total_cents: 0,
    amount_paid_cents: 0,
    client_snapshot: {
      displayName: "Bélanger, Marie",
      personName: "Marie Bélanger",
      email: "marie@example.ca",
      phone: null,
      street1: null,
      street2: null,
      city: null,
      province: null,
      postalCode: null,
      country: null,
    },
    property_snapshot: null,
    client_message: null,
    payment_terms: null,
    internal_notes: null,
    show_quantities: true,
    show_unit_prices: true,
    show_line_totals: true,
    show_totals_footer: true,
    language: "fr",
    sent_at: null,
    viewed_at: null,
    paid_at: null,
    public_token: null,
    archived_at: null,
    custom: {},
    payments: [],
    client_name: "Marie Bélanger",
    ...over,
    lines,
  } as InvoiceWithLines & { client_name: string };
}

describe("invoiceToRows", () => {
  it("writes one row per line item, with the header repeated", () => {
    const rows = invoiceToRows(
      invoice({
        lines: [line(), line({ id: "l2", position: 1, name: "Paint", unit_price_cents: 50_00 })],
        subtotal_cents: 150_00,
        tax_cents: 22_46,
        total_cents: 172_46,
      }),
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r["*InvoiceNo"])).toEqual(["1042", "1042"]);
    expect(rows.map((r) => r["*ItemAmount"])).toEqual(["100.00", "50.00"]);
  });

  it("bills the customer the invoice was issued to, not the client record today", () => {
    const [row] = invoiceToRows(
      invoice({ lines: [line()], subtotal_cents: 100_00, tax_cents: 14_98, total_cents: 114_98 }),
    );
    // client_name says "Marie Bélanger"; the snapshot says how the document
    // actually addressed her, and that is what QBO must match on.
    expect(row["*Customer"]).toBe("Bélanger, Marie");
  });

  it("drops an optional line nobody ticked", () => {
    const rows = invoiceToRows(
      invoice({
        lines: [line(), line({ id: "l2", position: 1, optional: true, selected: false })],
        subtotal_cents: 100_00,
        tax_cents: 14_98,
        total_cents: 114_98,
      }),
    );
    expect(rows).toHaveLength(1);
  });

  it("keeps an optional line the customer ticked", () => {
    const rows = invoiceToRows(
      invoice({
        lines: [line(), line({ id: "l2", position: 1, optional: true, selected: true })],
        subtotal_cents: 200_00,
        tax_cents: 29_95,
        total_cents: 229_95,
      }),
    );
    expect(rows).toHaveLength(2);
  });

  it("marks a non-taxable line exempt and leaves the taxable one at the invoice's own rate", () => {
    const rows = invoiceToRows(
      invoice({
        lines: [line(), line({ id: "l2", position: 1, taxable: false })],
        subtotal_cents: 200_00,
        tax_cents: 14_98,
        total_cents: 214_98,
      }),
    );
    expect(rows[0]["*ItemTaxCode"]).toBe("GST + QST (Quebec)");
    expect(rows[1]["*ItemTaxCode"]).toBe("Exempt");
  });

  it("exempts every line on an invoice raised before the company was tax-registered", () => {
    const rows = invoiceToRows(
      invoice({
        lines: [line()],
        tax_snapshot: { id: "unregistered", label: "No tax", components: [] },
        subtotal_cents: 100_00,
        tax_cents: 0,
        total_cents: 100_00,
      }),
    );
    expect(rows[0]["*ItemTaxCode"]).toBe("Exempt");
  });

  it("splits a discount across the tax boundary the way the money engine does", () => {
    // $100 taxable + $50 exempt, $60 off. The engine takes the discount off
    // the non-taxable base first: $50 exempt, then $10 taxable. Collapsing
    // this into one $60 taxable row would understate the taxable base by $50
    // and lose about $7.49 of tax.
    const rows = invoiceToRows(
      invoice({
        lines: [line(), line({ id: "l2", position: 1, taxable: false, unit_price_cents: 50_00 })],
        discount_kind: "amount",
        discount_value: 60_00,
        discount_cents: 60_00,
        subtotal_cents: 150_00,
        tax_cents: 13_48,
        total_cents: 103_48,
      }),
    );

    expect(rows).toHaveLength(4);
    const discounts = rows.slice(2);
    expect(discounts.map((r) => [r["*ItemAmount"], r["*ItemTaxCode"]])).toEqual([
      ["-50.00", "Exempt"],
      ["-10.00", "GST + QST (Quebec)"],
    ]);
  });

  it("carries a negative deposit-credit line straight through", () => {
    // A balance invoice credits an earlier deposit as a negative, tax-included
    // line. It is already the right sign and the right tax code; the export
    // must not touch it.
    const rows = invoiceToRows(
      invoice({
        lines: [
          line(),
          line({
            id: "l2",
            position: 1,
            name: "Less deposit invoiced — invoice #1041 (tax included)",
            taxable: false,
            unit_price_cents: -40_00,
          }),
        ],
        subtotal_cents: 60_00,
        tax_cents: 14_98,
        total_cents: 74_98,
      }),
    );
    expect(rows[1]["*ItemAmount"]).toBe("-40.00");
  });

  it("writes fractional quantities without float noise", () => {
    const [row] = invoiceToRows(
      invoice({
        lines: [line({ quantity_milli: 12_375, unit_price_cents: 8_00 })],
        subtotal_cents: 99_00,
        tax_cents: 14_83,
        total_cents: 113_83,
      }),
    );
    expect(row.ItemQuantity).toBe("12.375");
    expect(row.ItemRate).toBe("8.00");
    expect(row["*ItemAmount"]).toBe("99.00");
  });

  it("falls back to the issue date when an invoice has no due date", () => {
    const [row] = invoiceToRows(
      invoice({
        lines: [line()],
        due_date: null,
        subtotal_cents: 100_00,
        tax_cents: 14_98,
        total_cents: 114_98,
      }),
    );
    expect(row["*DueDate"]).toBe("2026-08-01");
  });
});

describe("invoicesToQuickBooksCsv", () => {
  const clean = invoice({
    lines: [line()],
    subtotal_cents: 100_00,
    tax_cents: 14_98,
    total_cents: 114_98,
  });

  it("writes a header row and quotes every cell", () => {
    const { csv } = invoicesToQuickBooksCsv([clean]);
    const [header, first] = csv.replace(/^﻿/, "").split("\r\n");
    expect(header.startsWith('"*InvoiceNo","*Customer"')).toBe(true);
    expect(first.startsWith('"1042","Bélanger, Marie"')).toBe(true);
  });

  it("leads with a BOM and ends every row with CRLF", () => {
    const { csv } = invoicesToQuickBooksCsv([clean]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("escapes a quote inside a line name rather than breaking the row", () => {
    const { csv } = invoicesToQuickBooksCsv([
      invoice({
        lines: [line({ name: 'Baseboard 4" pine' })],
        subtotal_cents: 100_00,
        tax_cents: 14_98,
        total_cents: 114_98,
      }),
    ]);
    expect(csv).toContain('"Baseboard 4"" pine"');
    expect(csv.replace(/^﻿/, "").trimEnd().split("\r\n")).toHaveLength(2);
  });

  it("counts invoices and rows separately", () => {
    const result = invoicesToQuickBooksCsv([
      clean,
      invoice({
        invoice_number: 1043,
        lines: [line(), line({ id: "l2", position: 1 })],
        subtotal_cents: 200_00,
        tax_cents: 29_95,
        total_cents: 229_95,
      }),
    ]);
    expect(result.invoiceCount).toBe(2);
    expect(result.rowCount).toBe(3);
  });

  it("skips an invoice with nothing billable on it, and says so", () => {
    const result = invoicesToQuickBooksCsv([
      invoice({ invoice_number: 1044, lines: [line({ optional: true, selected: false })] }),
    ]);
    expect(result.rowCount).toBe(0);
    expect(result.invoiceCount).toBe(0);
    expect(result.warnings[0]).toContain("#1044");
  });

  it("warns — but still exports — when the lines and the stored total disagree", () => {
    const result = invoicesToQuickBooksCsv([
      invoice({
        invoice_number: 1045,
        lines: [line()],
        subtotal_cents: 100_00,
        tax_cents: 14_98,
        // Someone edited the line and the stored total did not follow.
        total_cents: 999_98,
      }),
    ]);
    expect(result.rowCount).toBe(1);
    expect(result.warnings[0]).toContain("does not reconcile");
  });

  it("reconciles a discounted invoice, so a real discount raises no warning", () => {
    const result = invoicesToQuickBooksCsv([
      invoice({
        lines: [line(), line({ id: "l2", position: 1, taxable: false, unit_price_cents: 50_00 })],
        discount_kind: "amount",
        discount_value: 60_00,
        discount_cents: 60_00,
        subtotal_cents: 150_00,
        tax_cents: 13_48,
        total_cents: 103_48,
      }),
    ]);
    expect(result.warnings).toEqual([]);
  });
});
