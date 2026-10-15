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

  const edges = ring.map((p, i) => {
    const q = ring[(i + 1) % n];
    const L = Math.hypot(q.x - p.x, q.y - p.y);
    const ux = (q.x - p.x) / L;
    const uy = (q.y - p.y) / L;
    // Positive area: the interior lies to the left of each edge, so the
    // outside is to its right — whichever way y runs in these coordinates.
    const out = area > 0 ? { x: uy, y: -ux } : { x: -uy, y: ux };
    return { p, q, L, ux, uy, out };
  });

  // Outer corner i: where the offset lines of edge i-1 and edge i meet.
  const outer = ring.map((p, i) => {
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
