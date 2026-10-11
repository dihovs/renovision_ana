import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FloorPlan from "./FloorPlan";
import { makeRectangularRoom } from "@/lib/manualRoom";
import { outlineCorners, perimeterWithOpenWallsMeters, wallSide } from "@/lib/openWalls";
import { savedPerimeterMeters, type SavedScan, type ScanGeometry } from "@/lib/roomScan";
import { roomFromScan } from "@/lib/estimator/insurance/context";
import type { RoomScan } from "@/lib/crm/roomScans";

// 4 m across, 3 m deep, 2.44 m ceiling: 14 m of wall around.
const geometry = makeRectangularRoom({
  widthMeters: 4,
  lengthMeters: 3,
  heightMeters: 2.44,
}) as ScanGeometry;
const corners = outlineCorners(geometry);
const right = corners.findIndex((_, i) => wallSide(corners, i) === "Right");

function svg(openWalls?: number[]): string {
  return renderToStaticMarkup(createElement(FloorPlan, { result: geometry, name: "Room", openWalls }));
}

function scan(openWalls: number[]): RoomScan {
  return {
    id: "r1",
    created_at: "",
    project_id: "p",
    name: "Entry",
    level: "Ground",
    position: 0,
    floor_area_sqm: 12,
    // What the server stores after a toggle: the run of wall that is left.
    wall_length_m: perimeterWithOpenWallsMeters(geometry, openWalls),
    ceiling_height_m: 2.44,
    door_count: 0,
    window_count: 0,
    stair_count: 0,
    geometry: geometry as unknown as Record<string, unknown>,
    notes: null,
    plan_x: null,
    plan_y: null,
    room_type: null,
    living_percent: null,
    room_color: null,
    floor_finish: null,
    open_walls: openWalls,
  };
}

describe("an open side on the plan", () => {
  it("draws nothing dashed when every side is a wall", () => {
    expect(svg()).not.toContain("data-open-wall");
    expect(svg([])).not.toContain("data-open-wall");
  });

  it("draws the open side as one thin dashed line", () => {
    const markup = svg([right]);
    expect(markup.match(/data-open-wall/g)).toHaveLength(1);
    expect(markup).toContain("stroke-dasharray");
  });

  it("leaves the open side out of the wall band", () => {
    // The band is one path of "M x y L x y" runs, one per wall drawn.
    const runs = (markup: string) =>
      (markup.match(/<path d="([^"]*)"[^>]*stroke-width="0.15/)?.[1].match(/M /g) ?? []).length;
    expect(runs(svg([]))).toBe(4);
    expect(runs(svg([right]))).toBe(3);
  });
});

describe("an open side in the numbers", () => {
  it("bills wall and baseboard on the walls that are left, and the same floor", () => {
    const closed = roomFromScan(scan([]), [], []);
    const open = roomFromScan(scan([right]), [], []);

    expect(closed.stats.perimeterM).toBeCloseTo(14, 6);
    expect(open.stats.perimeterM).toBeCloseTo(11, 6);
    expect(open.stats.wallAreaGrossSqm).toBeCloseTo(11 * 2.44, 6);
    expect(open.baseboardLengthM).toBeCloseTo(11, 6);
    // The outline is still closed: the floor is the same floor.
    expect(open.stats.floorAreaSqm).toBe(closed.stats.floorAreaSqm);
  });

  it("reads a room open on every side as no wall at all, not as the full outline", () => {
    const everySide = corners.map((_, i) => i);
    const saved = scan(everySide) as unknown as SavedScan;
    expect(saved.wall_length_m).toBe(0);
    expect(savedPerimeterMeters(saved)).toBe(0);
  });

  it("still falls back to the outline for an old row with no figure and no open sides", () => {
    const legacy = { ...scan([]), wall_length_m: 0 } as unknown as SavedScan;
    expect(savedPerimeterMeters(legacy)).toBeCloseTo(14, 6);
  });
});
