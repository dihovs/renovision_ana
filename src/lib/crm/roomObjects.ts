import { db, isMissingTable, MigrationPendingError } from "./db";

/**
 * Objects standing in a room — cabinets, toilets, vanities, appliances.
 * Database side.
 *
 * ORD-40 / ORD-36. The owner, asked what an object has to DO on his jobs,
 * 18 Aug 2026: *"well if replaced, if there is damage, it needs to be
 * counted, there is installation involved also, i need to have an option to
 * include or exclude it like any other item."* So an object is a line item,
 * not decoration — which is why it is a table and not more JSON on the scan.
 *
 * **An object is not an opening.** An opening lives IN a wall, is keyed to an
 * edge index, and DEDUCTS from net wall area. An object sits ON the floor,
 * has a position rather than a host edge, keeps its own height, and deducts
 * nothing. The two models stay separate on purpose: modelling a cabinet as
 * an opening is how it would start subtracting wall area that is still
 * there.
 *
 * Metres throughout, like every other measurement in this codebase.
 */

/** What is happening to the object on this job — the "installation" half. */
export const DISPOSITIONS = ["none", "remove", "reset", "replace", "protect"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export const DISPOSITION_LABEL: Record<Disposition, string> = {
  none: "In place",
  remove: "Remove & dispose",
  reset: "Remove & reset",
  replace: "Replace",
  protect: "Protect in place",
};

export type RoomObject = {
  id: string;
  roomScanId: string;
  /** Catalogue slug — resolved in the app, deliberately not constrained here. */
  kind: string;
  name: string | null;
  x: number;
  y: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  disposition: Disposition;
  included: boolean;
  quantity: number;
  notes: string | null;
};

export type RoomObjectInput = {
  roomScanId: string;
  kind: string;
  name?: string | null;
  x: number;
  y: number;
  rotation?: number;
  width: number;
  depth: number;
  height: number;
  disposition?: Disposition;
  included?: boolean;
  quantity?: number;
  notes?: string | null;
};

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

type Row = Record<string, unknown>;

function toObject(row: Row): RoomObject {
  return {
    id: String(row.id),
    roomScanId: String(row.room_scan_id),
    kind: String(row.kind),
    name: (row.name as string | null) ?? null,
    x: Number(row.x ?? 0),
    y: Number(row.y ?? 0),
    rotation: Number(row.rotation ?? 0),
    width: Number(row.width ?? 0),
    depth: Number(row.depth ?? 0),
    height: Number(row.height ?? 0),
    disposition: (DISPOSITIONS as readonly string[]).includes(String(row.disposition))
      ? (row.disposition as Disposition)
      : "none",
    included: row.included !== false,
    quantity: Number(row.quantity ?? 1),
    notes: (row.notes as string | null) ?? null,
  };
}

export async function listRoomObjects(roomScanId: string): Promise<RoomObject[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("room_objects")
    .select("*")
    .eq("room_scan_id", roomScanId)
    .order("created_at", { ascending: true });

  if (error) {
    // A table that is not there yet is a routine state in this project —
    // migrations are applied by hand — and the phone can say which file to
    // run rather than "server error".
    if (isMissingTable(error)) throw new MigrationPendingError("room_objects", error.message);
    throw new Error(`Could not read the room's objects: ${error.message}`);
  }
  return (data ?? []).map((row) => toObject(row as Row));
}

export async function createRoomObject(input: RoomObjectInput): Promise<string> {
  const client = requireDb();
  const { data, error } = await client
    .from("room_objects")
    .insert({
      room_scan_id: input.roomScanId,
      kind: input.kind,
      name: input.name?.trim().slice(0, 200) || null,
      x: input.x,
      y: input.y,
      rotation: input.rotation ?? 0,
      width: input.width,
      depth: input.depth,
      height: input.height,
      disposition: input.disposition ?? "none",
      included: input.included ?? true,
      // Guarded here as well as by the check constraint, so a bad value
      // fails as a sentence rather than as a constraint name.
      quantity: Math.max(1, Math.round(input.quantity ?? 1)),
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("room_objects", error.message);
    throw new Error(`Could not place the object: ${error.message}`);
  }
  return data.id as string;
}

export async function updateRoomObject(
  id: string,
  patch: {
    name?: string | null;
    x?: number;
    y?: number;
    rotation?: number;
    width?: number;
    depth?: number;
    height?: number;
    disposition?: Disposition;
    included?: boolean;
    quantity?: number;
    notes?: string | null;
  },
): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("room_objects")
    .update({
      ...(patch.name !== undefined ? { name: patch.name?.trim().slice(0, 200) || null } : {}),
      ...(patch.x !== undefined ? { x: patch.x } : {}),
      ...(patch.y !== undefined ? { y: patch.y } : {}),
      ...(patch.rotation !== undefined ? { rotation: patch.rotation } : {}),
      ...(patch.width !== undefined ? { width: patch.width } : {}),
      ...(patch.depth !== undefined ? { depth: patch.depth } : {}),
      ...(patch.height !== undefined ? { height: patch.height } : {}),
      ...(patch.disposition !== undefined ? { disposition: patch.disposition } : {}),
      ...(patch.included !== undefined ? { included: patch.included } : {}),
      ...(patch.quantity !== undefined
        ? { quantity: Math.max(1, Math.round(patch.quantity)) }
        : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`Could not save the change: ${error.message}`);
}

export async function deleteRoomObject(id: string): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("room_objects").delete().eq("id", id);
  if (error) throw new Error(`Could not remove the object: ${error.message}`);
}

/**
 * The takeoff this table exists for: how many of each kind are IN the claim.
 *
 * Excluded objects are left out entirely rather than counted and flagged —
 * "include or exclude it like any other item" means an excluded object is
 * not on the list, the same way an unticked line is not on an estimate.
 * `quantity` is summed, not counted, because one row can stand for eight
 * identical base cabinets along a run.
 */
export function countByKind(objects: RoomObject[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const object of objects) {
    if (!object.included) continue;
    counts[object.kind] = (counts[object.kind] ?? 0) + object.quantity;
  }
  return counts;
}
