import { describe, expect, it } from "vitest";
import { chainOutline, cleanedForChaining, type ChainSegment } from "./wallChain";

/**
 * The scan that squares itself off.
 *
 * These tests are written against what RoomPlan actually produces — walls in
 * pieces, walls seen twice, doorway stubs — because the failure being fixed
 * was not "the maths is wrong". It was that the chainer gave up on real input
 * and something downstream drew a bounding box instead, silently turning a
 * room with a nook into a clean rectangle.
 */

const rect = (w: number, h: number): ChainSegment[] => [
  { x1: 0, y1: 0, x2: w, y2: 0 },
  { x1: w, y1: 0, x2: w, y2: h },
  { x1: w, y1: h, x2: 0, y2: h },
  { x1: 0, y1: h, x2: 0, y2: 0 },
];

const area = (points: { x: number; y: number }[]) => {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
};

describe("cleanedForChaining", () => {
  it("drops stubs too short to be walls", () => {
    const withStub = [...rect(4, 3), { x1: 2, y1: 0, x2: 2.05, y2: 0 }];
    expect(cleanedForChaining(withStub)).toHaveLength(4);
  });

  it("merges one wall that arrived in two pieces", () => {
    // The commonest RoomPlan artefact: a long wall broken at a doorway.
    const split: ChainSegment[] = [
      { x1: 0, y1: 0, x2: 2.4, y2: 0 },
      { x1: 2.5, y1: 0, x2: 5, y2: 0 },
    ];
    const cleaned = cleanedForChaining(split);
    expect(cleaned).toHaveLength(1);
    expect(Math.hypot(cleaned[0].x2 - cleaned[0].x1, cleaned[0].y2 - cleaned[0].y1)).toBeCloseTo(5, 6);
  });

  it("merges a wall seen twice without doubling its length", () => {
    // Two overlapping observations of one wall. Summing them would report a
    // wall twice as long as the room, and price twice the drywall.
    const twice: ChainSegment[] = [
      { x1: 0, y1: 0, x2: 4, y2: 0 },
      { x1: 1, y1: 0.02, x2: 5, y2: 0.02 },
    ];
    const cleaned = cleanedForChaining(twice);
    expect(cleaned).toHaveLength(1);
    const len = Math.hypot(cleaned[0].x2 - cleaned[0].x1, cleaned[0].y2 - cleaned[0].y1);
    expect(len).toBeGreaterThan(4.9);
    expect(len).toBeLessThan(5.1);
  });

  it("refuses to merge the two sides of a partition", () => {
    // Parallel and close, but 15cm apart — a stud wall seen from both rooms.
    // Merging them would delete a wall that exists.
    const partition: ChainSegment[] = [
      { x1: 0, y1: 0, x2: 4, y2: 0 },
      { x1: 0, y1: 0.15, x2: 4, y2: 0.15 },
    ];
    expect(cleanedForChaining(partition)).toHaveLength(2);
  });

  it("refuses to merge collinear walls with a real gap between them", () => {
    // A room open to a hallway: same line, metres apart. One wall, not two.
    const gapped: ChainSegment[] = [
      { x1: 0, y1: 0, x2: 2, y2: 0 },
      { x1: 5, y1: 0, x2: 8, y2: 0 },
    ];
    expect(cleanedForChaining(gapped)).toHaveLength(2);
  });

  it("welds near-miss corners to exactly one point", () => {
    const sloppy: ChainSegment[] = [
      { x1: 0, y1: 0, x2: 4, y2: 0 },
      { x1: 4.05, y1: 0.04, x2: 4, y2: 3 },
    ];
    const cleaned = cleanedForChaining(sloppy);
    expect(cleaned[1].x1).toBeCloseTo(cleaned[0].x2, 9);
    expect(cleaned[1].y1).toBeCloseTo(cleaned[0].y2, 9);
  });
});

describe("chainOutline", () => {
  it("closes a clean rectangle and does not repeat the first corner", () => {
    const outline = chainOutline(rect(4, 3))!;
    expect(outline.inferredClosingEdge).toBe(false);
    expect(outline.points).toHaveLength(4);
    expect(area(outline.points)).toBeCloseTo(12, 6);
  });

  it("closes a room whose walls arrived in fragments", () => {
    // The case that used to fail outright: every wall in two pieces, corners
    // off by a couple of centimetres.
    const fragments: ChainSegment[] = [
      { x1: 0, y1: 0, x2: 2, y2: 0 },
      { x1: 2.01, y1: 0.01, x2: 4, y2: 0 },
      { x1: 4, y1: 0, x2: 4, y2: 1.5 },
      { x1: 4.02, y1: 1.5, x2: 4, y2: 3 },
      { x1: 4, y1: 3, x2: 2, y2: 3 },
      { x1: 1.99, y1: 3.01, x2: 0, y2: 3 },
      { x1: 0, y1: 3, x2: 0, y2: 0 },
    ];
    const outline = chainOutline(fragments)!;
    expect(outline.inferredClosingEdge).toBe(false);
    expect(area(outline.points)).toBeCloseTo(12, 1);
  });

  it("keeps an L-shaped room L-shaped", () => {
    // The whole point. A bounding box would report 12; the room is 9.
    const ell: ChainSegment[] = [
      { x1: 0, y1: 0, x2: 4, y2: 0 },
      { x1: 4, y1: 0, x2: 4, y2: 1.5 },
      { x1: 4, y1: 1.5, x2: 2, y2: 1.5 },
      { x1: 2, y1: 1.5, x2: 2, y2: 3 },
      { x1: 2, y1: 3, x2: 0, y2: 3 },
      { x1: 0, y1: 3, x2: 0, y2: 0 },
    ];
    const outline = chainOutline(ell)!;
    expect(outline.points).toHaveLength(6);
    expect(area(outline.points)).toBeCloseTo(9, 6);
    expect(area(outline.points)).not.toBeCloseTo(12, 1);
  });

  it("says when it had to guess the closing edge", () => {
    // Three sides of a rectangle. It can be closed, but the operator must be
    // told the fourth wall was never measured.
    const open: ChainSegment[] = [
      { x1: 0, y1: 0, x2: 4, y2: 0 },
      { x1: 4, y1: 0, x2: 4, y2: 3 },
      { x1: 4, y1: 3, x2: 0, y2: 3 },
    ];
    const outline = chainOutline(open)!;
    expect(outline.inferredClosingEdge).toBe(true);
    expect(outline.points).toHaveLength(4);
  });

  it("returns nothing for fragments that are not one room", () => {
    // Two walls here, one across the building. Chaining these would draw a
    // shape that exists nowhere.
    const scattered: ChainSegment[] = [
      { x1: 0, y1: 0, x2: 2, y2: 0 },
      { x1: 2, y1: 0, x2: 2, y2: 2 },
      { x1: 40, y1: 40, x2: 42, y2: 40 },
    ];
    expect(chainOutline(scattered)).toBeNull();
  });

  it("survives the fourteen-piece living room", () => {
    // Shaped like the owner's own scan: a rectangle whose every wall came
    // back in three overlapping pieces with sloppy joins.
    const messy: ChainSegment[] = [];
    const corners = [
      [0, 0],
      [6, 0],
      [6, 4],
      [0, 4],
    ];
    for (let i = 0; i < 4; i += 1) {
      const [ax, ay] = corners[i];
      const [bx, by] = corners[(i + 1) % 4];
      for (let k = 0; k < 3; k += 1) {
        const t0 = k / 3;
        const t1 = (k + 1) / 3 + (k < 2 ? 0.04 : 0);
        messy.push({
          x1: ax + (bx - ax) * t0,
          y1: ay + (by - ay) * t0,
          x2: ax + (bx - ax) * Math.min(t1, 1),
          y2: ay + (by - ay) * Math.min(t1, 1),
        });
      }
    }
    const outline = chainOutline(messy)!;
    expect(outline).not.toBeNull();
    expect(outline.inferredClosingEdge).toBe(false);
    expect(area(outline.points)).toBeCloseTo(24, 0);
  });
});
