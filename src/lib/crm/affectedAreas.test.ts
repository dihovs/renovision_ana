import { describe, expect, it } from "vitest";
import {
  areaColor,
  polygonAreaSqm,
  totalsByDamageType,
  DAMAGE_COLOR,
  type AffectedArea,
} from "./affectedAreas";

/**
 * The area maths, which is the part that turns into money.
 *
 * A wrong figure here does not throw — it prices a floor at the wrong size
 * and the error reaches a customer as a number on an invoice.
 */

function area(over: Partial<AffectedArea> = {}): AffectedArea {
  return {
    id: "a1",
    created_at: "2026-08-13T00:00:00Z",
    room_scan_id: "r1",
    surface: "floor",
    wall_index: null,
    name: "Affected area",
    damage_type: "water",
    color: null,
    area_sqm: 0,
    polygon: [],
    notes: null,
    ...over,
  };
}

describe("polygonAreaSqm", () => {
  it("measures a rectangle", () => {
    // 4m x 3m
    expect(
      polygonAreaSqm([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ]),
    ).toBeCloseTo(12, 6);
  });

  it("measures the same whichever way round the corners were dragged", () => {
    const clockwise = [
      { x: 0, y: 0 },
      { x: 0, y: 3 },
      { x: 4, y: 3 },
      { x: 4, y: 0 },
    ];
    const anticlockwise = [...clockwise].reverse();
    expect(polygonAreaSqm(clockwise)).toBeCloseTo(polygonAreaSqm(anticlockwise), 6);
  });

  it("measures an L-shape, which is what a real wet patch looks like", () => {
    // A 4x4 square with a 2x2 bite out of one corner = 12 m2.
    expect(
      polygonAreaSqm([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 4 },
        { x: 0, y: 4 },
      ]),
    ).toBeCloseTo(12, 6);
  });

  it("returns nothing for a shape that encloses nothing", () => {
    expect(polygonAreaSqm([])).toBe(0);
    expect(polygonAreaSqm([{ x: 0, y: 0 }])).toBe(0);
    expect(polygonAreaSqm([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
  });

  it("returns nothing for three collinear points", () => {
    expect(
      polygonAreaSqm([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ]),
    ).toBeCloseTo(0, 9);
  });
});

describe("areaColor", () => {
  it("uses the cause's colour by default", () => {
    expect(areaColor(area({ damage_type: "fire" }))).toBe(DAMAGE_COLOR.fire);
  });

  it("lets an area override it", () => {
    expect(areaColor(area({ damage_type: "fire", color: "#123456" }))).toBe("#123456");
  });
});

describe("totalsByDamageType", () => {
  it("totals each cause separately, because they are different trades", () => {
    const totals = totalsByDamageType([
      area({ damage_type: "water", area_sqm: 10 }),
      area({ damage_type: "water", area_sqm: 5 }),
      area({ damage_type: "mould", area_sqm: 2 }),
    ]);
    expect(totals).toEqual([
      { type: "water", sqm: 15 },
      { type: "mould", sqm: 2 },
    ]);
  });

  it("does not invent a grand total across causes", () => {
    // Areas may overlap by design — a wall both wet and smoke-stained — so
    // one sum across every cause would double-count that square footage.
    const totals = totalsByDamageType([
      area({ damage_type: "water", area_sqm: 8 }),
      area({ damage_type: "fire", area_sqm: 8 }),
    ]);
    expect(totals).toHaveLength(2);
    expect(totals.every((t) => t.sqm === 8)).toBe(true);
  });

  it("omits causes with nothing recorded rather than showing zeroes", () => {
    expect(totalsByDamageType([area({ damage_type: "impact", area_sqm: 3 })])).toEqual([
      { type: "impact", sqm: 3 },
    ]);
  });
});
