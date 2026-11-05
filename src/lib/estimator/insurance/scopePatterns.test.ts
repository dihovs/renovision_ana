import { describe, expect, it } from "vitest";
import { getLineItem } from "../catalog";
import { INSURANCE_SCOPE_PATTERNS, XACTIMATE_TO_CATALOGUE } from "./scopePatterns";

describe("scope patterns from reference estimates", () => {
  it("maps every Xactimate code to catalogue items that exist", () => {
    // A typo here would send a reader of another firm's devis — or the AI —
    // to a code the catalogue does not have, which prices as a gap at best.
    for (const [code, entry] of Object.entries(XACTIMATE_TO_CATALOGUE)) {
      for (const item of Object.values(entry.items ?? {})) {
        expect(getLineItem(item), `${code} → ${item}`).toBeDefined();
      }
    }
  });

  it("cites only catalogue codes that exist", () => {
    const cited = INSURANCE_SCOPE_PATTERNS.join(" ").match(/\b[A-Z]{2,5}(?:-[A-Z0-9]+)+\b/g) ?? [];
    expect(cited.length).toBeGreaterThan(0);
    for (const code of cited) expect(getLineItem(code), code).toBeDefined();
  });

  it("carries no prices", () => {
    // The owner's ruling: their rates are not ours. A dollar figure in a
    // pattern would reach the model as a hint it must never act on.
    expect(INSURANCE_SCOPE_PATTERNS.join(" ")).not.toMatch(/\$|\d+[.,]\d{2}\b/);
  });
});
