import { describe, expect, it } from "vitest";
import { appendKey, backspace, formatDialed, isDialable, sanitisePasted } from "./phone";

/**
 * toE164 itself is already covered in crm/callScheduler.test.ts, which is where
 * it lived and which still imports it through the re-export — so moving the
 * function is proven by that suite continuing to pass rather than by a copy of
 * it here. What is new, and therefore what is tested below, is the dial pad.
 */

describe("appendKey — one press at a time", () => {
  it("adds digits, stars and hashes", () => {
    expect(appendKey("", "5")).toBe("5");
    expect(appendKey("514", "5")).toBe("5145");
    expect(appendKey("", "*")).toBe("*");
    expect(appendKey("*6", "7")).toBe("*67");
  });

  it("ignores anything that is not a key on a phone", () => {
    for (const key of ["a", " ", "-", "(", "", "12", "\n"]) {
      expect(appendKey("514", key)).toBe("514");
    }
  });

  it("takes a plus only as the very first character", () => {
    // E.164 has exactly one, at the front. Anywhere else it guarantees the
    // number will not dial, so dropping it beats inserting it.
    expect(appendKey("", "+")).toBe("+");
    expect(appendKey("1", "+")).toBe("1");
    expect(appendKey("+1", "+")).toBe("+1");
  });

  it("stops growing at the cap, so a stuck key cannot run away", () => {
    const long = "1".repeat(20);
    expect(appendKey(long, "2")).toBe(long);
  });
});

describe("backspace", () => {
  it("rubs out the last character and is safe on an empty display", () => {
    expect(backspace("5145")).toBe("514");
    expect(backspace("5")).toBe("");
    expect(backspace("")).toBe("");
  });
});

describe("sanitisePasted — numbers arrive with punctuation in them", () => {
  it("keeps the digits out of anything pasted from an email or the CRM", () => {
    expect(sanitisePasted("(514) 555-0188")).toBe("5145550188");
    expect(sanitisePasted("  514.555.0188  ")).toBe("5145550188");
    expect(sanitisePasted("514 555 0188")).toBe("5145550188");
  });

  it("keeps a leading plus and drops one that is buried mid-string", () => {
    expect(sanitisePasted("+1 514 555 0188")).toBe("+15145550188");
    expect(sanitisePasted("514+555")).toBe("514555");
  });

  it("truncates rather than accepting an unbounded paste", () => {
    expect(sanitisePasted("9".repeat(50))).toHaveLength(20);
  });
});

describe("formatDialed — readable while it is still being typed", () => {
  it("groups a North American number progressively", () => {
    // Brackets appear as soon as the area code is complete, so a wrong digit
    // is catchable at the moment it is typed rather than ten digits later.
    expect(formatDialed("")).toBe("");
    expect(formatDialed("5")).toBe("5");
    expect(formatDialed("514")).toBe("514");
    expect(formatDialed("5145")).toBe("(514) 5");
    expect(formatDialed("514555")).toBe("(514) 555");
    expect(formatDialed("5145550")).toBe("(514) 555-0");
    expect(formatDialed("5145550188")).toBe("(514) 555-0188");
  });

  it("promotes a leading country code to +1", () => {
    expect(formatDialed("15145550188")).toBe("+1 (514) 555-0188");
    expect(formatDialed("+15145550188")).toBe("+1 (514) 555-0188");
  });

  it("leaves other country codes alone rather than guessing their grouping", () => {
    expect(formatDialed("+33142685300")).toBe("+33142685300");
  });

  it("never reformats a dial code", () => {
    expect(formatDialed("*67")).toBe("*67");
    expect(formatDialed("*675145550188")).toBe("*675145550188");
    expect(formatDialed("#31#")).toBe("#31#");
  });
});

describe("isDialable — exactly what the Call button lights up on", () => {
  it("accepts what the server will accept", () => {
    expect(isDialable("5145550188")).toBe(true);
    expect(isDialable("(514) 555-0188")).toBe(true);
    expect(isDialable("15145550188")).toBe(true);
    expect(isDialable("+33142685300")).toBe(true);
  });

  it("refuses a half-typed number, so Call stays dark until it would work", () => {
    expect(isDialable("")).toBe(false);
    expect(isDialable("514")).toBe(false);
    expect(isDialable("514555018")).toBe(false);
  });

  it("refuses the typos the strict NANP rules exist to catch", () => {
    // Area code and exchange may not start with 0 or 1. Catching these here is
    // the difference between a dark button and a call that fails after the
    // click.
    expect(isDialable("+10555550123")).toBe(false);
    expect(isDialable("0145550188")).toBe(false);
    expect(isDialable("5141550188")).toBe(false);
  });

  it("refuses an extension, which a bridged call cannot navigate", () => {
    expect(isDialable("514-555-0188 ext 22")).toBe(false);
  });
});
