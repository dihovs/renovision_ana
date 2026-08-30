import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Reading other people's messages back.
 *
 * The cases here are the ones where being wrong is not a cosmetic problem: a
 * search that silently widens to every job, a wildcard in the owner's own
 * search text matching everything, and a transcript that loses who said a
 * thing — which is the difference between a quote and an assertion.
 */

type Row = Record<string, unknown>;

const tables: Record<string, Row[]> = {};
const calls: { table: string; filters: Record<string, unknown> }[] = [];

vi.mock("./db", () => ({
  db: () => ({
    from(table: string) {
      const filters: Record<string, unknown> = {};
      calls.push({ table, filters });
      // Supabase's builder is a thenable that keeps returning itself, so the
      // stand-in has to be one too — a mock whose limit() returns a plain
      // promise passes the tests the real client would fail on.
      const chain: Record<string, unknown> = {
        then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
          Promise.resolve({ data: tables[table] ?? [], error: null }).then(resolve),
        maybeSingle: () =>
          Promise.resolve({ data: (tables[table] ?? [])[0] ?? null, error: null }),
      };
      for (const method of ["select", "eq", "gte", "ilike", "order", "limit", "not", "is"]) {
        chain[method] = (a?: unknown, b?: unknown) => {
          if (a !== undefined) filters[`${method}:${String(a)}`] = b ?? true;
          return chain;
        };
      }
      return chain;
    },
  }),
}));

const { asTranscript, searchConversations } = await import("./conversations");

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  calls.length = 0;
});

describe("searchConversations", () => {
  it("returns nothing when the job number matches no job, rather than everything", async () => {
    tables.jobs = [];
    tables.whatsapp_messages = [{ body: "should never be seen", direction: "inbound", sent_at: "2026-08-01T12:00:00Z", kind: "text", whatsapp_contacts: null, jobs: null }];

    const found = await searchConversations({ jobNumber: 9999, channel: "whatsapp" });
    expect(found).toEqual([]);
  });

  it("escapes the wildcards Postgres would otherwise honour in the owner's own words", async () => {
    tables.whatsapp_messages = [];
    await searchConversations({ query: "50%_off", channel: "whatsapp" });

    const ilike = calls
      .flatMap((c) => Object.keys(c.filters))
      .find((key) => key.startsWith("ilike:"));
    expect(ilike).toBe("ilike:body");
    const pattern = calls.flatMap((c) => Object.values(c.filters)).find((v) => typeof v === "string" && v.includes("50"));
    expect(pattern).toBe("%50\\%\\_off%");
  });

  it("does not answer a job-scoped question with the customer's whole text history", async () => {
    tables.jobs = [{ id: "job-1" }];
    tables.whatsapp_messages = [];
    tables.sms_messages = [{ body: "unrelated text", direction: "inbound", created_at: "2026-08-01T12:00:00Z", phone: "+15145550188", clients: null }];

    const found = await searchConversations({ jobNumber: 1042 });
    expect(found.every((m) => m.channel !== "sms")).toBe(true);
  });

  it("names the sender from what the owner calls them, not their WhatsApp profile", async () => {
    tables.whatsapp_messages = [
      {
        body: "Tiles arrived",
        direction: "inbound",
        sent_at: "2026-08-01T12:00:00Z",
        kind: "text",
        whatsapp_contacts: { id: "c1", wa_id: "15145550188", profile_name: "MIKE 🔧", display_name: "Mike (plumber)", role: "subcontractor", opted_in_at: null, notes: null },
        jobs: { job_number: 1042 },
      },
    ];
    const [message] = await searchConversations({ channel: "whatsapp" });
    expect(message.who).toBe("Mike (plumber)");
    expect(message.jobNumber).toBe(1042);
  });

  it("names an attachment without pretending to know what is in it", async () => {
    tables.whatsapp_messages = [
      {
        body: null,
        media_mime: "image/jpeg",
        media_caption: null,
        direction: "inbound",
        sent_at: "2026-08-01T12:00:00Z",
        kind: "image",
        whatsapp_contacts: null,
        jobs: null,
      },
    ];
    const [message] = await searchConversations({ channel: "whatsapp" });
    expect(message.attachment).toBe("image");
    expect(message.text).toBe("(image)");
  });
});

describe("asTranscript", () => {
  const message = {
    channel: "whatsapp" as const,
    who: "Mike (plumber)",
    direction: "inbound" as const,
    sentAt: "2026-08-01T16:30:00Z",
    text: "The tiles are the wrong colour",
    jobNumber: 1042,
    attachment: null,
  };

  it("keeps who said it and when — a quote without those is an assertion", () => {
    const line = asTranscript([message]);
    expect(line).toContain("Mike (plumber)");
    expect(line).toContain("job 1042");
    expect(line).toContain("Aug 1");
    expect(line).toContain("The tiles are the wrong colour");
  });

  it("marks our own messages as ours", () => {
    expect(asTranscript([{ ...message, direction: "outbound" }])).toContain("Us → Mike (plumber)");
  });

  it("says so when there is nothing, rather than returning an empty string", () => {
    expect(asTranscript([])).toBe("No messages.");
  });
});
