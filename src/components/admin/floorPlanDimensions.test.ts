import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FloorPlan from "./FloorPlan";
import { makeRectangularRoom } from "@/lib/manualRoom";
import type { RoomScanResult, ScanGeometry } from "@/lib/roomScan";

// Dimensions print in feet and inches, drafting form (`8'-10"`), since the
// owner's "feet everywhere" (15 Oct 2026). The markup escapes the marks.
function labels(result: RoomScanResult): string[] {
  const svg = renderToStaticMarkup(createElement(FloorPlan, { result, name: "Room" }));
  return [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)]
    .map((m) => m[1].replace(/&#x27;/g, "'").replace(/&quot;/g, '"'))
    .filter((v) => /^\d+'-\d+"$|^\d+"$/.test(v));
}

function count(list: string[], value: string): number {
  return list.filter((v) => v === value).length;
}

describe("floor plan dimension chains", () => {
  it("prints each side of a plain rectangle once", () => {
    // 2.692 x 1.956 m (8'-10" x 6'-5"), the room the owner caught drawn with
    // every figure twice.
    const room = makeRectangularRoom({ widthMeters: 2.692, lengthMeters: 1.956, heightMeters: 2.44 });
    const found = labels(room);
    expect(count(found, `8'-10"`)).toBe(1);
    expect(count(found, `6'-5"`)).toBe(1);
  });

  it("still breaks a side into spans where its corners divide it", () => {
    // An L: 4 m (13'-1") across the bottom, a 1.5 m (4'-11") step in on the
    // top right after 2.5 m (8'-2").
    const room = makeRectangularRoom({ widthMeters: 4, lengthMeters: 3, heightMeters: 2.44 });
    const l: ScanGeometry = {
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
    expect(found).toContain(`8'-2"`);
    expect(found).toContain(`4'-11"`);
    expect(count(found, `13'-1"`)).toBe(1);
  });
});
