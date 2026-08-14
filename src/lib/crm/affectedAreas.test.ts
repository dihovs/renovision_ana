import { describe, expect, it } from "vitest";
import {
  areaColor,
  polygonAreaSqm,
  bySurface,
  floorAreas,
  wallAreas,
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

describe("splitting by surface", () => {
  /**
   * The rule that keeps a wall area off the floor plan and out of the floor
   * total. Two independent reasons, and either one alone would be enough:
   * the polygons are in different coordinate spaces, and the two surfaces
   * are different trades at different rates.
   */
  const wetFloor = area({ id: "f1", surface: "floor", area_sqm: 10 });
  const wetWall = area({ id: "w1", surface: "wall", wall_index: 2, area_sqm: 6 });
  const mouldyWall = area({ id: "w2", surface: "wall", wall_index: 0, damage_type: "mould", area_sqm: 4 });
  const mixed = [wetFloor, wetWall, mouldyWall];

  it("keeps wall areas off the floor", () => {
    expect(floorAreas(mixed).map((a) => a.id)).toEqual(["f1"]);
  });

  it("keeps floor areas off the walls", () => {
    expect(wallAreas(mixed).map((a) => a.id)).toEqual(["w2", "w1"]);
  });

  it("orders wall areas by the wall they sit on", () => {
    // So a room's wall damage reads in the same order the walls are indexed
    // rather than in whatever order they happened to be drawn.
    expect(wallAreas(mixed).map((a) => a.wall_index)).toEqual([0, 2]);
  });

  it("treats an area with no surface as floor", () => {
    // Every row written before wall areas existed carries no surface, and
    // every one of them is a floor area. Dropping them would quietly delete
    // damage from finished claims.
    const legacy = { ...area({ id: "old" }), surface: undefined as unknown as "floor" };
    expect(floorAreas([legacy]).map((a) => a.id)).toEqual(["old"]);
    expect(wallAreas([legacy])).toHaveLength(0);
  });

  it("splits both ways at once without losing or duplicating anything", () => {
    const { floor, wall } = bySurface(mixed);
    expect(floor.length + wall.length).toBe(mixed.length);
    expect([...floor, ...wall].map((a) => a.id).sort()).toEqual(["f1", "w1", "w2"]);
  });

  it("never adds floor and wall square footage together", () => {
    // 10 sq m of wet floor and 6 of wet wall is not 16 sq m of anything.
    const floorWater = totalsByDamageType(floorAreas(mixed));
    const wallWater = totalsByDamageType(wallAreas(mixed));
    expect(floorWater).toEqual([{ type: "water", sqm: 10 }]);
    expect(wallWater).toEqual([
      { type: "water", sqm: 6 },
      { type: "mould", sqm: 4 },
    ]);
  });
});
