import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The crew view is a disclosure boundary, so these tests are mostly about what
 * is NOT here.
 *
 * The database is faked rather than mocked per-call, because the interesting
 * question is not "was the right function invoked" but "given a set of rows
 * absolutely stuffed with money, does a single one of those numbers survive
 * the trip to the payload". That is the test at the bottom of the first block,
 * and it is the one worth keeping if all the others were deleted.
 *
 * The second thing under test is the DIRECTION of the allowlist. A column
 * invented next year must be invisible by default. The fake job row therefore
 * carries columns that do not exist in `0007_jobs_invoices.sql` at all, and
 * the payload's key set is asserted literally.
 */

const from = vi.fn();
const createSignedUrls = vi.fn(async (paths: string[]) => ({
  data: paths.map((path) => ({ path, signedUrl: `https://signed.example/${path}` })),
  error: null,
}));
const supabase = {
  from,
  storage: { from: () => ({ createSignedUrls }) },
} as unknown as ReturnType<typeof import("./db").db>;
const dbMock = vi.fn(() => supabase);

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, db: () => dbMock() };
});

const {
  CREW_COMPLETED_GRACE_DAYS,
  CREW_TOKEN_TTL_DAYS,
  JOB_COLUMNS,
  LINE_COLUMNS,
  crewJobPayload,
  ensureCrewToken,
  getCrewJob,
  revokeCrewToken,
  setCrewChecklistItemDone,
  setCrewVisitCompleted,
} = await import("./crewView");

// ---------------------------------------------------------------------------
// Fake PostgREST builder — records the chained calls, answers per table.
// ---------------------------------------------------------------------------

type Op = { op: string; args: unknown[] };
type Reply = { data?: unknown; error?: unknown };
type Handler = (table: string, ops: Op[]) => Reply;

let calls: Array<{ table: string; ops: Op[] }> = [];
let handler: Handler = () => ({ data: [], error: null });

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
  );

  return proxy;
}

function callFor(table: string, index = 0) {
  return calls.filter((c) => c.table === table)[index];
}

function argsOf(ops: Op[], name: string, index = 0): unknown[] | undefined {
  return ops.filter((o) => o.op === name)[index]?.args;
}

function selectOf(table: string): string {
  return String(argsOf(callFor(table)?.ops ?? [], "select")?.[0] ?? "");
}

const MISSING_TABLE = { code: "PGRST205", message: "Could not find the table" };

// ---------------------------------------------------------------------------
// A job whose every record has been stuffed with money.
//
// The numbers are deliberately distinctive seven-to-nine digit values so a
// substring search cannot pass by accident against a quantity or a job number.
// ---------------------------------------------------------------------------

const MONEY_VALUES = [
  4871200, // job subtotal
  2350000, // job discount
  7311455, // job tax
  9182736, // job total
  6543210, // line unit price
  3216549, // line unit cost
  8080808, // invoice total
  1122334, // payment amount
  5566778, // expense amount
  9998887, // deposit
  4443332, // time entry cost
  7776665, // margin
];

const VALID_TOKEN = "a".repeat(64);

function moneyStuffedJob() {
  return {
    id: "job-1",
    job_number: 1042,
    title: "Basement — framing and drywall",
    status: "scheduled",
    instructions: "Park in the alley. Dust barrier at the stair head before anything else.",
    starts_on: "2026-08-10",
    ends_on: "2026-08-14",
    completed_at: null,
    property_snapshot: {
      street1: "12 rue Frozen",
      city: "Laval",
      accessNotes: "stale note",
      // A future writer stuffing something into the untyped blob.
      dealValueCents: 9182736,
    },
    clients: {
      first_name: "Marie",
      last_name: "Tremblay",
      phones: [
        { number: "514-555-0110", type: "other", primary: false, smsAllowed: false },
        { number: "514-555-0188", type: "mobile", primary: true, smsAllowed: true },
      ],
      emails: [{ address: "marie@example.com" }],
      billing_street1: "900 Billing Ave",
      billing_city: "Montréal",
    },
    properties: {
      street1: "3410 boulevard Saint-Martin",
      street2: "Apt 4",
      city: "Laval",
      province: "QC",
      postal_code: "H7T 1A1",
      country: "Canada",
      access_notes: "Gate code 4417. Dog in the yard — call first.",
    },
    // Everything below is what the crew must never see. Some of these columns
    // exist on `jobs` today; the last two do not exist at all, and stand in for
    // whatever gets added to the table next year.
    subtotal_cents: 4871200,
    discount_cents: 2350000,
    tax_cents: 7311455,
    total_cents: 9182736,
    internal_notes: "Client haggled. Margin is thin at 7776665 — do not go back.",
    client_snapshot: { displayName: "Marie Tremblay", street1: "900 Billing Ave" },
    tax_snapshot: { name: "QST+GST", totalRateHundredths: 1497 },
    quote_id: "quote-9",
    client_id: "client-3",
    property_id: "prop-2",
    archived_at: null,
    future_profitability_score: "leak-me",
    future_margin_cents: 7776665,
  };
}

function stuffedHandler(overrides: Partial<Record<string, Reply>> = {}): Handler {
  return (table, ops) => {
    if (overrides[table]) return overrides[table] as Reply;

    switch (table) {
      case "job_crew_tokens": {
        if (ops.some((o) => o.op === "update" || o.op === "upsert" || o.op === "delete")) {
          return { data: [{ job_id: "job-1" }], error: null };
        }
        return {
          data: {
            job_id: "job-1",
            expires_at: "2099-01-01T00:00:00.000Z",
            token: VALID_TOKEN,
          },
          error: null,
        };
      }
      case "jobs":
        return { data: moneyStuffedJob(), error: null };
      case "job_line_items":
        return {
          data: [
            {
              id: "line-1",
              position: 0,
              kind: "item",
              name: "Frame partition wall",
              description: "2x4 at 16 in. o.c.",
              quantity_milli: 12000,
              unit: "m²",
              // Selected-away in production; present here to prove the mapper
              // does not pick them up even when the driver hands them over.
              unit_price_cents: 6543210,
              unit_cost_cents: 3216549,
              labor_hours: 14,
              taxable: true,
            },
            {
              id: "line-2",
              position: 1,
              kind: "text",
              name: "Owner supplies the vanity",
              description: null,
              quantity_milli: null,
              unit: null,
            },
          ],
          error: null,
        };
      case "visits":
        if (ops.some((o) => o.op === "update")) return { data: [{ id: "visit-1" }], error: null };
        return {
          data: [
            {
              id: "visit-1",
              title: "Day one",
              starts_at: "2026-08-10T12:00:00.000Z",
              ends_at: "2026-08-10T20:00:00.000Z",
              all_day: false,
              completed_at: null,
              notes: "Ring the buzzer twice.",
            },
          ],
          error: null,
        };
      case "job_checklist_items":
        if (ops.some((o) => o.op === "update")) return { data: [{ id: "chk-1" }], error: null };
        return {
          data: [
            { id: "chk-1", label: "Photos before demolition", done: false, position: 0 },
            { id: "chk-2", label: "Water main off", done: true, position: 1 },
          ],
          error: null,
        };
      case "project_jobs":
        return { data: [{ project_id: "proj-1" }], error: null };
      case "project_files":
        return {
          data: [
            {
              id: "f1",
              storage_path: "proj-1/aaa-before.jpg",
              filename: "before.jpg",
              content_type: "image/jpeg",
              note: "Existing wall",
            },
            {
              id: "f2",
              storage_path: "proj-1/bbb-contract.pdf",
              filename: "contract.pdf",
              content_type: "application/pdf",
              note: null,
            },
            {
              id: "f3",
              storage_path: "proj-1/ccc-receipt.jpg",
              filename: "rona-receipt.jpg",
              content_type: "image/jpeg",
              note: "lumber",
            },
            {
              id: "f4",
              storage_path: "proj-1/ddd-plan.png",
              filename: "floor-plan.png",
              content_type: "image/png",
              note: null,
            },
          ],
          error: null,
        };
      default:
        return { data: [], error: null };
    }
  };
}

beforeEach(() => {
  calls = [];
  handler = stuffedHandler();
  dbMock.mockReturnValue(supabase);
  createSignedUrls.mockClear();
  from.mockReset();
  from.mockImplementation((table: string) => makeBuilder(table));
});

// ---------------------------------------------------------------------------

describe("crewJobPayload — what the crew may see", () => {
  it("carries the work, the site and the contact", async () => {
    const payload = await crewJobPayload("job-1");
    expect(payload).not.toBeNull();

    expect(payload!.jobNumber).toBe(1042);
    expect(payload!.title).toBe("Basement — framing and drywall");
    expect(payload!.instructions).toContain("Dust barrier");
    expect(payload!.workItems.map((w) => w.name)).toEqual([
      "Frame partition wall",
      "Owner supplies the vanity",
    ]);
    expect(payload!.workItems[0].quantityMilli).toBe(12000);
    expect(payload!.checklist).toEqual([
      { id: "chk-1", label: "Photos before demolition", done: false },
      { id: "chk-2", label: "Water main off", done: true },
    ]);
    expect(payload!.visits[0].startsAt).toBe("2026-08-10T12:00:00.000Z");
  });

  it("prefers the live property over the frozen snapshot — a gate code that changed", async () => {
    const payload = await crewJobPayload("job-1");
    expect(payload!.site.accessNotes).toBe("Gate code 4417. Dog in the yard — call first.");
    expect(payload!.site.street1).toBe("3410 boulevard Saint-Martin");
    expect(payload!.site.mapQuery).toBe("3410 boulevard Saint-Martin, Laval, QC, H7T 1A1");
  });

  it("falls back to the snapshot field by field, not by spreading it", async () => {
    handler = stuffedHandler({
      jobs: { data: { ...moneyStuffedJob(), properties: null }, error: null },
    });
    const payload = await crewJobPayload("job-1");

    expect(payload!.site.street1).toBe("12 rue Frozen");
    expect(payload!.site.accessNotes).toBe("stale note");
    // The extra key somebody stuffed into the jsonb blob is not along for the ride.
    expect(payload!.site).not.toHaveProperty("dealValueCents");
    expect(JSON.stringify(payload)).not.toContain("dealValueCents");
  });

  it("gives the customer's first name and phone — and nothing else about them", async () => {
    const payload = await crewJobPayload("job-1");
    expect(payload!.contact).toEqual({ firstName: "Marie", phone: "514-555-0188" });

    const json = JSON.stringify(payload);
    expect(json).not.toContain("Tremblay");
    expect(json).not.toContain("marie@example.com");
    expect(json).not.toContain("900 Billing Ave");
  });

  // -------------------------------------------------------------------------
  // The one that matters.
  // -------------------------------------------------------------------------

  it("leaks not one number from a job stuffed with prices, costs and totals", async () => {
    const payload = await crewJobPayload("job-1");
    const json = JSON.stringify(payload);

    for (const value of MONEY_VALUES) {
      expect(json, `money value ${value} reached the crew payload`).not.toContain(String(value));
      // …and not as dollars either, in case something formatted on the way out.
      expect(json).not.toContain((value / 100).toFixed(2));
    }

    // Nor the words that would carry one.
    for (const word of [
      "cents",
      "subtotal",
      "total",
      "discount",
      "tax_",
      "taxSnapshot",
      "internal_notes",
      "internalNotes",
      "client_snapshot",
      "price",
      "cost",
      "margin",
      "invoice",
      "payment",
      "deposit",
      "labor_hours",
      "laborHours",
    ]) {
      expect(json.toLowerCase(), `"${word}" reached the crew payload`).not.toContain(
        word.toLowerCase(),
      );
    }
  });

  it("never asks the database for a money column in the first place", async () => {
    await crewJobPayload("job-1");

    for (const table of ["jobs", "job_line_items", "visits", "job_checklist_items"]) {
      const select = selectOf(table);
      expect(select, `${table} select`).not.toContain("*");
      expect(select).not.toMatch(/cents/);
      expect(select).not.toMatch(/labor_hours/);
    }

    const jobSelect = selectOf("jobs");
    expect(jobSelect).not.toContain("internal_notes");
    expect(jobSelect).not.toContain("client_snapshot");
    expect(jobSelect).not.toContain("tax_snapshot");
    // The client embed asks for two fields, not the row.
    expect(jobSelect).toContain("clients(first_name, phones)");
  });

  // -------------------------------------------------------------------------
  // The allowlist's direction.
  // -------------------------------------------------------------------------

  it("ignores a column that does not exist yet — the allowlist is built by naming", async () => {
    const payload = await crewJobPayload("job-1");
    const json = JSON.stringify(payload);

    // Both are present on the row the fake driver returned. Neither is named
    // anywhere in crewView.ts, so neither can appear.
    expect(json).not.toContain("leak-me");
    expect(json).not.toContain("future_profitability_score");
    expect(json).not.toContain("7776665");
  });

  it("has exactly these top-level keys, and adding one is a deliberate act", async () => {
    const payload = await crewJobPayload("job-1");
    expect(Object.keys(payload!).sort()).toEqual(
      [
        "checklist",
        "checklistUnavailable",
        "completedAt",
        "contact",
        "endsOn",
        "instructions",
        "jobId",
        "jobNumber",
        "photos",
        "photosUnavailable",
        "site",
        "startsOn",
        "status",
        "title",
        "visits",
        "workItems",
      ].sort(),
    );
  });

  it("names every column it selects — no wildcards anywhere", () => {
    expect([...JOB_COLUMNS]).not.toContain("*");
    expect([...LINE_COLUMNS]).toEqual([
      "id",
      "position",
      "kind",
      "name",
      "description",
      "quantity_milli",
      "unit",
    ]);
  });
});

describe("photos", () => {
  it("shows site photos and hides the paperwork", async () => {
    const payload = await crewJobPayload("job-1");
    expect(payload!.photos.map((p) => p.filename)).toEqual(["before.jpg", "floor-plan.png"]);
  });

  it("drops a photographed receipt even though it is an image", async () => {
    const payload = await crewJobPayload("job-1");
    expect(payload!.photos.some((p) => p.filename.includes("receipt"))).toBe(false);
  });

  it("signs only the files it kept", async () => {
    await crewJobPayload("job-1");
    expect(createSignedUrls).toHaveBeenCalledWith(
      ["proj-1/aaa-before.jpg", "proj-1/ddd-plan.png"],
      expect.any(Number),
    );
  });

  it("renders a photo unlinked rather than failing when signing breaks", async () => {
    createSignedUrls.mockRejectedValueOnce(new Error("storage is down"));
    const payload = await crewJobPayload("job-1");
    expect(payload!.photos).toHaveLength(2);
    expect(payload!.photos[0].url).toBeNull();
  });
});

describe("degraded paths", () => {
  it("returns null when the database is unconfigured", async () => {
    dbMock.mockReturnValue(null as never);
    expect(await crewJobPayload("job-1")).toBeNull();
    expect(await getCrewJob(VALID_TOKEN)).toBeNull();
  });

  it("returns null for a job that does not exist", async () => {
    handler = stuffedHandler({ jobs: { data: null, error: null } });
    expect(await crewJobPayload("nope")).toBeNull();
  });

  it("still gives the address when the checklist migration has not run", async () => {
    handler = stuffedHandler({ job_checklist_items: { error: MISSING_TABLE } });
    const payload = await crewJobPayload("job-1");
    expect(payload!.checklistUnavailable).toBe(true);
    expect(payload!.checklist).toEqual([]);
    expect(payload!.site.street1).toBe("3410 boulevard Saint-Martin");
  });

  it("still gives the address when the projects migration has not run", async () => {
    handler = stuffedHandler({ project_jobs: { error: MISSING_TABLE } });
    const payload = await crewJobPayload("job-1");
    expect(payload!.photosUnavailable).toBe(true);
    expect(payload!.photos).toEqual([]);
  });

  it("reads archived jobs out of existence", async () => {
    await crewJobPayload("job-1");
    expect(argsOf(callFor("jobs").ops, "is", 0)).toEqual(["archived_at", null]);
  });
});

describe("tokens", () => {
  it("refuses anything that is not a 64-character hex token before querying", async () => {
    for (const bad of ["", "short", "../../etc/passwd", "z".repeat(64), "a".repeat(200)]) {
      expect(await getCrewJob(bad)).toBeNull();
    }
    expect(from).not.toHaveBeenCalled();
  });

  it("resolves a live token to its job", async () => {
    const payload = await getCrewJob(VALID_TOKEN);
    expect(payload!.jobId).toBe("job-1");
    expect(argsOf(callFor("job_crew_tokens").ops, "eq", 0)).toEqual(["token", VALID_TOKEN]);
  });

  it("stamps the visit so the office knows the link was opened", async () => {
    await getCrewJob(VALID_TOKEN, new Date("2026-08-10T13:00:00.000Z"));
    const update = calls.filter((c) => c.table === "job_crew_tokens").at(-1)!;
    expect((argsOf(update.ops, "update")?.[0] as Record<string, unknown>).last_viewed_at).toBe(
      "2026-08-10T13:00:00.000Z",
    );
  });

  it("stops working after the hard expiry", async () => {
    handler = stuffedHandler({
      job_crew_tokens: {
        data: { job_id: "job-1", expires_at: "2026-01-01T00:00:00.000Z" },
        error: null,
      },
    });
    expect(await getCrewJob(VALID_TOKEN, new Date("2026-08-10T00:00:00.000Z"))).toBeNull();
  });

  it("keeps working through the grace period after the job is completed", async () => {
    const completedAt = "2026-08-14T21:00:00.000Z";
    handler = stuffedHandler({
      jobs: { data: { ...moneyStuffedJob(), completed_at: completedAt, status: "complete" }, error: null },
    });

    const withinGrace = new Date(
      Date.parse(completedAt) + (CREW_COMPLETED_GRACE_DAYS - 1) * 86_400_000,
    );
    expect(await getCrewJob(VALID_TOKEN, withinGrace)).not.toBeNull();

    calls = [];
    const afterGrace = new Date(
      Date.parse(completedAt) + (CREW_COMPLETED_GRACE_DAYS + 1) * 86_400_000,
    );
    expect(await getCrewJob(VALID_TOKEN, afterGrace)).toBeNull();
  });

  it("does not distinguish an unknown token from an expired one", async () => {
    handler = stuffedHandler({ job_crew_tokens: { data: null, error: null } });
    expect(await getCrewJob(VALID_TOKEN)).toBeNull();
  });

  it("mints a 64-character hex token with an expiry, one row per job", async () => {
    handler = stuffedHandler({ job_crew_tokens: { data: null, error: null } });
    const now = new Date("2026-08-01T00:00:00.000Z");
    const token = await ensureCrewToken("job-1", now);

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const upsert = calls.filter((c) => c.table === "job_crew_tokens").at(-1)!;
    const row = argsOf(upsert.ops, "upsert")?.[0] as Record<string, unknown>;
    expect(row.job_id).toBe("job-1");
    expect(row.token).toBe(token);
    expect(row.expires_at).toBe(
      new Date(now.getTime() + CREW_TOKEN_TTL_DAYS * 86_400_000).toISOString(),
    );
    expect(argsOf(upsert.ops, "upsert")?.[1]).toEqual({ onConflict: "job_id" });
  });

  it("returns the existing token rather than minting a second key to the same door", async () => {
    const token = await ensureCrewToken("job-1", new Date("2026-08-01T00:00:00.000Z"));
    expect(token).toBe(VALID_TOKEN);
    expect(calls.some((c) => c.ops.some((o) => o.op === "upsert"))).toBe(false);
  });

  it("replaces an expired token instead of extending it", async () => {
    handler = stuffedHandler({
      job_crew_tokens: {
        data: { token: VALID_TOKEN, expires_at: "2026-01-01T00:00:00.000Z" },
        error: null,
      },
    });
    const token = await ensureCrewToken("job-1", new Date("2026-08-01T00:00:00.000Z"));
    expect(token).not.toBe(VALID_TOKEN);
  });

  it("revokes by deleting the grant", async () => {
    await revokeCrewToken("job-1");
    const call = callFor("job_crew_tokens");
    expect(call.ops.some((o) => o.op === "delete")).toBe(true);
    expect(argsOf(call.ops, "eq", 0)).toEqual(["job_id", "job-1"]);
  });
});

describe("writes are scoped to the token's job", () => {
  it("ticks a checklist item with the job id in the WHERE clause", async () => {
    expect(await setCrewChecklistItemDone(VALID_TOKEN, "chk-1", true)).toBe(true);

    const write = callFor("job_checklist_items");
    expect(argsOf(write.ops, "update")?.[0]).toEqual({ done: true });
    expect(argsOf(write.ops, "eq", 0)).toEqual(["id", "chk-1"]);
    // Without this second predicate the link to job A would edit job B.
    expect(argsOf(write.ops, "eq", 1)).toEqual(["job_id", "job-1"]);
  });

  it("changes nothing when the item belongs to another job", async () => {
    handler = stuffedHandler({ job_checklist_items: { data: [], error: null } });
    expect(await setCrewChecklistItemDone(VALID_TOKEN, "someone-elses-item", true)).toBe(false);
  });

  it("marks a visit done with a timestamp, and undoes it with null", async () => {
    const now = new Date("2026-08-10T22:15:00.000Z");
    expect(await setCrewVisitCompleted(VALID_TOKEN, "visit-1", true, now)).toBe(true);
    expect(argsOf(callFor("visits").ops, "update")?.[0]).toEqual({
      completed_at: "2026-08-10T22:15:00.000Z",
    });
    expect(argsOf(callFor("visits").ops, "eq", 1)).toEqual(["job_id", "job-1"]);

    calls = [];
    await setCrewVisitCompleted(VALID_TOKEN, "visit-1", false, now);
    expect(argsOf(callFor("visits").ops, "update")?.[0]).toEqual({ completed_at: null });
  });

  it("refuses every write on a bad token without touching the database", async () => {
    expect(await setCrewChecklistItemDone("nope", "chk-1", true)).toBe(false);
    expect(await setCrewVisitCompleted("nope", "visit-1", true)).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("refuses every write on an expired token", async () => {
    handler = stuffedHandler({
      job_crew_tokens: {
        data: { job_id: "job-1", expires_at: "2026-01-01T00:00:00.000Z" },
        error: null,
      },
    });
    const now = new Date("2026-08-01T00:00:00.000Z");
    expect(await setCrewChecklistItemDone(VALID_TOKEN, "chk-1", true, now)).toBe(false);
    expect(calls.some((c) => c.table === "job_checklist_items")).toBe(false);
  });
});
