import { describe, expect, it } from "vitest";
import {
  ceilingHeightMeters,
  metersToFeet,
  openingAreaSquareMeters,
  planCorners,
  savedFloorAreaSquareMeters,
  savedPerimeterMeters,
  squareMetersToSquareFeet,
  toFloorPlan,
  polygonAreaSquareMeters,
  totalFloorAreaSquareMeters,
  totalWallLengthMeters,
  wallAreaSquareMeters,
  type RoomScanResult,
  type SavedScan,
  type ScanGeometry,
} from "./roomScan";
import { polygonMetrics } from "./crm/roomScans";

/**
 * The scan's geometry, which is the part that can be wrong quietly.
 *
 * A wrong number here doesn't throw — it draws a plausible plan of a room
 * that doesn't exist, or prices flooring for the wrong area. The fixture is
 * a real Magicplan measurement (their "1st bedroom", 5.205 × 3.300 m,
 * 17.15 m²) so the figures below can be checked against something outside
 * this codebase.
 */

const W = 5.205;
const H = 3.3;

function wall(centerX: number, centerZ: number, axisX: number, axisZ: number, length: number) {
  return { centerX, centerZ, axisX, axisZ, lengthMeters: length, heightMeters: 2.449 };
}

function bedroom(): RoomScanResult {
  return {
    walls: [
      wall(W / 2, 0, 1, 0, W),
      wall(W / 2, H, 1, 0, W),
      wall(0, H / 2, 0, 1, H),
      wall(W, H / 2, 0, 1, H),
    ],
    floors: [{ areaSquareMeters: W * H }],
    doors: [
      { centerX: W, centerZ: 0.99, axisX: 0, axisZ: 1, widthMeters: 0.9, heightMeters: 2.03 },
    ],
    windows: [
      { centerX: 2.2, centerZ: 0, axisX: 1, axisZ: 0, widthMeters: 1.4, heightMeters: 1.2 },
    ],
    doorCount: 1,
    windowCount: 1,
    openingCount: 0,
    stairCount: 0,
  };
}

describe("toFloorPlan", () => {
  it("lays the walls out at the room's true size", () => {
    const plan = toFloorPlan(bedroom());
    expect(plan.segments).toHaveLength(4);
    expect(plan.width).toBeCloseTo(W, 2);
    expect(plan.height).toBeCloseTo(H, 2);
  });

  it("normalises to the origin, so nothing is drawn off-canvas", () => {
    const plan = toFloorPlan(bedroom());
    const xs = plan.segments.flatMap((s) => [s.x1, s.x2]);
    const ys = plan.segments.flatMap((s) => [s.y1, s.y2]);
    expect(Math.min(...xs)).toBeCloseTo(0, 6);
    expect(Math.min(...ys)).toBeCloseTo(0, 6);
  });

  it("closes a rectangular room into an outline that can be filled", () => {
    const plan = toFloorPlan(bedroom());
    // Four corners, plus the return to the start.
    expect(plan.polygon.length).toBeGreaterThanOrEqual(4);
    const first = plan.polygon[0];
    const last = plan.polygon[plan.polygon.length - 1];
    expect(Math.hypot(last.x - first.x, last.y - first.y)).toBeLessThan(0.25);
  });

  it("refuses to invent an outline when the walls don't meet", () => {
    // Two facing walls and nothing joining them: a real state when only one
    // side of a room was walked. Drawing a fill here would be a lie.
    const open: RoomScanResult = {
      ...bedroom(),
      walls: [wall(W / 2, 0, 1, 0, W), wall(W / 2, H, 1, 0, W), wall(0, H / 2, 0, 1, H)],
    };
    expect(toFloorPlan(open).polygon).toHaveLength(0);
  });

  it("keeps openings positioned in the walls they were cut from", () => {
    const plan = toFloorPlan(bedroom());
    expect(plan.openings).toHaveLength(2);

    const window = plan.openings.find((o) => o.kind === "window")!;
    // Sits on the y=0 wall, 1.4m wide, centred at x=2.2.
    expect(window.y1).toBeCloseTo(0, 2);
    expect(window.y2).toBeCloseTo(0, 2);
    expect(Math.hypot(window.x2 - window.x1, window.y2 - window.y1)).toBeCloseTo(1.4, 2);
    expect((window.x1 + window.x2) / 2).toBeCloseTo(2.2, 2);

    const door = plan.openings.find((o) => o.kind === "door")!;
    expect(door.x1).toBeCloseTo(W, 2);
    expect(Math.hypot(door.x2 - door.x1, door.y2 - door.y1)).toBeCloseTo(0.9, 2);
  });

  it("survives a room with no walls rather than dividing by nothing", () => {
    const empty = toFloorPlan({ ...bedroom(), walls: [] });
    expect(empty).toEqual({
      segments: [],
      openings: [],
      polygon: [],
      width: 0,
      height: 0,
      offsetX: 0,
      offsetY: 0,
    });
  });
});

describe("the figures an estimate is built from", () => {
  it("totals the floor area, and converts to the price book's units", () => {
    const room = bedroom();
    expect(totalFloorAreaSquareMeters(room)).toBeCloseTo(17.18, 1);
    // 17.15 m² is ~184.6 sq ft — the number that prices flooring.
    expect(squareMetersToSquareFeet(totalFloorAreaSquareMeters(room))).toBeCloseTo(184.9, 0);
  });

  it("totals the perimeter, which is what baseboard is priced against", () => {
    // Magicplan reports this room's perimeter as 17.00 m.
    expect(totalWallLengthMeters(bedroom())).toBeCloseTo(17.01, 1);
  });

  it("converts metres to feet at the real ratio", () => {
    expect(metersToFeet(1)).toBeCloseTo(3.28084, 5);
  });
});

describe("wall area", () => {
  it("reports gross and net, with the openings taken out of net", () => {
    const room = bedroom();
    const { gross, net } = wallAreaSquareMeters(room);

    // Perimeter 17.01 m x 2.449 m ceiling.
    expect(gross).toBeCloseTo(41.66, 1);
    // One door (0.9 x 2.03) and one window (1.4 x 1.2) = 3.51 m2.
    expect(openingAreaSquareMeters(room)).toBeCloseTo(3.51, 2);
    expect(net).toBeCloseTo(gross - 3.51, 2);
  });

  it("never returns a negative net, however the openings measure", () => {
    // A scan that mis-sizes an opening should not produce a wall of less
    // than nothing — a negative would flow straight into a paint quantity.
    const absurd: RoomScanResult = {
      ...bedroom(),
      doors: [{ centerX: 0, centerZ: 0, axisX: 1, axisZ: 0, widthMeters: 99, heightMeters: 99 }],
    };
    expect(wallAreaSquareMeters(absurd).net).toBe(0);
  });

  it("treats an opening with no recorded height as no deduction", () => {
    // Scans saved before openings carried a height. Guessing a standard
    // door there would silently shrink a wall the operator can measure.
    const legacy: RoomScanResult = {
      ...bedroom(),
      doors: [{ centerX: W, centerZ: 0.99, axisX: 0, axisZ: 1, widthMeters: 0.9 }],
      windows: [],
    };
    expect(openingAreaSquareMeters(legacy)).toBe(0);
    expect(wallAreaSquareMeters(legacy).net).toBeCloseTo(wallAreaSquareMeters(legacy).gross, 6);
  });

  it("takes the ceiling from the tallest wall", () => {
    expect(ceilingHeightMeters(bedroom())).toBeCloseTo(2.449, 3);
  });
});

describe("a hand-corrected outline (editedPolygon)", () => {
  // An L-shaped correction, deliberately NOT at the origin: the editor works
  // in the squared plan's own frame, so honouring the edit includes moving
  // it back to (0, 0) the way the native renderer does.
  const edited = [
    { x: 3, y: 2 },
    { x: 8, y: 2 },
    { x: 8, y: 5 },
    { x: 6, y: 5 },
    { x: 6, y: 7 },
    { x: 3, y: 7 },
  ];

  function editedRoom(): ScanGeometry {
    return { ...bedroom(), editedPolygon: edited, lockedEdges: [0], editedAt: "2026-08-14" };
  }

  /** The saved row as the server writes it after an edit: the columns
      recomputed from the corrected outline by the same code the API uses. */
  function savedRow(): SavedScan {
    const { areaSqm, perimeterM } = polygonMetrics(edited);
    return {
      id: "room-1",
      name: "Bedroom",
      level: "Ground",
      position: 0,
      floor_area_sqm: areaSqm,
      wall_length_m: perimeterM,
      ceiling_height_m: 2.449,
      door_count: 1,
      window_count: 1,
      stair_count: 0,
      geometry: editedRoom(),
    };
  }

  it("replaces the scan's walls for drawing, normalised to the origin", () => {
    const plan = toFloorPlan(editedRoom());
    expect(plan.segments).toHaveLength(edited.length);
    expect(plan.openings).toHaveLength(0);
    const xs = plan.polygon.map((p) => p.x);
    const ys = plan.polygon.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(0, 9);
    expect(Math.min(...ys)).toBeCloseTo(0, 9);
    expect(plan.width).toBeCloseTo(5, 9);
    expect(plan.height).toBeCloseTo(5, 9);
    // The shift is recorded, so anything positioned in the original frame
    // can follow the plan to the origin.
    expect(plan.offsetX).toBeCloseTo(3, 9);
    expect(plan.offsetY).toBeCloseTo(2, 9);
  });

  it("reports identical floor area and perimeter through the drawing and the columns", () => {
    // Path one: what the web plan DRAWS — area and perimeter implied by the
    // polygon toFloorPlan returns.
    const plan = toFloorPlan(editedRoom());
    const drawnPerimeter = plan.segments.reduce(
      (sum, s) => sum + Math.hypot(s.x2 - s.x1, s.y2 - s.y1),
      0,
    );
    let twice = 0;
    for (let i = 0; i < plan.polygon.length; i += 1) {
      const a = plan.polygon[i];
      const b = plan.polygon[(i + 1) % plan.polygon.length];
      twice += a.x * b.y - b.x * a.y;
    }
    const drawnArea = Math.abs(twice) / 2;

    // Path two: what the stored columns SAY — written by the server from the
    // same outline, read back through the saved-room helpers.
    const row = savedRow();
    expect(savedFloorAreaSquareMeters(row)).toBeCloseTo(drawnArea, 9);
    expect(savedPerimeterMeters(row)).toBeCloseTo(drawnPerimeter, 9);

    // And both are the corrected figures, not the scan's raw ones.
    expect(drawnArea).toBeCloseTo(21, 9); // 5×5 minus the 2×2 notch
    expect(drawnPerimeter).toBeCloseTo(20, 9);
    expect(drawnArea).not.toBeCloseTo(totalFloorAreaSquareMeters(bedroom()), 1);
  });

  it("keeps segments in edge order, so lockedEdges indices map to drawn walls", () => {
    // The report's "only dimensions that have been manually set" option
    // looks a segment up by index in lockedEdges — which only works if
    // segment i IS edge i (point i to point i+1). Pin that construction.
    const plan = toFloorPlan(editedRoom());
    plan.segments.forEach((segment, i) => {
      const a = edited[i];
      const b = edited[(i + 1) % edited.length];
      expect(segment.x1).toBeCloseTo(a.x - 3, 9);
      expect(segment.y1).toBeCloseTo(a.y - 2, 9);
      expect(segment.x2).toBeCloseTo(b.x - 3, 9);
      expect(segment.y2).toBeCloseTo(b.y - 2, 9);
    });
  });

  it("derives from the geometry when the columns were never filled", () => {
    // Rows from before the columns existed carry the default 0 — zero means
    // absent, and the raw scan is the only figure there is.
    const row: SavedScan = { ...savedRow(), floor_area_sqm: 0, wall_length_m: 0, geometry: bedroom() };
    expect(savedFloorAreaSquareMeters(row)).toBeCloseTo(totalFloorAreaSquareMeters(bedroom()), 9);
    expect(savedPerimeterMeters(row)).toBeCloseTo(totalWallLengthMeters(bedroom()), 9);
  });
});

describe("planCorners", () => {
  /**
   * The corner list a wall index counts against — and the reason it cannot
   * just be `polygon.slice(0, -1)`.
   *
   * `toFloorPlan` returns a closed outline when it chained one out of the
   * walls, and a bare corner list when the operator corrected the plan by
   * hand. Dropping the last point unconditionally is right for the first and
   * deletes a real corner from the second, which renumbers every wall after
   * it — so a wall area drawn on the phone against wall 3 would print on
   * wall 2 here.
   */
  const square = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ];

  it("drops the closing point from an outline that repeats its first", () => {
    expect(planCorners({ polygon: [...square, { x: 0, y: 0 }] })).toEqual(square);
  });

  it("keeps every corner of an outline that does not", () => {
    expect(planCorners({ polygon: square })).toEqual(square);
  });

  it("agrees with itself whichever form the same room arrives in", () => {
    expect(planCorners({ polygon: square })).toEqual(
      planCorners({ polygon: [...square, { x: 0, y: 0 }] }),
    );
  });

  it("gives the same corner count for a chained plan and a corrected one", () => {
    // The chained-from-walls path closes its loop; the hand-corrected path
    // does not. Both must describe a four-walled room as four corners.
    const chained = toFloorPlan(bedroom());
    const corrected = toFloorPlan({ ...bedroom(), editedPolygon: square });
    expect(planCorners(chained)).toHaveLength(4);
    expect(planCorners(corrected)).toHaveLength(4);
  });

  it("leaves a degenerate outline alone rather than emptying it", () => {
    expect(planCorners({ polygon: [] })).toEqual([]);
    expect(planCorners({ polygon: [{ x: 1, y: 1 }] })).toEqual([{ x: 1, y: 1 }]);
  });
});

describe("floor area comes from the outline, not the patches", () => {
  /** A 4×3 room whose walls close, reported by RoomPlan as TWO overlapping
      floor patches — which is what it actually does, and what used to be
      summed. */
  const room = (): RoomScanResult => ({
    walls: [
      { lengthMeters: 4, heightMeters: 2.4, centerX: 2, centerZ: 0, axisX: 1, axisZ: 0 },
      { lengthMeters: 3, heightMeters: 2.4, centerX: 4, centerZ: 1.5, axisX: 0, axisZ: 1 },
      { lengthMeters: 4, heightMeters: 2.4, centerX: 2, centerZ: 3, axisX: 1, axisZ: 0 },
      { lengthMeters: 3, heightMeters: 2.4, centerX: 0, centerZ: 1.5, axisX: 0, axisZ: 1 },
    ],
    floors: [{ areaSquareMeters: 12 }, { areaSquareMeters: 11 }],
    doors: [],
    windows: [],
    openings: [],
    doorCount: 0,
    windowCount: 0,
    openingCount: 0,
    stairCount: 0,
  });

  it("measures the outline rather than adding the patches up", () => {
    // Summing gives 23 for a room that is plainly 12.
    expect(totalFloorAreaSquareMeters(room())).toBeCloseTo(12, 1);
  });

  it("never reports more floor than the room's own extent", () => {
    // No outline at all — fragments — so the patches are all there is, and
    // the extent is the only sanity left.
    const fragments: RoomScanResult = {
      ...room(),
      walls: [
        { lengthMeters: 4, heightMeters: 2.4, centerX: 2, centerZ: 0, axisX: 1, axisZ: 0 },
        { lengthMeters: 3, heightMeters: 2.4, centerX: 9, centerZ: 9, axisX: 0, axisZ: 1 },
      ],
      floors: [{ areaSquareMeters: 500 }],
    };
    const area = totalFloorAreaSquareMeters(fragments);
    const plan = toFloorPlan(fragments);
    expect(area).toBeLessThanOrEqual(plan.width * plan.height + 0.01);
  });

  it("shoelaces an L correctly", () => {
    expect(
      polygonAreaSquareMeters([
        { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 },
        { x: 2, y: 2 }, { x: 2, y: 4 }, { x: 0, y: 4 },
      ]),
    ).toBeCloseTo(12, 5);
  });
});
