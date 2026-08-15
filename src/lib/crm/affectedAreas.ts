import { db, isMissingTable, MigrationPendingError } from "./db";
import {
  polygonAreaSqm,
  type AffectedArea,
  type AffectedAreaInput,
  type AreaPoint,
  type DamageType,
} from "./areaShapes";

/**
 * Affected areas — the damaged region inside a scanned room. Database side.
 *
 * The measurement that becomes money. A scan says the basement floor is
 * 420 sq ft; an affected area says 96 sq ft of it is wet, and that is the
 * figure a flooring line is priced from.
 *
 * The shapes, colours and maths live in `areaShapes.ts`, which has no
 * database import — client components use that module directly. Everything
 * is re-exported here so server callers keep a single import.
 *
 * Square metres throughout, like every other measurement in this codebase;
 * feet are a presentation concern.
 */

export {
  DAMAGE_TYPES,
  DAMAGE_LABEL,
  DAMAGE_COLOR,
  polygonAreaSqm,
  areaColor,
  bySurface,
  floorAreas,
  wallAreas,
  totalsByDamageType,
  totalsBySurface,
  wallEdgeCorners,
  wallLengthM,
} from "./areaShapes";
export type {
  AffectedArea,
  AffectedAreaInput,
  AreaPoint,
  DamageType,
  SurfaceTotals,
} from "./areaShapes";

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

export async function listAffectedAreas(roomScanId: string): Promise<AffectedArea[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("affected_areas")
    .select("*")
    .eq("room_scan_id", roomScanId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("affected_areas", error.message);
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
    if (isMissingTable(error)) throw new MigrationPendingError("affected_areas", error.message);
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
    if (isMissingTable(error)) throw new MigrationPendingError("affected_areas", error.message);
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
