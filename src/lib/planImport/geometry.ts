import { parsePrintedSize } from "./lengths";

/**
 * The geometry half of plan import: everything after a model has said what
 * is on the drawing and roughly where, done in code because code is exact
 * and the model is not.
 *
 * The method is the one worked out by hand on the owner's two reference
 * plans (11 Oct 2026), turned into an algorithm:
 *
 * 1. **Snap every wall to the ink.** The model's corners are within a few
 *    pixels. The drawing's walls are exact. Each edge of each room is moved
 *    to the nearest place where the room's white interior meets a dark wall.
 * 2. **Scale from the printed sizes, not the other way round.** Every room
 *    with a label gives a pixels-per-metre estimate; the median of the ones
 *    that agree is the drawing's scale. The printed numbers are NOT then
 *    forced back onto the rooms: on the second reference plan Bedroom 2 is
 *    labelled 11'-6" and the Foyer and Dining 11'-0", yet all three are drawn
 *    the same depth — typing the labels made the Foyer and Dining six inches
 *    short and left a gap under them at the porch. The drawing is consistent;
 *    the labels are not always. A disagreement is reported, not "fixed".
 * 3. **Line up what lines up.** Faces that land within a few centimetres of
 *    each other are made identical, so three rooms that share a back wall
 *    share it exactly and the floor has no hairline steps.
 * 4. **Doors and windows go on the walls they sit in**, in every room whose
 *    wall they pierce — a bedroom door is in the bedroom's wall and the
 *    hall's.
 */

export type Point = { x: number; y: number };

/** A greyscale drawing reduced to ink and paper. */
export type Mask = { width: number; height: number; dark: Uint8Array };

export type ExtractedRoom = {
  name: string;
  roomType: string;
  printedSize: string | null;
  ceilingHeight: number | null;
  outdoor: boolean;
  /** Interior corners, in image pixels. */
  polygon: Point[];
};

export type ExtractedOpening = {
  kind: string;
  /** The opening's two jambs, in image pixels. */
  a: Point;
  b: Point;
};

export type ImportedOpening = { edge: number; offset: number; width: number; kind: string };

export type ImportedRoom = {
  name: string;
  roomType: string;
  outdoor: boolean;
  ceilingHeightM: number | null;
  /** Interior outline in the room's own metres, its min corner at 0,0. */
  polygon: Point[];
  /** Where that min corner sits on the floor, metres. */
  planX: number;
  planY: number;
  openings: ImportedOpening[];
  printedSize: string | null;
  /** Said when the drawing and the label disagree, or the walls could not be found. */
  note: string | null;
};

// ---------------------------------------------------------------- snapping

function coverage(mask: Mask, horizontal: boolean, line: number, from: number, to: number): number {
  const limit = horizontal ? mask.height : mask.width;
  if (line < 0 || line >= limit) return 0;
  const start = Math.max(0, Math.floor(from));
  const end = Math.min(horizontal ? mask.width : mask.height, Math.ceil(to));
  if (end - start < 2) return 0;
  let dark = 0;
  for (let i = start; i < end; i++) {
    const index = horizontal ? line * mask.width + i : i * mask.width + line;
    dark += mask.dark[index];
  }
  return dark / (end - start);
}

export function signedArea(polygon: Point[]): number {
  let twice = 0;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    twice += p.x * q.y - q.x * p.y;
  }
  return twice / 2;
}

/**
 * Move each axis-aligned edge to the inside face of its wall — the boundary
 * where the room's interior gives way to ink — searched within `reach` of
 * where the model put it.
 *
 * Scored as a step, not tested against fixed amounts: the ink just outside
 * the boundary (two lines of it, so a thick wall beats a hairline) minus the
 * ink just inside, with a mild preference for staying close. Fixed
 * thresholds failed on exactly the rooms that matter: a great room whose back
 * wall is mostly French doors carries 29% ink, and a kitchen's counters sit
 * right against its wall so its "white" interior is a third ink. A step of
 * at least 0.15 counts; an edge with none in reach — an open side, a wall that
 * is one long garage door — is left for `alignLooseEdges`.
 *
 * Only the middle 70% of each edge is sampled: the ends run into the walls
 * of the next room and would read as wall everywhere.
 */
export function snapPolygon(
  mask: Mask,
  polygon: Point[],
  reach: number,
): { polygon: Point[]; snapped: number; edgeSnapped: boolean[] } {
  const n = polygon.length;
  const edgeSnapped = new Array<boolean>(n).fill(false);
  if (n < 3) return { polygon, snapped: 0, edgeSnapped };
  // Screen coordinates, y down: positive area means clockwise on screen, and
  // the interior is then on the right of each edge's direction.
  const clockwise = signedArea(polygon) > 0;
  const result = polygon.map((p) => ({ ...p }));
  let snapped = 0;

  for (let i = 0; i < n; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % n];
    const horizontal = Math.abs(q.y - p.y) < Math.abs(q.x - p.x) * 0.1;
    const vertical = Math.abs(q.x - p.x) < Math.abs(q.y - p.y) * 0.1;
    if (!horizontal && !vertical) continue;

    const dx = q.x - p.x;
    const dy = q.y - p.y;
    // Right-hand normal (interior side for a clockwise outline).
    const inward = horizontal ? Math.sign(clockwise ? dx : -dx) : Math.sign(clockwise ? -dy : dy);
    const along0 = horizontal ? Math.min(p.x, q.x) : Math.min(p.y, q.y);
    const along1 = horizontal ? Math.max(p.x, q.x) : Math.max(p.y, q.y);
    const inset = (along1 - along0) * 0.15;
    const at = Math.round(horizontal ? (p.y + q.y) / 2 : (p.x + q.x) / 2);
    const ink = (line: number) => coverage(mask, horizontal, line, along0 + inset, along1 - inset);

    let best: { boundary: number; value: number } | null = null;
    for (let d = -reach; d <= reach; d++) {
      const boundary = at + d;
      // The first interior pixel line, and the first wall line beyond it.
      const interiorLine = inward > 0 ? boundary : boundary - 1;
      const wallLine = inward > 0 ? boundary - 1 : boundary;
      const outside = ink(wallLine) * 0.6 + ink(wallLine - inward) * 0.4;
      const inside = (ink(interiorLine) + ink(interiorLine + inward)) / 2;
      const step = outside - inside;
      if (step < 0.15) continue;
      const value = step - (0.3 * Math.abs(d)) / reach;
      if (!best || value > best.value) best = { boundary, value };
    }
    if (!best) continue;
    snapped++;
    edgeSnapped[i] = true;
    if (horizontal) {
      result[i].y = best.boundary;
      result[(i + 1) % n].y = best.boundary;
    } else {
      result[i].x = best.boundary;
      result[(i + 1) % n].x = best.boundary;
    }
  }
  return { polygon: result, snapped, edgeSnapped };
}

/**
 * Edges that found no wall of their own take the nearest wall another room
 * DID find, along the same axis and within `reach`.
 *
 * Two cases, one rule. An open side between two rooms — a great room open to
 * its foyer — has the neighbour's facing edge right there, and an open join
 * is exactly two rooms meeting with nothing between. A wall that is nearly all
 * garage door has, somewhere along the same line, the rest of the house's
 * outside wall, and the garage's side is that line.
 */
export function alignLooseEdges(
  rooms: { polygon: Point[]; edgeSnapped: boolean[] }[],
  reach: number,
  alongLimit: number,
): Point[][] {
  type Face = { horizontal: boolean; at: number; from: number; to: number };
  const faceOf = (poly: Point[], i: number): Face | null => {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    if (Math.abs(q.y - p.y) < 0.5) return { horizontal: true, at: p.y, from: Math.min(p.x, q.x), to: Math.max(p.x, q.x) };
    if (Math.abs(q.x - p.x) < 0.5) return { horizontal: false, at: p.x, from: Math.min(p.y, q.y), to: Math.max(p.y, q.y) };
    return null;
  };
  const found: Face[] = [];
  rooms.forEach((room) =>
    room.polygon.forEach((_, i) => {
      if (!room.edgeSnapped[i]) return;
      const face = faceOf(room.polygon, i);
      if (face) found.push(face);
    }),
  );

  return rooms.map((room) => {
    const poly = room.polygon.map((p) => ({ ...p }));
    room.polygon.forEach((_, i) => {
      if (room.edgeSnapped[i]) return;
      const face = faceOf(room.polygon, i);
      if (!face) return;
      let nearest: { at: number; distance: number } | null = null;
      for (const other of found) {
        if (other.horizontal !== face.horizontal) continue;
        const distance = Math.abs(other.at - face.at);
        if (distance > reach || distance < 0.01) continue;
        // How far apart along the line: overlapping spans are 0.
        const gap = Math.max(0, Math.max(other.from, face.from) - Math.min(other.to, face.to));
        if (gap > alongLimit) continue;
        if (!nearest || distance < nearest.distance) nearest = { at: other.at, distance };
      }
      if (!nearest) return;
      const j = (i + 1) % poly.length;
      if (face.horizontal) poly[i].y = poly[j].y = nearest.at;
      else poly[i].x = poly[j].x = nearest.at;
    });
    return poly;
  });
}

// ---------------------------------------------------------------- scale

function bounds(polygon: Point[]) {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Pixels per metre, from every room whose printed size fits its drawn box.
 * Which printed number is the width is decided by which assignment agrees
 * with itself — plans print "12-10 x 11-6" in either order.
 */
export function estimateScale(rooms: { polygon: Point[]; printedSize: string | null }[]): number | null {
  const estimates: number[] = [];
  for (const room of rooms) {
    const printed = parsePrintedSize(room.printedSize);
    if (!printed || room.polygon.length !== 4) continue;
    const box = bounds(room.polygon);
    const w = box.maxX - box.minX;
    const h = box.maxY - box.minY;
    if (w < 4 || h < 4) continue;
    const [a, b] = printed;
    const straight = [w / a, h / b];
    const turned = [w / b, h / a];
    const spread = (pair: number[]) => Math.abs(Math.log(pair[0] / pair[1]));
    const pair = spread(straight) <= spread(turned) ? straight : turned;
    if (spread(pair) > 0.12) continue;
    estimates.push(...pair);
  }
  if (estimates.length === 0) return null;
  const first = median(estimates);
  const agreeing = estimates.filter((e) => Math.abs(e / first - 1) < 0.08);
  return median(agreeing.length ? agreeing : estimates);
}

// ---------------------------------------------------------------- alignment

/** Make coordinates within `tolerance` of each other identical. */
export function alignValues(values: number[], tolerance: number): Map<number, number> {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const out = new Map<number, number>();
  let group: number[] = [];
  const flush = () => {
    if (!group.length) return;
    const mean = group.reduce((s, v) => s + v, 0) / group.length;
    for (const v of group) out.set(v, mean);
    group = [];
  };
  for (const v of sorted) {
    if (group.length && v - group[group.length - 1] > tolerance) flush();
    group.push(v);
  }
  flush();
  return out;
}

// ---------------------------------------------------------------- openings

const JAMB = 0.05;

/**
 * Put an opening on every non-outdoor room edge it sits in: parallel, within
 * a wall's thickness of the edge, and overlapping it by at least half its
 * width. Offset is measured from the edge's start corner, the way the phone
 * stores it.
 */
export function placeOpening(
  polygon: Point[],
  a: Point,
  b: Point,
  kind: string,
  wallReach: number,
): ImportedOpening[] {
  const placed: ImportedOpening[] = [];
  const openingLength = Math.hypot(b.x - a.x, b.y - a.y);
  if (openingLength < 0.25) return placed;
  const openingHorizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);

  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    const length = Math.hypot(q.x - p.x, q.y - p.y);
    if (length < 0.3) continue;
    const edgeHorizontal = Math.abs(q.x - p.x) >= Math.abs(q.y - p.y);
    if (edgeHorizontal !== openingHorizontal) continue;

    const ux = (q.x - p.x) / length;
    const uy = (q.y - p.y) / length;
    // Perpendicular distance from the opening's middle to the edge line.
    const mx = (a.x + b.x) / 2 - p.x;
    const my = (a.y + b.y) / 2 - p.y;
    const across = Math.abs(mx * -uy + my * ux);
    if (across > wallReach) continue;

    const ta = (a.x - p.x) * ux + (a.y - p.y) * uy;
    const tb = (b.x - p.x) * ux + (b.y - p.y) * uy;
    const start = Math.max(Math.min(ta, tb), JAMB);
    const end = Math.min(Math.max(ta, tb), length - JAMB);
    const overlap = end - start;
    if (overlap < Math.max(0.25, openingLength * 0.5)) continue;
    placed.push({ edge: i, offset: round(start), width: round(overlap), kind });
  }
  return placed;
}

const round = (v: number) => Math.round(v * 1000) / 1000;

// ---------------------------------------------------------------- assembly

/**
 * Snapped pixel rooms and openings → rooms in metres, laid out on one floor.
 * `scale` is pixels per metre.
 */
export function assemble(
  rooms: ExtractedRoom[],
  openings: ExtractedOpening[],
  scale: number,
): ImportedRoom[] {
  const metric = rooms.map((room) => room.polygon.map((p) => ({ x: p.x / scale, y: p.y / scale })));

  // Faces within 4 cm are the same face.
  const xs = alignValues(metric.flatMap((poly) => poly.map((p) => round(p.x))), 0.04);
  const ys = alignValues(metric.flatMap((poly) => poly.map((p) => round(p.y))), 0.04);
  const aligned = metric.map((poly) =>
    poly.map((p) => ({ x: xs.get(round(p.x)) ?? p.x, y: ys.get(round(p.y)) ?? p.y })),
  );

  const all = aligned.flat();
  const originX = Math.min(...all.map((p) => p.x));
  const originY = Math.min(...all.map((p) => p.y));
  const openingsM = openings.map((o) => ({
    kind: o.kind,
    a: { x: o.a.x / scale - originX, y: o.a.y / scale - originY },
    b: { x: o.b.x / scale - originX, y: o.b.y / scale - originY },
  }));

  return rooms.map((room, index) => {
    const floor = aligned[index].map((p) => ({ x: p.x - originX, y: p.y - originY }));
    const box = bounds(floor);
    const local = floor.map((p) => ({ x: round(p.x - box.minX), y: round(p.y - box.minY) }));

    const placed = room.outdoor
      ? []
      : openingsM.flatMap((o) => placeOpening(floor, o.a, o.b, o.kind, 0.35));

    let note: string | null = null;
    const printed = parsePrintedSize(room.printedSize);
    if (printed && local.length === 4) {
      const w = box.maxX - box.minX;
      const h = box.maxY - box.minY;
      const [pa, pb] = printed;
      const off = Math.min(
        Math.max(Math.abs(w - pa), Math.abs(h - pb)),
        Math.max(Math.abs(w - pb), Math.abs(h - pa)),
      );
      if (off > 0.1) {
        note = `Labelled ${room.printedSize}; drawn ${feetInches(w)} × ${feetInches(h)}. Kept the drawing.`;
      }
    }

    return {
      name: room.name,
      roomType: room.roomType,
      outdoor: room.outdoor,
      ceilingHeightM: room.ceilingHeight,
      polygon: local,
      planX: round(box.minX),
      planY: round(box.minY),
      openings: placed,
      printedSize: room.printedSize,
      note,
    };
  });
}

export function feetInches(metres: number): string {
  const totalInches = Math.round(metres / 0.0254);
  return `${Math.floor(totalInches / 12)}'-${totalInches % 12}"`;
}
