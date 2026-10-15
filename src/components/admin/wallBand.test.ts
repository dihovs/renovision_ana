import { describe, expect, it } from "vitest";
import { wallBand, type Pt } from "./wallBand";

const T = 0.1;

/** Area covered by the pieces (they do not overlap one another). */
function coveredArea(pieces: Pt[][]): number {
  return pieces.reduce((sum, piece) => {
    let twice = 0;
    piece.forEach((p, i) => {
      const q = piece[(i + 1) % piece.length];
      twice += p.x * q.y - q.x * p.y;
    });
    return sum + Math.abs(twice) / 2;
  }, 0);
}

/** Even-odd point-in-polygon. */
function inside(pt: Pt, ring: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

const coveredBy = (pt: Pt, pieces: Pt[][]) => pieces.some((piece) => inside(pt, piece));

const square: Pt[] = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 1 },
  { x: 0, y: 1 },
];

describe("wall band outside the room", () => {
  it("rings a rectangle exactly: outer box minus the room, corners square", () => {
    const band = wallBand(square, T)!;
    expect(band.pieces).toHaveLength(4);
    // (2 + 2T)(1 + 2T) − 2·1
    expect(coveredArea(band.pieces)).toBeCloseTo((2 + 2 * T) * (1 + 2 * T) - 2, 6);
    expect(coveredBy({ x: -T / 2, y: -T / 2 }, band.pieces)).toBe(true); // the corner square
    expect(coveredBy({ x: 1, y: 0.5 }, band.pieces)).toBe(false); // never inside the room
  });

  it("does not depend on which way the outline winds", () => {
    const reversed = [...square].reverse();
    expect(coveredArea(wallBand(reversed, T)!.pieces)).toBeCloseTo(coveredArea(wallBand(square, T)!.pieces), 6);
  });

  it("closes an L's inside corner without poking into the room", () => {
    // The Hymus open area's shape: a long body with a bump up at the right.
    const L: Pt[] = [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 1 },
      { x: 2, y: 1 },
    ];
    const band = wallBand(L, T)!;
    expect(coveredBy({ x: 2 - T / 2, y: 1 - T / 2 }, band.pieces)).toBe(true); // elbow square
    expect(coveredBy({ x: 2 + 0.02, y: 1 - 0.02 }, band.pieces)).toBe(false); // bump interior
    expect(coveredBy({ x: 1.98, y: 1.02 }, band.pieces)).toBe(false); // body interior
  });

  it("leaves a door's width out of the wall and reports which way is outside", () => {
    const door = { x1: 0.5, y1: 1, x2: 1.3, y2: 1 };
    const band = wallBand(square, T, [door])!;
    expect(coveredBy({ x: 0.9, y: 1 + T / 2 }, band.pieces)).toBe(false); // the gap
    expect(coveredBy({ x: 0.3, y: 1 + T / 2 }, band.pieces)).toBe(true); // wall beside it
    expect(band.openingNormals[0]).toEqual({ x: 0, y: 1 }); // the bottom edge's outside is +y
  });

  it("leaves an opening that lies on no edge to the caller", () => {
    const band = wallBand(square, T, [{ x1: 0.5, y1: 0.5, x2: 1, y2: 0.5 }])!;
    expect(band.openingNormals[0]).toBeNull();
    expect(band.pieces).toHaveLength(4);
  });

  it("draws nothing on an open side", () => {
    const openBottom = (a: Pt, b: Pt) => a.y === 1 && b.y === 1;
    const band = wallBand(square, T, [], openBottom)!;
    expect(band.pieces).toHaveLength(3);
    expect(coveredBy({ x: 1, y: 1 + T / 2 }, band.pieces)).toBe(false);
  });

  it("joins a wall split at a jamb into one flush run", () => {
    const split: Pt[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(coveredArea(wallBand(split, T)!.pieces)).toBeCloseTo((2 + 2 * T) * (1 + 2 * T) - 2, 6);
  });

  it("prints a shared wall once: two rooms a wall apart cover the same strip", () => {
    const left = square;
    const right: Pt[] = square.map((p) => ({ x: p.x + 2 + T, y: p.y }));
    const a = wallBand(left, T)!;
    const b = wallBand(right, T)!;
    // The strip between them, x ∈ (2, 2 + T), is covered by both — one wall,
    // not two side by side.
    const mid = { x: 2 + T / 2, y: 0.5 };
    expect(coveredBy(mid, a.pieces)).toBe(true);
    expect(coveredBy(mid, b.pieces)).toBe(true);
    expect(coveredBy({ x: 2 + T + 0.01, y: 0.5 }, a.pieces)).toBe(false); // never over the neighbour's floor
  });

  it("gives up cleanly without an outline", () => {
    expect(wallBand([{ x: 0, y: 0 }, { x: 1, y: 0 }], T)).toBeNull();
  });
});
