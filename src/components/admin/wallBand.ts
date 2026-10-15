// The wall band of a room, drawn OUTSIDE its outline.
//
// A room's outline is the inside face of its walls — what a scan measures,
// what the phone draws, what every printed dimension measures to. The plan
// used to stroke a wall centred on that outline: half of every wall drawn
// inside the room, half outside. Two neighbours a wall's thickness apart
// therefore each drew their own band over the gap, and every shared wall
// printed about 1,6 times as thick as an outside wall. That was found on
// 14 Oct 2026 checking our Hymus plans against Polygon's sketch, where a
// wall is a pair of lines 4" apart standing outside the room; the owner then
// asked for every report to draw walls that way.
//
// Drawn outside, a room's band covers [face, face + T]. Two rooms a real
// wall apart cover the same strip from both sides, so the shared wall prints
// once at its true thickness, and a room's drawn floor is exactly the size
// its dimensions say.
//
// Built as filled pieces rather than a stroke: one quadrilateral per stretch
// of wall between openings, its outer corners taken from the outline offset
// by T, so outside corners mitre square, inside corners (an L's elbow)
// close without poking into the room, and a door is simply a stretch with
// no piece on it.

export type Pt = { x: number; y: number };
export type BandOpening = { x1: number; y1: number; x2: number; y2: number };

export type WallBand = {
  /** Filled pieces of wall, each a closed quadrilateral outside the room. */
  pieces: Pt[][];
  /** Per opening (same order as given): the outward unit normal of the edge
      it was cut from, or null when it lies on no edge of the outline — a
      scanned door the traced floor does not run under. A null opening has
      no gap in the band; the caller knocks it out the old way. */
  openingNormals: (Pt | null)[];
};

const EPS = 1e-6;
/** How far off an edge an opening may sit and still be "on" it, metres. */
const ON_EDGE = 0.06;

function clean(polygon: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of polygon) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1e-4) out.push(p);
  }
  if (out.length > 1) {
    const a = out[0];
    const z = out[out.length - 1];
    if (Math.hypot(a.x - z.x, a.y - z.y) <= 1e-4) out.pop();
  }
  return out;
}

function signedArea(polygon: Pt[]): number {
  let twice = 0;
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    twice += p.x * q.y - q.x * p.y;
  });
  return twice / 2;
}

type Edge = { p: Pt; q: Pt; L: number; ux: number; uy: number; out: Pt };

function edgesOf(ring: Pt[], area: number): Edge[] {
  const n = ring.length;
  return ring.map((p, i) => {
    const q = ring[(i + 1) % n];
    const L = Math.hypot(q.x - p.x, q.y - p.y);
    const ux = (q.x - p.x) / L;
    const uy = (q.y - p.y) / L;
    // Positive area: the interior lies to the left of each edge, so the
    // outside is to its right — whichever way y runs in these coordinates.
    const out = area > 0 ? { x: uy, y: -ux } : { x: -uy, y: ux };
    return { p, q, L, ux, uy, out };
  });
}

/** Corner i of the outline offset outward by T: where the offset lines of
    edge i-1 and edge i meet. */
function outerCorners(ring: Pt[], edges: Edge[], T: number): Pt[] {
  const n = ring.length;
  return ring.map((p, i) => {
    const a = edges[(i - 1 + n) % n];
    const b = edges[i];
    const pa = { x: a.p.x + a.out.x * T, y: a.p.y + a.out.y * T };
    const pb = { x: b.p.x + b.out.x * T, y: b.p.y + b.out.y * T };
    const cross = a.ux * b.uy - a.uy * b.ux;
    const fallback = { x: p.x + b.out.x * T, y: p.y + b.out.y * T };
    // Collinear (a long wall split at a door jamb) or a hairpin: no corner,
    // just the offset point.
    if (Math.abs(cross) < 1e-9) return fallback;
    const t = ((pb.x - pa.x) * b.uy - (pb.y - pa.y) * b.ux) / cross;
    const hit = { x: pa.x + a.ux * t, y: pa.y + a.uy * t };
    // A needle-sharp corner mitres off to infinity; cap it.
    return Math.hypot(hit.x - p.x, hit.y - p.y) > 4 * T ? fallback : hit;
  });
}

/** A room's outline grown by its wall: the wall band's outer edge. */
export function grownOutline(polygon: Pt[], thickness: number): Pt[] | null {
  const ring = clean(polygon);
  if (ring.length < 3) return null;
  const area = signedArea(ring);
  if (Math.abs(area) < EPS) return null;
  return outerCorners(ring, edgesOf(ring, area), thickness);
}

export type ExteriorRun = { x1: number; y1: number; x2: number; y2: number; out: Pt };

/**
 * **The building's outside face, as runs of wall.** The storey's rooms each
 * grown by their wall, merged, and the boundary kept where it faces the
 * outside — not a gap enclosed between rooms. Each run is one straight
 * stretch of outside face, the length the other firms' sketches print
 * outside the building (Polygon's `17' 3"`, `15' 11"`). Doors do not break a
 * run; corners do.
 *
 * Square-cornered plans only: the merge works on the grid the rooms' own
 * corners make. An outline with an angled wall returns null and the plan
 * simply goes without the outside chain.
 */
export function exteriorRuns(polygons: Pt[][], thickness: number): ExteriorRun[] | null {
  const grown = polygons.map((p) => grownOutline(p, thickness)).filter((p): p is Pt[] => p !== null);
  if (grown.length === 0) return null;
  const axisAligned = grown.every((ring) =>
    ring.every((p, i) => {
      const q = ring[(i + 1) % ring.length];
      return Math.abs(p.x - q.x) < 1e-4 || Math.abs(p.y - q.y) < 1e-4;
    }),
  );
  if (!axisAligned) return null;

  const key = (v: number) => Math.round(v * 1e5) / 1e5;
  const xs = [...new Set(grown.flatMap((ring) => ring.map((p) => key(p.x))))].sort((a, b) => a - b);
  const ys = [...new Set(grown.flatMap((ring) => ring.map((p) => key(p.y))))].sort((a, b) => a - b);
  const nx = xs.length - 1;
  const ny = ys.length - 1;
  if (nx < 1 || ny < 1) return null;

  const insideRing = (pt: Pt, ring: Pt[]) => {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
    }
    return hit;
  };
  // Cells padded by one empty ring all round, so "outside" is one region.
  const W = nx + 2;
  const H = ny + 2;
  const filled = new Uint8Array(W * H);
  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < ny; j += 1) {
      const c = { x: (xs[i] + xs[i + 1]) / 2, y: (ys[j] + ys[j + 1]) / 2 };
      if (grown.some((ring) => insideRing(c, ring))) filled[(j + 1) * W + (i + 1)] = 1;
    }
  }
  const outside = new Uint8Array(W * H);
  const stack = [0];
  outside[0] = 1;
  while (stack.length) {
    const k = stack.pop()!;
    const i = k % W;
    const j = Math.floor(k / W);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di;
      const b = j + dj;
      if (a < 0 || b < 0 || a >= W || b >= H) continue;
      const m = b * W + a;
      if (!filled[m] && !outside[m]) {
        outside[m] = 1;
        stack.push(m);
      }
    }
  }
  // Grid line coordinate of padded index: index 1..n+1 ↔ xs[0..n].
  const gx = (i: number) => xs[i - 1];
  const gy = (j: number) => ys[j - 1];
  const raw: ExteriorRun[] = [];
  for (let j = 1; j <= ny; j += 1) {
    for (let i = 1; i <= nx; i += 1) {
      if (!filled[j * W + i]) continue;
      if (outside[(j - 1) * W + i]) raw.push({ x1: gx(i), y1: gy(j), x2: gx(i + 1), y2: gy(j), out: { x: 0, y: -1 } });
      if (outside[(j + 1) * W + i]) raw.push({ x1: gx(i), y1: gy(j + 1), x2: gx(i + 1), y2: gy(j + 1), out: { x: 0, y: 1 } });
      if (outside[j * W + i - 1]) raw.push({ x1: gx(i), y1: gy(j), x2: gx(i), y2: gy(j + 1), out: { x: -1, y: 0 } });
      if (outside[j * W + i + 1]) raw.push({ x1: gx(i + 1), y1: gy(j), x2: gx(i + 1), y2: gy(j + 1), out: { x: 1, y: 0 } });
    }
  }
  // Merge pieces of one straight face into runs.
  const groups = new Map<string, ExteriorRun[]>();
  for (const e of raw) {
    const horizontal = e.y1 === e.y2;
    const k = `${horizontal ? "h" : "v"}:${horizontal ? e.y1 : e.x1}:${e.out.x}:${e.out.y}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }
  const runs: ExteriorRun[] = [];
  for (const [k, list] of groups) {
    const horizontal = k.startsWith("h");
    list.sort((a, b) => (horizontal ? a.x1 - b.x1 : a.y1 - b.y1));
    let cur = { ...list[0] };
    for (const e of list.slice(1)) {
      const touching = horizontal ? Math.abs(e.x1 - cur.x2) < 1e-6 : Math.abs(e.y1 - cur.y2) < 1e-6;
      if (touching) {
        cur = { ...cur, x2: e.x2, y2: e.y2 };
      } else {
        runs.push(cur);
        cur = { ...e };
      }
    }
    runs.push(cur);
  }
  return runs;
}

/**
 * The band, or null when there is no outline to build it from (fewer than
 * three distinct corners) — the caller keeps its old drawing then.
 *
 * `isOpenEdge` names edges with no wall on them (open sides into the next
 * room): they get no piece.
 */
export function wallBand(
  polygon: Pt[],
  thickness: number,
  openings: BandOpening[] = [],
  isOpenEdge: (a: Pt, b: Pt) => boolean = () => false,
): WallBand | null {
  const ring = clean(polygon);
  const n = ring.length;
  if (n < 3) return null;
  const area = signedArea(ring);
  if (Math.abs(area) < EPS) return null;
  const T = thickness;

  const edges = edgesOf(ring, area);

  const outer = outerCorners(ring, edges, T);

  const openingNormals: (Pt | null)[] = openings.map(() => null);
  const pieces: Pt[][] = [];

  edges.forEach((e, i) => {
    if (isOpenEdge(e.p, e.q)) return;
    // Openings on this edge, as [from, to] distances along it.
    const cuts: [number, number][] = [];
    openings.forEach((o, j) => {
      const off = (x: number, y: number) => Math.abs((x - e.p.x) * e.uy - (y - e.p.y) * e.ux);
      if (off(o.x1, o.y1) > ON_EDGE || off(o.x2, o.y2) > ON_EDGE) return;
      const t1 = (o.x1 - e.p.x) * e.ux + (o.y1 - e.p.y) * e.uy;
      const t2 = (o.x2 - e.p.x) * e.ux + (o.y2 - e.p.y) * e.uy;
      const lo = Math.max(0, Math.min(t1, t2));
      const hi = Math.min(e.L, Math.max(t1, t2));
      if (hi - lo < 0.02) return;
      cuts.push([lo, hi]);
      openingNormals[j] = e.out;
    });
    cuts.sort((a, b) => a[0] - b[0]);

    const stretches: [number, number][] = [];
    let at = 0;
    for (const [lo, hi] of cuts) {
      if (lo > at + 1e-4) stretches.push([at, lo]);
      at = Math.max(at, hi);
    }
    if (e.L > at + 1e-4) stretches.push([at, e.L]);

    for (const [a, b] of stretches) {
      const A = { x: e.p.x + e.ux * a, y: e.p.y + e.uy * a };
      const B = { x: e.p.x + e.ux * b, y: e.p.y + e.uy * b };
      const A2 = a <= 1e-4 ? outer[i] : { x: A.x + e.out.x * T, y: A.y + e.out.y * T };
      const B2 = b >= e.L - 1e-4 ? outer[(i + 1) % n] : { x: B.x + e.out.x * T, y: B.y + e.out.y * T };
      pieces.push([A, B, B2, A2]);
    }
  });

  return { pieces, openingNormals };
}

/** SVG path data for the pieces — one path, many closed sub-paths. */
export function bandPath(band: WallBand): string {
  return band.pieces
    .map((piece) => `M ${piece.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`)
    .join(" ");
}
