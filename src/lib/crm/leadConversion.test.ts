import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lead → client, the first hop.
 *
 * The lead row is kept and linked, never consumed: it is the customer's own
 * words and the estimator's original numbers, and the tidied client record must
 * not overwrite the evidence of what was actually asked for.
 *
 * The interesting case is the half-applied one. Converting is two writes with
 * no transaction around them — insert the client, then point the lead at it.
 * When the second failed, the old code logged and returned success, leaving a
 * client nothing referenced; the next press of the button made another one.
 * `clients.lead_id` (migration 0019) is written by the SAME insert that creates
 * the client, so it cannot be the half that fails, and these tests pin both
 * that behaviour and the graceful fallback for a schema without it.
 */

const from = vi.fn();
const supabase = { from } as unknown as ReturnType<typeof import("./db").db>;
const dbMock = vi.fn(() => supabase);

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, db: () => dbMock() };
});

const { convertLeadToClient } = await import("./clients");
const { ConversionRefused } = await import("./conversions");

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

function filters(ops: Op[]): string[] {
  return ops.filter((o) => o.op === "eq").map((o) => String(o.args[0]));
}

const MISSING_COLUMN = {
  code: "PGRST204",
  message: "Could not find the 'lead_id' column of 'clients' in the schema cache",
};

// ---------------------------------------------------------------------------

let lead: Record<string, unknown> | null;
let clientById: Record<string, unknown> | null;
let clientByLead: Record<string, unknown> | null;
/** Set to simulate a database that has not had migration 0019 applied. */
let leadIdColumnMissing: boolean;
let leadUpdateError: unknown;

let clientInserts: Record<string, unknown>[];
let leadUpdates: Record<string, unknown>[];

function handler(table: string, ops: Op[]): Reply {
  if (table === "leads") {
    if (has(ops, "update")) {
      leadUpdates.push(argsOf(ops, "update")?.[0] as Record<string, unknown>);
      return { error: leadUpdateError };
    }
    return { data: lead };
  }

  if (table === "clients") {
    if (has(ops, "insert")) {
      const row = argsOf(ops, "insert")?.[0] as Record<string, unknown>;
      clientInserts.push(row);
      if (leadIdColumnMissing && "lead_id" in row) return { error: MISSING_COLUMN };
      return { data: { id: "client-new" } };
    }
    const on = filters(ops);
    if (on.includes("lead_id")) {
      if (leadIdColumnMissing) return { error: MISSING_COLUMN };
      return { data: clientByLead };
    }
    return { data: clientById };
  }

  if (table === "properties") return { data: { id: "prop-new" } };

  return { data: null };
}

beforeEach(() => {
  calls = [];
  lead = {
    id: "lead1",
    name: "Marc Tremblay",
    email: "marc@example.com",
    phone: "514-555-0188",
    address: "12 rue Principale, Laval",
    client_id: null,
    source: "phone",
  };
  clientById = null;
  clientByLead = null;
  leadIdColumnMissing = false;
  leadUpdateError = null;
  clientInserts = [];
  leadUpdates = [];
  dbMock.mockReturnValue(supabase);
  from.mockReset();
  from.mockImplementation((table: string) => makeBuilder(table));
});

// ---------------------------------------------------------------------------

describe("converting a lead", () => {
  it("creates the client and records the link on both rows", async () => {
    const result = await convertLeadToClient("lead1");

    expect(result).toEqual({ id: "client-new", created: true });
    expect(clientInserts[0]).toMatchObject({
      first_name: "Marc",
      last_name: "Tremblay",
      lead_id: "lead1",
    });
    expect(leadUpdates[0]).toEqual({ client_id: "client-new" });
  });

  it("carries the lead's source rather than assuming the website", async () => {
    // Hardcoding "Website" silently mis-attributed every phone-originated
    // client in the reports.
    await convertLeadToClient("lead1");
    expect(clientInserts[0].lead_source).toBe("Phone");
  });

  it("refuses a lead that no longer exists", async () => {
    lead = null;
    const err = await convertLeadToClient("lead1").catch((e) => e);
    expect(err).toBeInstanceOf(ConversionRefused);
    expect(err.refusal).toBe("not_found");
    expect(clientInserts).toHaveLength(0);
  });
});

describe("no double conversion", () => {
  it("hands back the client this lead already became", async () => {
    lead = { ...lead, client_id: "client-old" };
    clientById = {
      id: "client-old",
      first_name: "Marc",
      last_name: "Tremblay",
      company_name: null,
      archived_at: null,
    };

    const result = await convertLeadToClient("lead1");

    expect(result).toEqual({ id: "client-old", created: false });
    expect(clientInserts).toHaveLength(0);
  });

  it("finds the orphan when the first run created the client but never linked it", async () => {
    // The half-applied case. Without `clients.lead_id` this press would have
    // created a second Marc Tremblay.
    clientByLead = {
      id: "client-orphan",
      first_name: "Marc",
      last_name: "Tremblay",
      company_name: null,
      archived_at: null,
    };

    const result = await convertLeadToClient("lead1");

    expect(result).toEqual({ id: "client-orphan", created: false });
    expect(clientInserts).toHaveLength(0);
    // …and repairs the link that failed last time.
    expect(leadUpdates[0]).toEqual({ client_id: "client-orphan" });
  });

  it("refuses when the client it already became has been archived", async () => {
    lead = { ...lead, client_id: "client-old" };
    clientById = {
      id: "client-old",
      first_name: "Marc",
      last_name: "Tremblay",
      company_name: null,
      archived_at: "2026-01-01T00:00:00Z",
    };

    const err = await convertLeadToClient("lead1").catch((e) => e);
    expect(err.refusal).toBe("already_converted");
    expect(err.message).toMatch(/already Marc Tremblay, whose client record is archived/);
    expect(clientInserts).toHaveLength(0);
  });
});

describe("a schema one migration behind", () => {
  it("still converts when clients.lead_id does not exist yet", async () => {
    // Migrations here are run by hand. Until 0019 is applied this falls back to
    // the pre-0019 behaviour rather than breaking lead conversion outright.
    leadIdColumnMissing = true;

    const result = await convertLeadToClient("lead1");

    expect(result).toEqual({ id: "client-new", created: true });
    expect(clientInserts).toHaveLength(2);
    expect(clientInserts[0]).toHaveProperty("lead_id");
    expect(clientInserts[1]).not.toHaveProperty("lead_id");
    expect(leadUpdates[0]).toEqual({ client_id: "client-new" });
  });

  it("still finds an already-converted lead from the lead's own pointer", async () => {
    leadIdColumnMissing = true;
    lead = { ...lead, client_id: "client-old" };
    clientById = {
      id: "client-old",
      first_name: "Marc",
      last_name: "Tremblay",
      company_name: null,
      archived_at: null,
    };

    expect(await convertLeadToClient("lead1")).toEqual({ id: "client-old", created: false });
  });
});

describe("partial failure", () => {
  it("retries the lead link before giving up on it", async () => {
    leadUpdateError = { message: "connection reset" };

    // The client is still created — losing the customer record because a link
    // write failed would be worse, and 0019's `clients.lead_id` means the next
    // press finds this client instead of making another.
    const result = await convertLeadToClient("lead1");

    expect(result).toEqual({ id: "client-new", created: true });
    expect(leadUpdates).toHaveLength(2);
  });
});
