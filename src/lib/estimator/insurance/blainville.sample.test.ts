import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import type { AffectedArea } from "../../crm/areaShapes";
import type { EquipmentPlacement, MoistureReading } from "../../crm/dryingLog";
import type { RoomObject } from "../../crm/roomObjects";
import { applyMinimumCharges, deriveLines, mergeLines } from "./derive";
import { allocateLines, estimateTotals } from "./trailer";
import {
  POLYGON_TRAILER,
  type EstimateContext,
  type EstimateRoom,
} from "./types";

/**
 * Worked sample — Cuisine, 9e étage, 75 Rue Raymond Lapalice, Blainville.
 *
 * Every quantity comes from the owner's own magicplan survey
 * ("My New Project Report 8.pdf", 29 Aug 2026), not from a guess:
 *
 *   AIRE      206,00 pi²        PÉRIMÈTRE  80' 2"
 *   ZONE AFFECTÉE  45,16 pi²    "Drywall Damage"
 *   Note du relevé: "This part needs to be repaired, plastered,
 *                    sanded 3 layer for level for finish"
 *
 * Ceiling height is NOT in the report — the two basement rooms carry one,
 * this room does not. 8' 0" confirmed verbally by the owner, 30 Aug 2026.
 *
 * Two things are decomposed rather than read, and are marked below:
 * the per-wall lengths (the report prints a dimension chain, not a wall
 * schedule) and the openings deduction (six at 2'7" counted off the sketch —
 * there is no Mur manquant schedule in this report).
 *
 * Asserts nothing; prints the devis. Run: npx vitest run blainville.sample
 */

const SQFT = 10.763910417;
const FT = 3.280839895;
const sqft = (v: number) => v / SQFT;
const ft = (v: number) => v / FT;

describe("worked sample — Cuisine, 9e étage, Blainville", () => {
  it("derives the devis from the surveyed quantities", () => {
    const floorAreaSqm = sqft(206.0);
    const perimeterM = ft(80 + 2 / 12);
    const ceilingHeightM = ft(8);
    const wallAreaGrossSqm = perimeterM * ceilingHeightM;

    // Openings: six at 2'7" x 6'8" counted off the survey sketch. The report
    // prints wall dimensions but no Mur manquant schedule, so this is the one
    // quantity on the page that is counted rather than measured.
    const openingsSqm = 6 * ft(2 + 7 / 12) * ft(6 + 8 / 12);
    const wallAreaNetSqm = wallAreaGrossSqm - openingsSqm;

    // Trim does not run across a doorway — the same subtraction context.ts makes.
    const baseboardLengthM = perimeterM - 6 * ft(2 + 7 / 12);

    // Decomposition of the 80'2" perimeter into the segments legible on the
    // sketch's dimension chains. Sums to 80'1" against a printed 80'2"; the
    // one-inch difference is the chain's own rounding. Index 2 is the 12'10"
    // east wall, which is the wall the affected area sits on.
    const wallLengthsM = [
      9.25, 3.917, 12.833, 6.333, 3.5, 11.833, 5.667, 3.333, 6.5, 7.75, 3.583, 5.583,
    ].map(ft);

    const affectedAreas: AffectedArea[] = [
      {
        id: "dmg-wall-1",
        created_at: "",
        room_scan_id: "blainville-9-cuisine",
        surface: "wall",
        wall_index: 2,
        name: "Drywall Damage",
        // The survey records the damage but not a cause. Left non-water on
        // purpose: "water" would fire room.antimicrobial and price a
        // treatment nobody has justified. Change it if the cause is a loss.
        damage_type: "other",
        color: null,
        area_sqm: sqft(45.16),
        polygon: [
          { x: 0, y: 0 },
          { x: 1.75, y: 0 },
          { x: 1.75, y: 2.4 },
          { x: 0, y: 2.4 },
        ],
        notes:
          "This part needs to be repaired, plastered, sanded 3 layer for level for finish",
        show_dimensions: false,
      },
    ];

    const objects: RoomObject[] = [];
    const equipment: EquipmentPlacement[] = [];
    const readings: MoistureReading[] = [];

    const room: EstimateRoom = {
      roomScanId: "blainville-9-cuisine",
      name: "Cuisine",
      stats: {
        level: "9e étage",
        floorAreaSqm,
        perimeterM,
        ceilingHeightM,
        wallAreaGrossSqm,
        wallAreaNetSqm,
        doorCount: 4,
        windowCount: 2,
      },
      wallLengthsM,
      baseboardLengthM,
      floorFinish: null,
      affectedAreas,
      objects,
    };

    const context: EstimateContext = {
      rooms: [room],
      equipment,
      readings,
      asOf: new Date("2026-08-30T12:00:00Z"),
    };

    // No operator lines. Everything on this devis is now derived: the
    // ceiling by ceiling.paint and the full run of trim by wall.baseboard,
    // both of which landed 30 Aug 2026. The two hand-added lines this sample
    // carried before are gone, and the total is unchanged by their removal —
    // the rules emit exactly what the operator was adding by hand.
    const lines = applyMinimumCharges(mergeLines([], deriveLines(context)), {});
    const allocated = allocateLines(lines, POLYGON_TRAILER);
    const totals = estimateTotals(allocated);

    const m = (cents: number) =>
      (cents / 100).toLocaleString("fr-CA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    const out: string[] = [];
    out.push("DEVIS — Cuisine, 9e étage");
    out.push("75 Rue Raymond Lapalice, J7B 1J8 Blainville, Québec");
    out.push(
      `AIRE 206,00 pi²  ·  PÉRIMÈTRE 80' 2"  ·  HAUTEUR 8' 0"  ·  ZONE AFFECTÉE 45,16 pi²`,
    );
    out.push(
      `Murs: ${(wallAreaGrossSqm * SQFT).toFixed(0)} pi² bruts − ${(openingsSqm * SQFT).toFixed(0)} ouvertures = ${(wallAreaNetSqm * SQFT).toFixed(0)} pi² nets`,
    );
    out.push("");
    out.push(
      "#   SECTION      CODE             DESCRIPTION                          QTÉ        BASE      FG&P     TOTAL",
    );
    allocated.forEach((l, i) => {
      const code = l.itemCode ?? l.removalItemCode ?? "—";
      const removal = l.removalItemCode ? ` (E&R ${l.removalItemCode})` : "";
      out.push(
        [
          String(i + 1).padEnd(4),
          (l.tradeSection ?? "").padEnd(13),
          (code + removal).padEnd(17),
          l.name.slice(0, 36).padEnd(37),
          `${l.quantity} ${l.unit}`.padStart(12),
          m(l.baseCents).padStart(10),
          m(l.opCents).padStart(9),
          m(l.totalCents).padStart(10),
        ].join(""),
      );
      if (l.calc) out.push(`      CALC: ${l.calc}`);
      if (l.note) out.push(`      NOTE: ${l.note}`);
    });

    out.push("");
    out.push("SOMMAIRE");
    const somm: [string, number][] = [
      ["Ligne du total des articles", totals.itemsCents],
      ["Généraux 10%", totals.generalsCents],
      ["Profit 5% (articles + Gén.)", totals.profitCents],
      ["TPS 5%", totals.gstCents],
      ["TVQ 9,975%", totals.qstCents],
      ["VALEUR À NEUF", totals.totalCents],
    ];
    somm.forEach(([k, v]) => out.push(`  ${k.padEnd(30)}${m(v).padStart(14)}`));
    out.push(`  ${"Main-d'oeuvre incorporée".padEnd(30)}${totals.totalLaborHours.toFixed(2).padStart(11)} h`);

    const text = out.join("\n");
    // eslint-disable-next-line no-console
    console.log("\n" + text + "\n");
    writeFileSync("/tmp/blainville-devis.txt", text);
    writeFileSync(
      "/tmp/blainville-devis.json",
      JSON.stringify({ lines: allocated, totals }, null, 2),
    );
  });
});
