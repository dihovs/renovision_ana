import { describe, expect, it } from "vitest";
import {
  REFERENCE_DIGITS,
  formatReference,
  generateReference,
  parseSpokenReference,
} from "./reference";

describe("generateReference", () => {
  it("is always six digits and never starts with a zero", () => {
    // A leading zero is the one value people drop when reading a number aloud,
    // so the generator must not be able to produce it. Both ends of the random
    // range are pinned rather than sampled, because a probabilistic test that
    // fails one run in a thousand is worse than no test.
    expect(generateReference(() => 0)).toBe("100000");
    expect(generateReference(() => 0.999999999)).toBe("999999");
    for (let i = 0; i < 200; i += 1) {
      const ref = generateReference();
      expect(ref).toMatch(/^[1-9]\d{5}$/);
      expect(ref).toHaveLength(REFERENCE_DIGITS);
    }
  });
});

describe("formatReference", () => {
  it("wears the prefix on screen", () => {
    expect(formatReference("482913")).toBe("RVA-482913");
  });
});

describe("parseSpokenReference", () => {
  it("reads the shapes a transcriber actually produces", () => {
    expect(parseSpokenReference("482913")).toBe("482913");
    expect(parseSpokenReference("4 8 2 9 1 3")).toBe("482913");
    expect(parseSpokenReference("482 913")).toBe("482913");
    expect(parseSpokenReference("482-913")).toBe("482913");
    expect(parseSpokenReference("it's RVA 482913")).toBe("482913");
    expect(parseSpokenReference("R V A 4 8 2 9 1 3")).toBe("482913");
    expect(parseSpokenReference("mon numéro de référence est le 482913")).toBe("482913");
    expect(parseSpokenReference("yeah, 482913, that's the one.")).toBe("482913");
  });

  // The expensive false positive. The intake asks for a callback number on
  // nearly every call, and ten digits contain five six-digit windows — so
  // without this a customer reading their own phone number would have a
  // stranger's estimate read back to them.
  it("never reads a reference out of a phone number", () => {
    expect(parseSpokenReference("514-555-0188")).toBeNull();
    expect(parseSpokenReference("5145550188")).toBeNull();
    expect(parseSpokenReference("my number is (450) 555 0199")).toBeNull();
    expect(parseSpokenReference("c'est le 438 555 0123")).toBeNull();
    expect(parseSpokenReference("+1 579 990 3077")).toBeNull();
  });

  it("ignores the other numbers said on an intake call", () => {
    expect(parseSpokenReference("")).toBeNull();
    expect(parseSpokenReference("the bathroom is about 10 by 12")).toBeNull();
    expect(parseSpokenReference("ça dure depuis le 3 mars")).toBeNull();
    expect(parseSpokenReference("j'habite au 7144 rue Lajeunesse")).toBeNull();
    expect(parseSpokenReference("H7T 0C6")).toBeNull();
  });

  it("refuses a leading zero, which it could never have issued", () => {
    expect(parseSpokenReference("042913")).toBeNull();
  });

  it("refuses two candidates rather than guessing between them", () => {
    expect(parseSpokenReference("was it 482913 or 913482?")).toBeNull();
  });

  it("does not fuse two separate numbers into one reference", () => {
    // "7144" and "82" are two runs, not the six-digit "714482": only
    // separators between digits collapse, and a word between them stops it.
    expect(parseSpokenReference("7144 rue, unit 82")).toBeNull();
  });
});
