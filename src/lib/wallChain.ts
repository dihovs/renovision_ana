/**
 * Turning scanned wall pieces into a room outline.
 *
 * # Why this exists
 *
 * RoomPlan does not hand back one segment per wall. It hands back what it
 * saw: a long wall arrives as two or three collinear pieces with millimetre
 * gaps, a doorway leaves a stub, and a wall observed twice from different
 * angles arrives twice, slightly apart. A six-metre living room routinely
 * comes back as fourteen "walls".
 *
 * The old chainer walked those pieces nearest-end-to-nearest-end and gave up
 * the moment one of them did not connect within tolerance. On real scans it
 * gave up often — and the consequence was not a missing outline, it was a
 * SILENT LIE: with no polygon, the editor fell back to the bounding box, so a
 * room with a nook was drawn as a clean rectangle. Nobody was told. The nook
 * you would never have been paid for simply was not on the plan.
 *
 * So the fix is not a looser tolerance. It is to clean the input first —
 * drop the noise, merge the pieces that are one wall, weld the corners — and
 * only then walk it. And when it still does not close, to say so rather than
 * quietly square the room off.
 *
 * Everything here is pure and in metres. The Swift twin is
 * `FloorPlanGeometry.cleanedForChaining` in
 * ios/App/App/Native/FloorPlanGeometry.swift; the two must not diverge, since
 * a room that closes on the phone and not in the report is worse than one
 * that closes in neither.
 */

export type ChainSegment = { x1: number; y1: number; x2: number; y2: number };
export type ChainPoint = { x: number; y: number };

/** Shorter than this is not a wall. A doorway stub or a scan artefact. */
export const MIN_WALL_M = 0.12;

/** Two endpoints closer than this are one corner. */
export const WELD_M = 0.30;

/** Beyond this out-of-line, two collinear-looking pieces are different walls. */
const COLLINEAR_OFFSET_M = 0.12;

/** Degrees within which two segments count as the same direction. */
const COLLINEAR_ANGLE_DEG = 8;

const length = (s: ChainSegment) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1);

/** Smallest angle between two undirected lines, in degrees (0…90). */
function angleBetween(a: ChainSegment, b: ChainSegment): number {
  const a1 = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
  const a2 = Math.atan2(b.y2 - b.y1, b.x2 - b.x1);
  let d = Math.abs(a1 - a2) % Math.PI;
  if (d > Math.PI / 2) d = Math.PI - d;
  return (d * 180) / Math.PI;
}

/** Perpendicular distance from a point to the infinite line through a segment. */
function offsetFromLine(s: ChainSegment, p: ChainPoint): number {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - s.x1, p.y - s.y1);
  return Math.abs(dy * (p.x - s.x1) - dx * (p.y - s.y1)) / len;
}

/**
 * Merge two collinear pieces into the single wall they came from.
 *
 * Both are projected onto the longer one's direction and the extremes kept,
 * so two overlapping observations of one wall become one wall of the right
 * length rather than a wall of their summed lengths.
 */
function mergeCollinear(a: ChainSegment, b: ChainSegment): ChainSegment {
  const base = length(a) >= length(b) ? a : b;
  const dx = base.x2 - base.x1;
  const dy = base.y2 - base.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const project = (p: ChainPoint) => (p.x - base.x1) * ux + (p.y - base.y1) * uy;

  const points = [
    { x: a.x1, y: a.y1 },
    { x: a.x2, y: a.y2 },
    { x: b.x1, y: b.y1 },
    { x: b.x2, y: b.y2 },
  ];
  let lo = Infinity;
  let hi = -Infinity;
  let loPoint = points[0];
  let hiPoint = points[0];
  for (const p of points) {
    const t = project(p);
    if (t < lo) {
      lo = t;
      loPoint = p;
    }
    if (t > hi) {
      hi = t;
      hiPoint = p;
    }
  }
  return { x1: loPoint.x, y1: loPoint.y, x2: hiPoint.x, y2: hiPoint.y };
}

/** Are these two pieces the same physical wall, seen twice or cut in two? */
function sameWall(a: ChainSegment, b: ChainSegment): boolean {
  if (angleBetween(a, b) > COLLINEAR_ANGLE_DEG) return false;
  // Both ends of b have to sit on a's line, or they are parallel neighbours —
  // the two sides of a partition, which must never be merged into one.
  if (offsetFromLine(a, { x: b.x1, y: b.y1 }) > COLLINEAR_OFFSET_M) return false;
  if (offsetFromLine(a, { x: b.x2, y: b.y2 }) > COLLINEAR_OFFSET_M) return false;

  // Collinear but far apart along the line are two walls with a gap, not one
  // wall: think of a room open to a hallway. Touching-or-overlapping only.
  const dx = a.x2 - a.x1;
  const dy = a.y2 - a.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const project = (p: ChainPoint) => (p.x - a.x1) * ux + (p.y - a.y1) * uy;
  const aLo = 0;
  const aHi = len;
  const bs = [project({ x: b.x1, y: b.y1 }), project({ x: b.x2, y: b.y2 })];
  const bLo = Math.min(...bs);
  const bHi = Math.max(...bs);
  return bLo <= aHi + WELD_M && aLo <= bHi + WELD_M;
}

/**
 * The cleaning pass: drop noise, merge one-wall-in-pieces, weld near corners.
 *
 * Order matters. Merging before welding means two halves of a wall become one
 * before their shared midpoint can be mistaken for a corner; welding after
 * means the corners that remain are real ones.
 */
export function cleanedForChaining(
  segments: ChainSegment[],
  options: { minLength?: number; weld?: number } = {},
): ChainSegment[] {
  const minLength = options.minLength ?? MIN_WALL_M;
  const weld = options.weld ?? WELD_M;

  // 1. Anything too short to be a wall.
  let work = segments.filter((s) => length(s) >= minLength);

  // 2. Merge collinear pieces, repeatedly: merging two can make the result
  //    collinear with a third, and one pass would leave that behind.
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < work.length; i += 1) {
      for (let j = i + 1; j < work.length; j += 1) {
        if (sameWall(work[i], work[j])) {
          const combined = mergeCollinear(work[i], work[j]);
          work = work.filter((_, k) => k !== i && k !== j);
          work.push(combined);
          merged = true;
          break outer;
        }
      }
    }
  }

  // 3. Weld endpoints that are the same corner into one point, so the walk
  //    matches exactly instead of within a tolerance that can drift.
  const corners: ChainPoint[] = [];
  const snap = (p: ChainPoint): ChainPoint => {
    for (const c of corners) {
      if (Math.hypot(c.x - p.x, c.y - p.y) <= weld) return c;
    }
    corners.push(p);
    return p;
  };
  return work.map((s) => {
    const a = snap({ x: s.x1, y: s.y1 });
    const b = snap({ x: s.x2, y: s.y2 });
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
}

export type Outline = {
  points: ChainPoint[];
  /** True when the walk had to invent the final edge to get home. */
  inferredClosingEdge: boolean;
};

/**
 * Walk cleaned segments into an outline.
 *
 * The walk itself is unchanged in spirit — take the nearest unused endpoint —
 * but it runs on welded corners, so "nearest" is usually exact, and it
 * reports whether it had to guess the last edge rather than pretending.
 */
export function chainOutline(
  segments: ChainSegment[],
  options: { weld?: number } = {},
): Outline | null {
  const weld = options.weld ?? WELD_M;
  const cleaned = cleanedForChaining(segments, { weld });
  if (cleaned.length < 3) return null;

  const remaining = cleaned.slice(1);
  const points: ChainPoint[] = [
    { x: cleaned[0].x1, y: cleaned[0].y1 },
    { x: cleaned[0].x2, y: cleaned[0].y2 },
  ];

  while (remaining.length > 0) {
    const tail = points[points.length - 1];
    let bestIndex = -1;
    let bestDistance = Infinity;
    let bestEnd: ChainPoint | null = null;

    remaining.forEach((segment, index) => {
      const start = { x: segment.x1, y: segment.y1 };
      const end = { x: segment.x2, y: segment.y2 };
      const toStart = Math.hypot(start.x - tail.x, start.y - tail.y);
      const toEnd = Math.hypot(end.x - tail.x, end.y - tail.y);
      if (toStart < bestDistance) {
        bestDistance = toStart;
        bestIndex = index;
        bestEnd = end;
      }
      if (toEnd < bestDistance) {
        bestDistance = toEnd;
        bestIndex = index;
        bestEnd = start;
      }
    });

    // A piece that connects to nothing is a fragment, not a missing edge.
    // Stop and report what closed; do not drag it in from across the room.
    if (bestIndex < 0 || bestDistance > weld || !bestEnd) return null;
    remaining.splice(bestIndex, 1);
    points.push(bestEnd);
  }

  const start = points[0];
  const end = points[points.length - 1];
  if (Math.hypot(end.x - start.x, end.y - start.y) <= weld) {
    // The last point IS the first; carrying both leaves a zero-length edge.
    return { points: points.slice(0, -1), inferredClosingEdge: false };
  }
  return { points, inferredClosingEdge: true };
}
