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
