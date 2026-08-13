import { db, isMissingTable, MigrationPendingError } from "./db";

/**
 * Affected areas — the damaged region inside a scanned room.
 *
 * The measurement that becomes money. A scan says the basement floor is
 * 420 sq ft; an affected area says 96 sq ft of it is wet, and that is the
 * figure a flooring line is priced from.
 *
 * Square metres throughout, like every other measurement in this codebase;
 * feet are a presentation concern.
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
 * The default colour per cause. Chosen to stay apart from each other and
 * from the plan's own black-on-grey, and to read at the size an area is
 * actually drawn — a thumbnail, over a floor, under a dimension line.
 */
export const DAMAGE_COLOR: Record<DamageType, string> = {
  water: "#2b7fd4",
  fire: "#e2673a",
  mould: "#4f9d3a",
  impact: "#8a63d2",
  other: "#8a8a8e",
};

export type AreaPoint = { x: number; y: number };

export type AffectedArea = {
  id: string;
  created_at: string;
  room_scan_id: string;
  surface: "floor" | "wall";
  wall_index: number | null;
  name: string;
  damage_type: DamageType;
  color: string | null;
  area_sqm: number;
  polygon: AreaPoint[];
  notes: string | null;
};

export type AffectedAreaInput = {
  roomScanId: string;
  surface?: "floor" | "wall";
  wallIndex?: number | null;
  name?: string;
  damageType?: DamageType;
  color?: string | null;
  polygon: AreaPoint[];
  notes?: string | null;
};

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

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

export async function listAffectedAreas(roomScanId: string): Promise<AffectedArea[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("affected_areas")
    .select("*")
    .eq("room_scan_id", roomScanId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("affected_areas");
    throw new Error(`Could not load the affected areas: ${error.message}`);
  }
  return (data ?? []) as AffectedArea[];
}

/** Every area across a whole project, for totals and for the report. */
export async function listProjectAffectedAreas(projectId: string): Promise<AffectedArea[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("affected_areas")
    .select("*, room_scans!inner(project_id)")
    .eq("room_scans.project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("affected_areas");
    throw new Error(`Could not load the affected areas: ${error.message}`);
  }
  return (data ?? []) as AffectedArea[];
}

export async function createAffectedArea(input: AffectedAreaInput): Promise<string> {
  const client = requireDb();
  const surface = input.surface ?? "floor";
  const { data, error } = await client
    .from("affected_areas")
    .insert({
      room_scan_id: input.roomScanId,
      surface,
      // The constraint enforces this too; doing it here means a malformed
      // row fails as a clear message rather than a constraint name.
      wall_index: surface === "wall" ? (input.wallIndex ?? 0) : null,
      name: input.name?.trim().slice(0, 200) || "Affected area",
      damage_type: input.damageType ?? "water",
      color: input.color?.trim() || null,
      area_sqm: polygonAreaSqm(input.polygon),
      polygon: input.polygon,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("affected_areas");
    throw new Error(`Could not save the affected area: ${error.message}`);
  }
  return data.id as string;
}

/**
 * Reshaping recomputes the area. The polygon and its measurement are one
 * fact stored twice, and letting them drift would mean an estimate priced
 * from a number that no longer matches the shape on the plan.
 */
export async function updateAffectedArea(
  id: string,
  patch: {
    name?: string;
    damageType?: DamageType;
    color?: string | null;
    polygon?: AreaPoint[];
    notes?: string | null;
  },
): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("affected_areas")
    .update({
      ...(patch.name !== undefined
        ? { name: patch.name.trim().slice(0, 200) || "Affected area" }
        : {}),
      ...(patch.damageType !== undefined ? { damage_type: patch.damageType } : {}),
      ...(patch.color !== undefined ? { color: patch.color?.trim() || null } : {}),
      ...(patch.polygon !== undefined
        ? { polygon: patch.polygon, area_sqm: polygonAreaSqm(patch.polygon) }
        : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`Could not save the change: ${error.message}`);
}

export async function deleteAffectedArea(id: string): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("affected_areas").delete().eq("id", id);
  if (error) throw new Error(`Could not remove the affected area: ${error.message}`);
}

/**
 * Damaged area totalled by cause.
 *
 * By cause rather than one grand total because the causes do not share a
 * trade or a rate — and because areas may overlap, a single sum across all
 * of them would double-count the square footage where a wall is both wet
 * and smoke-stained.
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
