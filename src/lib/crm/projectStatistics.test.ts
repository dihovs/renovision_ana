import { describe, expect, it } from "vitest";
import {
  cubicMetersToCubicFeet,
  projectStatistics,
  type StatisticsRoom,
} from "./projectStatistics";

/**
 * The statistics sheet. Every figure on it goes into an estimate or gets
 * questioned by an adjuster, so the arithmetic is pinned rather than trusted.
 */

function room(over: Partial<StatisticsRoom> = {}): StatisticsRoom {
  return {
    level: "Ground",
    floorAreaSqm: 20,
    perimeterM: 18,
    ceilingHeightM: 2.4,
    wallAreaGrossSqm: 43.2,
    wallAreaNetSqm: 40,
    doorCount: 1,
    windowCount: 1,
    ...over,
  };
}

describe("projectStatistics", () => {
  it("counts distinct floors, not rooms that have a level", () => {
    const stats = projectStatistics([
      room({ level: "Ground" }),
      room({ level: "Ground" }),
      room({ level: "Basement" }),
    ]);
    expect(stats.summary.find((r) => r.id === "floors")?.value).toBe(2);
    expect(stats.summary.find((r) => r.id === "rooms")?.value).toBe(3);
  });

  it("sums doors and windows across the property", () => {
    const stats = projectStatistics([
      room({ doorCount: 2, windowCount: 3 }),
      room({ doorCount: 1, windowCount: 0 }),
    ]);
    expect(stats.summary.find((r) => r.id === "doors")?.value).toBe(3);
    expect(stats.summary.find((r) => r.id === "windows")?.value).toBe(3);
  });

  it("computes volume per room, not from one blended ceiling height", () => {
    // The case that separates the two: a normal room and a tall one. Summing
    // floor area first and multiplying by either height gets this wrong.
    const stats = projectStatistics([
      room({ floorAreaSqm: 20, ceilingHeightM: 2.4 }),
      room({ floorAreaSqm: 10, ceilingHeightM: 4.0 }),
    ]);
    // 20×2.4 + 10×4.0 = 48 + 40 = 88, not 30 × anything.
    expect(stats.measurements.find((r) => r.id === "volume")?.value).toBeCloseTo(88, 6);
  });

  it("carries a definition on every measurement, and none on the counts", () => {
    // A figure without its definition is a figure an adjuster can discount.
    const stats = projectStatistics([room()]);
    for (const row of stats.measurements) {
      expect(row.meaning, row.id).toBeTruthy();
    }
    for (const row of stats.summary) {
      expect(row.meaning, row.id).toBeUndefined();
    }
  });

  it("reports zeroes rather than NaN for a project with no rooms", () => {
    const stats = projectStatistics([]);
    for (const row of [...stats.summary, ...stats.measurements]) {
      expect(Number.isFinite(row.value), row.id).toBe(true);
      expect(row.value, row.id).toBe(0);
    }
  });

  it("survives a room whose figures are missing", () => {
    // A scan held offline, or a hand-typed room mid-edit, can arrive with a
    // hole in it. One bad room must not turn the whole sheet into NaN.
    const stats = projectStatistics([
      room(),
      room({ floorAreaSqm: NaN, wallAreaNetSqm: NaN, ceilingHeightM: NaN }),
    ]);
    expect(stats.measurements.find((r) => r.id === "floorArea")?.value).toBe(20);
    expect(Number.isFinite(stats.measurements.find((r) => r.id === "volume")!.value)).toBe(true);
  });

  it("does not invent the reference's three ground-surface variants", () => {
    // They need wall thickness, which a scan of wall faces does not have.
    // Shipping them would mean reporting a guess as a measurement.
    const ids = projectStatistics([room()]).measurements.map((r) => r.id);
    expect(ids).not.toContain("groundSurfaceWithAllWalls");
    expect(ids).not.toContain("groundSurfaceWithInteriorWalls");
  });
});

describe("cubicMetersToCubicFeet", () => {
  it("converts to the unit dehumidifiers are rated in", () => {
    // A 20 m² room at 2.4 m is 48 m³ — about 1,695 cu ft, which is the number
    // an LGR's coverage is quoted against.
    expect(cubicMetersToCubicFeet(48)).toBeCloseTo(1695.1, 1);
  });
});
