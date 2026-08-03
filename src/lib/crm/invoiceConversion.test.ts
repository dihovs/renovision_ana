import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaxRate } from "./settings";

/**
 * Billing a job.
 *
 * This is the hop where money can go wrong quietly, so the tests are mostly
 * arithmetic. The rule they enforce, in one sentence: **an invoice raised
 * against a job comes to exactly what the customer was quoted, or it refuses to
 * exist.**
 *
 * Three of these are regression tests for real defects in the version this
 * replaced:
 *
 *   1. The quote's discount was dropped. Jobs carry a discount as
 *      `discount_cents`, and the invoice re-totalled the lines with no discount
 *      at all — so a quote with 10% off produced an invoice 10% higher than the
 *      document the customer had accepted, with nothing on screen to say so.
 *
 *   2. A deposit was billed as a percentage of the PRE-discount subtotal, and
 *      always as one fully taxable line — so a job with any exempt work on it
 *      was charged tax it did not owe.
 *
 *   3. Nothing stopped a second invoice. The button could be pressed twice.
 */

const from = vi.fn();
const supabase = { from } as unknown as ReturnType<typeof import("./db").db>;
const dbMock = vi.fn(() => supabase);

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, db: () => dbMock() };
});

const { createInvoiceFromJob } = await import("./invoices");
const { ConversionRefused } = await import("./conversions");

// ---------------------------------------------------------------------------
// A fake PostgREST builder — the same shape as callTasksStore.test.ts uses.
// ---------------------------------------------------------------------------

type Op = { op: string; args: unknown[] };
type Reply = { data?: unknown; error?: unknown };

let calls: Array<{ table: string; ops: Op[] }> = [];

function makeBuilder(table: string) {
  const ops: Op[] = [];
  calls.push({ table, ops });

  const proxy: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          const reply = handler(table, ops);
          return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null, ...reply }).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          ops.push({ op: String(prop), args });
          return proxy;
        };
      },
    },
  ) as Record<string | symbol, unknown>;

  return proxy;
}

function has(ops: Op[], name: string): boolean {
  return ops.some((o) => o.op === name);
}

function argsOf(ops: Op[], name: string): unknown[] | undefined {
  return ops.find((o) => o.op === name)?.args;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const QC: TaxRate = {
  id: "qc",
  label: "GST + QST (Quebec)",
  components: [
    { name: "GST", rate: 50_000 },
    { name: "QST", rate: 99_750 },
  ],
};

const EXEMPT: TaxRate = { id: "exempt", label: "No tax", components: [] };

const REGISTERED = {
  taxRegistered: true,
  gstNumber: "123456789 RT0001",
  qstNumber: "1234567890 TQ0001",
  rbqLicence: "1234-5678-01",
};

function line(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: `l${Math.random()}`,
    position: 0,
    kind: "item",
    name: "Work",
    description: null,
    quantity_milli: 1000,
    unit: null,
    unit_cost_cents: null,
    unit_price_cents: 0,
    taxable: true,
    optional: false,
    selected: false,
    labor_hours: null,
    price_book_item_id: null,
    ...over,
  };
}

/**
 * The worked example every money test below uses.
 *
 *   $2,500.00 of work        → 250000
 *   2.5 × $80.00             →  20000
 *   subtotal                   270000
 *   GST  5%     of 270000    →  13500
 *   QST  9.975% of 270000    →  26933   (26932.5, rounded half up)
 *   total                      310433
 *
 * GST and QST are each charged on the same pre-tax base and summed. Quebec
 * de-harmonised in 2013, so QST is NOT charged on top of GST — compounding
 * them would overstate this job by $1,346.65.
 */
const SUBTOTAL = 270_000;
const GST = 13_500;
const QST = 26_933;
const TAX = GST + QST;
const TOTAL = SUBTOTAL + TAX;

function makeJob(over: Record<string, unknown> = {}) {
  return {
    id: "job1",
    job_number: 1042,
    client_id: "c1",
    property_id: "p1",
    quote_id: "q1",
    title: "Bathroom ceiling",
    status: "complete",
    archived_at: null,
    tax_snapshot: QC,
    client_snapshot: { displayName: "Marc Tremblay" },
    property_snapshot: null,
    subtotal_cents: SUBTOTAL,
    discount_cents: 0,
    tax_cents: TAX,
    total_cents: TOTAL,
    job_line_items: [
      line({ position: 0, name: "Plaster and paint", unit_price_cents: 250_000 }),
      line({ position: 1, name: "Materials", quantity_milli: 2500, unit_price_cents: 8_000 }),
    ],
    visits: [],
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Mutable world
// ---------------------------------------------------------------------------

let job: Record<string, unknown> | null;
let quoteRow: { quote_number: number; status: string } | null;
let company: Record<string, unknown>;
let existingInvoices: Record<string, unknown>[];
/** What the second read of `invoices` sees, for the lost-race case. */
let invoicesAfterRace: Record<string, unknown>[] | null;
let invoiceSelects: number;
let invoiceInsertError: unknown;
let lineInsertError: unknown;

let insertedInvoice: Record<string, unknown> | null;
let insertedLines: Record<string, unknown>[] | null;
let deletedInvoices: number;

function handler(table: string, ops: Op[]): Reply {
  if (table === "app_settings") {
    const key = String(argsOf(ops, "eq")?.[1] ?? "");
    if (key === "company") return { data: { value: company } };
    if (key === "quote_defaults") return { data: { value: { validDays: 30 } } };
    return { data: null };
  }

  if (table === "jobs") return { data: job };

  if (table === "quotes") return { data: quoteRow };

  if (table === "invoices") {
    if (has(ops, "insert")) {
      insertedInvoice = argsOf(ops, "insert")?.[0] as Record<string, unknown>;
      if (invoiceInsertError) return { error: invoiceInsertError };
      return { data: { id: "inv-new" } };
    }
    if (has(ops, "delete")) {
      deletedInvoices += 1;
      return { data: null };
    }
    invoiceSelects += 1;
    if (invoiceSelects > 1 && invoicesAfterRace) return { data: invoicesAfterRace };
    return { data: existingInvoices };
  }

  if (table === "invoice_line_items") {
    insertedLines = argsOf(ops, "insert")?.[0] as Record<string, unknown>[];
    return { error: lineInsertError };
  }

  return { data: null };
}

beforeEach(() => {
  calls = [];
  job = makeJob();
  quoteRow = { quote_number: 77, status: "converted" };
  company = { ...REGISTERED };
  existingInvoices = [];
  invoicesAfterRace = null;
  invoiceSelects = 0;
  invoiceInsertError = null;
  lineInsertError = null;
  insertedInvoice = null;
  insertedLines = null;
  deletedInvoices = 0;
  dbMock.mockReturnValue(supabase);
  from.mockReset();
  from.mockImplementation((table: string) => makeBuilder(table));
});

/** The money columns actually written to the invoices row. */
function written() {
  return {
    subtotal: insertedInvoice?.subtotal_cents,
    discount: insertedInvoice?.discount_cents,
    tax: insertedInvoice?.tax_cents,
    total: insertedInvoice?.total_cents,
  };
}

// ---------------------------------------------------------------------------
// The money
// ---------------------------------------------------------------------------

describe("the invoice matches the job, to the cent", () => {
  it("carries the subtotal, both taxes and the total unchanged", async () => {
    const result = await createInvoiceFromJob("job1");

    expect(result).toEqual({ id: "inv-new", created: true });
    expect(written()).toEqual({ subtotal: SUBTOTAL, discount: 0, tax: TAX, total: TOTAL });
    // Not the job's stored numbers copied across — recomputed from the frozen
    // lines and then found to agree. That is what makes divergence detectable.
    expect(insertedInvoice?.total_cents).toBe(job!.total_cents);
  });

  it("copies every line verbatim", async () => {
    await createInvoiceFromJob("job1");

    expect(insertedLines).toHaveLength(2);
    expect(insertedLines?.[0]).toMatchObject({
      name: "Plaster and paint",
      quantity_milli: 1000,
      unit_price_cents: 250_000,
      taxable: true,
      position: 0,
    });
    expect(insertedLines?.[1]).toMatchObject({
      name: "Materials",
      quantity_milli: 2500,
      unit_price_cents: 8_000,
    });
  });

  it("freezes the tax rate and the snapshots from the job, not from live settings", async () => {
    await createInvoiceFromJob("job1");
    expect(insertedInvoice?.tax_snapshot).toEqual(QC);
    expect(insertedInvoice?.client_snapshot).toEqual({ displayName: "Marc Tremblay" });
  });

  it("charges GST and QST on the same base rather than compounding them", async () => {
    await createInvoiceFromJob("job1");
    // Compounded, QST would be charged on 283500 and come to 28279 — $13.46
    // more on a $2,700 job, and wrong on every job in the system.
    expect(insertedInvoice?.tax_cents).toBe(13_500 + 26_933);
  });
});

describe("the quote's discount survives the trip", () => {
  // The regression test. 10% off 270000 is 27000; the job stores that as cents
  // and the invoice has to re-apply the same integer.
  const DISCOUNT = 27_000;
  const ADJUSTED = SUBTOTAL - DISCOUNT; // 243000
  const D_GST = 12_150;
  const D_QST = 24_239; // 24239.25, rounded half up
  const D_TOTAL = ADJUSTED + D_GST + D_QST;

  beforeEach(() => {
    job = makeJob({
      discount_cents: DISCOUNT,
      tax_cents: D_GST + D_QST,
      total_cents: D_TOTAL,
    });
  });

  it("bills the discounted total, not the list price", async () => {
    await createInvoiceFromJob("job1");
    expect(written()).toEqual({
      subtotal: SUBTOTAL,
      discount: DISCOUNT,
      tax: D_GST + D_QST,
      total: D_TOTAL,
    });
    // Before this was fixed the invoice came to the undiscounted 310433.
    expect(insertedInvoice?.total_cents).not.toBe(TOTAL);
  });

  it("stores the discount on the invoice so the document renders the same row", async () => {
    await createInvoiceFromJob("job1");
    expect(insertedInvoice?.discount_kind).toBe("amount");
    expect(insertedInvoice?.discount_value).toBe(DISCOUNT);
  });

  it("taxes the discounted base — a discount reduces the tax owed", async () => {
    await createInvoiceFromJob("job1");
    expect(insertedInvoice?.tax_cents).toBeLessThan(TAX);
  });
});

describe("tax-exempt", () => {
  it("charges nothing when the company is not registered to collect it", async () => {
    // `canChargeTax` is a hard gate: below the $30,000 small-supplier threshold
    // there is no authority to collect, whatever the line flags say. The job
    // was frozen the same way, so its stored figures agree.
    company = { taxRegistered: false, gstNumber: "", qstNumber: "", rbqLicence: "1234-5678-01" };
    job = makeJob({ tax_snapshot: EXEMPT, tax_cents: 0, total_cents: SUBTOTAL });

    await createInvoiceFromJob("job1");

    expect(written()).toEqual({ subtotal: SUBTOTAL, discount: 0, tax: 0, total: SUBTOTAL });
    expect(insertedInvoice?.tax_snapshot).toEqual({
      id: "unregistered",
      label: "No tax",
      components: [],
    });
  });

  it("charges nothing when the registered company quoted at the exempt rate", async () => {
    job = makeJob({ tax_snapshot: EXEMPT, tax_cents: 0, total_cents: SUBTOTAL });
    await createInvoiceFromJob("job1");
    expect(written()).toEqual({ subtotal: SUBTOTAL, discount: 0, tax: 0, total: SUBTOTAL });
  });

  it("does not tax exempt LINES on an otherwise taxable job", async () => {
    // 200000 taxable + 70000 exempt. Tax is charged on 200000 only.
    const taxable = 200_000;
    const exempt = 70_000;
    const gst = 10_000;
    const qst = 19_950;
    job = makeJob({
      job_line_items: [
        line({ position: 0, name: "Labour", unit_price_cents: taxable, taxable: true }),
        line({ position: 1, name: "Permit", unit_price_cents: exempt, taxable: false }),
      ],
      subtotal_cents: taxable + exempt,
      tax_cents: gst + qst,
      total_cents: taxable + exempt + gst + qst,
    });

    await createInvoiceFromJob("job1");
    expect(insertedInvoice?.tax_cents).toBe(gst + qst);
  });
});

describe("deposits", () => {
  // 30% of the post-discount pre-tax base: 81000, plus tax on that.
  const DEP_BASE = 81_000;
  const DEP_GST = 4_050;
  const DEP_QST = 8_080; // 8079.75, rounded half up
  const DEP_TOTAL = DEP_BASE + DEP_GST + DEP_QST;

  it("bills a percentage of the work as one taxable line", async () => {
    await createInvoiceFromJob("job1", { depositPercent: 30 });

    expect(insertedInvoice?.is_deposit).toBe(true);
    expect(insertedLines).toHaveLength(1);
    expect(insertedLines?.[0]).toMatchObject({
      name: "Deposit — 30% of Bathroom ceiling",
      unit_price_cents: DEP_BASE,
      quantity_milli: 1000,
      taxable: true,
    });
    expect(written()).toEqual({
      subtotal: DEP_BASE,
      discount: 0,
      tax: DEP_GST + DEP_QST,
      total: DEP_TOTAL,
    });
  });

  it("splits the deposit so exempt work is not taxed", async () => {
    job = makeJob({
      job_line_items: [
        line({ position: 0, name: "Labour", unit_price_cents: 200_000, taxable: true }),
        line({ position: 1, name: "Permit", unit_price_cents: 70_000, taxable: false }),
      ],
      subtotal_cents: 270_000,
      tax_cents: 10_000 + 19_950,
      total_cents: 270_000 + 10_000 + 19_950,
    });

    await createInvoiceFromJob("job1", { depositPercent: 50 });

    expect(insertedLines).toHaveLength(2);
    expect(insertedLines?.[0]).toMatchObject({ unit_price_cents: 100_000, taxable: true });
    expect(insertedLines?.[1]).toMatchObject({ unit_price_cents: 35_000, taxable: false });
    // Tax on the taxable half only: 5000 + 9975.
    expect(insertedInvoice?.tax_cents).toBe(5_000 + 9_975);
  });

  it("takes the percentage AFTER the discount, not off the list price", async () => {
    job = makeJob({ discount_cents: 27_000, tax_cents: 12_150 + 24_239, total_cents: 279_389 });
    await createInvoiceFromJob("job1", { depositPercent: 30 });
    // 30% of 243000, not of 270000.
    expect(insertedLines?.[0]).toMatchObject({ unit_price_cents: 72_900 });
  });

  it("the balance invoice credits the deposit so the two add up to the job exactly", async () => {
    existingInvoices = [
      { id: "inv-dep", invoice_number: 1041, is_deposit: true, total_cents: DEP_TOTAL },
    ];

    await createInvoiceFromJob("job1");

    // Full line list, plus one non-taxable credit for the tax-inclusive deposit.
    expect(insertedLines).toHaveLength(3);
    expect(insertedLines?.[2]).toMatchObject({
      name: "Less deposit invoiced — invoice #1041 (tax included)",
      unit_price_cents: -DEP_TOTAL,
      taxable: false,
    });

    // The whole point: deposit + balance = the job, to the cent.
    expect(insertedInvoice?.total_cents).toBe(TOTAL - DEP_TOTAL);
    expect((insertedInvoice?.total_cents as number) + DEP_TOTAL).toBe(TOTAL);
    // And the balance still shows the full GST and QST for the whole supply.
    expect(insertedInvoice?.tax_cents).toBe(TAX);
  });

  it("refuses a deposit that is not a sane percentage", async () => {
    for (const percent of [0, -10, 100, 150]) {
      await expect(createInvoiceFromJob("job1", { depositPercent: percent })).rejects.toThrow(
        /between 1% and 99%/,
      );
    }
    expect(insertedInvoice).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The guards
// ---------------------------------------------------------------------------

describe("no double invoicing", () => {
  it("hands back the invoice that already exists rather than raising a second", async () => {
    existingInvoices = [
      { id: "inv-1", invoice_number: 1041, is_deposit: false, total_cents: TOTAL },
    ];

    const result = await createInvoiceFromJob("job1");

    expect(result).toEqual({ id: "inv-1", created: false });
    expect(insertedInvoice).toBeNull();
  });

  it("hands back the existing deposit rather than taking a second one", async () => {
    existingInvoices = [
      { id: "inv-dep", invoice_number: 1041, is_deposit: true, total_cents: 93_130 },
    ];

    const result = await createInvoiceFromJob("job1", { depositPercent: 30 });

    expect(result).toEqual({ id: "inv-dep", created: false });
    expect(insertedInvoice).toBeNull();
  });

  it("refuses a deposit asked for after the final bill has gone out", async () => {
    existingInvoices = [
      { id: "inv-1", invoice_number: 1041, is_deposit: false, total_cents: TOTAL },
    ];

    await expect(createInvoiceFromJob("job1", { depositPercent: 30 })).rejects.toThrow(
      /already been invoiced in full on invoice #1041/,
    );
    expect(insertedInvoice).toBeNull();
  });

  it("picks up the winner when the unique index catches a race", async () => {
    // Both presses read "not invoiced yet"; the database refuses the second.
    invoiceInsertError = { code: "23505", message: "duplicate key value" };
    invoicesAfterRace = [
      { id: "inv-winner", invoice_number: 1041, is_deposit: false, total_cents: TOTAL },
    ];

    const result = await createInvoiceFromJob("job1");
    expect(result).toEqual({ id: "inv-winner", created: false });
  });

  it("refuses when the deposits already cover the whole job", async () => {
    existingInvoices = [
      { id: "inv-dep", invoice_number: 1041, is_deposit: true, total_cents: TOTAL },
    ];
    await expect(createInvoiceFromJob("job1")).rejects.toThrow(/no balance to bill/);
  });
});

describe("what will not be invoiced", () => {
  it("refuses a job that no longer exists", async () => {
    job = null;
    await expect(createInvoiceFromJob("job1")).rejects.toThrow(/no longer exists/);
  });

  it("refuses a cancelled job", async () => {
    job = makeJob({ status: "cancelled" });
    await expect(createInvoiceFromJob("job1")).rejects.toThrow(/was cancelled/);
    expect(insertedInvoice).toBeNull();
  });

  it("refuses an archived job", async () => {
    job = makeJob({ archived_at: "2026-01-01T00:00:00Z" });
    await expect(createInvoiceFromJob("job1")).rejects.toThrow(/is archived/);
  });

  it("refuses to invoice an unapproved quote", async () => {
    quoteRow = { quote_number: 77, status: "declined" };
    await expect(createInvoiceFromJob("job1")).rejects.toThrow(
      /quote #77, which is declined — not approved/,
    );
    expect(insertedInvoice).toBeNull();
  });

  it("allows a job whose quote was purged — the job carries everything it needs", async () => {
    quoteRow = null;
    await expect(createInvoiceFromJob("job1")).resolves.toEqual({ id: "inv-new", created: true });
  });

  it("refuses a job with no priced work on it", async () => {
    job = makeJob({
      job_line_items: [line({ kind: "text", quantity_milli: null, unit_price_cents: null })],
      subtotal_cents: 0,
      tax_cents: 0,
      total_cents: 0,
    });
    await expect(createInvoiceFromJob("job1")).rejects.toThrow(/no priced work on it/);
  });

  it("refuses — loudly — when the lines no longer total what was approved", async () => {
    // Somebody edited the work after the quote was accepted. The old code would
    // have billed the new number without a word.
    job = makeJob({ total_cents: 400_000 });

    const err = await createInvoiceFromJob("job1").catch((e) => e);
    expect(err).toBeInstanceOf(ConversionRefused);
    expect(err.refusal).toBe("totals_diverged");
    expect(err.message).toMatch(/accepted at \$4,000\.00/);
    expect(err.message).toMatch(/now come to \$3,104\.33/);
    expect(insertedInvoice).toBeNull();
  });

  it("refuses when the tax basis moved after the quote was frozen", async () => {
    // The company's registration was switched off. Every rate collapses to
    // nothing, so the job can no longer be billed at the price it was accepted
    // at — and inventing one of the two numbers is not an option.
    company = { taxRegistered: false, gstNumber: "", qstNumber: "", rbqLicence: "1234-5678-01" };

    const err = await createInvoiceFromJob("job1").catch((e) => e);
    expect(err.refusal).toBe("totals_diverged");
    expect(err.message).toMatch(/tax settings have changed/);
  });
});

describe("partial failure", () => {
  it("takes the invoice back out when its lines cannot be written", async () => {
    // An invoice with a total and no lines is a demand for money with nothing
    // behind it. Nothing points at the row yet, so it is removed and the
    // operator can simply press the button again.
    lineInsertError = { message: "connection reset" };

    await expect(createInvoiceFromJob("job1")).rejects.toThrow(/Could not copy the lines/);
    expect(deletedInvoices).toBe(1);
  });
});
