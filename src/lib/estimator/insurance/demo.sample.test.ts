import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import type { AffectedArea } from "../../crm/areaShapes";
import type { EquipmentPlacement, MoistureReading } from "../../crm/dryingLog";
import type { RoomObject } from "../../crm/roomObjects";
import { applyMinimumCharges, deriveLines, mergeLines } from "./derive";
import { allocateLines, estimateTotals } from "./trailer";
import { POLYGON_TRAILER, type EstimateContext, type EstimateRoom } from "./types";

/**
 * A worked sample of the insurance estimate, for the owner to look at.
 *
 * **Not a test of anything** — it asserts nothing. It exists because he
 * asked to SEE an estimate before trusting it, and the only honest way to
 * show one is to run the real engine over invented measurements rather than
 * to mock up a picture of what it might say. Every figure in the output is
 * computed by the same `deriveLines` / `allocateLines` / `estimateTotals`
 * the app calls; only the room is fictional.
 *
 * Run it with: npx vitest run demo.sample
 */

const area = (p: Partial<AffectedArea>): AffectedArea => ({
  id: "a", created_at: "", room_scan_id: "bath", surface: "floor", wall_index: null,
  name: "Affected area", damage_type: "water", color: null, area_sqm: 1, polygon: [],
  notes: null, show_dimensions: false, ...p,
});

const object = (p: Partial<RoomObject>): RoomObject => ({
  id: "o", roomScanId: "bath", kind: "toilet", name: null, x: 0, y: 0, rotation: 0,
  width: 0.7, depth: 0.4, height: 0.75, disposition: "none", included: true,
  quantity: 1, sizeHandSet: false, notes: null, ...p,
});

const placement = (p: Partial<EquipmentPlacement>): EquipmentPlacement => ({
  id: "e", created_at: "", project_id: "p", room_scan_id: "bath", kind: "LGR dehumidifier",
  identifier: null, quantity: 1, in_service_at: "2026-08-19T08:00:00Z",
  out_of_service_at: "2026-08-22T16:00:00Z", notes: null, ...p,
});

const reading = (p: Partial<MoistureReading>): MoistureReading => ({
  id: "r", created_at: "", room_scan_id: "bath", taken_at: "2026-08-19T14:00:00Z",
  location: "North wall", material_percent: 42, relative_humidity: null,
  temperature_c: null, gpp: null, material: "Drywall", notes: null, ...p,
});

/** A second-floor bathroom, supply line to the vanity, water into the hall. */
const bathroom: EstimateRoom = {
  roomScanId: "bath",
  name: "Salle de bain",
  stats: {
    level: "2nd", floorAreaSqm: 7.34, perimeterM: 11.2, ceilingHeightM: 2.48,
    wallAreaGrossSqm: 27.78, wallAreaNetSqm: 24.1, doorCount: 1, windowCount: 1,
  },
  wallLengthsM: [3.2, 2.3, 3.2, 2.5],
  baseboardLengthM: 10.3,
  floorFinish: "tile",
  affectedAreas: [
    area({ id: "a1", name: "Vanity supply leak — floor", area_sqm: 4.1 }),
    area({ id: "a2", name: "Wet wall behind vanity", surface: "wall", wall_index: 1, area_sqm: 3.4 }),
  ],
  objects: [
    object({ id: "o1", kind: "toilet", disposition: "reset" }),
    object({ id: "o2", kind: "vanity_cabinet", name: "Vanity", disposition: "replace", width: 1.2 }),
    object({ id: "o3", kind: "mirror", disposition: "protect" }),
    object({ id: "o4", kind: "bathtub", disposition: "none" }),
  ],
};

/** The hall the water ran into — floor only, no wall damage. */
const hall: EstimateRoom = {
  roomScanId: "hall",
  name: "Corridor",
  stats: {
    level: "2nd", floorAreaSqm: 9.6, perimeterM: 14.8, ceilingHeightM: 2.48,
    wallAreaGrossSqm: 36.7, wallAreaNetSqm: 30.2, doorCount: 3, windowCount: 0,
  },
  wallLengthsM: [6.1, 1.6, 6.1, 1.6],
  baseboardLengthM: 12.4,
  floorFinish: "engineered",
  affectedAreas: [area({ id: "a3", room_scan_id: "hall", name: "Water tracked into hall", area_sqm: 5.2 })],
  objects: [],
};

const context: EstimateContext = {
  rooms: [bathroom, hall],
  equipment: [
    placement({ id: "e1", identifier: "LGR-2" }),
    placement({ id: "e2", kind: "Air mover", identifier: "AM-4", quantity: 3 }),
  ],
  readings: [
    reading({ id: "r1", taken_at: "2026-08-19T14:00:00Z" }),
    reading({ id: "r2", taken_at: "2026-08-20T15:00:00Z" }),
    reading({ id: "r3", taken_at: "2026-08-21T15:30:00Z" }),
    reading({ id: "r4", taken_at: "2026-08-22T16:00:00Z" }),
  ],
  asOf: new Date("2026-08-22T18:00:00Z"),
};

describe("worked sample", () => {
  it("writes a demo estimate", () => {
    const lines = applyMinimumCharges(mergeLines([], deriveLines(context)), {});
    const allocated = allocateLines(lines, POLYGON_TRAILER);
    const totals = estimateTotals(allocated);
    writeFileSync(
      "/tmp/estimate-demo.json",
      JSON.stringify({ lines: allocated, totals }, null, 2),
    );

    const money = (c: number) =>
      new Intl.NumberFormat("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .format(c / 100);
    console.log(`\n${"=".repeat(96)}`);
    for (const room of ["Salle de bain", "Corridor", "Frais généraux"]) {
      const group = allocated.filter((l) => l.roomName === room);
      if (!group.length) continue;
      console.log(`\n### ${room}`);
      for (const l of group) {
        const codes = [l.removalItemCode, l.itemCode].filter(Boolean).join("+") || "—";
        console.log(
          `${l.name.slice(0, 42).padEnd(43)}${String(l.quantity).padStart(8)} ${l.unit.padEnd(10)}` +
          `${money(l.baseCents).padStart(10)}${money(l.opCents).padStart(9)}` +
          `${money(l.taxCents).padStart(9)}${money(l.totalCents).padStart(11)}  ${codes}`,
        );
        if (l.calc) console.log(`    ↳ ${l.calc}`);
      }
    }
    console.log(`\nItems ${money(totals.itemsCents)} | O&P ${money(totals.generalsCents + totals.profitCents)}` +
      ` | TPS ${money(totals.gstCents)} | TVQ ${money(totals.qstCents)}` +
      ` | TOTAL ${money(totals.totalCents)} $ | ${totals.totalLaborHours} h`);
  });
});
