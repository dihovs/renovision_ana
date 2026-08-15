import {
  areaColor,
  wallLengthM,
  DAMAGE_LABEL,
  type AffectedArea,
  type AreaPoint,
} from "@/lib/crm/areaShapes";
import { metersToFeet, squareMetersToSquareFeet } from "@/lib/roomScan";

/**
 * One wall, drawn straight on, with the damage marked on it.
 *
 * The web counterpart of `ios/App/App/Native/ElevationView.swift`, and the
 * reason wall damage is worth recording at all: a plan can say a wall is
 * four metres long, but only an elevation can say that the bottom metre of
 * it is wet and that the damage stops under the window. That is the fact a
 * drywall line is priced from, so a report that records wall damage and
 * prints no picture of it is asking the adjuster to take the figure on
 * trust.
 *
 * Deliberately not the phone's editor: nothing here is draggable, there are
 * no adjoining walls folded away and no offset chain. This is the printed
 * form — the face, its size, and what is damaged on it.
 *
 * Coordinates are wall-face metres exactly as `AffectedArea` defines them
 * (see the note on that type): x along the wall from the edge's start
 * corner, y up from the floor. The one transform is that y flip, because an
 * SVG's y grows down the page and the face's grows up off the floor.
 */
export default function WallElevation({
  corners,
  wallIndex,
  ceilingHeightM,
  areas,
}: {
  /** The room polygon in plan metres, without its closing point — what
      `planCorners` returns. Wall indices count against this. */
  corners: AreaPoint[];
  wallIndex: number;
  ceilingHeightM: number;
  /** Areas on THIS wall. The caller filters; this draws what it is given. */
  areas: AffectedArea[];
}) {
  const length = wallLengthM(corners, wallIndex);
  // The same floor the phone puts under a wall height: a scan that recorded
  // no ceiling still gets a face with a readable proportion rather than a
  // zero-height sliver.
  const height = Math.max(ceilingHeightM, 0.3);

  // A wall this short is a corner artefact, not a wall. Drawing it produces
  // a sliver with overlapping labels that reads as a rendering fault.
  if (length <= 0.05) return null;

  // Room for the height label down the left and the length label along the
  // bottom, in the same metres as everything else.
  const padLeft = 0.5;
  const padRight = 0.12;
  const padTop = 0.12;
  const padBottom = 0.42;

  /** Face metres → SVG units. Only y moves: it grows up off the floor. */
  const fy = (y: number) => height - y;
  const type = 0.15;

  return (
    <svg
      viewBox={`${-padLeft} ${-padTop} ${length + padLeft + padRight} ${height + padTop + padBottom}`}
      className="elevation"
      role="img"
      aria-label={`Wall ${wallIndex + 1}, seen straight on`}
    >
      {/* The wall face. White against the report's grey so the damage on it
          is the only thing carrying colour. */}
      <rect x={0} y={0} width={length} height={height} fill="#ffffff" stroke="#d9d9de" strokeWidth={0.012} />

      {/* The floor line reads heavier than the other three edges: every
          height on this drawing is measured from it. */}
      <line x1={0} y1={height} x2={length} y2={height} stroke="#111111" strokeWidth={0.03} strokeLinecap="square" />

      {areas.map((area) => (
        <polygon
          key={area.id}
          points={area.polygon.map((p) => `${p.x},${fy(p.y)}`).join(" ")}
          fill={areaColor(area)}
          fillOpacity={0.28}
          stroke={areaColor(area)}
          strokeWidth={0.02}
        />
      ))}

      {/* Wall height down the left edge, wall length along the bottom — the
          two figures that make the face measurable rather than decorative. */}
      <text
        x={-padLeft + 0.06}
        y={height / 2}
        fontSize={type}
        fill="#6b6b73"
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(-90 ${-padLeft + 0.06} ${height / 2})`}
      >
        {metersToFeet(height).toFixed(1)} ft
      </text>
      <text x={length / 2} y={height + 0.3} fontSize={type} fill="#6b6b73" textAnchor="middle">
        {metersToFeet(length).toFixed(1)} ft
      </text>
    </svg>
  );
}

/**
 * Every wall of one room that has damage on it, in wall order.
 *
 * Walls with nothing marked are left out rather than printed empty: a report
 * page of blank rectangles buries the one wall that matters, and an adjuster
 * reading it has to check each in turn to find out that three of them say
 * nothing.
 */
export function RoomElevations({
  corners,
  ceilingHeightM,
  areas,
}: {
  corners: AreaPoint[];
  ceilingHeightM: number;
  /** Wall areas for the whole room — grouped by wall here. */
  areas: AffectedArea[];
}) {
  if (corners.length < 3 || areas.length === 0) return null;

  const walls = new Map<number, AffectedArea[]>();
  for (const area of areas) {
    // An area whose wall was deleted from the plan since it was drawn has no
    // face left to sit on. It still counts in the wall total above — the
    // damage was real — but there is nothing honest to draw it against.
    const index = area.wall_index;
    if (index === null || index < 0 || index >= corners.length) continue;
    if (area.polygon.length < 3) continue;
    walls.set(index, [...(walls.get(index) ?? []), area]);
  }
  if (walls.size === 0) return null;

  return (
    <div className="elevations">
      {[...walls.keys()]
        .sort((a, b) => a - b)
        .map((index) => {
          const onWall = walls.get(index) ?? [];
          const sqm = onWall.reduce((sum, area) => sum + Number(area.area_sqm), 0);
          return (
            <figure key={index}>
              <WallElevation
                corners={corners}
                wallIndex={index}
                ceilingHeightM={ceilingHeightM}
                areas={onWall}
              />
              <figcaption>
                <strong>Wall {index + 1}</strong>
                <span>
                  {Math.round(squareMetersToSquareFeet(sqm)).toLocaleString("en-CA")} sq ft ·{" "}
                  {onWall.map((area) => DAMAGE_LABEL[area.damage_type]).join(", ")}
                </span>
              </figcaption>
            </figure>
          );
        })}
    </div>
  );
}
