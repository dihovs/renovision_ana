import { describe, expect, it } from "vitest";
import { packRooms, resolvePlacements, zoomTo } from "./floorLayout";

/**
 * Laying a floor's rooms out on one sheet.
 *
 * The property that matters most: packing must never change a room's own
 * size. The arrangement is arbitrary and admitted to be; the measurements
 * are not, and a layout that scaled a room to fit would corrupt the one
 * thing the whole app exists to record.
 */

describe("packRooms", () => {
  it("keeps every room at its measured size", () => {
    const sizes = [
      { width: 4, height: 3 },
      { width: 6, height: 2.5 },
      { width: 2, height: 2 },
    ];
    const { placed } = packRooms(sizes);
    expect(placed).toHaveLength(3);
    placed.forEach((room, i) => {
      expect(room.width).toBe(sizes[i].width);
      expect(room.height).toBe(sizes[i].height);
    });
  });

  it("never overlaps two rooms", () => {
    const sizes = Array.from({ length: 9 }, (_, i) => ({
      width: 3 + (i % 3),
      height: 2 + (i % 2),
    }));
    const { placed } = packRooms(sizes);

    for (let a = 0; a < placed.length; a += 1) {
      for (let b = a + 1; b < placed.length; b += 1) {
        const A = placed[a];
        const B = placed[b];
        const apart =
          A.x + A.width <= B.x || B.x + B.width <= A.x || A.y + A.height <= B.y || B.y + B.height <= A.y;
        expect(apart, `room ${a} overlaps room ${b}`).toBe(true);
      }
    }
  });

  it("wraps instead of drawing one long ribbon", () => {
    // Eight rooms in a single row would be unreadable on a phone.
    const { placed } = packRooms(Array.from({ length: 8 }, () => ({ width: 4, height: 3 })));
    const rows = new Set(placed.map((room) => room.y));
    expect(rows.size).toBeGreaterThan(1);
  });

  it("places a single room at the origin", () => {
    const { placed, width, height } = packRooms([{ width: 5, height: 4 }]);
    expect(placed[0]).toEqual({ x: 0, y: 0, width: 5, height: 4 });
    expect(width).toBe(5);
    expect(height).toBe(4);
  });

  it("still places a room wider than the target row", () => {
    // A 30 m hallway among small rooms must not vanish.
    const { placed } = packRooms([
      { width: 2, height: 2 },
      { width: 30, height: 1.5 },
    ]);
    expect(placed).toHaveLength(2);
    expect(placed[1].width).toBe(30);
  });

  it("reports a sheet that contains every room", () => {
    const sizes = Array.from({ length: 6 }, (_, i) => ({ width: 3 + i, height: 2 + (i % 3) }));
    const { placed, width, height } = packRooms(sizes);
    for (const room of placed) {
      expect(room.x + room.width).toBeLessThanOrEqual(width + 1e-9);
      expect(room.y + room.height).toBeLessThanOrEqual(height + 1e-9);
    }
  });

  it("handles an empty floor", () => {
    expect(packRooms([])).toEqual({ placed: [], width: 0, height: 0 });
  });
});

describe("zoomTo", () => {
  const sheet = { width: 20, height: 20 };

  it("is the identity when nothing is selected", () => {
    expect(zoomTo(null, sheet)).toBe("translate(0,0) scale(1)");
  });

  it("centres the selected room", () => {
    // A room in the top-left corner must end up in the middle of the view.
    const transform = zoomTo({ x: 0, y: 0, width: 4, height: 4 }, sheet);
    const [, tx, ty, scale] = /translate\(([-\d.]+),([-\d.]+)\) scale\(([\d.]+)\)/.exec(transform)!;
    const centreX = Number(tx) + Number(scale) * 2;
    const centreY = Number(ty) + Number(scale) * 2;
    // Two places, not three: the transform is rounded to 3 decimals on the
    // way out, and translate and scale round independently, so the centre
    // can land about a millimetre off. That is deliberate — the alternative
    // is 17 significant figures in every SVG attribute.
    expect(centreX).toBeCloseTo(10, 2);
    expect(centreY).toBeCloseTo(10, 2);
  });

  it("does not magnify a tiny room past the cap", () => {
    // A cupboard blown up to fill a phone screen reads as a bug.
    const transform = zoomTo({ x: 0, y: 0, width: 0.5, height: 0.5 }, sheet);
    const scale = Number(/scale\(([\d.]+)\)/.exec(transform)![1]);
    expect(scale).toBeLessThanOrEqual(4);
  });

  it("survives a degenerate sheet rather than emitting NaN", () => {
    // NaN in a transform silently blanks the whole drawing.
    const transform = zoomTo({ x: 0, y: 0, width: 3, height: 3 }, { width: 0, height: 0 });
    expect(transform).toBe("translate(0,0) scale(1)");
    expect(transform).not.toContain("NaN");
  });
});

describe("resolvePlacements", () => {
  const sizes = [
    { width: 4, height: 3 },
    { width: 3, height: 3 },
  ];

  it("falls back to the packed slot for an unplaced room", () => {
    const { placed } = resolvePlacements(sizes, [null, null]);
    expect(placed).toEqual(packRooms(sizes).placed);
  });

  it("honours a room the operator dragged", () => {
    const { placed } = resolvePlacements(sizes, [{ x: 10, y: 5 }, null]);
    expect(placed[0].x).toBe(10);
    expect(placed[0].y).toBe(5);
    // The unplaced one keeps its own slot rather than being shoved along.
    expect(placed[1].width).toBe(3);
  });

  it("keeps a room dragged past the origin inside the sheet", () => {
    // Negative coordinates would otherwise fall outside the viewBox and the
    // room would simply not be drawn.
    const { placed, width, height } = resolvePlacements(sizes, [{ x: -6, y: -2 }, null]);
    for (const room of placed) {
      expect(room.x).toBeGreaterThanOrEqual(-1e-9);
      expect(room.y).toBeGreaterThanOrEqual(-1e-9);
      expect(room.x + room.width).toBeLessThanOrEqual(width + 1e-9);
      expect(room.y + room.height).toBeLessThanOrEqual(height + 1e-9);
    }
  });

  it("never resizes a room, wherever it is put", () => {
    const { placed } = resolvePlacements(sizes, [{ x: 99, y: -40 }, { x: 0, y: 0 }]);
    expect(placed.map((r) => [r.width, r.height])).toEqual([
      [4, 3],
      [3, 3],
    ]);
  });
});
