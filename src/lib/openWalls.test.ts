import { describe, expect, it } from "vitest";
import { makeRectangularRoom } from "./manualRoom";
import {
  closedPerimeterMeters,
  openSegmentFlags,
  openWallLengthMeters,
  outlineCorners,
  perimeterWithOpenWallsMeters,
  wallSide,
} from "./openWalls";
import { toFloorPlan, type ScanGeometry } from "./roomScan";

// 4 m across, 3 m deep: perimeter 14 m.
const room = makeRectangularRoom({
  widthMeters: 4,
  lengthMeters: 3,
  heightMeters: 2.44,
}) as ScanGeometry;

function sideIndex(side: string): number {
  const corners = outlineCorners(room);
  return corners.findIndex((_, i) => wallSide(corners, i) === side);
}

describe("open sides", () => {
  it("leaves the perimeter alone when nothing is open", () => {
    expect(closedPerimeterMeters(room)).toBeCloseTo(14, 6);
    expect(perimeterWithOpenWallsMeters(room, [])).toBeCloseTo(14, 6);
  });

  it("takes an open side out of the perimeter, and only that side", () => {
    const right = sideIndex("Right");
    expect(openWallLengthMeters(room, [right])).toBeCloseTo(3, 6);
    expect(perimeterWithOpenWallsMeters(room, [right])).toBeCloseTo(11, 6);
  });

  it("counts a side once however many times it is listed", () => {
    const top = sideIndex("Top");
    expect(perimeterWithOpenWallsMeters(room, [top, top])).toBeCloseTo(10, 6);
  });

  it("ignores indices that no longer name an edge", () => {
    expect(perimeterWithOpenWallsMeters(room, [7, -1, 2.5])).toBeCloseTo(14, 6);
  });

  it("measures a corrected outline from its own edges", () => {
    const edited: ScanGeometry = {
      ...room,
      editedPolygon: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 2 },
        { x: 0, y: 2 },
      ],
    };
    expect(closedPerimeterMeters(edited)).toBeCloseTo(14, 6);
    // Edge 1 of a hand-drawn outline is the 2 m right side.
    expect(perimeterWithOpenWallsMeters(edited, [1])).toBeCloseTo(12, 6);
  });

  it("names each side of a rectangle by where it sits on the page", () => {
    const corners = outlineCorners(room);
    expect(corners.map((_, i) => wallSide(corners, i)).sort()).toEqual([
      "Bottom",
      "Left",
      "Right",
      "Top",
    ]);
  });

  it("flags exactly the drawn segment that stands on the open side", () => {
    const plan = toFloorPlan(room);
    const left = sideIndex("Left");
    const flags = openSegmentFlags(plan, [left]);
    expect(flags.filter(Boolean)).toHaveLength(1);
    const open = plan.segments[flags.indexOf(true)];
    // The left side runs straight down the page at x = 0.
    expect(Math.abs(open.x1 - open.x2)).toBeLessThan(1e-6);
    expect(Math.min(open.x1, open.x2)).toBeCloseTo(0, 6);
  });

  it("flags nothing when no side is open", () => {
    expect(openSegmentFlags(toFloorPlan(room), []).some(Boolean)).toBe(false);
    expect(openSegmentFlags(toFloorPlan(room), undefined).some(Boolean)).toBe(false);
  });
});
