/**
 * Wall thickness, and the footprint figures that depend on it.
 *
 * # Why this exists, and what changed
 *
 * `projectStatistics.ts` used to refuse the reference's three ground-surface
 * variants outright, on the grounds that they need the thickness of every wall
 * and a scan gives wall faces, not assemblies. That was the right call while
 * thickness was unknown — computing them would have meant inventing a number
 * and printing it as measured.
 *
 * The owner's instruction removed the premise: *"you can copy it, and maybe
 * make the thickness adjustable, anyway here is mostly 2×4"*. A thickness the
 * operator STATES is not an invented one, and the reference works exactly this
 * way — thickness is a per-floor setting there, interior and exterior kept
 * separate (`Docs/reference/magicplan/object-model.md` §2c, observed at
 * 0.120 m and 0.250 m).
 *
 * # What this can and cannot know
 *
 * It can know the thickness, because somebody sets it. It **cannot** tell an
 * exterior wall from a shared partition: our rooms are scanned one at a time
 * and are not registered into a single footprint, so a room does not know
 * which of its walls its neighbour is on the other side of. The reference
 * knows, because its rooms live in one plan.
 *
 * So the model here is stated, not hidden: **each room is expanded outward by
 * half the thickness of the walls bounding it.** Where two rooms share a
 * partition each contributes half and the partition is counted once, correctly.
 * Where a wall is exterior only half of it is counted, so the gross footprint
 * is **understated by roughly half the exterior wall thickness around the
 * outside** — and the definition says so rather than leaving a reader to
 * assume a precision that is not there.
 *
 * Getting the last half requires detecting which room edges lie on the
 * building's outer boundary, which is real work on the stored `plan_x`/
 * `plan_y` positions and is not attempted here.
 */

const INCH = 0.0254;

/**
 * Stock North American assemblies, finished thickness.
 *
 * A 2×4 is 3½" of stud plus ½" of drywall each side — 4½", not 4". A 2×6
 * exterior wall is 5½" plus drywall inside and sheathing out, taken at 7".
 * These are the defaults; the operator can state otherwise per floor.
 */
export const WALL_ASSEMBLIES = {
  /** 2×4 partition, drywall both sides. The Quebec residential default. */
  stud2x4: 4.5 * INCH,
  /** 2×6 partition — plumbing walls, and older construction. */
  stud2x6: 6.5 * INCH,
  /** 2×6 exterior wall with sheathing. */
  exterior2x6: 7 * INCH,
  /** Poured concrete foundation wall — a basement's outer skin. */
  concrete8: 8 * INCH,
} as const;

export type WallThickness = {
  /** Partitions between two rooms. */
  interiorM: number;
  /** The building's outer skin. */
  exteriorM: number;
};

/** 2×4 partitions, 2×6 exterior — what most of this trade's jobs are. */
export const DEFAULT_WALL_THICKNESS: WallThickness = {
  interiorM: WALL_ASSEMBLIES.stud2x4,
  exteriorM: WALL_ASSEMBLIES.exterior2x6,
};

/**
 * A room's footprint including half the walls that bound it.
 *
 * Offsetting a polygon outward by `d` grows it by its perimeter times `d`,
 * plus the corners. The corner term is exact only for a convex shape, and a
 * real room is mostly right angles, so it is deliberately omitted: on a
 * 4 × 3 m room at half a 2×4 it is under two thousandths of a square metre —
 * far below what the scan itself is accurate to — and including a term that
 * is right for circles and wrong for rooms would be false precision.
 */
export function footprintWithHalfWalls(
  floorAreaSqm: number,
  perimeterM: number,
  thicknessM: number,
): number {
  if (!Number.isFinite(floorAreaSqm) || !Number.isFinite(perimeterM)) return 0;
  if (!Number.isFinite(thicknessM) || thicknessM <= 0) return Math.max(0, floorAreaSqm);
  return Math.max(0, floorAreaSqm + (perimeterM * thicknessM) / 2);
}

/**
 * The three figures the reference publishes, from a stated thickness.
 *
 * `withoutWalls` is the clear floor — what we already reported, unchanged.
 * `withInteriorWalls` adds half the interior thickness around every room, so a
 * shared partition lands once. `withAllWalls` does the same at the exterior
 * thickness, which is the closest a per-room scan gets to a gross footprint.
 *
 * On a single-room floor the middle figure equals the first, exactly as it
 * does in the reference — there are no partitions to add.
 */
export function groundSurfaces(
  rooms: { floorAreaSqm: number; perimeterM: number }[],
  thickness: WallThickness = DEFAULT_WALL_THICKNESS,
): { withoutWalls: number; withInteriorWalls: number; withAllWalls: number } {
  const withoutWalls = rooms.reduce((sum, r) => sum + (Number.isFinite(r.floorAreaSqm) ? r.floorAreaSqm : 0), 0);

  // One room has no partitions to share, so "with interior walls" is the
  // clear floor — the reference reports exactly this, 6.24 and 6.24.
  const withInteriorWalls =
    rooms.length < 2
      ? withoutWalls
      : rooms.reduce(
          (sum, r) => sum + footprintWithHalfWalls(r.floorAreaSqm, r.perimeterM, thickness.interiorM),
          0,
        );

  const withAllWalls = rooms.reduce(
    (sum, r) => sum + footprintWithHalfWalls(r.floorAreaSqm, r.perimeterM, thickness.exteriorM),
    0,
  );

  return { withoutWalls, withInteriorWalls, withAllWalls };
}

/**
 * What a project stores: one default, and overrides for the floors that
 * differ.
 *
 * Most jobs are one construction throughout, so a single pair covers them.
 * The exception is real and common on this trade — a basement's poured
 * foundation is nothing like the stud walls above it — so a level can say
 * otherwise without the operator re-stating the whole building.
 */
export type WallThicknessConfig = {
  default: WallThickness;
  byLevel?: Record<string, WallThickness>;
};

export const DEFAULT_WALL_THICKNESS_CONFIG: WallThicknessConfig = {
  default: DEFAULT_WALL_THICKNESS,
};

/** A thickness that could not have been typed by someone measuring a wall. */
function sane(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  // Two millimetres to half a metre. Below that is a sheet of board, above it
  // is a vault — either way somebody typed inches into a metres field, or the
  // other way round, and the fallback is safer than the number.
  return Number.isFinite(n) && n >= 0.002 && n <= 0.5 ? n : fallback;
}

function readPair(raw: unknown, fallback: WallThickness): WallThickness {
  if (!raw || typeof raw !== "object") return fallback;
  const value = raw as Record<string, unknown>;
  return {
    interiorM: sane(value.interiorM, fallback.interiorM),
    exteriorM: sane(value.exteriorM, fallback.exteriorM),
  };
}

/**
 * Read a stored config, tolerating anything.
 *
 * The column is jsonb written by a client, so it can hold a shape from an
 * older build, a half-written object, or nonsense. Every field falls back
 * rather than throwing: a project whose config is corrupt still reports
 * figures, computed on the documented default, instead of a screen of errors
 * on a job site.
 */
export function parseWallThicknessConfig(raw: unknown): WallThicknessConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_WALL_THICKNESS_CONFIG;
  const value = raw as Record<string, unknown>;
  const base = readPair(value.default, DEFAULT_WALL_THICKNESS);

  const byLevel: Record<string, WallThickness> = {};
  if (value.byLevel && typeof value.byLevel === "object") {
    for (const [level, pair] of Object.entries(value.byLevel as Record<string, unknown>)) {
      if (level.trim()) byLevel[level] = readPair(pair, base);
    }
  }

  return Object.keys(byLevel).length > 0 ? { default: base, byLevel } : { default: base };
}

/** The thickness that applies on one floor: its own if stated, else the default. */
export function thicknessForLevel(
  config: WallThicknessConfig,
  level: string,
): WallThickness {
  return config.byLevel?.[level] ?? config.default;
}
