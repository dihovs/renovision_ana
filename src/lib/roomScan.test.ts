import { describe, expect, it } from "vitest";
import {
  metersToFeet,
  squareMetersToSquareFeet,
  toFloorPlan,
  totalFloorAreaSquareMeters,
  totalWallLengthMeters,
  type RoomScanResult,
} from "./roomScan";

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
    doors: [{ centerX: W, centerZ: 0.99, axisX: 0, axisZ: 1, widthMeters: 0.9 }],
    windows: [{ centerX: 2.2, centerZ: 0, axisX: 1, axisZ: 0, widthMeters: 1.4 }],
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
    expect(empty).toEqual({ segments: [], openings: [], polygon: [], width: 0, height: 0 });
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
