import { describe, expect, it } from "vitest";
import { parseLength, parsePrintedSize } from "./lengths";
import { alignValues, assemble, estimateScale, placeOpening, snapPolygon, type Mask } from "./geometry";

const ft = (feet: number, inches = 0) => (feet + inches / 12) * 0.3048;

describe("reading a printed length", () => {
  it("understands the ways a plan writes feet and inches", () => {
    expect(parseLength("18-8")).toBeCloseTo(ft(18, 8), 6);
    expect(parseLength(`18'-8"`)).toBeCloseTo(ft(18, 8), 6);
    expect(parseLength("18’ 8”")).toBeCloseTo(ft(18, 8), 6);
    expect(parseLength(`9'-10 1/2"`)).toBeCloseTo(ft(9, 10.5), 6);
    expect(parseLength("10'")).toBeCloseTo(ft(10), 6);
    expect(parseLength("3.81m")).toBeCloseTo(3.81, 6);
    expect(parseLength("5,69 m")).toBeCloseTo(5.69, 6);
  });

  it("refuses a bare whole number, which could be feet or metres", () => {
    expect(parseLength("12")).toBeNull();
  });

  it("splits a printed size into its two lengths", () => {
    const [a, b] = parsePrintedSize("12-10 x 11-6")!;
    expect(a).toBeCloseTo(ft(12, 10), 6);
    expect(b).toBeCloseTo(ft(11, 6), 6);
    expect(parsePrintedSize("5.69 × 5.89 m")).toEqual([5.69, 5.89]);
    expect(parsePrintedSize(null)).toBeNull();
  });
});

/** A white sheet with black rectangles drawn on it. */
function sheet(width: number, height: number, walls: [number, number, number, number][]): Mask {
  const dark = new Uint8Array(width * height);
  for (const [x0, y0, x1, y1] of walls) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) dark[y * width + x] = 1;
  }
  return { width, height, dark };
}

describe("snapping a room to its walls", () => {
  // A room whose inside runs x 20..120, y 30..90, walls 6 px thick.
  const mask = sheet(200, 150, [
    [14, 24, 126, 30],
    [14, 90, 126, 96],
    [14, 24, 20, 96],
    [120, 24, 126, 96],
  ]);

  it("moves corners the reader got a few pixels wrong onto the inside faces", () => {
    const { polygon, snapped } = snapPolygon(
      mask,
      [
        { x: 24, y: 26 },
        { x: 117, y: 26 },
        { x: 117, y: 93 },
        { x: 24, y: 93 },
      ],
      12,
    );
    expect(snapped).toBe(4);
    expect(polygon).toEqual([
      { x: 20, y: 30 },
      { x: 120, y: 30 },
      { x: 120, y: 90 },
      { x: 20, y: 90 },
    ]);
  });

  it("leaves an edge alone when there is no wall within reach", () => {
    const open = sheet(200, 150, [[14, 24, 126, 30]]);
    const { polygon, snapped } = snapPolygon(
      open,
      [
        { x: 24, y: 33 },
        { x: 117, y: 33 },
        { x: 117, y: 93 },
        { x: 24, y: 93 },
      ],
      12,
    );
    expect(snapped).toBe(1);
    expect(polygon[0].y).toBe(30);
    expect(polygon[2].y).toBe(93);
  });
});

describe("the drawing's scale", () => {
  it("comes from the printed sizes that agree, whichever way round they are printed", () => {
    const pxPerM = 25;
    const room = (w: number, h: number, printed: string) => ({
      printedSize: printed,
      polygon: [
        { x: 0, y: 0 },
        { x: w * pxPerM, y: 0 },
        { x: w * pxPerM, y: h * pxPerM },
        { x: 0, y: h * pxPerM },
      ],
    });
    const scale = estimateScale([
      room(ft(18, 8), ft(19, 4), "18-8 x 19-4"),
      room(ft(14), ft(12, 6), "12-6 x 14-0"), // printed the other way round
      room(ft(7), ft(11), "7-0 x 11-0"),
      room(ft(5), ft(5), "9-0 x 9-0"), // a label that does not match its room
    ]);
    expect(scale).toBeCloseTo(pxPerM, 1);
  });
});

describe("lining rooms up", () => {
  it("makes faces a hair apart identical, and leaves a wall's two faces apart", () => {
    const map = alignValues([3.47, 3.49, 3.5, 3.61], 0.04);
    expect(map.get(3.47)).toBeCloseTo(3.4867, 3);
    expect(map.get(3.5)).toBeCloseTo(3.4867, 3);
    expect(map.get(3.61)).toBe(3.61);
  });
});

describe("placing a door", () => {
  const room = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ];

  it("lands on the wall it sits in, measured from that wall's start corner", () => {
    // A door in the bottom wall, drawn 5 cm into the wall band, 1.0–1.8 m from
    // the left. The bottom edge runs right to left, from (4,3) to (0,3).
    const placed = placeOpening(room, { x: 1.0, y: 3.05 }, { x: 1.8, y: 3.05 }, "doorSingle", 0.35);
    expect(placed).toEqual([{ edge: 2, offset: 2.2, width: 0.8, kind: "doorSingle" }]);
  });

  it("ignores a wall it is nowhere near", () => {
    expect(placeOpening(room, { x: 1, y: 6 }, { x: 1.8, y: 6 }, "doorSingle", 0.35)).toEqual([]);
  });
});

describe("assembling a floor", () => {
  it("puts each room's min corner on the floor and keeps the drawing over a disagreeing label", () => {
    const scale = 10; // px per metre
    const rooms = assemble(
      [
        {
          name: "Bedroom 2",
          roomType: "bedroom",
          printedSize: "12-10 x 11-6",
          ceilingHeight: null,
          outdoor: false,
          polygon: [
            { x: 100, y: 100 },
            { x: 139.1, y: 100 },
            { x: 139.1, y: 135 },
            { x: 100, y: 135 },
          ],
        },
        {
          name: "Foyer",
          roomType: "entry",
          printedSize: "7-0 x 11-0", // drawn 11'-6" deep, like the bedroom
          ceilingHeight: null,
          outdoor: false,
          polygon: [
            { x: 140.2, y: 100 },
            { x: 161.5, y: 100 },
            { x: 161.5, y: 135.1 },
            { x: 140.2, y: 135.1 },
          ],
        },
      ],
      [],
      scale,
    );
    expect(rooms[0].planX).toBe(0);
    expect(rooms[0].planY).toBe(0);
    // The foyer's back wall lines up with the bedroom's, exactly.
    expect(rooms[1].polygon[2].y).toBeCloseTo(rooms[0].polygon[2].y, 6);
    expect(rooms[1].note).toMatch(/Kept the drawing/);
    expect(rooms[0].note).toBeNull();
  });
});
