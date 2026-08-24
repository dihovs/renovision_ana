// Build the derivation context from a project's own records. This module is
// the ONLY bridge between the database and the rules: everything the rules
// cite comes through here, from the same loaders the report uses — one set
// of measurements, two documents, no way for them to disagree.

import { listRoomScans, type RoomScan } from "../../crm/roomScans";
import { listProjectAffectedAreas } from "../../crm/affectedAreas";
import { listProjectObjects } from "../../crm/roomObjects";
import { listEquipment, listMoistureReadings } from "../../crm/dryingLog";
import { wallLengthM } from "../../crm/areaShapes";
import {
  planCorners,
  savedCeilingHeightMeters,
  savedFloorAreaSquareMeters,
  savedPerimeterMeters,
  savedWallAreaSquareMeters,
  toFloorPlan,
  type RoomScanOpening,
  type SavedScan,
  type ScanGeometry,
} from "../../roomScan";
import type { EstimateContext, EstimateRoom } from "./types";

function asSavedScan(scan: RoomScan): SavedScan {
  return scan as unknown as SavedScan;
}

/** Doorway widths off the scan's own openings — what baseboard length
    subtracts from the perimeter, because trim does not run across a
    doorway. Same figure `baseboardLengthMeters` uses; recomputed here
    against the SAVED perimeter so a hand-corrected outline stays the
    authority (the column-wins rule of roomScan.ts). */
function doorwayWidthsMeters(geometry: ScanGeometry): number {
  const walkThrough: RoomScanOpening[] = [
    ...(geometry.doors ?? []),
    ...(geometry.openings ?? []),
  ];
  return walkThrough.reduce((sum, opening) => sum + (opening.widthMeters || 0), 0);
}

export function roomFromScan(
  scan: RoomScan,
  affectedAreas: EstimateRoom["affectedAreas"],
  objects: EstimateRoom["objects"],
): EstimateRoom {
  const saved = asSavedScan(scan);
  const geometry = saved.geometry ?? ({} as ScanGeometry);
  const perimeterM = savedPerimeterMeters(saved);
  const wallArea = savedWallAreaSquareMeters(saved);

  let wallLengthsM: number[] = [];
  try {
    const corners = planCorners(toFloorPlan(geometry));
    wallLengthsM = corners.map((_, i) => wallLengthM(corners, i));
  } catch {
    // A scan with no usable outline still estimates; per-wall rules just
    // derive zero-length and stand down.
  }

  return {
    roomScanId: scan.id,
    name: scan.name,
    stats: {
      level: scan.level,
      floorAreaSqm: savedFloorAreaSquareMeters(saved),
      perimeterM,
      ceilingHeightM: savedCeilingHeightMeters(saved),
      wallAreaGrossSqm: wallArea.gross,
      wallAreaNetSqm: wallArea.net,
      doorCount: scan.door_count,
      windowCount: scan.window_count,
    },
    wallLengthsM,
    baseboardLengthM: Math.max(0, perimeterM - doorwayWidthsMeters(geometry)),
    floorFinish: scan.floor_finish ?? null,
    affectedAreas,
    objects,
  };
}

export async function buildEstimateContext(projectId: string): Promise<EstimateContext> {
  const [scans, areas, objects, equipment] = await Promise.all([
    listRoomScans(projectId),
    listProjectAffectedAreas(projectId).catch(() => []),
    listProjectObjects(projectId).catch(() => []),
    listEquipment(projectId).catch(() => []),
  ]);

  const readingsPerRoom = await Promise.all(
    scans.map((scan) => listMoistureReadings(scan.id).catch(() => [])),
  );

  const rooms = scans.map((scan) =>
    roomFromScan(
      scan,
      areas.filter((area) => area.room_scan_id === scan.id),
      objects.filter((object) => object.roomScanId === scan.id),
    ),
  );

  return {
    rooms,
    equipment,
    readings: readingsPerRoom.flat(),
    asOf: new Date(),
  };
}
