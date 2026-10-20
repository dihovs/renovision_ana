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
    // The side walls end square on the open side's line: no mitred point
    // past it (the Clark hall's 4'-2" wall, 19 Oct 2026).
    expect(coveredBy({ x: -T / 2, y: 1 - 0.01 }, band.pieces)).toBe(true);
    expect(coveredBy({ x: -T / 2, y: 1 + T / 2 }, band.pieces)).toBe(false);
    expect(coveredBy({ x: 2 + T / 2, y: 1 + T / 2 }, band.pieces)).toBe(false);
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

describe("the building's outside face", () => {
  it("measures Polygon's Hymus sketch to the inch: all twelve outside figures", async () => {
    // Their sketch draws 4" walls and prints every outside face; our rooms
    // are traced off the same sketch (hymus.job.ts).
    const { exteriorRuns } = await import("./wallBand");
    const { ROOM_SHAPES } = await import("@/lib/estimator/insurance/hymus.job");
    const FT = 0.3048;
    const rings = ROOM_SHAPES.map((shape) =>
      shape.polygonFt.map((p) => ({ x: (p.x + shape.atFt.x) * FT, y: (p.y + shape.atFt.y) * FT })),
    );
    const runs = exteriorRuns(rings, (4 / 12) * FT)!;
    const inches = runs
      .map((r) => Math.round(Math.hypot(r.x2 - r.x1, r.y2 - r.y1) / 0.0254))
      .sort((a, b) => a - b);
    // 3'6" 3'7" 5'5" 5'10" 6'1" 6'4" 9'1" 9'5" 10'11" 15'11" 17'3" 21'10"
    expect(inches).toEqual([42, 43, 65, 70, 73, 76, 109, 113, 131, 191, 207, 262]);
  });

  it("skips a gap enclosed between rooms: only faces that see the outside count", async () => {
    const { exteriorRuns } = await import("./wallBand");
    // Four rooms round a 1 m courtyard-like hole: the hole's edges are not
    // the building's outside.
    const box = (x: number, y: number, w: number, h: number) => [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
    const runs = exteriorRuns(
      [box(0, 0, 3, 1), box(0, 2, 3, 1), box(0, 1, 1, 1), box(2, 1, 1, 1)],
      0.1,
    )!;
    // Outside ring only: 4 sides of a 3.2 × 3.2 square.
    expect(runs).toHaveLength(4);
    for (const r of runs) expect(Math.hypot(r.x2 - r.x1, r.y2 - r.y1)).toBeCloseTo(3.2, 6);
  });

  it("grows no wall on an open side, and breaks a run where wall meets open side", async () => {
    // Lauresco's Clark sketch: the bathroom, and the hall outside it with
    // three open sides ("Mur manquant … Ouvre sur Extérieur").
    const { exteriorRuns } = await import("./wallBand");
    const { ROOM_SHAPES } = await import("@/lib/estimator/insurance/clark.job");
    const FT = 0.3048;
    const rings = ROOM_SHAPES.map((shape) =>
      shape.polygonFt.map((p) => ({ x: (p.x + shape.atFt.x) * FT, y: (p.y + shape.atFt.y) * FT })),
    );
    const open = ROOM_SHAPES.map((shape, k) => (a: Pt, b: Pt) => {
      const ring = rings[k];
      return shape.openEdges.some((i) => {
        const p = ring[i];
        const q = ring[(i + 1) % ring.length];
        return Math.hypot(p.x - a.x, p.y - a.y) < 1e-6 && Math.hypot(q.x - b.x, q.y - b.y) < 1e-6;
      });
    });
    const runs = exteriorRuns(rings, (4 / 12) * FT, open)!;
    const inches = runs
      .map((r) => Math.round(Math.hypot(r.x2 - r.x1, r.y2 - r.y1) / 0.0254))
      .filter((n) => n >= 12)
      .sort((a, b) => a - b);
    // Every figure their sketch prints outside: 2'-3" 3'-9" 4'-2" 4'-3"
    // 6'-1" 12' 16'.
    expect(inches).toEqual([27, 45, 50, 51, 73, 144, 192]);
  });

  it("gives up on an angled wall rather than guessing", async () => {
    const { exteriorRuns } = await import("./wallBand");
    expect(exteriorRuns([[{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1.5 }]], 0.1)).toBeNull();
  });
});
