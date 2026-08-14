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
  /** Bedroom, basement, garage… drives the living-area default. */
  room_type: string | null;
  /** Hand-set 0-100 override. NULL means "use the type's default", which is
      a different statement from 0. */
  living_percent: number | null;
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
  /** The living-area vocabulary id, asked at capture. Null means
      unclassified — the engine's `other` fallback — never a guess. */
  roomType?: string | null;
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
    if (isMissingTable(error)) throw new MigrationPendingError("room_scans", error.message);
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
      room_type: input.roomType ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("room_scans", error.message);
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
    roomType?: string | null;
    livingPercent?: number | null;
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
      ...(patch.roomType !== undefined ? { room_type: patch.roomType } : {}),
      ...(patch.livingPercent !== undefined ? { living_percent: patch.livingPercent } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`Could not save the change: ${error.message}`);
}

/** Which project a room belongs to. Used to file a photo against the right
    project without trusting a client-supplied id. */
export async function getRoomScanProject(id: string): Promise<string | null> {
  const client = requireDb();
  const { data, error } = await client
    .from("room_scans")
    .select("project_id")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("room_scans", error.message);
    throw new Error(`Could not find the room: ${error.message}`);
  }
  return (data?.project_id as string | undefined) ?? null;
}

/**
 * Record a plan the operator corrected by hand.
 *
 * The scan's own geometry is NEVER overwritten. The corrected outline is
 * added to the same jsonb blob under `editedPolygon`, beside the walls and
 * floors the sensor reported, so "what did the laser actually say" stays
 * answerable forever — which matters when an adjuster asks why a figure
 * changed between the first visit and the invoice.
 *
 * The derived numbers DO move, because they are the whole point of
 * correcting the plan: floor area and perimeter are recomputed from the
 * corrected outline and written to their columns, where every total, every
 * report line and every estimate reads them.
 */
export async function saveEditedPolygon(
  id: string,
  polygon: { x: number; y: number }[],
  lockedEdges: number[] = [],
): Promise<void> {
  const client = requireDb();

  const { data, error: readError } = await client
    .from("room_scans")
    .select("geometry, ceiling_height_m")
    .eq("id", id)
    .single();
  if (readError) throw new Error(`Could not find that room: ${readError.message}`);

  // Shoelace, absolute — a room traced clockwise measures the same as one
  // traced the other way, and an operator dragging corners has no idea which
  // way round they are going.
  let twiceArea = 0;
  let perimeter = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    twiceArea += a.x * b.y - b.x * a.y;
    perimeter += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const areaSqm = Math.abs(twiceArea) / 2;

  const geometry = {
    ...((data?.geometry ?? {}) as Record<string, unknown>),
    editedPolygon: polygon,
    // Which lengths were typed rather than measured. A claim file has to be
    // able to tell those apart — "which of these did you measure?" is a fair
    // question with a real answer.
    lockedEdges,
    editedAt: new Date().toISOString(),
  };

  const { error } = await client
    .from("room_scans")
    .update({
      geometry,
      floor_area_sqm: areaSqm,
      wall_length_m: perimeter,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`Could not save the corrected plan: ${error.message}`);
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
