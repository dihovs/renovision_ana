/**
 * Curved walls — the floor-plan spec §10, M5.
 *
 * The TypeScript twin of `FloorPlanCore/Arc.swift`; the numbers must match
 * (both are tested against the spec's T8). A curved wall is its chord — the
 * straight line between its corners — plus how far its middle stands off
 * that line.
 *
 * STORED SIGN, in `geometry.edgeBulge[i]` for edge i of `editedPolygon`:
 * positive bulges AWAY from the room, negative INTO it. That is the spec's
 * "+sagitta bulges outward" read against the room rather than against the
 * direction of travel, so it means the same thing whichever way round the
 * outline happens to be stored, and in the phone's y-down frame as well as
 * the spec's y-up one.
 */

export type ArcFigures = {
  radius: number;
  /** Half the angle the arc subtends at its centre, radians. */
  halfAngle: number;
  /** Along the curve; the chord when straight. */
  length: number;
  /** Between the arc and its chord, always ≥ 0. */
  segmentArea: number;
};

export function arcFigures(chord: number, bulge: number): ArcFigures {
  const s = Math.abs(bulge);
  if (s < 1e-12 || chord <= 0) return { radius: Infinity, halfAngle: 0, length: chord, segmentArea: 0 };
  const radius = (chord * chord) / (8 * s) + s / 2;
  let halfAngle = Math.asin(Math.min(1, chord / (2 * radius)));
  if (s > chord / 2) halfAngle = Math.PI - halfAngle;
  return {
    radius,
    halfAngle,
    length: 2 * radius * halfAngle,
    segmentArea: (radius * radius * (2 * halfAngle - Math.sin(2 * halfAngle))) / 2,
  };
}

/** What a wall adds to its room's floor: + bulging out, − bulging in. */
export function signedSegmentArea(chord: number, bulge: number): number {
  const { segmentArea } = arcFigures(chord, bulge);
  return bulge >= 0 ? segmentArea : -segmentArea;
}

/** The bulge of edge i, or 0 when the room has none recorded. */
export function bulgeAt(edgeBulge: readonly number[] | null | undefined, i: number): number {
  const b = edgeBulge?.[i];
  return typeof b === "number" && Number.isFinite(b) ? b : 0;
}

type Pt = { x: number; y: number };

/**
 * Points along the edge a → b of a ring whose signed shoelace area is
 * `ringArea`, bowed `bulge` metres away from the ring's inside (− toward
 * it). The two ends when straight. Twin of `PlanBridge.edgePoints`.
 *
 * Works in any frame: "inside" is read from the ring's own winding, so a
 * y-down web plan and a y-up spec plan agree on which way is out.
 */
export function edgeArcPoints(a: Pt, b: Pt, bulge: number, ringArea: number, steps = 24): Pt[] {
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  if (bulge === 0 || chord <= 0) return [a, b];
  const ux = (b.x - a.x) / chord;
  const uy = (b.y - a.y) / chord;
  // Positive shoelace: the inside is LEFT of travel, so out is right.
  const out = ringArea > 0 ? { x: uy, y: -ux } : { x: -uy, y: ux };
  const s = Math.abs(bulge);
  const sign = bulge > 0 ? 1 : -1;
  const { radius } = arcFigures(chord, s);
  const pts: Pt[] = [];
  for (let k = 0; k <= steps; k += 1) {
    const t = k / steps;
    const x = (t - 0.5) * chord;
    // Height of the arc above its chord at x along it.
    const h = Math.sqrt(Math.max(0, radius * radius - x * x)) - (radius - s);
    pts.push({
      x: a.x + ux * t * chord + out.x * h * sign,
      y: a.y + uy * t * chord + out.y * h * sign,
    });
  }
  return pts;
}

/** A ring (no repeated closing point) with every curved edge followed. */
export function curvedRing(points: readonly Pt[], bulges: readonly number[] | null | undefined): Pt[] {
  if (!bulges || bulges.length !== points.length || !bulges.some((b) => b !== 0)) return [...points];
  let twice = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    twice += p.x * q.y - q.x * p.y;
  }
  const out: Pt[] = [];
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    out.push(...edgeArcPoints(a, b, bulgeAt(bulges, i), twice).slice(0, -1));
  });
  return out;
}
