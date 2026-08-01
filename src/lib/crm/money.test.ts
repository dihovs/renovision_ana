import { describe, expect, it } from "vitest";
import {
  calculateQuoteTotals,
  formatMoney,
  formatPercent,
  formatQuantity,
  isIncluded,
  lineTotalCents,
  parseMoneyToCents,
  parseQuantityToMilli,
  PERCENT_SCALE,
  type LineForTotals,
} from "./money";
import { DEFAULT_TAX_RATES, type TaxRate } from "./settings";

/** The real Quebec rate the app ships with: GST 5% + QST 9.975%. */
const QC: TaxRate = DEFAULT_TAX_RATES.rates[0];
/** The registration gate resolves to a component-less rate — tax must be zero. */
const NO_TAX: TaxRate = { id: "unregistered", label: "No tax", components: [] };

function line(over: Partial<LineForTotals> = {}): LineForTotals {
  return {
    quantityMilli: 1000,
    unitPriceCents: 10_000,
    taxable: true,
    optional: false,
    selected: false,
    ...over,
  };
}

describe("lineTotalCents", () => {
  it("multiplies quantity (thousandths) by unit price (cents)", () => {
    expect(lineTotalCents({ quantityMilli: 2000, unitPriceCents: 1050 })).toBe(2100);
  });

  it("is exact for realistic fractional quantities", () => {
    // 320.5 sq ft at $8.60/sq ft = $2,756.30 with no drift.
    expect(lineTotalCents({ quantityMilli: 320_500, unitPriceCents: 860 })).toBe(275_630);
  });

  it("rounds the half-cent up on positive lines", () => {
    // 1.5 x $10.05 = $15.075 -> $15.08.
    expect(lineTotalCents({ quantityMilli: 1500, unitPriceCents: 1005 })).toBe(1508);
  });

  it("rounds the half-cent toward zero on negative lines (Math.round half-up asymmetry)", () => {
    // DOCUMENTS CURRENT BEHAVIOR: -$15.075 -> -$15.07, not -$15.08. Math.round
    // rounds exact halves toward +Infinity, so a credit line mirroring a charge
    // line can differ from it by one cent on exact half-cents. The error is in
    // the customer's favour.
    expect(lineTotalCents({ quantityMilli: 1500, unitPriceCents: -1005 })).toBe(-1507);
  });

  it("handles negative-price discount lines", () => {
    expect(lineTotalCents({ quantityMilli: 1000, unitPriceCents: -5000 })).toBe(-5000);
  });
});

describe("isIncluded", () => {
  it("always includes non-optional lines, whatever `selected` says", () => {
    expect(isIncluded(line({ optional: false, selected: false }))).toBe(true);
    expect(isIncluded(line({ optional: false, selected: true }))).toBe(true);
  });

  it("includes optional lines only once ticked", () => {
    expect(isIncluded(line({ optional: true, selected: false }))).toBe(false);
    expect(isIncluded(line({ optional: true, selected: true }))).toBe(true);
  });
});

describe("calculateQuoteTotals", () => {
  it("computes a known Quebec invoice: $100 -> GST $5.00, QST $9.98, total $114.98", () => {
    const totals = calculateQuoteTotals([line()], QC);
    expect(totals.subtotalCents).toBe(10_000);
    expect(totals.taxes).toEqual([
      { name: "GST", cents: 500 },
      // 10000 x 9.975% = 997.5 -> 998 (half rounds up).
      { name: "QST", cents: 998 },
    ]);
    expect(totals.totalTaxCents).toBe(1498);
    expect(totals.totalCents).toBe(11_498);
    expect(totals.depositCents).toBeNull();
    expect(totals.balanceCents).toBeNull();
  });

  it("does NOT compound QST on top of GST (Quebec de-harmonised in 2013)", () => {
    const totals = calculateQuoteTotals([line()], QC);
    // Compounded would be round(10500 x 9.975%) = 1047; correct is 998.
    expect(totals.taxes[1].cents).toBe(998);
  });

  it("rounds each line to the cent BEFORE aggregating", () => {
    // Two lines of 0.5 x $1.01 = $0.505 each. Rounded per line: 51 + 51 = 102.
    // Aggregated raw then rounded once: round(50.5 + 50.5) = 101. The printed
    // column must sum to the subtotal, so 102 is the documented answer.
    const half = line({ quantityMilli: 500, unitPriceCents: 101, taxable: false });
    const totals = calculateQuoteTotals([half, half], NO_TAX);
    expect(totals.subtotalCents).toBe(102);
  });

  it("produces zero tax when the rate has no components (registration gate off)", () => {
    const totals = calculateQuoteTotals([line()], NO_TAX);
    expect(totals.taxes).toEqual([]);
    expect(totals.totalTaxCents).toBe(0);
    expect(totals.totalCents).toBe(totals.subtotalCents);
  });

  it("excludes unticked optional lines and includes ticked ones", () => {
    const base = line();
    const unticked = line({ optional: true, selected: false, unitPriceCents: 99_999 });
    const ticked = line({ optional: true, selected: true, unitPriceCents: 5000 });
    const totals = calculateQuoteTotals([base, unticked, ticked], NO_TAX);
    expect(totals.subtotalCents).toBe(15_000);
  });

  it("splits subtotals by taxability and taxes only the taxable base", () => {
    const totals = calculateQuoteTotals(
      [line({ taxable: true }), line({ taxable: false, unitPriceCents: 5000 })],
      QC,
    );
    expect(totals.taxableSubtotalCents).toBe(10_000);
    expect(totals.nonTaxableSubtotalCents).toBe(5000);
    expect(totals.subtotalCents).toBe(15_000);
    expect(totals.totalTaxCents).toBe(1498); // tax on 10,000 only
    expect(totals.totalCents).toBe(16_498);
  });

  it("lets a negative-price line reduce its own taxability bucket", () => {
    // Jobber's discount-line idiom: the discount line carries the same taxable
    // flag as the work it discounts.
    const totals = calculateQuoteTotals(
      [line(), line({ unitPriceCents: -2000 })],
      QC,
    );
    expect(totals.taxableSubtotalCents).toBe(8000);
    expect(totals.taxes).toEqual([
      { name: "GST", cents: 400 },
      { name: "QST", cents: 798 },
    ]);
  });

  it("takes a global discount from the non-taxable base first", () => {
    // Taking it from the taxable base first would understate the tax owed.
    const totals = calculateQuoteTotals(
      [line({ taxable: true }), line({ taxable: false, unitPriceCents: 5000 })],
      QC,
      { kind: "amount", value: 6000 },
    );
    expect(totals.discountCents).toBe(6000);
    expect(totals.adjustedNonTaxableCents).toBe(0); // 5000 fully consumed
    expect(totals.adjustedTaxableCents).toBe(9000); // remaining 1000 from taxable
    expect(totals.taxes).toEqual([
      { name: "GST", cents: 450 },
      { name: "QST", cents: 898 }, // 897.75 -> 898
    ]);
    expect(totals.totalCents).toBe(10_348);
  });

  it("gives a negative non-taxable bucket none of the discount", () => {
    const totals = calculateQuoteTotals(
      [line(), line({ taxable: false, unitPriceCents: -1000 })],
      QC,
      { kind: "amount", value: 2000 },
    );
    expect(totals.adjustedNonTaxableCents).toBe(-1000);
    expect(totals.adjustedTaxableCents).toBe(8000);
    expect(totals.totalCents).toBe(8000 - 1000 + 400 + 798);
  });

  it("clamps a discount to the subtotal — the total never goes negative from a typo", () => {
    const totals = calculateQuoteTotals([line()], NO_TAX, { kind: "amount", value: 999_999 });
    expect(totals.discountCents).toBe(10_000);
    expect(totals.totalCents).toBe(0);
  });

  it("ignores zero, negative and 'none' discounts", () => {
    expect(calculateQuoteTotals([line()], NO_TAX, { kind: "amount", value: -50 }).discountCents).toBe(0);
    expect(calculateQuoteTotals([line()], NO_TAX, { kind: "percent", value: 0 }).discountCents).toBe(0);
    expect(calculateQuoteTotals([line()], NO_TAX, { kind: "none", value: 5000 }).discountCents).toBe(0);
  });

  it("stores percent values as percent x 10,000 (matches the UI, not the stale comment)", () => {
    // QuoteBuilder.tsx writes Math.round(userPercent * PERCENT_SCALE), so 12.5%
    // is stored as 125,000 — NOT 1,250 as the "hundredths of a percent" comment
    // above PERCENT_SCALE in money.ts claims. resolveDiscountCents and
    // formatPercent both agree with the x10,000 convention; only the comment is
    // out of date.
    expect(Math.round(12.5 * PERCENT_SCALE)).toBe(125_000);
    const totals = calculateQuoteTotals([line({ unitPriceCents: 20_000 })], NO_TAX, {
      kind: "percent",
      value: 125_000,
    });
    expect(totals.discountCents).toBe(2500); // 12.5% of $200.00
    expect(formatPercent(125_000)).toBe("12.5%");
  });

  it("does not clamp a negative taxable base: a credit note carries negative tax", () => {
    const totals = calculateQuoteTotals([line({ unitPriceCents: -10_000 })], QC);
    expect(totals.taxes[0].cents).toBe(-500);
    // DOCUMENTS CURRENT BEHAVIOR: round(-997.5) is -997, while the original
    // charge rounded +997.5 to +998. A full credit note for an invoice whose
    // QST landed on an exact half therefore refunds one cent less QST than was
    // charged.
    expect(totals.taxes[1].cents).toBe(-997);
    expect(totals.totalCents).toBe(-11_497);
  });

  it("computes percent deposits against the grand total", () => {
    const totals = calculateQuoteTotals([line()], QC, undefined, {
      kind: "percent",
      value: 500_000, // 50%
    });
    expect(totals.totalCents).toBe(11_498);
    expect(totals.depositCents).toBe(5749);
    expect(totals.balanceCents).toBe(5749);
  });

  it("clamps an amount deposit to the total", () => {
    const totals = calculateQuoteTotals([line()], QC, undefined, {
      kind: "amount",
      value: 999_999,
    });
    expect(totals.depositCents).toBe(11_498);
    expect(totals.balanceCents).toBe(0);
  });

  it("returns all-zero totals (with zero-cent tax lines) for an empty quote", () => {
    const totals = calculateQuoteTotals([], QC);
    expect(totals.subtotalCents).toBe(0);
    expect(totals.taxes).toEqual([
      { name: "GST", cents: 0 },
      { name: "QST", cents: 0 },
    ]);
    expect(totals.totalCents).toBe(0);
  });
});

describe("parseMoneyToCents", () => {
  it("parses plain and English-formatted amounts", () => {
    expect(parseMoneyToCents("1234")).toBe(123_400);
    expect(parseMoneyToCents("1,234.56")).toBe(123_456);
    expect(parseMoneyToCents("$1234.56")).toBe(123_456);
    expect(parseMoneyToCents("$ 12.34")).toBe(1234);
    expect(parseMoneyToCents("0")).toBe(0);
  });

  it("parses French-formatted amounts (comma decimal, space groups)", () => {
    expect(parseMoneyToCents("1 234,56 $")).toBe(123_456);
    // Narrow no-break space, which fr-CA formatting actually produces.
    expect(parseMoneyToCents("1\u202F234,56\u00A0$")).toBe(123_456);
    expect(parseMoneyToCents("1.234,56")).toBe(123_456);
  });

  it("reads a lone comma as decimal only with 1-2 digits after it", () => {
    expect(parseMoneyToCents("1,5")).toBe(150);
    expect(parseMoneyToCents("1,500")).toBe(150_000); // thousands separator
  });

  it("reads a lone dot with 3+ digits after it as a grouping separator", () => {
    expect(parseMoneyToCents("12.345")).toBe(1_234_500);
    expect(parseMoneyToCents("12.34")).toBe(1234);
  });

  it("handles negatives, both minus and accounting parentheses", () => {
    expect(parseMoneyToCents("-50")).toBe(-5000);
    expect(parseMoneyToCents("(50)")).toBe(-5000);
    expect(parseMoneyToCents("-1 234,56 $")).toBe(-123_456);
  });

  it("returns null for blank or unparseable input", () => {
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("   ")).toBeNull();
    expect(parseMoneyToCents(".")).toBeNull();
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(parseMoneyToCents("1.2.3")).toBeNull();
  });
});

describe("parseQuantityToMilli", () => {
  it("keeps three decimal places", () => {
    expect(parseQuantityToMilli("12.375")).toBe(12_375);
    expect(parseQuantityToMilli("320.5")).toBe(320_500);
    expect(parseQuantityToMilli("1,5")).toBe(1500);
    expect(parseQuantityToMilli("1 234,56")).toBe(1_234_560);
  });

  it("returns null for blank or unparseable input", () => {
    expect(parseQuantityToMilli("")).toBeNull();
    expect(parseQuantityToMilli("abc")).toBeNull();
  });

  it("treats a lone comma as a decimal even with 3 digits after it (diverges from the money parser)", () => {
    // DOCUMENTS CURRENT BEHAVIOR: the quantity re-read replaces the first comma
    // with a dot unconditionally, so "1,500" is 1.5 units here while
    // parseMoneyToCents("1,500") reads $1,500.00. Defensible for a field that
    // allows 3 decimals ("1,500" as French for 1.500), but the two parsers
    // disagree about the same string.
    expect(parseQuantityToMilli("1,500")).toBe(1500); // 1.5 units, not 1500
    expect(parseMoneyToCents("1,500")).toBe(150_000); // $1,500.00
  });
});

describe("formatMoney", () => {
  // Intl uses U+00A0/U+202F in fr-CA output; normalise so the assertions are
  // stable across ICU versions.
  const plain = (s: string) => s.replace(/[\u00A0\u202F]/g, " ");

  it("formats English CAD", () => {
    expect(plain(formatMoney(123_456))).toBe("$1,234.56");
    expect(plain(formatMoney(0))).toBe("$0.00");
    expect(plain(formatMoney(-123_456))).toBe("-$1,234.56");
    expect(plain(formatMoney(12_345_678_912))).toBe("$123,456,789.12");
  });

  it("formats French CAD with comma decimal and trailing symbol", () => {
    expect(plain(formatMoney(123_456, "fr"))).toBe("1 234,56 $");
    expect(plain(formatMoney(-123_456, "fr"))).toBe("-1 234,56 $");
  });
});

describe("formatQuantity", () => {
  it("drops trailing zeros but keeps real decimals", () => {
    expect(formatQuantity(12_000)).toBe("12");
    expect(formatQuantity(12_500)).toBe("12.5");
    expect(formatQuantity(12_375)).toBe("12.375");
    expect(formatQuantity(100)).toBe("0.1");
    expect(formatQuantity(10)).toBe("0.01");
    expect(formatQuantity(0)).toBe("0");
  });
});

describe("formatPercent", () => {
  it("renders percent x 10,000 storage back to a percentage", () => {
    expect(formatPercent(125_000)).toBe("12.5%");
    expect(formatPercent(1_000_000)).toBe("100%");
    expect(formatPercent(50_000)).toBe("5%");
    expect(formatPercent(0)).toBe("0%");
  });
});
