import { describe, expect, it } from "vitest";
import { getLineItem } from "../catalog";
import { allocateLine, allocateLines, estimateTotals, lineBaseCents } from "./trailer";
import { POLYGON_TRAILER } from "./types";
import type { EstimateLine, TrailerSettings } from "./types";

// The fixtures below are REAL printed figures from the reference estimates —
// Polygon's Jean-Picard devis (claim 1515767) and Restauration CT's TRAS
// urgence (201-0001). See Docs/Estimator-Xactimate-Conventions.md §1. If a
// change makes one of these fail, the change disagrees with what insurers in
// this market actually receive; the model is not ours to improve.

const CT_TRAILER: TrailerSettings = {
  generalsPct: 0.1,
  profitPct: 0.05,
  profitBasis: "items",
  gstPct: 0.05,
  qstPct: 0.09975,
};

function line(partial: Partial<EstimateLine>): EstimateLine {
  return {
    key: "test",
    origin: "derived",
    provenance: "rule",
    roomScanId: null,
    roomName: "Test",
    tradeSection: "misc",
    activity: "install",
    itemCode: null,
    removalItemCode: null,
    name: "Test line",
    unit: "sq ft",
    quantity: 1,
    removeRateCents: null,
    replaceRateCents: null,
    calc: "test",
    note: null,
    issues: [],
    taxable: true,
    removed: false,
    ...partial,
  };
}

describe("per-line allocation — Polygon convention (profit on items + generals)", () => {
  it("reproduces Jean-Picard item 2: paint the open-area ceiling", () => {
    // 2. PNT P2 — 423,55 P2 × 1,39 — TAXE 101,83 | FG&P 91,25 | TOTAL 781,81
    const allocated = allocateLine(
      line({ quantity: 423.55, replaceRateCents: 139 }),
      POLYGON_TRAILER,
    );
    expect(allocated.baseCents).toBe(58873);
    expect(allocated.opCents).toBe(9125);
    expect(allocated.taxCents).toBe(10183);
    expect(allocated.totalCents).toBe(78181);
  });

  it("reproduces Jean-Picard item 4: the tub surround, an E&R line", () => {
    // 4. TLE BAIN> — 1,00 CH × (219,17 + 2 224,97) — 422,74 | 378,84 | 3 245,72
    const allocated = allocateLine(
      line({ quantity: 1, removeRateCents: 21917, replaceRateCents: 222497 }),
      POLYGON_TRAILER,
    );
    expect(allocated.baseCents).toBe(244414);
    expect(allocated.opCents).toBe(37884);
    expect(allocated.taxCents).toBe(42274);
    expect(allocated.totalCents).toBe(324572);
  });

  it("reproduces Jean-Picard item 47: dump truck, a removal-only line", () => {
    // 47. DMO CAMION — 1,00 CH × 442,23 in ENLEV — 76,49 | 68,54 | 587,26
    const allocated = allocateLine(
      line({ quantity: 1, removeRateCents: 44223 }),
      POLYGON_TRAILER,
    );
    expect(allocated.opCents).toBe(6854);
    expect(allocated.taxCents).toBe(7649);
    expect(allocated.totalCents).toBe(58726);
  });

  it("reproduces Jean-Picard item 52: cleaning technician hours", () => {
    // 52. NET M-O — 10,00 HR × 53,30 — 92,19 | 82,62 | 707,81
    const allocated = allocateLine(
      line({ quantity: 10, replaceRateCents: 5330, unit: "hour" }),
      POLYGON_TRAILER,
    );
    expect(allocated.opCents).toBe(8262);
    expect(allocated.taxCents).toBe(9219);
    expect(allocated.totalCents).toBe(70781);
  });

  it("lands within a cent of Jean-Picard item 6, Xactimate's own rounding wobble", () => {
    // 6. TLE MOY+ — 88,20 P2 × (2,92 + 21,06) — printed FG&P 327,82.
    // Half-up rounding gives 327,83; the reference's internal rounding
    // differs by one cent on this line and this line only of the five
    // sampled. A one-cent tolerance here is honest; forcing equality would
    // mean guessing at an undocumented rounding mode from one sample.
    const allocated = allocateLine(
      line({ quantity: 88.2, removeRateCents: 292, replaceRateCents: 2106 }),
      POLYGON_TRAILER,
    );
    expect(Math.abs(allocated.opCents - 32782)).toBeLessThanOrEqual(1);
    expect(Math.abs(allocated.totalCents - 280866)).toBeLessThanOrEqual(3);
  });
});

describe("per-line allocation — Restauration CT convention (profit on items)", () => {
  it("reproduces the TRAS dehumidifier day line", () => {
    // 5. Déshumidificateur (par période de 24 heures) — 1,00 CH × 123,73 —
    // TAXE 21,31 | FG&P 18,56 | TOTAL 163,60. FG&P is 15,0% here, not
    // 15,5%: CT computes profit on items alone. The printed TAXE is one
    // cent above split GST/QST rounding (the reference rounds the combined
    // 14,975% once); the split is what remittance needs, so the cent goes
    // to tolerance, not to the model.
    const allocated = allocateLine(
      line({ quantity: 1, replaceRateCents: 12373, unit: "day" }),
      CT_TRAILER,
    );
    expect(allocated.opCents).toBe(1856);
    expect(Math.abs(allocated.taxCents - 2131)).toBeLessThanOrEqual(1);
    expect(Math.abs(allocated.totalCents - 16360)).toBeLessThanOrEqual(1);
  });
});

describe("document totals", () => {
  it("sums the per-line allocations and recomputes nothing", () => {
    const lines = allocateLines(
      [
        line({ quantity: 423.55, replaceRateCents: 139 }),
        line({ quantity: 1, removeRateCents: 21917, replaceRateCents: 222497 }),
        line({ quantity: 10, replaceRateCents: 5330 }),
      ],
      POLYGON_TRAILER,
    );
    const totals = estimateTotals(lines);
    expect(totals.itemsCents).toBe(lines.reduce((s, l) => s + l.baseCents, 0));
    expect(totals.generalsCents).toBe(lines.reduce((s, l) => s + l.generalsCents, 0));
    expect(totals.profitCents).toBe(lines.reduce((s, l) => s + l.profitCents, 0));
    expect(totals.totalCents).toBe(lines.reduce((s, l) => s + l.totalCents, 0));
    expect(totals.totalCents).toBe(
      totals.itemsCents +
        totals.generalsCents +
        totals.profitCents +
        totals.gstCents +
        totals.qstCents,
    );
  });

  it("keeps O&P on a non-taxable line but drops its taxes", () => {
    const allocated = allocateLine(
      line({ quantity: 1, replaceRateCents: 10000, taxable: false }),
      POLYGON_TRAILER,
    );
    expect(allocated.opCents).toBe(1550);
    expect(allocated.taxCents).toBe(0);
    expect(allocated.totalCents).toBe(11550);
  });

  it("rounds an exact half-cent base half-up, not down through float drift", () => {
    // 4,14 sq ft × 2,25 $ = exactly 931,5¢. Doubles compute 931,4999…, and
    // the naive Math.round loses the cent; integer math keeps it.
    const allocated = allocateLine(
      line({ quantity: 4.14, removeRateCents: 225 }),
      POLYGON_TRAILER,
    );
    expect(allocated.baseCents).toBe(932);
  });

  it("counts embedded labour from BOTH sides of an E&R line", () => {
    const allocated = allocateLine(
      line({ quantity: 1, itemCode: "BATH-TUB-INST", removalItemCode: "DEM-TUB",
             replaceRateCents: 89500, removeRateCents: 49500 }),
      POLYGON_TRAILER,
    );
    const install = getLineItem("BATH-TUB-INST");
    const removal = getLineItem("DEM-TUB");
    expect(allocated.laborHours).toBeCloseTo(
      (install?.laborHoursPerUnit ?? 0) + (removal?.laborHoursPerUnit ?? 0),
      2,
    );
    expect(allocated.laborHours).toBeGreaterThan(0);
  });

  it("a removal-only line still carries its embedded labour", () => {
    const allocated = allocateLine(
      line({ quantity: 1, itemCode: null, removalItemCode: "DEM-TUB", removeRateCents: 49500 }),
      POLYGON_TRAILER,
    );
    expect(allocated.laborHours).toBeGreaterThan(0);
  });

  it("a removed tombstone is excluded from every total", () => {
    const lines = allocateLines(
      [
        line({ quantity: 1, replaceRateCents: 10000 }),
        line({ quantity: 1, replaceRateCents: 99900, removed: true }),
      ],
      POLYGON_TRAILER,
    );
    const totals = estimateTotals(lines);
    expect(totals.itemsCents).toBe(10000);
  });

  it("a no-rate line prints its quantity and carries no money", () => {
    const allocated = allocateLine(
      line({ quantity: 12, itemCode: null, replaceRateCents: null }),
      POLYGON_TRAILER,
    );
    expect(lineBaseCents(allocated)).toBe(0);
    expect(allocated.totalCents).toBe(0);
    expect(allocated.quantity).toBe(12);
  });
});
