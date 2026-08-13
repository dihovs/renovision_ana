import { db, isMissingTable, MigrationPendingError } from "./db";

/**
 * Room scans, stored against the project they measured.
 *
 * Metres in the database, always — RoomPlan measures in metres, and the
 * imperial figures the UI shows are derived on the way out. Storing feet
 * would bake a conversion into the record and lose the source measurement.
 */

export type RoomScan = {
  id: string;
  created_at: string;
  project_id: string;
  name: string;
  level: string;
  position: number;
  floor_area_sqm: number;
  wall_length_m: number;
  ceiling_height_m: number;
  door_count: number;
  window_count: number;
  stair_count: number;
  /** The full RoomScanResult, for redrawing the plan. Opaque here. */
  geometry: Record<string, unknown>;
  notes: string | null;
  /** Where the operator dragged this room on the floor, in metres of plan
      space. NULL means never placed — the drawing falls back to the packed
      layout rather than stacking every room at the origin. */
  plan_x: number | null;
  plan_y: number | null;
};

export type RoomScanInput = {
  projectId: string;
  name: string;
  level: string;
  position?: number;
  floorAreaSqm: number;
  wallLengthM: number;
  ceilingHeightM: number;
  doorCount: number;
  windowCount: number;
  stairCount: number;
  geometry: Record<string, unknown>;
  notes?: string | null;
};

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

/** Every room scanned for a project, in walking order within each floor. */
export async function listRoomScans(projectId: string): Promise<RoomScan[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("room_scans")
    .select("*")
    .eq("project_id", projectId)
    .order("level", { ascending: true })
    .order("position", { ascending: true });

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("room_scans");
    throw new Error(`Could not load the scans: ${error.message}`);
  }
  return (data ?? []) as RoomScan[];
}

export async function createRoomScan(input: RoomScanInput): Promise<string> {
  const client = requireDb();
  const { data, error } = await client
    .from("room_scans")
    .insert({
      project_id: input.projectId,
      name: input.name.trim().slice(0, 200) || "Room",
      level: input.level.trim().slice(0, 60) || "Ground",
      position: input.position ?? 0,
      floor_area_sqm: input.floorAreaSqm,
      wall_length_m: input.wallLengthM,
      ceiling_height_m: input.ceilingHeightM,
      door_count: input.doorCount,
      window_count: input.windowCount,
      stair_count: input.stairCount,
      geometry: input.geometry,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("room_scans");
    throw new Error(`Could not save the scan: ${error.message}`);
  }
  return data.id as string;
}

/** Rename a room, or move it to another floor. The measurements are a
    record of what was scanned and are deliberately not editable here. */
export async function updateRoomScan(
  id: string,
  patch: {
    name?: string;
    level?: string;
    position?: number;
    notes?: string | null;
    planX?: number | null;
    planY?: number | null;
  },
): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("room_scans")
    .update({
      ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 200) || "Room" } : {}),
      ...(patch.level !== undefined ? { level: patch.level.trim().slice(0, 60) || "Ground" } : {}),
      ...(patch.position !== undefined ? { position: patch.position } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
      ...(patch.planX !== undefined ? { plan_x: patch.planX } : {}),
      ...(patch.planY !== undefined ? { plan_y: patch.planY } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`Could not save the change: ${error.message}`);
}

export async function deleteRoomScan(id: string): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("room_scans").delete().eq("id", id);
  if (error) throw new Error(`Could not remove the scan: ${error.message}`);
}

/**
 * What the whole survey adds up to — the numbers an estimate is written
 * from, totalled per floor and overall.
 *
 * Summed here rather than in the database so the same figures come back
 * whether the caller has one room or forty, and so a floor with no scans
 * simply doesn't appear rather than showing zeroes.
 */
export type ScanTotals = {
  floorAreaSqm: number;
  wallLengthM: number;
  roomCount: number;
  stairCount: number;
};

export function totalScans(scans: RoomScan[]): ScanTotals {
  return scans.reduce<ScanTotals>(
    (total, scan) => ({
      floorAreaSqm: total.floorAreaSqm + Number(scan.floor_area_sqm),
      wallLengthM: total.wallLengthM + Number(scan.wall_length_m),
      roomCount: total.roomCount + 1,
      stairCount: total.stairCount + scan.stair_count,
    }),
    { floorAreaSqm: 0, wallLengthM: 0, roomCount: 0, stairCount: 0 },
  );
}

/** The same totals, broken out by floor, in the order the floors appear. */
export function totalsByLevel(scans: RoomScan[]): { level: string; totals: ScanTotals }[] {
  const levels: string[] = [];
  for (const scan of scans) if (!levels.includes(scan.level)) levels.push(scan.level);
  return levels.map((level) => ({
    level,
    totals: totalScans(scans.filter((scan) => scan.level === level)),
  }));
}
