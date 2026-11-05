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
 *
 * The merged wall lies on ONE line — the longer piece's direction, at the
 * pieces' length-weighted offset — with the extremes projected onto it. It
 * used to run from one piece's far end to the other's, so two halves of a
 * wall measured 7 cm apart merged into a wall slanted across both (0,7° on
 * a 6 m wall, 19 Oct 2026): the commonest crooked edge in a scanned outline.
 */
function mergeCollinear(a: ChainSegment, b: ChainSegment): ChainSegment {
  const base = length(a) >= length(b) ? a : b;
  const dx = base.x2 - base.x1;
  const dy = base.y2 - base.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const project = (p: ChainPoint) => (p.x - base.x1) * ux + (p.y - base.y1) * uy;
  // Signed distance off the base line, along its left normal (-uy, ux).
  const across = (p: ChainPoint) => -(p.x - base.x1) * uy + (p.y - base.y1) * ux;

  const points = [
    { x: a.x1, y: a.y1 },
    { x: a.x2, y: a.y2 },
    { x: b.x1, y: b.y1 },
    { x: b.x2, y: b.y2 },
  ];
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of points) {
    const t = project(p);
    if (t < lo) lo = t;
    if (t > hi) hi = t;
  }
  const la = length(a);
  const lb = length(b);
  const mid = (s: ChainSegment) => ({ x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 });
  const offset = (across(mid(a)) * la + across(mid(b)) * lb) / (la + lb || 1);
  const at = (t: number) => ({ x: base.x1 + ux * t - uy * offset, y: base.y1 + uy * t + ux * offset });
  const p1 = at(lo);
  const p2 = at(hi);
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

/** Are these two pieces the same physical wall, seen twice or cut in two? */
function sameWall(a: ChainSegment, b: ChainSegment, weld: number): boolean {
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
  return bLo <= aHi + weld && aLo <= bHi + weld;
}

/** Below this angle two walls continue rather than turn a corner. */
const CORNER_MIN_DEG = 30;

/**
 * Bring each wall's end to the corner it is reaching for: the point where its
 * line crosses the line of the wall it meets.
 *
 * The weld that used to do this moved an end onto whichever corner point was
 * seen FIRST — the other wall's end. Two walls that stopped 10 cm apart at a
 * corner were joined by dragging one of them sideways, and a 1 m return
 * dragged 10 cm sits almost 6° out of square: the crooked rooms the owner
 * asked about on 19 Oct 2026. Sliding each end along its own line to the
 * crossing keeps every wall exactly the direction it was scanned in.
 *
 * Works for a T as well — a partition's end lands on the wall it butts into.
 * Computed from the untouched input, so the result does not depend on which
 * wall comes first. An end moves only when the crossing is within `weld` of
 * it and on (or within `weld` of) the other wall, and never so far that its
 * own wall would shrink below a wall's minimum length.
 */
function meetAtCorners(segments: ChainSegment[], weld: number, minLength: number): ChainSegment[] {
  const crossing = (a: ChainSegment, b: ChainSegment): ChainPoint | null => {
    const adx = a.x2 - a.x1;
    const ady = a.y2 - a.y1;
    const bdx = b.x2 - b.x1;
    const bdy = b.y2 - b.y1;
    const cross = adx * bdy - ady * bdx;
    if (Math.abs(cross) < 1e-12) return null;
    const t = ((b.x1 - a.x1) * bdy - (b.y1 - a.y1) * bdx) / cross;
    return { x: a.x1 + adx * t, y: a.y1 + ady * t };
  };
  const reach = (s: ChainSegment, end: ChainPoint): ChainPoint => {
    let best: ChainPoint = end;
    let bestDistance = weld;
    segments.forEach((other) => {
      if (other === s || angleBetween(s, other) < CORNER_MIN_DEG) return;
      const x = crossing(s, other);
      if (!x) return;
      const distance = Math.hypot(x.x - end.x, x.y - end.y);
      if (distance > bestDistance) return;
      const len = length(other);
      const along = ((x.x - other.x1) * (other.x2 - other.x1) + (x.y - other.y1) * (other.y2 - other.y1)) / len;
      if (along < -weld || along > len + weld) return;
      best = x;
      bestDistance = distance;
    });
    return best;
  };
  return segments.map((s) => {
    const a = reach(s, { x: s.x1, y: s.y1 });
    const b = reach(s, { x: s.x2, y: s.y2 });
    if (Math.hypot(b.x - a.x, b.y - a.y) < minLength) return s;
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
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
        if (sameWall(work[i], work[j], weld)) {
          const combined = mergeCollinear(work[i], work[j]);
          work = work.filter((_, k) => k !== i && k !== j);
          work.push(combined);
          merged = true;
          break outer;
        }
      }
    }
  }

  // 3. Meet at the corner the walls themselves describe: where their lines
  //    cross. Each end slides along its OWN wall, so no wall tilts.
  work = meetAtCorners(work, weld, minLength);

  // 4. Weld endpoints that are the same corner into one point, so the walk
  //    matches exactly instead of within a tolerance that can drift. After
  //    step 3 a real corner's ends already coincide; this catches the rest
  //    (two walls continuing at a slight angle, which have no corner).
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

    // A piece that connects to nothing is not dragged in from across the
    // room — but neither does it veto the walls already walked. The walk
    // stops at the gap and keeps what it has, as the phone's twin does
    // (`outlineWithClosure`): a closet's partition, butting into the middle
    // of a wall, is left over on every room scanned with its closet, and
    // throwing the whole outline away for it left the report with no floor
    // for a room the phone drew fine (the Private Office, 19 Oct 2026).
    if (bestIndex < 0 || bestDistance > weld || !bestEnd) break;
    remaining.splice(bestIndex, 1);
    points.push(bestEnd);
  }

  // Only if the walk described the room: most of the wall length, and more
  // than a corner. Three segments of twenty closed into a confident triangle
  // is the failure this whole module exists to prevent.
  const walked = points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
  const total = cleaned.reduce((sum, s) => sum + length(s), 0);
  if (total <= 0 || walked < total * 0.6 || points.length < 4) return null;

  const start = points[0];
  const end = points[points.length - 1];
  if (Math.hypot(end.x - start.x, end.y - start.y) <= weld) {
    // The last point IS the first; carrying both leaves a zero-length edge.
    return { points: points.slice(0, -1), inferredClosingEdge: false };
  }
  return { points, inferredClosingEdge: true };
}
