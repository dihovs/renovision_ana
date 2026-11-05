import { db, isMissingTable, MigrationPendingError } from "./db";

/**
 * The drying record: what the building was doing, and what was on site.
 *
 * This is the half of a restoration file that a floor plan cannot supply. A
 * plan proves the room is 420 sq ft; a moisture curve falling from 38% to
 * 14% over five days proves the drying was necessary, was carried out, and
 * could reasonably stop when it did. Adjusters reduce invoices for want of
 * exactly this.
 *
 * Every measured field is nullable throughout. Instruments differ — a pin
 * meter reads material and nothing else — and writing a zero for "not
 * measured" would put a number into a claim file that nobody read off a
 * device.
 */

export type MoistureReading = {
  id: string;
  created_at: string;
  room_scan_id: string;
  taken_at: string;
  location: string;
  material_percent: number | null;
  relative_humidity: number | null;
  temperature_c: number | null;
  gpp: number | null;
  material: string | null;
  notes: string | null;
};

export type EquipmentPlacement = {
  id: string;
  created_at: string;
  project_id: string;
  room_scan_id: string | null;
  kind: string;
  identifier: string | null;
  quantity: number;
  in_service_at: string;
  out_of_service_at: string | null;
  notes: string | null;
};

/** The machines a restoration job actually puts in a building. Offered as
    suggestions, never enforced — the rental catalogue changes. */
export const EQUIPMENT_KINDS = [
  "Air mover",
  "LGR dehumidifier",
  "Conventional dehumidifier",
  "Air scrubber / HEPA",
  "Heater",
  "Injectidry / wall drying",
  "Ozone generator",
] as const;

/** What a probe was put into. Changes what a percentage means, so a reading
    without it is hard to defend to an adjuster. */
export const MOISTURE_MATERIALS = [
  "Drywall",
  "Subfloor",
  "Framing / studs",
  "Concrete",
  "Insulation",
  "Hardwood",
  "Air (RH only)",
] as const;

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

function fail(error: { message: string }, table: string, what: string): never {
  if (isMissingTable(error)) throw new MigrationPendingError(table);
  throw new Error(`${what}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Moisture
// ---------------------------------------------------------------------------

export async function listMoistureReadings(roomScanId: string): Promise<MoistureReading[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("moisture_readings")
    .select("*")
    .eq("room_scan_id", roomScanId)
    .order("taken_at", { ascending: false });
  if (error) fail(error, "moisture_readings", "Could not load the readings");
  return (data ?? []) as MoistureReading[];
}

/** Every reading on a property, for the drying log page of the report. */
export async function listProjectMoistureReadings(
  projectId: string,
): Promise<(MoistureReading & { room_name: string })[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("moisture_readings")
    .select("*, room_scans!inner(project_id, name)")
    .eq("room_scans.project_id", projectId)
    .order("taken_at", { ascending: true });
  if (error) fail(error, "moisture_readings", "Could not load the readings");

  return (data ?? []).map((row) => {
    const { room_scans: room, ...reading } = row as MoistureReading & {
      room_scans: { name: string };
    };
    return { ...reading, room_name: room?.name ?? "Room" };
  });
}

export type MoistureInput = {
  roomScanId: string;
  takenAt?: string;
  location?: string;
  materialPercent?: number | null;
  relativeHumidity?: number | null;
  temperatureC?: number | null;
  gpp?: number | null;
  material?: string | null;
  notes?: string | null;
};

export async function createMoistureReading(input: MoistureInput): Promise<string> {
  const client = requireDb();
  const { data, error } = await client
    .from("moisture_readings")
    .insert({
      room_scan_id: input.roomScanId,
      // Defaulted here rather than relying on the column default, so a
      // reading logged over lunch still carries the morning's timestamp when
      // the caller supplies one.
      taken_at: input.takenAt ?? new Date().toISOString(),
      location: input.location?.trim().slice(0, 200) ?? "",
      material_percent: input.materialPercent ?? null,
      relative_humidity: input.relativeHumidity ?? null,
      temperature_c: input.temperatureC ?? null,
      gpp: input.gpp ?? null,
      material: input.material?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (error) fail(error, "moisture_readings", "Could not save the reading");
  return data.id as string;
}

export async function deleteMoistureReading(id: string): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("moisture_readings").delete().eq("id", id);
  if (error) throw new Error(`Could not remove the reading: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

export async function listEquipment(projectId: string): Promise<EquipmentPlacement[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("equipment_placements")
    .select("*")
    .eq("project_id", projectId)
    .order("in_service_at", { ascending: false });
  if (error) fail(error, "equipment_placements", "Could not load the equipment");
  return (data ?? []) as EquipmentPlacement[];
}

export type EquipmentInput = {
  projectId: string;
  roomScanId?: string | null;
  kind: string;
  identifier?: string | null;
  quantity?: number;
  inServiceAt?: string;
  outOfServiceAt?: string | null;
  notes?: string | null;
};

export async function createEquipment(input: EquipmentInput): Promise<string> {
  const client = requireDb();
  const { data, error } = await client
    .from("equipment_placements")
    .insert({
      project_id: input.projectId,
      room_scan_id: input.roomScanId ?? null,
      kind: input.kind.trim().slice(0, 120) || "Equipment",
      identifier: input.identifier?.trim() || null,
      quantity: Math.max(1, Math.round(input.quantity ?? 1)),
      in_service_at: input.inServiceAt ?? new Date().toISOString(),
      out_of_service_at: input.outOfServiceAt ?? null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (error) fail(error, "equipment_placements", "Could not save the equipment");
  return data.id as string;
}

export async function updateEquipment(
  id: string,
  patch: { outOfServiceAt?: string | null; quantity?: number; notes?: string | null },
): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("equipment_placements")
    .update({
      ...(patch.outOfServiceAt !== undefined ? { out_of_service_at: patch.outOfServiceAt } : {}),
      ...(patch.quantity !== undefined ? { quantity: Math.max(1, Math.round(patch.quantity)) } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
    })
    .eq("id", id);
  if (error) throw new Error(`Could not save the change: ${error.message}`);
}

export async function deleteEquipment(id: string): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("equipment_placements").delete().eq("id", id);
  if (error) throw new Error(`Could not remove the equipment: ${error.message}`);
}

/**
 * Billable unit-days for one placement.
 *
 * Equipment is billed per unit per day on site, and the day it arrives and
 * the day it leaves are both billable — a dehumidifier delivered Monday and
 * collected Wednesday is three days, not two. Still-running equipment is
 * counted to `asOf` so a live job shows a running total rather than zero.
 *
 * Days, not hours: nobody in this trade bills a dehumidifier by the hour, and
 * rounding part-days down would systematically under-bill every job.
 */
export function unitDays(
  placement: Pick<EquipmentPlacement, "quantity" | "in_service_at" | "out_of_service_at">,
  asOf: Date,
): number {
  const start = new Date(placement.in_service_at);
  const end = placement.out_of_service_at ? new Date(placement.out_of_service_at) : asOf;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  // Compared by calendar day, so an 8am delivery and a 4pm collection on the
  // same date is one day rather than zero.
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  if (endDay < startDay) return 0;

  const days = Math.round((endDay - startDay) / 86_400_000) + 1;
  return days * placement.quantity;
}

/** What the whole job's equipment adds up to, for the report and the
    estimate line it justifies. */
export function totalUnitDays(placements: EquipmentPlacement[], asOf: Date): number {
  return placements.reduce((sum, placement) => sum + unitDays(placement, asOf), 0);
}

// ---------------------------------------------------------------------------
// Matching a spoken room name to a room scan (ANA-14)
// ---------------------------------------------------------------------------

export type RoomMatch =
  | { kind: "none" }
  | { kind: "one"; room: { id: string; name: string } }
  | { kind: "many"; rooms: { id: string; name: string }[] };

function roomKey(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Which room the owner means, from what he said.
 *
 * Same posture as contactMatch and rankTaskMatches: fail towards asking. A
 * reading filed against the wrong room corrupts the drying log an adjuster may
 * later read, so a winner must be the only room whose name contains the spoken
 * words (or vice versa — "the bathroom" should find "Salle de bain — bathroom"
 * and "Bathroom 2nd floor" both, and then ask). Pure, for testing without a
 * database.
 */
export function rankRoomMatches(
  spoken: string,
  rooms: { id: string; name: string }[],
): RoomMatch {
  const wanted = roomKey(spoken);
  if (!wanted || rooms.length === 0) return { kind: "none" };

  const hits = rooms.filter((room) => {
    const name = roomKey(room.name);
    return name.includes(wanted) || wanted.includes(name);
  });

  if (hits.length === 0) return { kind: "none" };
  if (hits.length === 1) return { kind: "one", room: hits[0] };
  return { kind: "many", rooms: hits };
}
