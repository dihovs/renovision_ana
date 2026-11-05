import { db, isMissingTable, MigrationPendingError } from "./db";
import { polishNote, NotesPolishError } from "../notesPolish";
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
  ceilingAreas,
  planAreas,
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

/**
 * The AI pass over damage notes, run at report/estimate generation time —
 * the owner's ask: he writes what he sees in his own words on site, and the
 * report should not go to an adjuster in that voice unedited.
 *
 * **Polished once, cached, not repeated on every export.** `notes_polished`
 * is written back to the row alongside `notes_polished_source` — a copy of
 * `notes` as it stood at that moment. A later call compares the two: equal
 * means the cached polish still describes the current note and nothing is
 * sent to the model again; different means the operator edited the note
 * since, and it is redone. This is the whole cache — no separate flag that
 * could fall out of step with the text it describes.
 *
 * Returns the areas with `notes_polished` filled in for immediate use by
 * the caller rendering THIS export, so a first-ever export is not one
 * render behind its own cache write.
 *
 * **A polish failure does not fail the export.** The report prints the
 * operator's own words when the model can't be reached rather than
 * blocking the document on a writing assistant being down — the raw note
 * is always a safe fallback, because it is the actual record.
 */
export async function ensurePolishedNotes(areas: AffectedArea[]): Promise<AffectedArea[]> {
  const client = requireDb();
  return Promise.all(
    areas.map(async (area) => {
      const notes = area.notes?.trim();
      if (!notes) return area;
      if (area.notes_polished && area.notes_polished_source === area.notes) return area;

      try {
        const polished = await polishNote(notes);
        const { error } = await client
          .from("affected_areas")
          .update({ notes_polished: polished, notes_polished_source: area.notes })
          .eq("id", area.id);
        // A failed cache WRITE still leaves a good polish to print this
        // once — only a read on the NEXT export would miss it, which costs
        // one repeated model call, not a wrong document.
        if (error) console.error("[affectedAreas] could not cache the polished note:", error.message);
        return { ...area, notes_polished: polished, notes_polished_source: area.notes };
      } catch (err) {
        if (!(err instanceof NotesPolishError)) {
          console.error("[affectedAreas] note polish failed:", err);
        }
        return area;
      }
    }),
  );
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
    showDimensions?: boolean;
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
      ...(patch.showDimensions !== undefined ? { show_dimensions: patch.showDimensions } : {}),
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
