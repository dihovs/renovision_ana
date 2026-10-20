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

describe("square corners (19 Oct 2026)", () => {
  const angleOf = (s: ChainSegment) => (Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180) / Math.PI;

  it("meets at the corner its walls describe, without tilting either", () => {
    // One wall stops 10 cm short of the corner, the other overshoots it. The
    // old weld dragged one end onto the other and tilted a 1 m return ~6°.
    const corner: ChainSegment[] = [
      { x1: 0, y1: 0, x2: 3.9, y2: 0 },
      { x1: 4, y1: -0.08, x2: 4, y2: 1 },
    ];
    const [a, b] = cleanedForChaining(corner);
    expect(angleOf(a)).toBeCloseTo(0, 9);
    expect(Math.abs(angleOf(b))).toBeCloseTo(90, 9);
    expect(a.x2).toBeCloseTo(4, 9);
    expect(b.y1).toBeCloseTo(0, 9);
  });

  it("lands a partition's end on the wall it butts into", () => {
    const tee: ChainSegment[] = [
      { x1: 0, y1: 0, x2: 6, y2: 0 },
      { x1: 2.5, y1: 0.12, x2: 2.5, y2: 2 },
    ];
    const [, partition] = cleanedForChaining(tee);
    expect(partition.x1).toBeCloseTo(2.5, 9);
    expect(partition.y1).toBeCloseTo(0, 9);
  });

  it("merges two halves of one wall onto one straight line", () => {
    // Halves measured 7 cm apart. Joining far end to far end slanted the
    // merged wall across both.
    const halves: ChainSegment[] = [
      { x1: 0, y1: 0.07, x2: 2.5, y2: 0.07 },
      { x1: 2.5, y1: 0, x2: 6, y2: 0 },
    ];
    const [wall] = cleanedForChaining(halves);
    expect(angleOf(wall)).toBeCloseTo(0, 9);
    expect(wall.y1).toBeCloseTo((0.07 * 2.5) / 6, 9);
    expect(Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)).toBeCloseTo(6, 9);
  });

  it("keeps a room's outline when its closet's partition is left over", () => {
    // An office with a closet in one corner and a notch in another, shaped
    // like the owner's "Private Office" scan. The closet's two partition
    // walls butt into the middle of the outside walls and are left over by
    // the walk; that used to throw the whole outline away on the web while
    // the phone drew it.
    const office: ChainSegment[] = [
      { x1: 5.9, y1: 0, x2: 5.9, y2: 4.7 },
      { x1: 2.4, y1: 0, x2: 5.9, y2: 0 },
      { x1: 0, y1: 0, x2: 2.4, y2: 0 },
      { x1: 0.4, y1: 3, x2: 0, y2: 3 },
      { x1: 0, y1: 1.8, x2: 0, y2: 0 },
      { x1: 0, y1: 1.8, x2: 2.4, y2: 1.8 },
      { x1: 5.9, y1: 4.7, x2: 0.4, y2: 4.7 },
      { x1: 0.4, y1: 4.7, x2: 0.4, y2: 3 },
      { x1: 2.4, y1: 1.8, x2: 2.4, y2: 0 },
      { x1: 0, y1: 3, x2: 0, y2: 1.8 },
    ];
    const outline = chainOutline(office, { weld: 0.25 })!;
    expect(outline).not.toBeNull();
    expect(outline.inferredClosingEdge).toBe(false);
    expect(outline.points).toHaveLength(6);
    expect(area(outline.points)).toBeCloseTo(5.9 * 4.7 - 0.4 * 1.7, 6);
  });
});

