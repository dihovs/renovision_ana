import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import type { AffectedArea } from "../../crm/areaShapes";
import type { EquipmentPlacement, MoistureReading } from "../../crm/dryingLog";
import type { RoomObject } from "../../crm/roomObjects";
import { getLineItem } from "../catalog";
import { applyMinimumCharges, deriveLines, mergeLines } from "./derive";
import { allocateLines, estimateTotals, rateCents } from "./trailer";
import {
  POLYGON_TRAILER,
  type EstimateContext,
  type EstimateLine,
  type EstimateRoom,
} from "./types";

/**
 * Worked sample — Living room, 2nd Floor, 3465 Ch de la Côte-des-Neiges
 * Unite 94. Every figure below is read from the app's own report
 * ("Tun.pdf", scanned and printed 23 Sep 2026), not invented:
 *
 *   AREA        42.98 m²        PERIMETER    32.872 m
 *   CEILING     2.700 m         WALL AREA    83.67 m² (printed, not
 *                                            re-derived — see note below)
 *   AFFECTED    13.87 m², Water · floor
 *   Note on the area: "This area has water domage, requires replacing the
 *   floor of the entire room and subfloor only in this damaged area"
 *
 * Wall area gross is taken from the report's own summary page rather than
 * recomputed as perimeter × height (32.872 × 2.7 = 88.75, not the printed
 * 83.67): the report's own methodology page says ceiling height is "the
 * tallest wall the scan measured", so a room with any lower segment has a
 * true wall area under that product. Reading the printed figure is the
 * §3.4 rule in practice — a second conversion site here would have quietly
 * overstated every wall by the same margin.
 *
 * ONE thing is counted rather than read: the door deduction for baseboard.
 * The plan shows exactly one door swing on the west wall and no printed
 * door-width label, so this uses a standard 0.9 m interior door. Flagged
 * here rather than silently baked in.
 *
 * ONE thing this report could not answer on its own, and did not get
 * guessed: floor finish. The photos showed a wide-plank wood-look floor,
 * but "looks like" is exactly the plausible invention Estimator-Spec.md
 * §3.2 exists to refuse — laminate, LVP, engineered and hardwood are four
 * different removal-scope/install codes at four different rates. The
 * owner confirmed it directly, 23 Sep 2026: bois franc — solid hardwood,
 * `floorFinish: "hardwood"` below. Before that answer, floor.replace fired
 * its unknown-finish branch and printed one unpriced line rather than a
 * guessed one; this file's git history has that version.
 *
 * ANOTHER gap the report's own note surfaces, and this one is not a fact
 * about this room: the area's note asks for subfloor work ("subfloor only
 * in this damaged area") that NO rule derives. FLR-SUB-34 ("Replace 3/4
 * inch subfloor") exists in the price book — it has simply never been
 * wired to a rule, because no room in this codebase's tests or samples had
 * asked for it before this one. Added below as a manual line citing the
 * report's own words, exactly the gap §5b's door 3 exists for.
 *
 * Asserts nothing; prints the devis. Run: npx vitest run cotedesneiges.sample
 */

const DOOR_WIDTH_M = 0.9;

describe("worked sample — Living room, Côte-des-Neiges", () => {
  it("derives what the engine can, and flags what it cannot", () => {
    const floorAreaSqm = 42.98;
    const perimeterM = 32.872;
    const ceilingHeightM = 2.7;
    const wallAreaGrossSqm = 83.67; // printed on the report, not recomputed — see note above

    const affectedArea: AffectedArea = {
      id: "cdn-a1",
      created_at: "",
      room_scan_id: "cdn-living",
      surface: "floor",
      wall_index: null,
      name: "Affected area",
      damage_type: "water",
      color: null,
      area_sqm: 13.87,
      polygon: [],
      notes:
        "This area has water domage, requires replacing the floor of the entire room and subfloor only in this damaged area",
      show_dimensions: false,
    };

    const objects: RoomObject[] = [];
    const equipment: EquipmentPlacement[] = [];
    const readings: MoistureReading[] = [];

    const room: EstimateRoom = {
      roomScanId: "cdn-living",
      name: "Living room",
      stats: {
        level: "2nd Floor",
        floorAreaSqm,
        perimeterM,
        ceilingHeightM,
        wallAreaGrossSqm,
        // Not printed anywhere on this report, and no wall or ceiling rule
        // reads it here — the loss is floor-only. Left equal to gross
        // rather than guessed at an opening count; it is inert either way.
        wallAreaNetSqm: wallAreaGrossSqm,
        doorCount: 1,
        windowCount: 2,
      },
      // The plan is an irregular L, not a wall schedule — no per-wall rule
      // needs individual lengths here since nothing is keyed to a wall_index.
      wallLengthsM: [],
      baseboardLengthM: perimeterM - DOOR_WIDTH_M,
      floorFinish: "hardwood", // bois franc, confirmed by the owner 23 Sep 2026
      affectedAreas: [affectedArea],
      objects,
    };

    const context: EstimateContext = {
      rooms: [room],
      equipment,
      readings,
      asOf: new Date("2026-09-23T18:00:00Z"),
    };

    // The one line the rules engine cannot produce yet: subfloor, quoted
    // against the area's own note, at the item the price book already has
    // but no rule calls (FLR-SUB-34). Manual/operator, not derived — a
    // re-run of deriveLines will never touch it.
    const subfloorItem = getLineItem("FLR-SUB-34");
    const subfloorSqFt = Math.round((affectedArea.area_sqm / 0.09290304) * 100) / 100;
    const subfloorLine: EstimateLine = {
      key: "operator:FLR-SUB-34",
      origin: "manual",
      provenance: "operator",
      roomScanId: room.roomScanId,
      roomName: room.name,
      tradeSection: "floor",
      activity: "install",
      itemCode: "FLR-SUB-34",
      removalItemCode: null,
      name: subfloorItem?.name ?? "FLR-SUB-34",
      unit: "sq ft",
      quantity: subfloorSqFt,
      removeRateCents: null,
      replaceRateCents: rateCents("FLR-SUB-34"),
      calc: `affected area only: ${subfloorSqFt} sq ft — "…subfloor only in this damaged area"`,
      note: "No rule derives subfloor yet (FLR-SUB-34 exists in the price book, unwired). Added by hand from the area's own note.",
      issues: [],
      taxable: subfloorItem?.taxable ?? true,
      removed: false,
    };

    const derived = deriveLines(context);
    const lines = applyMinimumCharges(mergeLines([], [...derived, subfloorLine]), {});
    const allocated = allocateLines(lines, POLYGON_TRAILER);
    const totals = estimateTotals(allocated);

    writeFileSync(
      "/tmp/cotedesneiges-devis.json",
      JSON.stringify({ lines: allocated, totals }, null, 2),
    );

    const money = (c: number) =>
      new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        c / 100,
      );

    const out: string[] = [];
    out.push("ESTIMATE — Living room, 2nd Floor");
    out.push("3465 Ch de la Côte-des-Neiges Unite 94");
    out.push(
      `AREA 42.98 m² · PERIMETER 32.872 m · CEILING 2.700 m · AFFECTED 13.87 m² (Water · floor)`,
    );
    out.push("");
    out.push(
      "#  DESCRIPTION                                QTY          BASE     O&P      TAX     TOTAL   ISSUE",
    );
    allocated.forEach((l, i) => {
      const issue = l.issues.length ? l.issues.join(",") : l.origin === "manual" ? "manual" : "";
      out.push(
        [
          String(i + 1).padEnd(3),
          l.name.slice(0, 40).padEnd(41),
          `${l.quantity} ${l.unit}`.padStart(12),
          money(l.baseCents).padStart(10),
          money(l.opCents).padStart(9),
          money(l.taxCents).padStart(9),
          money(l.totalCents).padStart(10),
          "  " + issue,
        ].join(""),
      );
      out.push(`     CALC: ${l.calc}`);
      if (l.note) out.push(`     NOTE: ${l.note}`);
    });
    out.push("");
    out.push("SUMMARY");
    const somm: [string, number][] = [
      ["Items", totals.itemsCents],
      ["Generals 10%", totals.generalsCents],
      ["Profit 5%", totals.profitCents],
      ["GST 5%", totals.gstCents],
      ["QST 9.975%", totals.qstCents],
      ["TOTAL", totals.totalCents],
    ];
    somm.forEach(([k, v]) => out.push(`  ${k.padEnd(16)}${money(v).padStart(12)}`));
    out.push(`  ${"Labour incorporated".padEnd(16)}${totals.totalLaborHours.toFixed(2).padStart(9)} h`);

    const text = out.join("\n");
    // eslint-disable-next-line no-console
    console.log("\n" + text + "\n");
    writeFileSync("/tmp/cotedesneiges-devis.txt", text);
  });
});
