/**
 * Affected areas — the shapes, colours and maths, with no database in sight.
 *
 * Split from `affectedAreas.ts` so client components (the area editor, the
 * room sheet on the phone) can import the geometry without dragging the
 * server-side Supabase client into the browser bundle. The DB functions
 * stay in `affectedAreas.ts`, which re-exports everything here so server
 * callers see one module.
 */

export const DAMAGE_TYPES = ["water", "fire", "mould", "impact", "other"] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const DAMAGE_LABEL: Record<DamageType, string> = {
  water: "Water",
  fire: "Fire / smoke",
  mould: "Mould",
  impact: "Impact",
  other: "Other",
};

/**
 * The same causes in French, for a report generated in French.
 *
 * **`Dégât d'eau` rather than `Eau`.** In Québec insurance the peril has a
 * name and that is it — an adjuster reading `Eau` under a heading called
 * `Cause` would parse it, but `dégât d'eau` is the line item they are going
 * to open in their own system. `Moisissure` likewise: it is the word on the
 * remediation protocols this trade works to.
 */
export const DAMAGE_LABEL_FR: Record<DamageType, string> = {
  water: "Dégât d'eau",
  fire: "Incendie / fumée",
  mould: "Moisissure",
  impact: "Impact",
  other: "Autre",
};

export function damageLabel(type: DamageType, locale: "en" | "fr"): string {
  return (locale === "fr" ? DAMAGE_LABEL_FR : DAMAGE_LABEL)[type] ?? type;
}

/**
 * The default colour per cause. Chosen to stay apart from each other and
 * from the plan's own black-on-grey, and to read at the size an area is
 * actually drawn — a thumbnail, over a floor, under a dimension line.
 */
export const DAMAGE_COLOR: Record<DamageType, string> = {
  // Lightened 18 Aug 2026 with its Swift twin in `Models.swift` —
  // `DamageCause.hex`. These two tables ARE one table; a colour that differs
  // between the phone and the printed report is the same damage described
  // twice, and an adjuster reading both will ask which is real.
  water: "#6fb0e8",
  fire: "#e2673a",
  mould: "#4f9d3a",
  impact: "#8a63d2",
  other: "#8a8a8e",
};

export type AreaPoint = { x: number; y: number };

/**
 * A damaged region of one room.
 *
 * # What `polygon` is measured in
 *
 * There are two coordinate spaces here and `surface` says which one applies.
 * Both are metres; nothing else about them is shared. Reading one as the
 * other draws a shape somewhere arbitrary, which looks like a broken scan
 * rather than like a bug.
 *
 * **`surface: "floor"`** — the plan's own metres, the space `toFloorPlan`
 * draws in. Origin top-left of the plan's bounding box, y down the page,
 * exactly like the walls beside it. Nothing to transform: a floor area is
 * drawn on the plan as it is stored.
 *
 * **`surface: "wall"`** — the face of the wall named by `wall_index`, seen
 * straight on. That face has its own two axes:
 *
 *   * **x — along the wall.** Measured from the edge's START corner toward
 *     its end corner, where edge `i` of the room polygon runs from
 *     `corners[i]` to `corners[(i + 1) % corners.length]` (`wallEdgeCorners`
 *     below). Range `0 … wallLengthM(corners, wall_index)`. This is
 *     deliberately the same origin and the same direction as an authored
 *     opening's `offset`, so a damaged region's x can be compared with a
 *     door's offset without a transform.
 *
 *   * **y — above the floor.** Range `0 … ceilingHeight`. y grows UPWARD,
 *     the opposite of the plan's y. The inversion is the point: heights
 *     counted down from the ceiling are not ones an estimator can read, and
 *     every trade quotes a sill height up from the floor.
 *
 * Corners are wound anticlockwise from the bottom-left, so `area_sqm` is
 * real square metres of wall rather than a signed or projected figure.
 *
 * **`surface: "ceiling"`** — the plan's own metres again, the floor's space
 * exactly, because the ceiling IS the floor's plane seen from underneath. A
 * ceiling area therefore draws on the plan without a transform, the way a
 * floor area does, and carries no `wall_index`. What it must never do is get
 * ADDED to the floor. The two coincide in plan, so a single summed square
 * footage double-counts every square foot; and they are different trades at
 * different rates — a wet ceiling is drywall, tape and paint, a wet floor is
 * covering — so no one rate prices the sum. Every filter here that means
 * "the floor" therefore names the floor rather than saying "not a wall".
 *
 * The face is taken in the edge's own parametric direction rather than
 * mirrored to "as seen standing in the room": winding is not guaranteed
 * across scanned rooms, so a from-inside rule would be a guess, while the
 * parametric rule is exact and is the one already baked into every opening
 * offset in the record.
 *
 * This is the same convention `ios/App/App/Native/ElevationView.swift` draws
 * and saves in — stated here as well, so the TypeScript side is a definition
 * rather than a pointer at a Swift file. A renderer needs no more than the
 * room polygon, the wall index and the ceiling height to reproduce the face.
 */
export type AffectedArea = {
  id: string;
  created_at: string;
  room_scan_id: string;
  surface: "floor" | "wall" | "ceiling";
  /** Which edge of the room polygon a wall area sits on. Null on the floor
      and on the ceiling, neither of which is one edge of anything. */
  wall_index: number | null;
  name: string;
  damage_type: DamageType;
  color: string | null;
  area_sqm: number;
  /** Plan metres for a floor area, wall-face metres for a wall area — see
      the note above, which is the whole of the difference. */
  polygon: AreaPoint[];
  notes: string | null;
  /** Whether this area's width/height print on the wall elevation. Off by
      default — most areas mark WHERE damage is, not what it measures;
      turning this on is a deliberate choice for the ones that matter to
      an estimate. */
  show_dimensions: boolean;
};

export type AffectedAreaInput = {
  roomScanId: string;
  surface?: "floor" | "wall" | "ceiling";
  wallIndex?: number | null;
  name?: string;
  damageType?: DamageType;
  color?: string | null;
  polygon: AreaPoint[];
  notes?: string | null;
};

/**
 * The area of a simple polygon, by the shoelace formula.
 *
 * Absolute value, so a shape drawn clockwise measures the same as one drawn
 * anticlockwise — the operator dragging corners has no idea which way round
 * they are going, and should not have to.
 *
 * Self-intersecting shapes (a bow-tie) are not meaningful here and this will
 * under-report them; the editor prevents making one rather than the maths
 * pretending to handle it.
 */
export function polygonAreaSqm(points: AreaPoint[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** The colour an area is drawn in: its own override, else its cause's. */
export function areaColor(area: Pick<AffectedArea, "color" | "damage_type">): string {
  return area.color ?? DAMAGE_COLOR[area.damage_type] ?? DAMAGE_COLOR.other;
}

/**
 * Split areas by the surface they sit on.
 *
 * These two are not interchangeable and must never be added together, for
 * two independent reasons.
 *
 * Their polygons are in different coordinate spaces. A floor area is metres
 * in the plan. A wall area is metres *along the wall* by metres *above the
 * floor* — a different origin, a different second axis, and a y that grows
 * upward rather than down the page. Drawing a wall area on the floor plan
 * puts a shape somewhere meaningless, which looks like a bug in the scan.
 *
 * And a wet floor and a wet wall are different trades at different rates.
 * One summed square-footage prices neither of them.
 *
 * Anything reading `AffectedArea[]` off the API has both kinds in it, so
 * this is the first thing to call.
 */
export function bySurface(areas: AffectedArea[]): {
  floor: AffectedArea[];
  wall: AffectedArea[];
  ceiling: AffectedArea[];
} {
  return {
    floor: floorAreas(areas),
    wall: areas.filter((area) => area.surface === "wall"),
    ceiling: areas.filter((area) => area.surface === "ceiling"),
  };
}

/** Only what is on the floor. Anything drawn in plan coordinates wants this
    or `ceilingAreas`, and the two are drawn the same way — see the note on
    `AffectedArea` for why they still must not be summed. */
export function floorAreas(areas: AffectedArea[]): AffectedArea[] {
  // Written as "is the floor" rather than "is not a wall". Rows predating
  // wall areas carry no surface and are all floor areas, so absent still
  // means floor — but a ceiling area answers "not a wall" too, and the
  // negative form would have quietly priced every ceiling as a floor.
  return areas.filter((area) => area.surface === "floor" || !area.surface);
}

/** Only what is on the ceiling. Plan coordinates, like the floor. */
export function ceilingAreas(areas: AffectedArea[]): AffectedArea[] {
  return areas.filter((area) => area.surface === "ceiling");
}

/**
 * Every area whose polygon is in PLAN metres — the floor and the ceiling.
 *
 * This is the filter a renderer wants, and it is a different question from
 * "which trade is this". Anything drawing on the plan needs the shapes that
 * are in the plan's space and must leave out the wall areas, whose polygons
 * are in their own wall's face space and would land somewhere meaningless.
 * Named as the positive fact so no caller has to work out that "not a wall"
 * happens to mean "drawable here" — the two came apart the moment the
 * ceiling existed, and every filter that stayed negative got it wrong once.
 */
export function planAreas(areas: AffectedArea[]): AffectedArea[] {
  return areas.filter((area) => area.surface !== "wall");
}

/** Only what is on a wall, in the order the walls are indexed. */
export function wallAreas(areas: AffectedArea[]): AffectedArea[] {
  return areas
    .filter((area) => area.surface === "wall")
    .sort((a, b) => (a.wall_index ?? 0) - (b.wall_index ?? 0));
}

/**
 * Damaged area totalled by cause.
 *
 * By cause rather than one grand total because the causes do not share a
 * trade or a rate — and because areas may overlap, a single sum across all
 * of them would double-count the square footage where a wall is both wet
 * and smoke-stained.
 *
 * Totals for the areas GIVEN. It sums exactly what it is handed and does not
 * filter — pass `floorAreas(...)` or `wallAreas(...)`, never a raw mixed
 * list, or the result is square metres of two different things. When both
 * surfaces are wanted, `totalsBySurface` is that call made correctly.
 */
export function totalsByDamageType(areas: AffectedArea[]): { type: DamageType; sqm: number }[] {
  const totals = new Map<DamageType, number>();
  for (const area of areas) {
    totals.set(area.damage_type, (totals.get(area.damage_type) ?? 0) + Number(area.area_sqm));
  }
  return DAMAGE_TYPES.filter((type) => totals.has(type)).map((type) => ({
    type,
    sqm: totals.get(type) ?? 0,
  }));
}

export type SurfaceTotals = {
  floor: { type: DamageType; sqm: number }[];
  wall: { type: DamageType; sqm: number }[];
  ceiling: { type: DamageType; sqm: number }[];
};

/**
 * Damaged area totalled by cause, kept apart by surface.
 *
 * The split every consumer of a mixed area list actually wants, so that
 * splitting correctly is one call rather than a filter each caller has to
 * remember. A caller that forgets prints floor and wall square footage added
 * together, and that figure is wrong twice over: the two surfaces overlap in
 * plan, so the sum double-counts, and they are different trades at different
 * rates, so no single rate prices the result.
 *
 * Either list is empty when nothing is recorded on that surface — an empty
 * list is "no wall damage", which is a table not to print rather than a zero
 * to print.
 */
export function totalsBySurface(areas: AffectedArea[]): SurfaceTotals {
  const { floor, wall, ceiling } = bySurface(areas);
  return {
    floor: totalsByDamageType(floor),
    wall: totalsByDamageType(wall),
    ceiling: totalsByDamageType(ceiling),
  };
}

/**
 * The two corners of edge `index`, as indices into the room polygon.
 *
 * Edge `i` runs from corner `i` to corner `i + 1`, wrapping — the same rule
 * as `PlanEditing.edgeCorners` on the phone, which is what `wall_index`
 * counts against. The pair is ordered: the first is the START corner a wall
 * area's x is measured from.
 */
export function wallEdgeCorners(count: number, index: number): [number, number] {
  if (count <= 0) return [0, 0];
  const edge = ((index % count) + count) % count;
  return [edge, (edge + 1) % count];
}

/**
 * How long the faced wall is, in metres — the width of the space a wall
 * area's x runs across.
 *
 * `corners` is the room polygon in plan metres, WITHOUT the repeated closing
 * point (`planCorners` in roomScan.ts strips it). Fewer than three corners
 * encloses no room and so has no wall to face.
 */
export function wallLengthM(corners: AreaPoint[], index: number): number {
  if (corners.length < 3) return 0;
  const [start, end] = wallEdgeCorners(corners.length, index);
  return Math.hypot(corners[end].x - corners[start].x, corners[end].y - corners[start].y);
}
