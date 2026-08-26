import { readFileSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import FloorPlan from "../../../components/admin/FloorPlan";
import {
  savedCeilingHeightMeters,
  savedFloorAreaSquareMeters,
  savedPerimeterMeters,
  savedWallAreaSquareMeters,
  toFloorPlan,
  planCorners,
  type SavedScan,
  type ScanGeometry,
} from "../../roomScan";
import { wallLengthM } from "../../crm/areaShapes";
import type { AffectedArea } from "../../crm/areaShapes";
import type { EquipmentPlacement, MoistureReading } from "../../crm/dryingLog";
import type { RoomObject } from "../../crm/roomObjects";
import { applyMinimumCharges, deriveLines, mergeLines } from "./derive";
import { allocateLines, estimateTotals } from "./trailer";
import { POLYGON_TRAILER, type EstimateContext, type EstimateRoom } from "./types";

/**
 * The worked sample, drawn from the owner's OWN room.
 *
 * *"Now use a real plan from my app."* The geometry is what build 207's
 * exporter wrote and `devicectl` fetched off his phone — his 2nd floor's
 * Living room, 14 walls, 5 doors, 2 windows, his corrected outline, and the
 * 26 RoomPlan detections that were standing in it. Nothing here is
 * transcribed or redrawn: the blob is the same one the server stores, and
 * the plan is rendered by the REPORT'S OWN `FloorPlan` component, so what
 * prints in the sample is what would print in a real document.
 *
 * What IS invented, and is labelled as such on the page: the damage. His
 * scan carries no affected areas, and a sample with no damage prices
 * nothing — so two areas are placed on the real floor, sized as fractions
 * of the real measured area rather than typed in.
 *
 * Asserts nothing. Run: npx vitest run realroom.sample
 */

type Exported = {
  id: string;
  name: string;
  level: string;
  ceilingHeightM: number;
  planX: number | null;
  planY: number | null;
  geometry: ScanGeometry;
};

const reading = (p: Partial<MoistureReading>): MoistureReading => ({
  id: "r", created_at: "", room_scan_id: "real", taken_at: "2026-08-23T14:00:00Z",
  location: "North wall", material_percent: 41, relative_humidity: null,
  temperature_c: null, gpp: null, material: "Drywall", notes: null, ...p,
});

describe("worked sample — the owner's real room", () => {
  it("derives an estimate and draws the real plan", () => {
    const exported = JSON.parse(readFileSync("/tmp/sg.json", "utf8")) as Exported[];
    const source = exported[0];
    const geometry = source.geometry;

    // The scan row as the app's own helpers expect it. Counts come from the
    // geometry so the figures match what the phone shows.
    const scan: SavedScan = {
      id: source.id,
      name: source.name,
      level: source.level,
      position: 0,
      floor_area_sqm: 0,
      wall_length_m: 0,
      ceiling_height_m: source.ceilingHeightM,
      door_count: geometry.doors?.length ?? 0,
      window_count: geometry.windows?.length ?? 0,
      stair_count: 0,
      geometry,
    };

    const floorAreaSqm = savedFloorAreaSquareMeters(scan);
    const perimeterM = savedPerimeterMeters(scan);
    const wallArea = savedWallAreaSquareMeters(scan);
    const ceilingHeightM = savedCeilingHeightMeters(scan);
    const corners = planCorners(toFloorPlan(geometry));
    const wallLengthsM = corners.map((_, i) => wallLengthM(corners, i));

    // Doorways come off the perimeter for trim, the same subtraction the
    // context builder makes.
    const doorways = [...(geometry.doors ?? []), ...(geometry.openings ?? [])].reduce(
      (sum, o) => sum + (o.widthMeters || 0),
      0,
    );

    // **The damage, and the only invented thing here.** Placed on the real
    // floor and sized against the real measured area: a wet patch across a
    // quarter of it, and a metre-and-a-half of wet wall on edge 1.
    const bbox = corners.reduce(
      (b, p) => ({
        minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x),
        minY: Math.min(b.minY, p.y), maxY: Math.max(b.maxY, p.y),
      }),
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    );
    const w = bbox.maxX - bbox.minX;
    const h = bbox.maxY - bbox.minY;
    const patch = [
      { x: bbox.minX + w * 0.12, y: bbox.minY + h * 0.55 },
      { x: bbox.minX + w * 0.62, y: bbox.minY + h * 0.55 },
      { x: bbox.minX + w * 0.62, y: bbox.minY + h * 0.95 },
      { x: bbox.minX + w * 0.12, y: bbox.minY + h * 0.95 },
    ];
    const patchArea = w * 0.5 * (h * 0.4);

    const areas: AffectedArea[] = [
      {
        id: "dmg-floor", created_at: "", room_scan_id: source.id, surface: "floor",
        wall_index: null, name: "Dégât d'eau — plancher", damage_type: "water",
        color: null, area_sqm: patchArea, polygon: patch, notes: null,
        show_dimensions: false,
      },
      {
        id: "dmg-wall", created_at: "", room_scan_id: source.id, surface: "wall",
        wall_index: 1, name: "Mur humide", damage_type: "water", color: null,
        area_sqm: Math.min(3.2, (wallLengthsM[1] ?? 2) * 1.2),
        polygon: [{ x: 0, y: 0 }, { x: 1.6, y: 0 }, { x: 1.6, y: 1.2 }, { x: 0, y: 1.2 }],
        notes: null, show_dimensions: false,
      },
    ];

    // Two of his own detections, given dispositions — a real sofa and a real
    // television, at the sizes RoomPlan measured them.
    const detected = (geometry as unknown as { detected?: Record<string, number | string>[] })
      .detected ?? [];
    const pick = (category: string) => detected.find((d) => d.category === category);
    const objects: RoomObject[] = [];
    const sofa = pick("sofa");
    if (sofa) {
      objects.push({
        id: "obj-sofa", roomScanId: source.id, kind: "sofa", name: null,
        x: Number(sofa.centerX), y: Number(sofa.centerZ), rotation: 0,
        width: Number(sofa.widthMeters), depth: Number(sofa.depthMeters), height: 0.8,
        disposition: "reset", included: true, quantity: 1, sizeHandSet: false, notes: null,
      });
    }
    const tv = pick("television");
    if (tv) {
      objects.push({
        id: "obj-tv", roomScanId: source.id, kind: "television", name: null,
        x: Number(tv.centerX), y: Number(tv.centerZ), rotation: 0,
        width: Number(tv.widthMeters), depth: Number(tv.depthMeters), height: 0.7,
        disposition: "protect", included: true, quantity: 1, sizeHandSet: false, notes: null,
      });
    }

    const room: EstimateRoom = {
      roomScanId: source.id,
      name: source.name,
      stats: {
        level: source.level, floorAreaSqm, perimeterM, ceilingHeightM,
        wallAreaGrossSqm: wallArea.gross, wallAreaNetSqm: wallArea.net,
        doorCount: scan.door_count, windowCount: scan.window_count,
      },
      wallLengthsM,
      baseboardLengthM: Math.max(0, perimeterM - doorways),
      floorFinish: "engineered",
      affectedAreas: areas,
      objects,
    };

    const equipment: EquipmentPlacement[] = [
      {
        id: "e1", created_at: "", project_id: "p", room_scan_id: source.id,
        kind: "LGR dehumidifier", identifier: "LGR-1", quantity: 1,
        in_service_at: "2026-08-23T09:00:00Z", out_of_service_at: "2026-08-25T17:00:00Z",
        notes: null,
      },
      {
        id: "e2", created_at: "", project_id: "p", room_scan_id: source.id,
        kind: "Air mover", identifier: "AM-1", quantity: 2,
        in_service_at: "2026-08-23T09:00:00Z", out_of_service_at: "2026-08-25T17:00:00Z",
        notes: null,
      },
    ];

    const context: EstimateContext = {
      rooms: [room],
      equipment,
      readings: [
        reading({ id: "r1", taken_at: "2026-08-23T14:00:00Z" }),
        reading({ id: "r2", taken_at: "2026-08-24T15:00:00Z" }),
        reading({ id: "r3", taken_at: "2026-08-25T15:00:00Z" }),
      ],
      asOf: new Date("2026-08-25T18:00:00Z"),
    };

    const lines = applyMinimumCharges(mergeLines([], deriveLines(context)), {});
    const allocated = allocateLines(lines, POLYGON_TRAILER);
    const totals = estimateTotals(allocated);

    // **The plan, by the report's own renderer.** Not a redrawing: the same
    // component the report and the estimate print, handed the same geometry
    // the server stores, with the damage shaded on it.
    const svg = renderToStaticMarkup(
      createElement(FloorPlan, {
        result: geometry,
        name: source.name,
        locale: "fr",
        objects: objects.map((o) => ({
          id: o.id, kind: o.kind, name: o.name, x: o.x, y: o.y,
          rotation: o.rotation, widthM: o.width, depthM: o.depth,
        })),
        areas: areas
          .filter((a) => a.surface !== "wall")
          .map((a) => ({ id: a.id, polygon: a.polygon, color: "#3f83d6" })),
      }),
    );

    writeFileSync(
      "/tmp/realroom.json",
      JSON.stringify(
        {
          room: {
            name: source.name, level: source.level,
            floorAreaSqm, perimeterM, ceilingHeightM,
            wallGross: wallArea.gross, wallNet: wallArea.net,
            baseboardM: room.baseboardLengthM,
            doors: scan.door_count, windows: scan.window_count,
            detections: detected.length,
            damageFloorSqm: patchArea,
          },
          lines: allocated,
          totals,
          svg,
        },
        null,
        2,
      ),
    );
    console.log(
      `real room: ${source.name} — ${floorAreaSqm.toFixed(2)} m² floor, ` +
        `${perimeterM.toFixed(2)} m perimeter, ${detected.length} detections, ` +
        `${allocated.length} lines, total ${(totals.totalCents / 100).toFixed(2)}`,
    );
  });
});
