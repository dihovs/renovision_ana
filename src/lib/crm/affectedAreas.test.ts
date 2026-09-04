import { describe, expect, it } from "vitest";
import {
  areaColor,
  polygonAreaSqm,
  bySurface,
  ceilingAreas,
  planAreas,
  floorAreas,
  wallAreas,
  totalsByDamageType,
  totalsBySurface,
  wallEdgeCorners,
  wallLengthM,
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
    show_dimensions: false,
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
  const wetCeiling = area({ id: "c1", surface: "ceiling", area_sqm: 8 });
  const mixed = [wetFloor, wetWall, mouldyWall, wetCeiling];

  it("keeps wall areas off the floor", () => {
    expect(floorAreas(mixed).map((a) => a.id)).toEqual(["f1"]);
  });

  it("keeps ceiling areas off the floor", () => {
    // The reason floorAreas is written as "is the floor" rather than "is not
    // a wall": a ceiling answers "not a wall" too, and the negative form fed
    // every ceiling to the floor rules — protection, covering removal,
    // covering replacement, baseboard. A wet ceiling billed as a wet floor is
    // the wrong trade at the wrong rate in a document that goes to an insurer.
    expect(floorAreas(mixed).map((a) => a.id)).not.toContain("c1");
    expect(ceilingAreas(mixed).map((a) => a.id)).toEqual(["c1"]);
  });

  it("draws the floor and the ceiling on the plan, and never the walls", () => {
    // planAreas is the renderer's question — whose polygon is in plan
    // metres — and the ceiling is the floor's plane seen from underneath.
    expect(planAreas(mixed).map((a) => a.id)).toEqual(["f1", "c1"]);
  });

  it("keeps floor and ceiling areas off the walls", () => {
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
    expect(ceilingAreas([legacy])).toHaveLength(0);
  });

  it("splits every way at once without losing or duplicating anything", () => {
    const { floor, wall, ceiling } = bySurface(mixed);
    expect(floor.length + wall.length + ceiling.length).toBe(mixed.length);
    expect([...floor, ...wall, ...ceiling].map((a) => a.id).sort()).toEqual([
      "c1",
      "f1",
      "w1",
      "w2",
    ]);
  });

  it("never adds floor and ceiling square footage together", () => {
    // 10 sq m of wet floor and 8 of wet ceiling is not 18 sq m of anything —
    // and these two are the pair that most looks addable, because they cover
    // the same footprint. That is exactly why the sum double-counts.
    expect(totalsByDamageType(floorAreas(mixed))).toEqual([{ type: "water", sqm: 10 }]);
    expect(totalsByDamageType(ceilingAreas(mixed))).toEqual([{ type: "water", sqm: 8 }]);
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

describe("totalsBySurface", () => {
  /**
   * The figures the report prints. The split has to happen here rather than
   * in each consumer, because a consumer that forgets prints one merged
   * number — and a merged number is wrong twice over: the surfaces overlap
   * in plan so it double-counts, and they are different trades so no single
   * rate prices it.
   */
  const mixed = [
    area({ id: "f1", surface: "floor", damage_type: "water", area_sqm: 10 }),
    area({ id: "f2", surface: "floor", damage_type: "water", area_sqm: 2.5 }),
    area({ id: "f3", surface: "floor", damage_type: "fire", area_sqm: 3 }),
    area({ id: "w1", surface: "wall", wall_index: 1, damage_type: "water", area_sqm: 6 }),
    area({ id: "w2", surface: "wall", wall_index: 0, damage_type: "mould", area_sqm: 4 }),
    area({ id: "c1", surface: "ceiling", damage_type: "water", area_sqm: 8 }),
  ];

  it("totals each surface separately, by cause", () => {
    expect(totalsBySurface(mixed)).toEqual({
      floor: [
        { type: "water", sqm: 12.5 },
        { type: "fire", sqm: 3 },
      ],
      wall: [
        { type: "water", sqm: 6 },
        { type: "mould", sqm: 4 },
      ],
      ceiling: [{ type: "water", sqm: 8 }],
    });
  });

  it("agrees with splitting and totalling by hand", () => {
    const split = totalsBySurface(mixed);
    expect(split.floor).toEqual(totalsByDamageType(floorAreas(mixed)));
    expect(split.wall).toEqual(totalsByDamageType(wallAreas(mixed)));
    expect(split.ceiling).toEqual(totalsByDamageType(ceilingAreas(mixed)));
  });

  it("counts every square metre exactly once, on exactly one surface", () => {
    const sum = (totals: { sqm: number }[]) => totals.reduce((t, row) => t + row.sqm, 0);
    const { floor, wall, ceiling } = totalsBySurface(mixed);
    expect(sum(floor) + sum(wall) + sum(ceiling)).toBeCloseTo(33.5, 6);
  });

  it("gives an empty list for a surface with nothing on it", () => {
    // Empty rather than a zero row: "no wall damage recorded" is a table not
    // to print. A zero printed under "affected wall area" reads as a wall
    // that was checked and found dry, which is a different claim.
    const floorOnly = [area({ surface: "floor", area_sqm: 4 })];
    expect(totalsBySurface(floorOnly)).toEqual({
      floor: [{ type: "water", sqm: 4 }],
      wall: [],
      ceiling: [],
    });
    expect(totalsBySurface([])).toEqual({ floor: [], wall: [], ceiling: [] });
  });

  it("counts a legacy row with no surface as floor", () => {
    // Rows written before wall areas existed. Counting them as wall, or
    // dropping them, would move square footage off finished claims.
    const legacy = { ...area({ area_sqm: 7 }), surface: undefined as unknown as "floor" };
    expect(totalsBySurface([legacy])).toEqual({
      floor: [{ type: "water", sqm: 7 }],
      wall: [],
      ceiling: [],
    });
  });
});

describe("the wall face a wall area is measured on", () => {
  /**
   * The convention documented on `AffectedArea`, and the same one
   * `ElevationView.swift` draws in: edge i runs from corner i to corner
   * i + 1, and a wall area's x is measured from that start corner.
   *
   * If these two disagree with the phone, every wall area lands on the wrong
   * wall or at the wrong length — silently, because the shape still draws.
   */
  const room = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ];

  it("runs each edge from its corner to the next, wrapping at the end", () => {
    expect(wallEdgeCorners(4, 0)).toEqual([0, 1]);
    expect(wallEdgeCorners(4, 2)).toEqual([2, 3]);
    expect(wallEdgeCorners(4, 3)).toEqual([3, 0]);
  });

  it("normalises a wall index from outside the room rather than crashing", () => {
    // The phone does the same modulo, for the same reason: the index comes
    // from a record that may name a wall the plan has since lost.
    expect(wallEdgeCorners(4, 4)).toEqual([0, 1]);
    expect(wallEdgeCorners(4, -1)).toEqual([3, 0]);
  });

  it("measures each wall's length in plan metres", () => {
    expect(wallLengthM(room, 0)).toBeCloseTo(4, 6);
    expect(wallLengthM(room, 1)).toBeCloseTo(3, 6);
    expect(wallLengthM(room, 3)).toBeCloseTo(3, 6);
  });

  it("measures a wall that runs at an angle", () => {
    expect(
      wallLengthM(
        [
          { x: 0, y: 0 },
          { x: 3, y: 4 },
          { x: 0, y: 4 },
        ],
        0,
      ),
    ).toBeCloseTo(5, 6);
  });

  it("has no wall to face when the corners enclose nothing", () => {
    expect(wallLengthM([], 0)).toBe(0);
    expect(wallLengthM([{ x: 0, y: 0 }, { x: 4, y: 0 }], 0)).toBe(0);
  });

  it("keeps a wall area's own square metres — the face is not a projection", () => {
    // A 2m x 1.2m patch on the wall measures 2.4 m2 of WALL. It is stored in
    // face metres, so the ordinary shoelace applies unchanged; nothing here
    // divides by a wall length or projects onto the plan.
    const patch = [
      { x: 1, y: 0.4 },
      { x: 3, y: 0.4 },
      { x: 3, y: 1.6 },
      { x: 1, y: 1.6 },
    ];
    expect(polygonAreaSqm(patch)).toBeCloseTo(2.4, 6);
  });
});
