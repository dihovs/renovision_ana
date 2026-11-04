import { describe, expect, it } from "vitest";
import { arcFigures, signedSegmentArea } from "./arc";
import { polygonMetrics } from "./crm/roomScans";
import { closedPerimeterMeters } from "./openWalls";
import type { ScanGeometry } from "./roomScan";

/** The floor-plan spec's T8, and what the server does with it (M5). */
describe("arcs — twin of FloorPlanCore/Arc.swift", () => {
  it("T8: chord 4, sagitta 0.5", () => {
    const a = arcFigures(4, 0.5);
    expect(a.radius).toBeCloseTo(4.25, 9);
    expect(a.halfAngle).toBeCloseTo(0.489957, 6);
    expect(a.length).toBeCloseTo(4.1646, 3);
    expect(a.segmentArea).toBeCloseTo(1.3499, 3);
  });

  it("a semicircle is πR long", () => {
    expect(arcFigures(4, 2).length).toBeCloseTo(2 * Math.PI, 9);
  });

  it("straight is the chord, no area", () => {
    expect(arcFigures(4, 0)).toMatchObject({ length: 4, segmentArea: 0 });
  });

  it("bulging out adds area, in removes it", () => {
    expect(signedSegmentArea(4, 0.5)).toBeCloseTo(1.3499, 3);
    expect(signedSegmentArea(4, -0.5)).toBeCloseTo(-1.3499, 3);
  });
});

describe("polygonMetrics with curved walls", () => {
  // The phone's frame: y down. Wall 0 is the top wall, (0,0) → (4,0).
  const rect = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ];

  it("is unchanged with no bulges", () => {
    expect(polygonMetrics(rect)).toEqual({ areaSqm: 12, perimeterM: 14 });
  });

  it("adds an outward bulge whichever way round the outline runs", () => {
    const out = polygonMetrics(rect, [0.5, 0, 0, 0]);
    expect(out.areaSqm).toBeCloseTo(12 + 1.3499, 3);
    expect(out.perimeterM).toBeCloseTo(4.1646 + 10, 3);
    // Same room, corners reversed: edge 0 is now (0,0) → (0,3), and the old
    // top wall is edge 3. The sign is "away from the room", not "right of
    // travel", so it still adds.
    const reversed = [rect[0], rect[3], rect[2], rect[1]];
    expect(polygonMetrics(reversed, [0, 0, 0, 0.5]).areaSqm).toBeCloseTo(12 + 1.3499, 3);
  });

  it("removes an inward one", () => {
    expect(polygonMetrics(rect, [-0.5, 0, 0, 0]).areaSqm).toBeCloseTo(12 - 1.3499, 3);
  });

  it("the closed perimeter counts the arc too", () => {
    const geometry = { editedPolygon: rect, edgeBulge: [0.5, 0, 0, 0] } as unknown as ScanGeometry;
    expect(closedPerimeterMeters(geometry)).toBeCloseTo(4.1646 + 10, 3);
  });
});
