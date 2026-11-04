import { describe, expect, it } from "vitest";
import { savedWallAreaSquareMeters, type SavedScan } from "./roomScan";

/** M6: a shaped ceiling's walls are measured on the phone, wall by wall. */
describe("saved wall area under a shaped ceiling", () => {
  const scan = (extra: Record<string, unknown>) =>
    ({
      floor_area_sqm: 12,
      wall_length_m: 14,
      ceiling_height_m: 2.7,
      geometry: {
        walls: [],
        floors: [],
        doors: [],
        windows: [],
        doorCount: 0,
        windowCount: 0,
        openingCount: 0,
        stairCount: 0,
        ...extra,
      },
    }) as unknown as SavedScan;

  it("is perimeter × height for a flat ceiling", () => {
    expect(savedWallAreaSquareMeters(scan({})).gross).toBeCloseTo(14 * 2.7, 9);
  });

  it("uses the phone's figure when the ceiling is shaped (a gable: 35.4, not 14 × 2.7)", () => {
    const gable = scan({
      ceilingProfile: { kind: "vaulted", eave: 2.4, ridge: 3.0, ridgeEdge: 0 },
      ceilingFigures: {
        volumeCbm: 32.4,
        grossWallSqm: 35.4,
        ceilingSurfaceSqm: 12.92,
        meanHeightM: 2.7,
        minHeightM: 2.4,
        maxHeightM: 3.0,
      },
    });
    expect(savedWallAreaSquareMeters(gable).gross).toBeCloseTo(35.4, 9);
  });
});
