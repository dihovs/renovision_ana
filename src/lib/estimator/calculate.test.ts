import { describe, expect, it } from "vitest";
import {
  calculateEstimate,
  calculateHandymanEstimate,
  calculateTax,
  formatCents,
  formatCentsPrecise,
} from "./calculate";

// Real catalog items used below (src/lib/estimator/data/lineItems.ts):
//   GEN-FLOOR-PROT    $1.65 / sq ft, 0.012 labor h/unit, taxable
//   GEN-SITE-PREP-SM  $295 / job,    3 labor h,          taxable, has an exclusion
//   GEN-SITE-PREP-LG  $1,195 / job,  14 labor h,         taxable

describe("calculateEstimate", () => {
  it("prices a known scope with exact Quebec taxes", () => {
    const result = calculateEstimate([{ itemCode: "GEN-FLOOR-PROT", quantity: 100 }]);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({
      itemCode: "GEN-FLOOR-PROT",
      unitRateCents: 165,
      lineTotalCents: 16_500,
      laborHours: 1.2,
      taxable: true,
    });

    expect(result.subtotalCents).toBe(16_500);
    expect(result.gstCents).toBe(825); // 5%
    expect(result.qstCents).toBe(1646); // 9.975% of 16,500 = 1,645.875 -> 1,646
    expect(result.totalCents).toBe(18_971);
    expect(result.unknownItemCodes).toEqual([]);
  });

  it("computes QST on the subtotal, not on top of GST", () => {
    const { qstCents } = calculateEstimate([{ itemCode: "GEN-FLOOR-PROT", quantity: 100 }]);
    // Compounded (pre-2013 style) would be round(17,325 x 9.975%) = 1,728.
    expect(qstCents).toBe(1646);
  });

  it("shows a -15% / +25% band around the computed subtotal", () => {
    const result = calculateEstimate([{ itemCode: "GEN-FLOOR-PROT", quantity: 100 }]);
    expect(result.lowCents).toBe(14_025); // 16,500 x 0.85
    expect(result.expectedCents).toBe(16_500);
    expect(result.highCents).toBe(20_625); // 16,500 x 1.25
  });

  it("converts labor hours to work days with the +20% buffer, 2-person crew, 8h days", () => {
    // 14h x 1.2 = 16.8h; 16.8 / (2 x 8) = 1.05 -> ceil -> 2 days.
    const large = calculateEstimate([{ itemCode: "GEN-SITE-PREP-LG", quantity: 1 }]);
    expect(large.totalLaborHours).toBe(14);
    expect(large.estimatedWorkDays).toBe(2);

    // 1.2h buffered to 1.44h still books a minimum full day.
    const small = calculateEstimate([{ itemCode: "GEN-FLOOR-PROT", quantity: 100 }]);
    expect(small.estimatedWorkDays).toBe(1);
  });

  it("collects unknown item codes instead of guessing", () => {
    const result = calculateEstimate([
      { itemCode: "NOT-A-REAL-CODE", quantity: 5 },
      { itemCode: "GEN-SITE-PREP-SM", quantity: 1 },
    ]);
    expect(result.unknownItemCodes).toEqual(["NOT-A-REAL-CODE"]);
    expect(result.lines).toHaveLength(1);
    expect(result.subtotalCents).toBe(29_500);
  });

  it("skips zero, negative and non-finite quantities silently", () => {
    const result = calculateEstimate([
      { itemCode: "GEN-SITE-PREP-SM", quantity: 0 },
      { itemCode: "GEN-SITE-PREP-SM", quantity: -3 },
      { itemCode: "GEN-SITE-PREP-SM", quantity: Number.NaN },
    ]);
    expect(result.lines).toEqual([]);
    expect(result.subtotalCents).toBe(0);
    expect(result.totalCents).toBe(0);
    expect(result.estimatedWorkDays).toBe(0);
    expect(result.unknownItemCodes).toEqual([]);
  });

  it("deduplicates identical exclusion notes", () => {
    const result = calculateEstimate([
      { itemCode: "GEN-SITE-PREP-SM", quantity: 1 },
      { itemCode: "GEN-SITE-PREP-SM", quantity: 1 },
    ]);
    expect(result.lines).toHaveLength(2);
    expect(result.exclusions).toEqual(["Does not include specialty negative-air containment"]);
  });

  it("returns an all-zero estimate for an empty scope", () => {
    const result = calculateEstimate([]);
    expect(result.subtotalCents).toBe(0);
    expect(result.totalCents).toBe(0);
    expect(result.lowCents).toBe(0);
    expect(result.highCents).toBe(0);
    expect(result.estimatedWorkDays).toBe(0);
  });
});

describe("calculateHandymanEstimate", () => {
  it("bills the 2-hour minimum call-out at $80/h", () => {
    const result = calculateHandymanEstimate(1);
    expect(result.billedHours).toBe(2);
    expect(result.labourCents).toBe(16_000);
    expect(result.gstCents).toBe(800);
    expect(result.qstCents).toBe(1596);
    expect(result.totalCents).toBe(18_396);
  });

  it("bills fractional hours above the minimum", () => {
    const result = calculateHandymanEstimate(3.5);
    expect(result.billedHours).toBe(3.5);
    expect(result.labourCents).toBe(28_000);
    expect(result.gstCents).toBe(1400);
    expect(result.qstCents).toBe(2793);
    expect(result.totalCents).toBe(32_193);
  });

  it("treats zero, negative and NaN hours as a minimum call-out", () => {
    for (const hours of [0, -4, Number.NaN]) {
      expect(calculateHandymanEstimate(hours).billedHours).toBe(2);
    }
  });
});

describe("calculateTax", () => {
  it("computes GST and QST independently on the same base", () => {
    // $100.00: GST $5.00, QST 997.5 -> 998 (half rounds up). Matches the CRM's
    // integer-rate math in src/lib/crm/money.ts for the same base.
    expect(calculateTax(10_000)).toEqual({ gstCents: 500, qstCents: 998, totalCents: 11_498 });
  });

  it("is zero on zero", () => {
    expect(calculateTax(0)).toEqual({ gstCents: 0, qstCents: 0, totalCents: 0 });
  });
});

describe("formatting", () => {
  it("formats the customer range in whole dollars", () => {
    expect(formatCents(94_720)).toBe("$947");
    expect(formatCents(18_971)).toBe("$190"); // rounds, not truncates
  });

  it("formats internal breakdowns to the cent", () => {
    expect(formatCentsPrecise(123_456)).toBe("$1,234.56");
    expect(formatCentsPrecise(0)).toBe("$0.00");
  });
});
