import { db, isMissingTable, MigrationPendingError } from "./db";
import { DEFAULT_WALL_THICKNESS, type WallThickness } from "./wallThickness";

/**
 * How a storey is turned on screen — a display fact, not a measurement.
 *
 * A "storey" is not its own row anywhere else in this schema (`room_scans`
 * only carries a `level` text label — see `lib/crm/floors.ts`), so the angle
 * gets its own tiny table keyed by (project_id, level). See migration 0043
 * for why this exists: the old path rotated every room's saved polygon
 * through `saveEditedPlan`, which overwrote RoomPlan scan geometry a turn
 * has no business touching.
 */

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

/** Degrees, keyed by level. A level with no row has never been turned — 0 —
    which is not distinguished from a level turned back to upright, because
    they are the same fact. */
export type FloorDisplayAngles = Record<string, number>;

/**
 * Every stored turn on a project's floors.
 *
 * A missing table reads as "no floor has been turned" rather than raising
 * `MigrationPendingError`, deliberately, and this is the one place in this
 * codebase that swallows it. This is bundled into `GET /api/v1/scans`, so
 * throwing here would 503 the whole floor plan — taking the drawing down
 * over the direction it is read from. `setFloorDisplayAngle` still throws,
 * which puts the "run 0043" message exactly where it is actionable: the
 * moment somebody tries to turn a floor.
 */
export async function getFloorDisplayAngles(projectId: string): Promise<FloorDisplayAngles> {
  const client = requireDb();
  const { data, error } = await client
    .from("floor_display")
    .select("level, display_angle")
    .eq("project_id", projectId);

  if (error) {
    if (isMissingTable(error)) return {};
    throw new Error(`Could not load the floor angles: ${error.message}`);
  }
  return Object.fromEntries(
    (data ?? []).map((row) => [row.level as string, Number(row.display_angle)]),
  );
}

/** Set how a storey is drawn. Upsert — a floor turned for the first time has
    no row yet, and this is the one write that should create it. */
export async function setFloorDisplayAngle(
  projectId: string,
  level: string,
  displayAngle: number,
): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("floor_display").upsert(
    {
      project_id: projectId,
      level,
      display_angle: displayAngle,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,level" },
  );

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("floor_display", error.message);
    throw new Error(`Could not save the turn: ${error.message}`);
  }
}

/** The stated wall widths of each storey, metres, keyed by level. Only
    levels where somebody stated them appear; the rest use
    `DEFAULT_WALL_THICKNESS`. See migration 0058. */
export type FloorWallWidths = Record<string, Partial<WallThickness>>;

function isMissingColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  if (code === "42703" || code === "PGRST204") return true;
  const message = (error as { message?: string }).message ?? "";
  return /column .* does not exist|could not find the .* column/i.test(message);
}

/**
 * Every stated wall width on a project's floors.
 *
 * Swallows a missing table or column for the same reason the angles do: it
 * is bundled into the plan read, and the plan must draw (at the default
 * widths) before 0058 has been run.
 */
export async function getFloorWallWidths(projectId: string): Promise<FloorWallWidths> {
  const client = requireDb();
  const { data, error } = await client
    .from("floor_display")
    .select("level, interior_wall_m, exterior_wall_m")
    .eq("project_id", projectId);

  if (error) {
    if (isMissingTable(error) || isMissingColumn(error)) return {};
    throw new Error(`Could not load the wall widths: ${error.message}`);
  }
  const out: FloorWallWidths = {};
  for (const row of data ?? []) {
    const widths: Partial<WallThickness> = {};
    const i = row.interior_wall_m == null ? NaN : Number(row.interior_wall_m);
    const e = row.exterior_wall_m == null ? NaN : Number(row.exterior_wall_m);
    if (Number.isFinite(i)) widths.interiorM = i;
    if (Number.isFinite(e)) widths.exteriorM = e;
    if (widths.interiorM != null || widths.exteriorM != null) out[row.level as string] = widths;
  }
  return out;
}

/** The widths `levelWalls` resolves to for one storey — stated where stated,
    default otherwise. */
export function resolveWallWidths(widths: FloorWallWidths, level: string): WallThickness {
  return { ...DEFAULT_WALL_THICKNESS, ...(widths[level] ?? {}) };
}

/** Plausible finished wall widths: thinner than a 1×2 furring strip or wider
    than a stone foundation is a typo, not a wall. Mirrors 0058's check. */
export function validWallWidth(kind: "interiorM" | "exteriorM", metres: number): boolean {
  return Number.isFinite(metres) && metres > 0.03 && metres < (kind === "interiorM" ? 0.6 : 0.8);
}

/** State a storey's wall widths. Only the given fields are written, so
    setting the interior leaves the exterior — and the turn — alone. */
export async function setFloorWallWidths(
  projectId: string,
  level: string,
  widths: Partial<WallThickness>,
): Promise<void> {
  const client = requireDb();
  const row: Record<string, unknown> = {
    project_id: projectId,
    level,
    updated_at: new Date().toISOString(),
  };
  if (widths.interiorM != null) row.interior_wall_m = widths.interiorM;
  if (widths.exteriorM != null) row.exterior_wall_m = widths.exteriorM;
  const { error } = await client.from("floor_display").upsert(row, { onConflict: "project_id,level" });

  if (error) {
    if (isMissingTable(error) || isMissingColumn(error)) {
      throw new MigrationPendingError("floor_display (0058 wall widths)", error.message);
    }
    throw new Error(`Could not save the wall widths: ${error.message}`);
  }
}
