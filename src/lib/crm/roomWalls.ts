import { db, isMissingTable, MigrationPendingError } from "./db";

/**
 * A wall's own details — database side.
 *
 * A wall has no id of its own; it is edge N of its room's polygon, so it is
 * keyed here the same way `affected_areas.wall_index` already is:
 * (room_scan_id, wall_index). A wall nobody has touched has no row at all —
 * `getRoomWall` hands back the defaults for one rather than requiring every
 * wall in a plan to be pre-created.
 *
 * Snake case, like `AffectedArea` — this is the row shape the client decodes
 * directly, not a renamed API model.
 */
export type RoomWall = {
  wall_index: number;
  load_bearing: boolean;
  display_elevation: boolean;
  notes: string | null;
};

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

const COLUMNS = "wall_index, load_bearing, display_elevation, notes";

/** Every wall of one room that has ever had a detail set on it. Walls with
    nothing set have no row and are not included — callers default the rest. */
export async function listRoomWalls(roomScanId: string): Promise<RoomWall[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("room_walls")
    .select(COLUMNS)
    .eq("room_scan_id", roomScanId);

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("room_walls", error.message);
    throw new Error(`Could not load the wall details: ${error.message}`);
  }
  return (data ?? []) as RoomWall[];
}

export async function getRoomWall(roomScanId: string, wallIndex: number): Promise<RoomWall> {
  const client = requireDb();
  const { data, error } = await client
    .from("room_walls")
    .select(COLUMNS)
    .eq("room_scan_id", roomScanId)
    .eq("wall_index", wallIndex)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("room_walls", error.message);
    throw new Error(`Could not load the wall: ${error.message}`);
  }
  return (data as RoomWall | null) ?? {
    wall_index: wallIndex,
    load_bearing: false,
    display_elevation: false,
    notes: null,
  };
}

/** Set one wall's own fields, creating its row the first time anything about
    it is said. `undefined` leaves a field alone; every other value overwrites. */
export async function upsertRoomWall(
  roomScanId: string,
  wallIndex: number,
  patch: { loadBearing?: boolean; displayElevation?: boolean; notes?: string | null },
): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("room_walls").upsert(
    {
      room_scan_id: roomScanId,
      wall_index: wallIndex,
      ...(patch.loadBearing !== undefined ? { load_bearing: patch.loadBearing } : {}),
      ...(patch.displayElevation !== undefined
        ? { display_elevation: patch.displayElevation }
        : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "room_scan_id,wall_index" },
  );

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("room_walls", error.message);
    throw new Error(`Could not save the wall: ${error.message}`);
  }
}
