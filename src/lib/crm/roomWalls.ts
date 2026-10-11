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
  /** The room's edge with no wall standing on it — see lib/openWalls.ts. */
  is_open: boolean;
  notes: string | null;
};

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

const COLUMNS = "wall_index, load_bearing, display_elevation, is_open, notes";
const COLUMNS_BEFORE_0051 = "wall_index, load_bearing, display_elevation, notes";

/**
 * `is_open` arrives with migration 0051. Code can reach production before the
 * migration does, and a wall list that failed outright would take the room
 * sheet, the report and the estimate down with it over one column nobody has
 * used yet. So a read that trips on it is retried without it, and every wall
 * reads as closed — which is exactly what every wall was before 0051.
 */
function isMissingOpenColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const message = (error as { message?: string }).message ?? "";
  return (code === "42703" || code === "PGRST204") && /is_open/.test(message);
}

function withClosedDefault(rows: Omit<RoomWall, "is_open">[]): RoomWall[] {
  return rows.map((row) => ({ ...row, is_open: false }));
}

/** Every wall of one room that has ever had a detail set on it. Walls with
    nothing set have no row and are not included — callers default the rest. */
export async function listRoomWalls(roomScanId: string): Promise<RoomWall[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("room_walls")
    .select(COLUMNS)
    .eq("room_scan_id", roomScanId);

  if (error && isMissingOpenColumn(error)) {
    const retry = await client
      .from("room_walls")
      .select(COLUMNS_BEFORE_0051)
      .eq("room_scan_id", roomScanId);
    if (retry.error) throw new Error(`Could not load the wall details: ${retry.error.message}`);
    return withClosedDefault((retry.data ?? []) as Omit<RoomWall, "is_open">[]);
  }
  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("room_walls", error.message);
    throw new Error(`Could not load the wall details: ${error.message}`);
  }
  return (data ?? []) as RoomWall[];
}

/**
 * The open sides of several rooms at once — room id → edge indices — for the
 * loaders that hand rooms to a drawing. One query for a whole project rather
 * than one per room. A database without 0051 (or without room_walls at all)
 * has no open sides, which is the truth about it, so it answers empty rather
 * than failing the room list.
 */
export async function listOpenWalls(roomScanIds: string[]): Promise<Map<string, number[]>> {
  const open = new Map<string, number[]>();
  if (roomScanIds.length === 0) return open;
  const client = requireDb();
  const { data, error } = await client
    .from("room_walls")
    .select("room_scan_id, wall_index")
    .in("room_scan_id", roomScanIds)
    .eq("is_open", true);
  if (error) {
    if (isMissingOpenColumn(error) || isMissingTable(error)) return open;
    throw new Error(`Could not load the open walls: ${error.message}`);
  }
  for (const row of (data ?? []) as { room_scan_id: string; wall_index: number }[]) {
    open.set(row.room_scan_id, [...(open.get(row.room_scan_id) ?? []), row.wall_index]);
  }
  for (const list of open.values()) list.sort((a, b) => a - b);
  return open;
}

export async function getRoomWall(roomScanId: string, wallIndex: number): Promise<RoomWall> {
  const client = requireDb();
  const { data, error } = await client
    .from("room_walls")
    .select(COLUMNS)
    .eq("room_scan_id", roomScanId)
    .eq("wall_index", wallIndex)
    .maybeSingle();

  if (error && isMissingOpenColumn(error)) {
    const retry = await client
      .from("room_walls")
      .select(COLUMNS_BEFORE_0051)
      .eq("room_scan_id", roomScanId)
      .eq("wall_index", wallIndex)
      .maybeSingle();
    if (retry.error) throw new Error(`Could not load the wall: ${retry.error.message}`);
    if (retry.data) return withClosedDefault([retry.data as Omit<RoomWall, "is_open">])[0];
  } else if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("room_walls", error.message);
    throw new Error(`Could not load the wall: ${error.message}`);
  } else if (data) {
    return data as RoomWall;
  }
  return {
    wall_index: wallIndex,
    load_bearing: false,
    display_elevation: false,
    is_open: false,
    notes: null,
  };
}

/** Set one wall's own fields, creating its row the first time anything about
    it is said. `undefined` leaves a field alone; every other value overwrites. */
export async function upsertRoomWall(
  roomScanId: string,
  wallIndex: number,
  patch: {
    loadBearing?: boolean;
    displayElevation?: boolean;
    isOpen?: boolean;
    notes?: string | null;
  },
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
      ...(patch.isOpen !== undefined ? { is_open: patch.isOpen } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "room_scan_id,wall_index" },
  );

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("room_walls", error.message);
    // Opening a side before 0051 has run: say which migration, rather than
    // the schema cache's own words about a column it cannot find.
    if (isMissingOpenColumn(error)) {
      throw new MigrationPendingError("room_walls.is_open (migration 0051)", error.message);
    }
    throw new Error(`Could not save the wall: ${error.message}`);
  }
}
