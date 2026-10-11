import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FloorPlan from "./FloorPlan";
import { makeRectangularRoom } from "@/lib/manualRoom";
import type { RoomScanResult } from "@/lib/roomScan";

function labels(result: RoomScanResult): string[] {
  const svg = renderToStaticMarkup(createElement(FloorPlan, { result, name: "Room" }));
  return [...svg.matchAll(/<text[^>]*>([\d.,]+)<\/text>/g)].map((m) => m[1]);
}

function count(list: string[], value: string): number {
  return list.filter((v) => v === value).length;
}

describe("floor plan dimension chains", () => {
  it("prints each side of a plain rectangle once", () => {
    // 2.692 x 1.956 m, the room the owner caught drawn with every figure twice.
    const room = makeRectangularRoom({ widthMeters: 2.692, lengthMeters: 1.956, heightMeters: 2.44 });
    const found = labels(room);
    expect(count(found, "2.692")).toBe(1);
    expect(count(found, "1.956")).toBe(1);
  });

  it("still breaks a side into spans where its corners divide it", () => {
    // An L: 4 m across the bottom, a 1.5 m step in on the top right.
    const room = makeRectangularRoom({ widthMeters: 4, lengthMeters: 3, heightMeters: 2.44 });
    const l: RoomScanResult = {
      ...room,
      editedPolygon: [
        { x: 0, y: 0 },
        { x: 2.5, y: 0 },
        { x: 2.5, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ],
    };
    const found = labels(l);
    expect(found).toContain("2.500");
    expect(found).toContain("1.500");
    expect(count(found, "4.000")).toBe(1);
  });
});
