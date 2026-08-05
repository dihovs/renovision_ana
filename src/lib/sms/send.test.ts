import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The rules that decide whether a text goes out at all.
 *
 * Everything here is a case where being wrong contacts a real person: texting
 * someone who unsubscribed, guessing at a malformed number and reaching a
 * stranger, or omitting the identification CASL requires on first contact.
 */

const rows: Record<string, unknown[]> = { sms_opt_outs: [], sms_messages: [] };
const inserted: Record<string, unknown>[] = [];

/**
 * A Supabase stand-in narrow enough to be honest: it answers exactly the three
 * shapes send.ts builds, and would break loudly rather than silently pass if
 * one of those queries changed.
 */
vi.mock("@/lib/crm/db", () => ({
  db: () => ({
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        limit: () => Promise.resolve({ data: rows[table] ?? [], error: null }),
        maybeSingle: () =>
          Promise.resolve({ data: (rows[table] ?? [])[0] ?? null, error: null }),
        insert: (value: Record<string, unknown>) => {
          inserted.push(value);
          return Promise.resolve({ error: null });
        },
        upsert: () => Promise.resolve({ error: null }),
        delete: () => chain,
      };
      return chain;
    },
  }),
}));

const { sendSms, toE164, isStopRequest, isStartRequest } = await import("./send");

const OK_TWILIO = {
  ok: true,
  json: async () => ({ sid: "SM123" }),
} as Response;

describe("turning what someone typed into a number we can text", () => {
  it.each([
    ["+15145550188", "+15145550188"],
    ["(514) 555-0188", "+15145550188"],
    ["514-555-0188", "+15145550188"],
    ["1 514 555 0188", "+15145550188"],
  ])("reads %s as %s", (input, expected) => {
    expect(toE164(input)).toBe(expected);
  });

  it.each([["123"], ["not a phone"], [""], ["555-0188"]])(
    "refuses %s rather than guessing",
    (input) => {
      expect(toE164(input)).toBeNull();
    },
  );
});

describe("STOP, in both languages", () => {
  it.each([["STOP"], ["stop"], ["Arrêt"], ["ARRET"], ["unsubscribe"], ["désabonner"]])(
    "%s withdraws consent",
    (text) => {
      expect(isStopRequest(text)).toBe(true);
    },
  );

  it("does not read a sentence containing the word as a withdrawal", () => {
    // "Stop by at three" is a scheduling message, not an unsubscribe.
    expect(isStopRequest("stop by at three")).toBe(false);
    expect(isStopRequest("can you stop the leak")).toBe(false);
  });

  it("recognises an explicit start", () => {
    expect(isStartRequest("START")).toBe(true);
    expect(isStartRequest("unstop")).toBe(true);
  });
});

describe("sending", () => {
  beforeEach(() => {
    rows.sms_opt_outs = [];
    rows.sms_messages = [];
    inserted.length = 0;
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token_test";
    vi.stubGlobal("fetch", vi.fn(async () => OK_TWILIO));
  });

  afterEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("will not text a number that unsubscribed", async () => {
    rows.sms_opt_outs = [{ id: "opt-1" }];

    const result = await sendSms({ to: "+15145550188", body: "hello" });

    expect(result).toEqual({ sent: false, reason: "opted_out" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses a number it cannot parse, before reaching Twilio", async () => {
    const result = await sendSms({ to: "nonsense", body: "hello" });

    expect(result).toEqual({ sent: false, reason: "invalid_number" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses to text our own number", async () => {
    const result = await sendSms({ to: "+15799995979", body: "hello" });

    expect(result.sent).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("says so plainly when Twilio is not configured, rather than throwing", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;

    const result = await sendSms({ to: "+15145550188", body: "hello" });

    expect(result).toEqual({ sent: false, reason: "not_configured" });
  });

  it("identifies the sender and how to opt out, on the first message to a number", async () => {
    await sendSms({ to: "+15145550188", body: "Bonjour", locale: "fr" });

    const sent = vi.mocked(fetch).mock.calls[0][1] as { body: URLSearchParams };
    const text = sent.body.get("Body") ?? "";
    expect(text).toContain("Renovision AnA");
    expect(text).toContain("STOP");
  });

  it("does not repeat the notice once a conversation is under way", async () => {
    rows.sms_messages = [{ id: "earlier" }];

    await sendSms({ to: "+15145550188", body: "On my way" });

    const sent = vi.mocked(fetch).mock.calls[0][1] as { body: URLSearchParams };
    expect(sent.body.get("Body")).toBe("On my way");
  });

  it("records what it sent", async () => {
    await sendSms({ to: "+15145550188", body: "hello", clientId: "client-1" });

    expect(inserted[0]).toMatchObject({
      direction: "outbound",
      phone: "+15145550188",
      client_id: "client-1",
      status: "queued",
      provider_sid: "SM123",
    });
  });

  it("records the failure too, so a message never just vanishes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ message: "unreachable" }) })),
    );

    const result = await sendSms({ to: "+15145550188", body: "hello" });

    expect(result).toEqual({ sent: false, reason: "failed", detail: "unreachable" });
    expect(inserted[0]).toMatchObject({ status: "failed", error: "unreachable" });
  });
});
