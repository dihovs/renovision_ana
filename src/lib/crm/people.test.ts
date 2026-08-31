import { describe, expect, it } from "vitest";
import { normaliseIdentity } from "./people";

/**
 * The normaliser is the whole of ANA-02 that decides anything, so it is the
 * whole of what is worth testing without a database — the same split
 * `contactMatch.test.ts` makes.
 *
 * What these tests are really protecting is one property: the same human
 * arriving by two routes must reduce to values that find one person. Everything
 * else here is a way of that going wrong.
 */

describe("normaliseIdentity", () => {
  it("treats nothing as nothing", () => {
    for (const kind of ["email", "phone", "whatsapp_wa_id", "teams_user_id", "ms_upn"] as const) {
      expect(normaliseIdentity(kind, null)).toBeNull();
      expect(normaliseIdentity(kind, undefined)).toBeNull();
      expect(normaliseIdentity(kind, "   ")).toBeNull();
    }
  });

  describe("email", () => {
    it("lowercases and trims, because a reply-to is written however it is written", () => {
      expect(normaliseIdentity("email", "  Marie.Tremblay@ACME.CA ")).toBe("marie.tremblay@acme.ca");
    });

    it("refuses what is not an address rather than storing a value nothing matches", () => {
      expect(normaliseIdentity("email", "marie")).toBeNull();
      expect(normaliseIdentity("email", "@acme.ca")).toBeNull();
      expect(normaliseIdentity("email", "marie@")).toBeNull();
      expect(normaliseIdentity("email", "a@b@c.ca")).toBeNull();
      expect(normaliseIdentity("email", "marie tremblay@acme.ca")).toBeNull();
    });

    it("keeps unusual but legal addresses", () => {
      expect(normaliseIdentity("email", "m+chantier@acme.ca")).toBe("m+chantier@acme.ca");
      expect(normaliseIdentity("email", "info@sous-sol.quebec")).toBe("info@sous-sol.quebec");
    });
  });

  describe("phone", () => {
    it("is the dialler's normaliser and not a second one", () => {
      expect(normaliseIdentity("phone", "(514) 555-1234")).toBe("+15145551234");
      expect(normaliseIdentity("phone", "514.555.1234")).toBe("+15145551234");
      expect(normaliseIdentity("phone", "+1 514 555 1234")).toBe("+15145551234");
    });

    it("refuses an extension, because an automated call cannot navigate one", () => {
      expect(normaliseIdentity("phone", "514-555-1234 ext 22")).toBeNull();
      expect(normaliseIdentity("phone", "514-555-1234 poste 22")).toBeNull();
    });

    it("refuses a typo that E.164 alone would accept", () => {
      expect(normaliseIdentity("phone", "+10555551234")).toBeNull();
    });
  });

  describe("whatsapp_wa_id", () => {
    it("is E.164 with the plus stripped, in either direction", () => {
      expect(normaliseIdentity("whatsapp_wa_id", "15145551234")).toBe("15145551234");
      expect(normaliseIdentity("whatsapp_wa_id", "+15145551234")).toBe("15145551234");
    });

    it("refuses anything that is not that", () => {
      expect(normaliseIdentity("whatsapp_wa_id", "05145551234")).toBeNull();
      expect(normaliseIdentity("whatsapp_wa_id", "514-555-1234")).toBeNull();
      expect(normaliseIdentity("whatsapp_wa_id", "mike")).toBeNull();
    });
  });

  describe("teams_user_id", () => {
    it("lowercases, because Microsoft returns a GUID in either case", () => {
      expect(normaliseIdentity("teams_user_id", "3F2504E0-4F89-11D3-9A0C-0305E82C3301")).toBe(
        "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
      );
    });

    it("refuses what is not a GUID", () => {
      expect(normaliseIdentity("teams_user_id", "marie@acme.ca")).toBeNull();
      expect(normaliseIdentity("teams_user_id", "3f2504e0")).toBeNull();
    });
  });

  /**
   * The property the whole design rests on. Migration 0046 writes both kinds
   * for a WhatsApp contact so that a text and a WhatsApp message from one
   * person find one row; if these two ever stop lining up, that join silently
   * returns nothing and the owner is back to reassembling by hand.
   */
  it("keeps a WhatsApp id and a phone number pointing at the same human", () => {
    const wa = normaliseIdentity("whatsapp_wa_id", "15145551234");
    const phone = normaliseIdentity("phone", "(514) 555-1234");
    expect(wa).not.toBeNull();
    expect(phone).toBe(`+${wa}`);
  });

  it("does not care how the number was typed on the way in", () => {
    const spellings = ["+1 (514) 555-1234", "514-555-1234", "5145551234", " +15145551234 "];
    const normalised = new Set(spellings.map((s) => normaliseIdentity("phone", s)));
    expect(normalised).toEqual(new Set(["+15145551234"]));
  });
});
