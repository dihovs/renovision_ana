import type { ReportRoom } from "@/components/admin/ReportDocument";
import { listRoomFiles, signProjectFileUrls, type Project } from "@/lib/crm/projects";
import { listRoomScans } from "@/lib/crm/roomScans";
import { getFloorWallWidths, resolveWallWidths } from "@/lib/crm/floorDisplay";
import { listAffectedAreas, ensurePolishedNotes } from "@/lib/crm/affectedAreas";
import { listRoomWalls } from "@/lib/crm/roomWalls";
import { listProjectObjects } from "@/lib/crm/roomObjects";
import { listEquipment, listMoistureReadings } from "@/lib/crm/dryingLog";
import { CLAIM_FIELD_TEMPLATE, getCompany, getCustomFields } from "@/lib/crm/settings";
import { trustedFloorAreaSquareMeters, type ScanGeometry } from "@/lib/roomScan";

/**
 * Everything the restoration report draws, for one project.
 *
 * Shared by the private report (`/admin/projects/[id]/report`) and the
 * view-only share link (`/s/[token]`), so the two can never disagree about
 * what a room measures — the share page only ever REMOVES fields from this.
 */
export async function loadReportData(project: Project) {
  const company = await getCompany();

  let claimFields = CLAIM_FIELD_TEMPLATE;
  try {
    const configured = (await getCustomFields()).project;
    if (configured.length > 0) claimFields = configured;
  } catch {
    // The template is a fine default; a settings failure is not a reason to
    // withhold the report.
  }

  // Each of these can be absent — a migration not yet run, a job with no
  // drying — and each failure narrows the report rather than breaking it.
  const [scans, wallWidths] = await Promise.all([
    listRoomScans(project.id).catch(() => []),
    getFloorWallWidths(project.id).catch(() => ({})),
  ]);
  const equipment = await listEquipment(project.id).catch(() => []);
  // The bath, the toilet, the counter run. One query for the whole project
  // rather than one per room: a nine-room job is nine round trips otherwise,
  // and the report already waits on enough of them.
  const objects = await listProjectObjects(project.id).catch(() => []);

  const rooms: ReportRoom[] = await Promise.all(
    scans.map(async (scan) => {
      const [rawAreas, readings, files, walls] = await Promise.all([
        listAffectedAreas(scan.id).catch(() => []),
        listMoistureReadings(scan.id).catch(() => []),
        listRoomFiles(scan.id).catch(() => []),
        listRoomWalls(scan.id).catch(() => []),
      ]);
      // The owner's ask: his own on-site wording gets an AI pass before it
      // reaches an adjuster. Cached on the row after the first export — see
      // `ensurePolishedNotes` — so this costs a model call only the first
      // time a note is printed, or after it is edited.
      const areas = await ensurePolishedNotes(rawAreas).catch(() => rawAreas);
      const thumbnailPaths = files
        .map((file) => file.thumbnail_path)
        .filter((path): path is string => Boolean(path));
      const urls = await signProjectFileUrls([
        ...files.map((file) => file.storage_path),
        ...thumbnailPaths,
      ]).catch(() => ({}) as Record<string, string>);

      return {
        id: scan.id,
        name: scan.name,
        level: scan.level,
        // Capped by the drawing's own extent — see
        // `trustedFloorAreaSquareMeters`. A live report was printing
        // `Total area 87.21 m²` for a room whose own plan measures 38.8.
        floorAreaSqm: trustedFloorAreaSquareMeters(
          Number(scan.floor_area_sqm),
          scan.geometry as unknown as ScanGeometry | null,
        ),
        wallLengthM: Number(scan.wall_length_m),
        ceilingHeightM: Number(scan.ceiling_height_m),
        stairCount: scan.stair_count,
        // The running header prints LIVING AREA on every page, so the share
        // has to reach the report — it was only ever on the phone before.
        roomType: scan.room_type,
        livingAreaPercent:
          scan.living_percent == null ? null : Number(scan.living_percent),
        notes: scan.notes,
        // Where the operator dragged this room on the storey canvas. The
        // report draws the floor from these, so what he arranged is what
        // prints — and where they are null it says so rather than implying a
        // building it has no positions for.
        planX: scan.plan_x === null || scan.plan_x === undefined ? null : Number(scan.plan_x),
        planY: scan.plan_y === null || scan.plan_y === undefined ? null : Number(scan.plan_y),
        // Excluded objects are off the claim, but they are still standing in
        // the room — a vanity nobody is charging for is still in the way of
        // the floor, and a plan that hides it is a plan of a different room.
        objects: objects
          .filter((object) => object.roomScanId === scan.id)
          .map((object) => ({
            id: object.id,
            kind: object.kind,
            name: object.name,
            x: object.x,
            y: object.y,
            rotation: object.rotation,
            widthM: object.width,
            depthM: object.depth,
          })),
        geometry: scan.geometry as unknown as ScanGeometry,
        areas,
        // Oldest first here, unlike the phone: a drying log reads as a
        // sequence, and a curve printed backwards has to be read backwards.
        readings: [...readings].reverse(),
        photos: files.slice(0, 6).map((file) => ({
          id: file.id,
          url: urls[file.storage_path] ?? null,
          note: file.note,
          contentType: file.content_type,
          thumbnailUrl: file.thumbnail_path ? (urls[file.thumbnail_path] ?? null) : null,
        })),
        wallDisplayElevation: new Map(walls.map((w) => [w.wall_index, w.display_elevation])),
        openWalls: walls.filter((w) => w.is_open).map((w) => w.wall_index),
      };
    }),
  );

  const levels: string[] = [];
  for (const room of rooms) if (!levels.includes(room.level)) levels.push(room.level);

  // The address of the loss, which is a claim field rather than a project
  // column — a landlord's claim is for a property they do not live at.
  const claim = (project.custom ?? {}) as Record<string, string>;
  const property = claim.loss_address?.trim() || null;

  return {
    company,
    claimFields,
    claim,
    property,
    rooms,
    levels,
    equipment,
    floorWalls: Object.fromEntries(levels.map((level) => [level, resolveWallWidths(wallWidths, level)])),
  };
}
