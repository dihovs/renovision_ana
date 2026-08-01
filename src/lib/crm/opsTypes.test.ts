import { describe, expect, it } from "vitest";
import {
  invoiceBalanceCents,
  isOverdue,
  lineForTotals,
  priced,
  type DocumentLine,
  type Invoice,
} from "./opsTypes";

// Clock-safe fixtures: these dates stay in the past/future for any realistic
// test run, so isOverdue never flakes on "today".
const LONG_PAST = "2000-01-01";
const FAR_FUTURE = "2999-12-31";

function invoice(over: Partial<Invoice> = {}): Pick<Invoice, "status" | "due_date" | "total_cents" | "amount_paid_cents"> {
  return {
    status: "sent",
    due_date: LONG_PAST,
    total_cents: 100_000,
    amount_paid_cents: 0,
    ...over,
  };
}

function docLine(over: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id: "dl-1",
    position: 0,
    kind: "item",
    name: "Demolition",
    description: null,
    quantity_milli: 1000,
    unit: null,
    unit_cost_cents: null,
    unit_price_cents: 25_000,
    taxable: true,
    optional: false,
    selected: false,
    labor_hours: null,
    price_book_item_id: null,
    ...over,
  };
}

describe("invoiceBalanceCents", () => {
  it("is total minus paid", () => {
    expect(invoiceBalanceCents({ total_cents: 100_000, amount_paid_cents: 40_000 })).toBe(60_000);
    expect(invoiceBalanceCents({ total_cents: 100_000, amount_paid_cents: 100_000 })).toBe(0);
    // Overpayment goes negative rather than clamping — the credit is real.
    expect(invoiceBalanceCents({ total_cents: 100_000, amount_paid_cents: 120_000 })).toBe(-20_000);
  });
});

describe("isOverdue", () => {
  it("flags an unpaid invoice past its due date", () => {
    expect(isOverdue(invoice())).toBe(true);
    expect(isOverdue(invoice({ status: "viewed" }))).toBe(true);
    expect(isOverdue(invoice({ status: "part_paid", amount_paid_cents: 50_000 }))).toBe(true);
  });

  it("never flags drafts, paid invoices or written-off debt", () => {
    expect(isOverdue(invoice({ status: "draft" }))).toBe(false);
    expect(isOverdue(invoice({ status: "paid" }))).toBe(false);
    expect(isOverdue(invoice({ status: "bad_debt" }))).toBe(false);
  });

  it("is not overdue without a due date, before the due date, or once settled", () => {
    expect(isOverdue(invoice({ due_date: null }))).toBe(false);
    expect(isOverdue(invoice({ due_date: FAR_FUTURE }))).toBe(false);
    expect(isOverdue(invoice({ amount_paid_cents: 100_000 }))).toBe(false);
    expect(isOverdue(invoice({ amount_paid_cents: 120_000 }))).toBe(false);
  });
});

describe("lineForTotals / priced", () => {
  it("maps columns and coalesces nulls to zero", () => {
    expect(lineForTotals(docLine({ quantity_milli: null, unit_price_cents: null }))).toEqual({
      quantityMilli: 0,
      unitPriceCents: 0,
      taxable: true,
      optional: false,
      selected: false,
    });
  });

  it("filters text lines out of the money path", () => {
    const lines = [docLine(), docLine({ id: "dl-2", kind: "text", quantity_milli: null, unit_price_cents: null })];
    expect(priced(lines).map((l) => l.id)).toEqual(["dl-1"]);
  });
});
