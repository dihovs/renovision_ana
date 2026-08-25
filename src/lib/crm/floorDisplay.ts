import { db, isMissingTable, MigrationPendingError } from "./db";

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
