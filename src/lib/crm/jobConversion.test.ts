import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two hops either side of the job: quote → job, client → job, job → visit.
 *
 * What is worth the cost of a fake Supabase client here is the guards. Every
 * one of them protects against something that is invisible once it has
 * happened: two jobs from one quote look like twice the work in every report,
 * and a visit booked on a cancelled job sends a crew to a house where nobody is
 * expecting them.
 */

const from = vi.fn();
const supabase = { from } as unknown as ReturnType<typeof import("./db").db>;
const dbMock = vi.fn(() => supabase);

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, db: () => dbMock() };
});

const { createJobForClient, createJobFromQuote, createVisit, scheduleJobVisit } =
  await import("./jobs");
const { ConversionRefused } = await import("./conversions");

// ---------------------------------------------------------------------------
// A fake PostgREST builder
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

/**
 * Which columns a select matched on EQUALITY — how the three different reads of
 * the jobs table tell each other apart. `is` is deliberately excluded: the
 * double-submit lookup filters `is("quote_id", null)`, which would otherwise
 * look exactly like the "has this quote been converted" lookup.
 */
function filters(ops: Op[]): string[] {
  return ops.filter((o) => o.op === "eq").map((o) => String(o.args[0]));
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const QC = {
  id: "qc",
  label: "GST + QST (Quebec)",
  components: [
    { name: "GST", rate: 50_000 },
    { name: "QST", rate: 99_750 },
  ],
};

const REGISTERED = {
  taxRegistered: true,
  gstNumber: "123456789 RT0001",
  qstNumber: "1234567890 TQ0001",
  rbqLicence: "1234-5678-01",
};

function quoteLine(over: Record<string, unknown> = {}) {
  return {
    id: `ql${Math.random()}`,
    quote_id: "q1",
    position: 0,
    kind: "item",
    name: "Work",
    description: null,
    quantity_milli: 1000,
    unit: null,
    unit_cost_cents: null,
    unit_price_cents: 100_000,
    taxable: true,
    optional: false,
    selected: false,
    labor_hours: null,
    price_book_item_id: null,
    ...over,
  };
}

function makeQuote(over: Record<string, unknown> = {}) {
  return {
    id: "q1",
    quote_number: 77,
    client_id: "c1",
    property_id: "p1",
    title: "Bathroom ceiling",
    status: "approved",
    tax_snapshot: QC,
    client_snapshot: { displayName: "Marc Tremblay" },
    property_snapshot: { street1: "12 rue Principale" },
    client_message: "Crew arrives 8am",
    internal_notes: "Cash job",
    discount_kind: "none",
    discount_value: 0,
    deposit_kind: "none",
    deposit_value: 0,
    quote_line_items: [
      quoteLine({ position: 0, name: "Plaster", unit_price_cents: 200_000 }),
      quoteLine({ position: 1, name: "Skylight", unit_price_cents: 90_000, optional: true, selected: false }),
    ],
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Mutable world
// ---------------------------------------------------------------------------

let quote: Record<string, unknown> | null;
let jobForQuote: Record<string, unknown> | null;
let jobForQuoteAfterRace: Record<string, unknown> | null;
let jobById: Record<string, unknown> | null;
let recentDirectJob: Record<string, unknown> | null;
let futureVisit: { id: string } | null;
let clientRow: Record<string, unknown> | null;
let propertyRow: Record<string, unknown> | null;
let jobInsertError: unknown;
let jobLineInsertError: unknown;
let quoteJobSelects: number;

let insertedJob: Record<string, unknown> | null;
let insertedJobLines: Record<string, unknown>[] | null;
let insertedVisit: Record<string, unknown> | null;
let jobUpdates: Record<string, unknown>[];
let quoteUpdates: Record<string, unknown>[];
let deletedJobs: number;

function handler(table: string, ops: Op[]): Reply {
  if (table === "app_settings") {
    const key = String(argsOf(ops, "eq")?.[1] ?? "");
    if (key === "company") return { data: { value: REGISTERED } };
    if (key === "tax_rates") return { data: { value: { default: "qc", rates: [QC] } } };
    return { data: null };
  }

  if (table === "clients") return { data: clientRow };
  if (table === "properties") return { data: propertyRow };

  if (table === "quotes") {
    if (has(ops, "update")) {
      quoteUpdates.push(argsOf(ops, "update")?.[0] as Record<string, unknown>);
      return { data: null };
    }
    return { data: quote };
  }

  if (table === "jobs") {
    if (has(ops, "insert")) {
      insertedJob = argsOf(ops, "insert")?.[0] as Record<string, unknown>;
      if (jobInsertError) return { error: jobInsertError };
      return { data: { id: "job-new" } };
    }
    if (has(ops, "update")) {
      jobUpdates.push(argsOf(ops, "update")?.[0] as Record<string, unknown>);
      return { data: null };
    }
    if (has(ops, "delete")) {
      deletedJobs += 1;
      return { data: null };
    }
    const on = filters(ops);
    if (on.includes("quote_id")) {
      quoteJobSelects += 1;
      if (quoteJobSelects > 1 && jobForQuoteAfterRace) return { data: jobForQuoteAfterRace };
      return { data: jobForQuote };
    }
    if (on.includes("client_id")) return { data: recentDirectJob };
    return { data: jobById };
  }

  if (table === "job_line_items") {
    insertedJobLines = argsOf(ops, "insert")?.[0] as Record<string, unknown>[];
    return { error: jobLineInsertError };
  }

  if (table === "visits") {
    if (has(ops, "insert")) {
      insertedVisit = argsOf(ops, "insert")?.[0] as Record<string, unknown>;
      return { data: { id: "visit-new" } };
    }
    return { data: futureVisit };
  }

  return { data: null };
}

beforeEach(() => {
  calls = [];
  quote = makeQuote();
  jobForQuote = null;
  jobForQuoteAfterRace = null;
  jobById = { id: "job1", job_number: 1042, status: "unscheduled", archived_at: null };
  recentDirectJob = null;
  futureVisit = null;
  clientRow = {
    id: "c1",
    first_name: "Marc",
    last_name: "Tremblay",
    company_name: null,
    emails: [{ address: "marc@example.com", primary: true }],
    phones: [{ number: "+15145550188", primary: true }],
    billing_street1: "12 rue Principale",
    billing_street2: null,
    billing_city: "Laval",
    billing_province: "QC",
    billing_postal_code: "H7N 1A1",
    billing_country: "Canada",
    tax_rate_id: null,
  };
  propertyRow = {
    street1: "88 boulevard Cartier",
    street2: null,
    city: "Laval",
    province: "QC",
    postal_code: "H7N 2B2",
    country: "Canada",
    access_notes: "Key under the mat",
    tax_rate_id: null,
  };
  jobInsertError = null;
  jobLineInsertError = null;
  quoteJobSelects = 0;
  insertedJob = null;
  insertedJobLines = null;
  insertedVisit = null;
  jobUpdates = [];
  quoteUpdates = [];
  deletedJobs = 0;
  dbMock.mockReturnValue(supabase);
  from.mockReset();
  from.mockImplementation((table: string) => makeBuilder(table));
});

// ---------------------------------------------------------------------------
// Quote → job
// ---------------------------------------------------------------------------

describe("quote → job", () => {
  it("copies the agreed work and freezes everything the quote had frozen", async () => {
    const result = await createJobFromQuote("q1");

    expect(result).toEqual({ id: "job-new", created: true });
    expect(insertedJob).toMatchObject({
      quote_id: "q1",
      client_id: "c1",
      status: "unscheduled",
      tax_snapshot: QC,
      client_snapshot: { displayName: "Marc Tremblay" },
      subtotal_cents: 200_000,
    });
  });

  it("leaves out an option the customer declined", async () => {
    await createJobFromQuote("q1");
    // The skylight was optional and unticked. Carrying it across "just in case"
    // puts work in front of a crew that nobody agreed to pay for.
    expect(insertedJobLines).toHaveLength(1);
    expect(insertedJobLines?.[0]).toMatchObject({ name: "Plaster" });
  });

  it("includes an option the customer did tick", async () => {
    quote = makeQuote({
      quote_line_items: [
        quoteLine({ position: 0, name: "Plaster", unit_price_cents: 200_000 }),
        quoteLine({
          position: 1,
          name: "Skylight",
          unit_price_cents: 90_000,
          optional: true,
          selected: true,
        }),
      ],
    });

    await createJobFromQuote("q1");
    expect(insertedJobLines).toHaveLength(2);
    // Resolved at copy time: everything on a job is in scope.
    expect(insertedJobLines?.[1]).toMatchObject({ name: "Skylight", optional: false });
    expect(insertedJob?.subtotal_cents).toBe(290_000);
  });

  it("resolves the quote's discount to cents and carries that", async () => {
    // 10% of 200000. Stored as an integer so nothing downstream has to
    // re-resolve a percentage against a line list that may have moved.
    quote = makeQuote({ discount_kind: "percent", discount_value: 100_000 });
    await createJobFromQuote("q1");
    expect(insertedJob?.discount_cents).toBe(20_000);
    expect(insertedJob?.subtotal_cents).toBe(200_000);
  });

  it("closes the quote so the pipeline reflects reality", async () => {
    await createJobFromQuote("q1");
    expect(quoteUpdates[0]).toMatchObject({ status: "converted" });
  });

  it("refuses a quote that was never approved", async () => {
    quote = makeQuote({ status: "sent" });
    const err = await createJobFromQuote("q1").catch((e) => e);
    expect(err).toBeInstanceOf(ConversionRefused);
    expect(err.refusal).toBe("wrong_status");
    expect(err.message).toMatch(/Only an approved quote can become a job — this one is sent/);
    expect(insertedJob).toBeNull();
  });

  it("refuses a quote that no longer exists", async () => {
    quote = null;
    await expect(createJobFromQuote("q1")).rejects.toThrow(/no longer exists/);
  });

  it("hands back the job it already made rather than making a second", async () => {
    jobForQuote = { id: "job-old", job_number: 1000, status: "scheduled", archived_at: null };

    const result = await createJobFromQuote("q1");

    expect(result).toEqual({ id: "job-old", created: false });
    expect(insertedJob).toBeNull();
  });

  it("finishes the half that failed last time when it hands the existing job back", async () => {
    // Insert succeeded, the status flip did not. The next press repairs it.
    jobForQuote = { id: "job-old", job_number: 1000, status: "scheduled", archived_at: null };
    await createJobFromQuote("q1");
    expect(quoteUpdates[0]).toMatchObject({ status: "converted" });
  });

  it("refuses when the job it already made has been archived", async () => {
    jobForQuote = { id: "job-old", job_number: 1000, status: "cancelled", archived_at: "2026-01-01" };

    const err = await createJobFromQuote("q1").catch((e) => e);
    expect(err.refusal).toBe("already_converted");
    expect(err.message).toMatch(/already became job #1000, which is archived/);
    expect(insertedJob).toBeNull();
  });

  it("picks up the winner when the unique index catches a race", async () => {
    jobInsertError = { code: "23505", message: "duplicate key value" };
    jobForQuoteAfterRace = {
      id: "job-winner",
      job_number: 1001,
      status: "unscheduled",
      archived_at: null,
    };

    const result = await createJobFromQuote("q1");
    expect(result).toEqual({ id: "job-winner", created: false });
  });

  it("takes the job back out when its lines cannot be copied", async () => {
    // Otherwise the board shows a job with a number, a customer and no work on
    // it, which reads as real and totals zero.
    jobLineInsertError = { message: "connection reset" };

    await expect(createJobFromQuote("q1")).rejects.toThrow(/Could not copy the lines/);
    expect(deletedJobs).toBe(1);
    expect(quoteUpdates).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Client → job
// ---------------------------------------------------------------------------

describe("client → job, with no quote", () => {
  it("freezes the client and property the way sending a quote would", async () => {
    await createJobForClient("c1", { propertyId: "p1", title: "Fix the leak" });

    expect(insertedJob).toMatchObject({
      client_id: "c1",
      property_id: "p1",
      quote_id: null,
      title: "Fix the leak",
      status: "unscheduled",
    });
    expect(insertedJob?.client_snapshot).toMatchObject({
      displayName: "Marc Tremblay",
      email: "marc@example.com",
      city: "Laval",
    });
    expect(insertedJob?.property_snapshot).toMatchObject({
      street1: "88 boulevard Cartier",
      accessNotes: "Key under the mat",
    });
  });

  it("prices the job through the same engine, tax and all", async () => {
    await createJobForClient("c1", {
      propertyId: "p1",
      title: "Fix the leak",
      lines: [{ name: "Emergency call-out", unitPriceCents: 85_000 }],
    });

    expect(insertedJob).toMatchObject({
      subtotal_cents: 85_000,
      discount_cents: 0,
      tax_cents: 4_250 + 8_479, // GST 5%, QST 9.975% (8478.75 → 8479)
      total_cents: 85_000 + 4_250 + 8_479,
    });
    expect(insertedJobLines?.[0]).toMatchObject({
      name: "Emergency call-out",
      quantity_milli: 1000,
      unit_price_cents: 85_000,
      taxable: true,
    });
  });

  it("creates the job with no price at all — the paperwork can catch up", async () => {
    await createJobForClient("c1", { title: "Look at the roof" });
    expect(insertedJob).toMatchObject({ subtotal_cents: 0, total_cents: 0 });
    expect(insertedJobLines).toBeNull();
  });

  it("hands back the same job on a double submit", async () => {
    recentDirectJob = { id: "job-just-made", job_number: 1043, status: "unscheduled", archived_at: null };

    const result = await createJobForClient("c1", { title: "Fix the leak" });

    expect(result).toEqual({ id: "job-just-made", created: false });
    expect(insertedJob).toBeNull();
  });

  it("takes the job back out when its lines cannot be written", async () => {
    jobLineInsertError = { message: "connection reset" };
    await expect(
      createJobForClient("c1", { title: "Fix the leak", lines: [{ name: "x", unitPriceCents: 100 }] }),
    ).rejects.toThrow(/Could not save the lines/);
    expect(deletedJobs).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Job → visit
// ---------------------------------------------------------------------------

describe("job → visit", () => {
  it("books the next working day, 8am to noon", async () => {
    vi.setSystemTime(new Date("2026-08-07T16:00:00Z")); // Friday, 12:00 EDT

    const result = await scheduleJobVisit("job1");

    expect(result).toEqual({ id: "visit-new", created: true });
    expect(insertedVisit).toMatchObject({
      job_id: "job1",
      starts_at: "2026-08-10T12:00:00.000Z", // Monday 08:00 EDT
      ends_at: "2026-08-10T16:00:00.000Z",
      all_day: false,
    });

    vi.useRealTimers();
  });

  it("makes the job scheduled, because a date on the calendar is what that means", async () => {
    await scheduleJobVisit("job1", { startsAt: "2026-08-10T12:00:00.000Z" });
    expect(jobUpdates.some((patch) => patch.status === "scheduled")).toBe(true);
  });

  it("hands back the visit already booked rather than stacking a second", async () => {
    futureVisit = { id: "visit-existing" };

    const result = await scheduleJobVisit("job1");

    expect(result).toEqual({ id: "visit-existing", created: false });
    expect(insertedVisit).toBeNull();
  });

  it("books a second trip when a date is given explicitly", async () => {
    // A renovation is rarely one visit — assessment, demolition, finishing.
    futureVisit = { id: "visit-existing" };

    const result = await scheduleJobVisit("job1", { startsAt: "2026-09-01T13:00:00.000Z" });

    expect(result).toEqual({ id: "visit-new", created: true });
    expect(insertedVisit).toMatchObject({ starts_at: "2026-09-01T13:00:00.000Z" });
  });

  it("refuses to put a cancelled job back on the calendar", async () => {
    jobById = { id: "job1", job_number: 1042, status: "cancelled", archived_at: null };

    const err = await scheduleJobVisit("job1").catch((e) => e);
    expect(err).toBeInstanceOf(ConversionRefused);
    expect(err.refusal).toBe("wrong_status");
    expect(err.message).toMatch(/Job #1042 was cancelled/);
    expect(insertedVisit).toBeNull();
  });

  it("refuses to schedule an archived job", async () => {
    jobById = { id: "job1", job_number: 1042, status: "unscheduled", archived_at: "2026-01-01" };

    await expect(scheduleJobVisit("job1")).rejects.toThrow(/Job #1042 is archived/);
    expect(insertedVisit).toBeNull();
  });

  it("refuses a job that no longer exists", async () => {
    jobById = null;
    await expect(scheduleJobVisit("job1")).rejects.toThrow(/no longer exists/);
  });

  it("applies the same guard to the date form, not just the one-click button", async () => {
    jobById = { id: "job1", job_number: 1042, status: "cancelled", archived_at: null };

    await expect(
      createVisit("job1", { startsAt: "2026-08-10T12:00:00.000Z" }),
    ).rejects.toThrow(/was cancelled/);
    expect(insertedVisit).toBeNull();
  });
});
