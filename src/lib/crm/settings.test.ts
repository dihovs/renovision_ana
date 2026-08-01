import { describe, expect, it } from "vitest";
import {
  canChargeTax,
  DEFAULT_COMPANY,
  DEFAULT_TAX_RATES,
  formatRate,
  RATE_SCALE,
  resolveTaxRate,
  type CompanySetting,
  type TaxRate,
  type TaxRatesSetting,
} from "./settings";

const QC = DEFAULT_TAX_RATES.rates[0];
const EXEMPT = DEFAULT_TAX_RATES.rates[1];

describe("DEFAULT_TAX_RATES", () => {
  it("ships the legally correct Quebec components: GST 5%, QST 9.975%", () => {
    // These integers are load-bearing: 50,000 / 1,000,000 = 5% and
    // 99,750 / 1,000,000 = 9.975%. A typo here misprices every quote.
    expect(RATE_SCALE).toBe(1_000_000);
    expect(QC.components).toEqual([
      { name: "GST", rate: 50_000, registration: "" },
      { name: "QST", rate: 99_750, registration: "" },
    ]);
    expect(EXEMPT.components).toEqual([]);
    expect(DEFAULT_TAX_RATES.default).toBe("qc");
  });
});

describe("canChargeTax", () => {
  const registered: CompanySetting = {
    ...DEFAULT_COMPANY,
    taxRegistered: true,
    gstNumber: "123456789 RT0001",
    qstNumber: "1234567890 TQ0001",
  };

  it("defaults to NOT charging tax (small supplier until proven otherwise)", () => {
    expect(canChargeTax(DEFAULT_COMPANY)).toBe(false);
  });

  it("requires the registration flag AND both numbers", () => {
    expect(canChargeTax(registered)).toBe(true);
    expect(canChargeTax({ ...registered, taxRegistered: false })).toBe(false);
    expect(canChargeTax({ ...registered, gstNumber: "" })).toBe(false);
    expect(canChargeTax({ ...registered, qstNumber: "" })).toBe(false);
    // Whitespace-only numbers do not count as present.
    expect(canChargeTax({ ...registered, gstNumber: "   " })).toBe(false);
    expect(canChargeTax({ ...registered, qstNumber: "   " })).toBe(false);
  });
});

describe("resolveTaxRate", () => {
  const other: TaxRate = { id: "on", label: "HST (Ontario)", components: [{ name: "HST", rate: 130_000 }] };
  const setting: TaxRatesSetting = { default: "qc", rates: [QC, EXEMPT, other] };

  it("returns the first preference that matches an existing rate", () => {
    expect(resolveTaxRate(setting, "exempt", "qc")).toBe(EXEMPT);
    expect(resolveTaxRate(setting, "on")).toBe(other);
  });

  it("skips null, undefined, empty and deleted rate ids", () => {
    expect(resolveTaxRate(setting, null, undefined, "", "deleted-id", "exempt")).toBe(EXEMPT);
  });

  it("falls back to the account default when no preference matches", () => {
    expect(resolveTaxRate(setting)).toBe(QC);
    expect(resolveTaxRate(setting, "deleted-id")).toBe(QC);
  });

  it("falls back to the first rate when the default id itself was deleted", () => {
    const broken: TaxRatesSetting = { default: "gone", rates: [other, QC] };
    expect(resolveTaxRate(broken)).toBe(other);
  });

  it("returns a no-tax stub when there are no rates at all", () => {
    const empty: TaxRatesSetting = { default: "qc", rates: [] };
    expect(resolveTaxRate(empty)).toEqual({ id: "exempt", label: "No tax", components: [] });
  });
});

describe("formatRate", () => {
  it("sums components and prints without trailing zeros", () => {
    expect(formatRate(QC)).toBe("14.975%");
    expect(formatRate(EXEMPT)).toBe("0%");
    expect(formatRate({ id: "g", label: "GST only", components: [{ name: "GST", rate: 50_000 }] })).toBe("5%");
  });
});
