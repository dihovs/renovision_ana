// **One wall per pair of facing edges** — the TypeScript twin of the phone's
// `StoreyWalls` (ios/App/App/Native/StoreyViewport.swift). The two must not
// diverge: a plan that drew its walls one way on the phone and another in the
// report would be worse than either.
//
// `wallBand.ts` grows every room by its own wall, outward. That is right for
// a room standing alone, and wrong on a storey: two rooms 6 cm apart each
// drew a full partition into the gap and on into the other's floor, and the
// outside skin printed at the partition's thickness. Here the edge facing
// each stretch of wall is FOUND (anti-parallel within 3°, overlapping along
// it), the gap is measured, and both rooms draw the same one wall from it:
//
// - gap of at least ¾ of a partition — the wall fills the gap exactly;
// - a smaller gap, flush included — one partition centred in the gap;
// - nothing facing within an exterior wall's reach — the outside, drawn at
//   the floor's EXTERIOR thickness.
//
// Corners take the crossing of the two walls' far faces, each with its own
// thickness (magicplan's corner rule), so an outside wall meeting a thinner
// partition neither pokes a stub past it nor leaves a notch.

export type Pt = { x: number; y: number };
export type Kind = "shared" | "partition" | "exterior";

export type Section = { kind: Kind; near: number; far: number };

export type Run = {
  a: Pt;
  b: Pt;
  out: Pt;
  kind: Kind;
  near: number;
  far: number;
  pastA: number;
  pastB: number;
  trimA: number;
  trimB: number;
};

function clean(polygon: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of polygon) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1e-6) out.push(p);
  }
  if (out.length > 1) {
    const a = out[0];
    const z = out[out.length - 1];
    if (Math.hypot(a.x - z.x, a.y - z.y) <= 1e-6) out.pop();
  }
  return out;
}

function signedArea(ring: Pt[]): number {
  let twice = 0;
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length];
    twice += p.x * q.y - q.x * p.y;
  });
  return twice / 2;
}

function contains(ring: Pt[], pt: Pt): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** The wall behind one point of a room's edge. */
export function section(
  point: Pt,
  u: Pt,
  out: Pt,
  others: Pt[][],
  interior: number,
  exterior: number,
): Section {
  const reach = exterior + 0.05;
  let best: number | null = null;
  for (const polygon of others) {
    const n = polygon.length;
    for (let j = 0; j < n; j += 1) {
      const c = polygon[j];
      const d = polygon[(j + 1) % n];
      const length = Math.hypot(d.x - c.x, d.y - c.y);
      if (length <= 0.05) continue;
      const w = { x: (d.x - c.x) / length, y: (d.y - c.y) / length };
      if (u.x * w.x + u.y * w.y >= -0.9986) continue;
      const along = (point.x - c.x) * w.x + (point.y - c.y) * w.y;
      if (along <= -0.01 || along >= length + 0.01) continue;
      const gap = (c.x - point.x) * out.x + (c.y - point.y) * out.y;
      if (gap <= -0.03 || gap >= reach) continue;
      if (best === null || Math.abs(gap) < Math.abs(best)) best = gap;
    }
  }
  if (best !== null) {
    if (best >= interior * 0.75) return { kind: "partition", near: 0, far: best };
    const middle = Math.max(best, 0) / 2;
    return { kind: "shared", near: middle - interior / 2, far: middle + interior / 2 };
  }
  const behind = (distance: number) => {
    const probe = { x: point.x + out.x * distance, y: point.y + out.y * distance };
    return others.some((ring) => contains(ring, probe));
  };
  if (behind(0.02)) return { kind: "shared", near: -interior / 2, far: interior / 2 };
  if (behind(interior + 0.05)) return { kind: "partition", near: 0, far: interior };
  return { kind: "exterior", near: 0, far: exterior };
}

/** How far a band runs on past its end for its far face to meet the next
    wall's far face; negative where the corner turns in. */
export function runOn(u: Pt, n: Pt, m: Pt, t1: number, t2: number): number {
  const um = u.x * m.x + u.y * m.y;
  if (Math.abs(um) <= 0.02) return 0;
  const nm = n.x * m.x + n.y * m.y;
  const s = (t2 - t1 * nm) / um;
  const cap = 3 * Math.max(t1, t2);
  return Math.max(-cap, Math.min(cap, s));
}

const same = (a: Section, b: Section) =>
  a.kind === b.kind && Math.abs(a.near - b.near) < 1e-9 && Math.abs(a.far - b.far) < 1e-9;

/**
 * Every run of wall around room `index`. `polygons` are every room on the
 * storey in FLOOR metres; runs come back in the room's own metres, `origin`
 * being where its own metres sit on the floor. `isOpenEdge` (room metres)
 * names edges with no wall — they get no run.
 */
export function runs(
  index: number,
  polygons: Pt[][],
  origin: Pt,
  interior: number,
  exterior: number,
  isOpenEdge: (a: Pt, b: Pt) => boolean = () => false,
  step = 0.05,
): Run[] {
  const rings = polygons.map(clean);
  const polygon = rings[index];
  if (!polygon || polygon.length < 3) return [];
  const area = signedArea(polygon);
  if (Math.abs(area) < 1e-9) return [];
  const others = rings.filter((r, k) => k !== index && r.length >= 3);
  const count = polygon.length;
  const local = (p: Pt) => ({ x: p.x - origin.x, y: p.y - origin.y });

  type Edge = { a: Pt; b: Pt; u: Pt; out: Pt; length: number; sections: Section[]; open: boolean };
  const edges: (Edge | null)[] = polygon.map((a, i) => {
    const b = polygon[(i + 1) % count];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length <= 1e-6) return null;
    const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    // Positive area: interior to the left, so outside to the right.
    const out = area > 0 ? { x: u.y, y: -u.x } : { x: -u.y, y: u.x };
    const pieces = Math.max(1, Math.ceil(length / step));
    const sections = Array.from({ length: pieces }, (_, k) => {
      const t = ((k + 0.5) / pieces) * length;
      return section({ x: a.x + u.x * t, y: a.y + u.y * t }, u, out, others, interior, exterior);
    });
    return { a, b, u, out, length, sections, open: isOpenEdge(local(a), local(b)) };
  });
  const neighbour = (i: number, dir: number): Edge | null => {
    let j = i;
    for (let k = 0; k < count; k += 1) {
      j = (j + dir + count) % count;
      if (edges[j]) return edges[j];
    }
    return null;
  };

  const result: Run[] = [];
  edges.forEach((edge, i) => {
    if (!edge || edge.open) return;
    const pieces = edge.sections.length;
    const prev = neighbour(i, -1);
    const next = neighbour(i, 1);
    let start = 0;
    while (start < pieces) {
      let end = start;
      while (end + 1 < pieces && same(edge.sections[end + 1], edge.sections[start])) end += 1;
      const s0 = (start / pieces) * edge.length;
      const s1 = ((end + 1) / pieces) * edge.length;
      const here = edge.sections[start];
      let pastA = 0;
      let pastB = 0;
      let trimA = 0;
      let trimB = 0;
      if (here.kind !== "shared") {
        // Beside an open side the wall ends square on its line.
        if (start === 0 && prev && !prev.open) {
          const theirs = prev.sections[prev.sections.length - 1];
          const s = runOn({ x: -edge.u.x, y: -edge.u.y }, edge.out, prev.out, here.far, theirs.far);
          if (s > 0) pastA = s;
          else trimA = Math.min(-s, (s1 - s0) / 2);
        }
        if (end === pieces - 1 && next && !next.open) {
          const theirs = next.sections[0];
          const s = runOn(edge.u, edge.out, next.out, here.far, theirs.far);
          if (s > 0) pastB = s;
          else trimB = Math.min(-s, (s1 - s0) / 2);
        }
      }
      result.push({
        a: local({ x: edge.a.x + edge.u.x * s0, y: edge.a.y + edge.u.y * s0 }),
        b: local({ x: edge.a.x + edge.u.x * s1, y: edge.a.y + edge.u.y * s1 }),
        out: edge.out,
        kind: here.kind,
        near: here.near,
        far: here.far,
        pastA,
        pastB,
        trimA,
        trimB,
      });
      start = end + 1;
    }
  });
  return result;
}

/** The band of one run as four points. */
export function band(run: Run): Pt[] {
  const length = Math.hypot(run.b.x - run.a.x, run.b.y - run.a.y);
  if (length <= 1e-9) return [];
  const u = { x: (run.b.x - run.a.x) / length, y: (run.b.y - run.a.y) / length };
  const start = { x: run.a.x - u.x * run.pastA, y: run.a.y - u.y * run.pastA };
  const end = { x: run.b.x + u.x * run.pastB, y: run.b.y + u.y * run.pastB };
  const farStart = { x: start.x + u.x * run.trimA, y: start.y + u.y * run.trimA };
  const farEnd = { x: end.x - u.x * run.trimB, y: end.y - u.y * run.trimB };
  const o = run.out;
  return [
    { x: start.x + o.x * run.near, y: start.y + o.y * run.near },
    { x: end.x + o.x * run.near, y: end.y + o.y * run.near },
    { x: farEnd.x + o.x * run.far, y: farEnd.y + o.y * run.far },
    { x: farStart.x + o.x * run.far, y: farStart.y + o.y * run.far },
  ];
}

/** Where an opening sits in the wall: its two faces, and the outward normal
    of the run it was cut from — what a door's jambs and leaf are drawn from.
    Null when it lies on no run. */
export type OpeningFaces = { out: Pt; near: number; far: number } | null;

const ON_EDGE = 0.06;

/**
 * The runs as one SVG path with each opening cut out of the run it sits on,
 * every quad wound the same way so a single fill paints them all without a
 * seam at the mitres. Also returns, per opening, the wall it was cut from.
 */
export function runsPath(
  all: Run[],
  openings: { x1: number; y1: number; x2: number; y2: number }[] = [],
): { d: string; faces: OpeningFaces[] } {
  const faces: OpeningFaces[] = openings.map(() => null);
  const quads: Pt[][] = [];
  for (const run of all) {
    const length = Math.hypot(run.b.x - run.a.x, run.b.y - run.a.y);
    if (length <= 1e-9) continue;
    const u = { x: (run.b.x - run.a.x) / length, y: (run.b.y - run.a.y) / length };
    const cuts: [number, number][] = [];
    openings.forEach((o, j) => {
      const off = (x: number, y: number) => Math.abs((x - run.a.x) * u.y - (y - run.a.y) * u.x);
      if (off(o.x1, o.y1) > ON_EDGE || off(o.x2, o.y2) > ON_EDGE) return;
      const t1 = (o.x1 - run.a.x) * u.x + (o.y1 - run.a.y) * u.y;
      const t2 = (o.x2 - run.a.x) * u.x + (o.y2 - run.a.y) * u.y;
      const lo = Math.max(0, Math.min(t1, t2));
      const hi = Math.min(length, Math.max(t1, t2));
      if (hi - lo < 0.02) return;
      cuts.push([lo, hi]);
      faces[j] = { out: run.out, near: run.near, far: run.far };
    });
    if (cuts.length === 0) {
      quads.push(band(run));
      continue;
    }
    cuts.sort((p, q) => p[0] - q[0]);
    let at = 0;
    const stretches: [number, number][] = [];
    for (const [lo, hi] of cuts) {
      if (lo > at + 1e-4) stretches.push([at, lo]);
      at = Math.max(at, hi);
    }
    if (length > at + 1e-4) stretches.push([at, length]);
    for (const [s0, s1] of stretches) {
      const first = s0 <= 1e-4;
      const last = s1 >= length - 1e-4;
      quads.push(
        band({
          ...run,
          a: { x: run.a.x + u.x * s0, y: run.a.y + u.y * s0 },
          b: { x: run.a.x + u.x * s1, y: run.a.y + u.y * s1 },
          pastA: first ? run.pastA : 0,
          trimA: first ? run.trimA : 0,
          pastB: last ? run.pastB : 0,
          trimB: last ? run.trimB : 0,
        }),
      );
    }
  }
  const d = quads
    .filter((q) => q.length === 4)
    .map((q) => {
      let twice = 0;
      for (let i = 0; i < 4; i += 1) twice += q[i].x * q[(i + 1) % 4].y - q[(i + 1) % 4].x * q[i].y;
      const wound = twice < 0 ? [...q].reverse() : q;
      return `M ${wound.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`;
    })
    .join(" ");
  return { d, faces };
}
