import { describe, expect, it } from "vitest";
import {
  checkSolicitationConsent,
  isLive,
  requiresExpressConsent,
  type ConsentRecord,
} from "./adadConsent";

const NOW = new Date("2026-08-13T14:00:00.000Z");
const PHONE = "+15145550147";
const OTHER = "+15145550148";

function consent(overrides: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    phone: PHONE,
    purpose: "business_intro",
    expires_at: null,
    withdrawn_at: null,
    ...overrides,
  };
}

describe("requiresExpressConsent", () => {
  it("gates the introductory call", () => {
    expect(requiresExpressConsent("business_intro")).toBe(true);
  });

  it("leaves the logistics calls alone", () => {
    // These service an appointment the recipient already has with us. Putting
    // a consent wall in front of "the crew is on the way" would break the one
    // thing about the dialer that is unambiguously lawful.
    expect(requiresExpressConsent("confirm_visit")).toBe(false);
    expect(requiresExpressConsent("crew_on_way")).toBe(false);
    expect(requiresExpressConsent("schedule_change")).toBe(false);
  });
});

describe("isLive", () => {
  it("accepts an open-ended consent for the right number", () => {
    expect(isLive(consent(), PHONE, "business_intro", NOW)).toBe(true);
  });

  it("rejects a consent given for a different number", () => {
    // The rule is per-number. A contact who consented on their mobile has not
    // consented on the office line, and this is the assumption that must never
    // be made quietly.
    expect(isLive(consent(), OTHER, "business_intro", NOW)).toBe(false);
  });

  it("rejects a consent given for a different purpose", () => {
    expect(isLive(consent({ purpose: "something_else" }), PHONE, "business_intro", NOW)).toBe(false);
  });

  it("rejects a withdrawn consent", () => {
    expect(isLive(consent({ withdrawn_at: "2026-08-01T00:00:00.000Z" }), PHONE, "business_intro", NOW)).toBe(false);
  });

  it("rejects an expired consent", () => {
    expect(isLive(consent({ expires_at: "2026-08-12T00:00:00.000Z" }), PHONE, "business_intro", NOW)).toBe(false);
  });

  it("accepts one that has not expired yet", () => {
    expect(isLive(consent({ expires_at: "2026-09-01T00:00:00.000Z" }), PHONE, "business_intro", NOW)).toBe(true);
  });

  it("treats the expiry instant itself as expired", () => {
    // Fails closed on the boundary. An off-by-one here is a call placed
    // without consent, which is the expensive direction.
    expect(isLive(consent({ expires_at: NOW.toISOString() }), PHONE, "business_intro", NOW)).toBe(false);
  });
});

describe("checkSolicitationConsent", () => {
  function check(records: ConsentRecord[], onDoNotCallList = false) {
    return checkSolicitationConsent({ phone: PHONE, records, onDoNotCallList, now: NOW });
  }

  it("allows a call with a live consent", () => {
    expect(check([consent()])).toEqual({ ok: true });
  });

  it("refuses with nothing on file", () => {
    expect(check([])).toEqual({ ok: false, reason: "no_consent_on_file", detail: PHONE });
  });

  it("refuses when the only consent belongs to another number", () => {
    expect(check([consent({ phone: OTHER })]).ok).toBe(false);
    expect(check([consent({ phone: OTHER })])).toMatchObject({ reason: "no_consent_on_file" });
  });

  it("refuses a withdrawn consent and says so", () => {
    const result = check([consent({ withdrawn_at: "2026-08-05T00:00:00.000Z" })]);
    expect(result).toEqual({
      ok: false,
      reason: "consent_withdrawn",
      detail: "2026-08-05T00:00:00.000Z",
    });
  });

  it("refuses an expired consent and says so", () => {
    const result = check([consent({ expires_at: "2026-07-01T00:00:00.000Z" })]);
    expect(result).toMatchObject({ reason: "consent_expired", detail: "2026-07-01T00:00:00.000Z" });
  });

  it("lets a live consent override an older withdrawn one", () => {
    // Someone withdrew, then later agreed again. The live row is the current
    // word, and refusing here would make re-consent impossible.
    expect(
      check([consent({ withdrawn_at: "2026-06-01T00:00:00.000Z" }), consent()]),
    ).toEqual({ ok: true });
  });

  it("reports withdrawal ahead of expiry when both are on file", () => {
    const result = check([
      consent({ expires_at: "2026-07-01T00:00:00.000Z" }),
      consent({ withdrawn_at: "2026-08-02T00:00:00.000Z" }),
    ]);
    expect(result).toMatchObject({ reason: "consent_withdrawn" });
  });

  it("puts the do-not-call list above every consent record", () => {
    // A stale consent row cannot outvote someone asking us to stop. This is
    // the ordering that matters most, so it is asserted against a LIVE
    // consent, not an absent one.
    expect(check([consent()], true)).toMatchObject({ reason: "on_do_not_call_list" });
  });

  it("refuses when there are no records at all and they are on the list", () => {
    expect(check([], true)).toMatchObject({ reason: "on_do_not_call_list" });
  });

  it("defaults the purpose to business_intro", () => {
    expect(
      checkSolicitationConsent({
        phone: PHONE,
        records: [consent({ purpose: "business_intro" })],
        onDoNotCallList: false,
        now: NOW,
      }),
    ).toEqual({ ok: true });
  });

  it("does not let a consent for another purpose authorise this one", () => {
    expect(check([consent({ purpose: "newsletter" })])).toMatchObject({
      reason: "no_consent_on_file",
    });
  });
});
