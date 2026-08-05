import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bridgeCall, ownerMobile } from "./bridge";

/**
 * Who gets dialled, and with whose number on the display.
 *
 * The caller ID is the entire reason this path exists — if it were his own
 * mobile, the `tel:` link would already do the job for free — so the assertion
 * that both legs carry the business number is the one that matters most here.
 */

const OK = { ok: true, json: async () => ({ sid: "CA123" }) } as Response;

/** The form Twilio was POSTed, decoded. */
function sentParams(): URLSearchParams {
  const init = vi.mocked(fetch).mock.calls[0][1] as { body: URLSearchParams };
  return init.body;
}

describe("choosing which phone to ring", () => {
  afterEach(() => {
    delete process.env.OWNER_MOBILE;
    delete process.env.OWNER_PHONE_NUMBERS;
  });

  it("takes the first owner number when no explicit mobile is set", () => {
    process.env.OWNER_PHONE_NUMBERS = "+15799903077, +15145550000";
    expect(ownerMobile()).toBe("+15799903077");
  });

  it("prefers OWNER_MOBILE when it is set", () => {
    process.env.OWNER_PHONE_NUMBERS = "+15799903077";
    process.env.OWNER_MOBILE = "(514) 555-0000";
    expect(ownerMobile()).toBe("+15145550000");
  });

  it("is null when nothing is configured", () => {
    expect(ownerMobile()).toBeNull();
  });
});

describe("placing the call", () => {
  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token_test";
    process.env.OWNER_PHONE_NUMBERS = "+15799903077";
    vi.stubGlobal("fetch", vi.fn(async () => OK));
  });

  afterEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.OWNER_PHONE_NUMBERS;
    delete process.env.OWNER_MOBILE;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("rings the owner first, from the business number", async () => {
    const result = await bridgeCall({ to: "(514) 555-0188" });

    expect(result).toEqual({ ok: true, sid: "CA123" });
    const params = sentParams();
    expect(params.get("To")).toBe("+15799903077");
    expect(params.get("From")).toBe("+15799995979");
  });

  it("shows the customer the business number, not the owner's mobile", async () => {
    await bridgeCall({ to: "+15145550188" });

    const twiml = sentParams().get("Twiml") ?? "";
    expect(twiml).toContain('callerId="+15799995979"');
    expect(twiml).toContain("+15145550188");
    // The whole point. If this ever appears, the customer has his mobile.
    expect(twiml).not.toContain("+15799903077");
  });

  it("refuses a number it cannot parse, before spending a call", async () => {
    const result = await bridgeCall({ to: "nonsense" });

    expect(result).toEqual({ ok: false, reason: "invalid_number" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses to dial the owner's own phone, which would just call himself", async () => {
    const result = await bridgeCall({ to: "+15799903077" });

    expect(result.ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses to dial the business number, which would loop into Ana", async () => {
    const result = await bridgeCall({ to: "+15799995979" });

    expect(result.ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("says which piece is missing when no owner phone is configured", async () => {
    delete process.env.OWNER_PHONE_NUMBERS;

    expect(await bridgeCall({ to: "+15145550188" })).toEqual({
      ok: false,
      reason: "no_owner_number",
    });
  });

  it("says so plainly when Twilio is not configured", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;

    expect(await bridgeCall({ to: "+15145550188" })).toEqual({
      ok: false,
      reason: "not_configured",
    });
  });

  it("passes Twilio's refusal back rather than swallowing it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ message: "unverified number" }),
      })),
    );

    expect(await bridgeCall({ to: "+15145550188" })).toEqual({
      ok: false,
      reason: "failed",
      detail: "unverified number",
    });
  });
});
