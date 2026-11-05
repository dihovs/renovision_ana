import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import type { AffectedArea } from "../../crm/areaShapes";
import type { EquipmentPlacement, MoistureReading } from "../../crm/dryingLog";
import type { RoomObject } from "../../crm/roomObjects";
import { applyMinimumCharges, deriveLines, mergeLines } from "./derive";
import { allocateLines, estimateTotals, rateCents } from "./trailer";
import { unitLabel } from "../catalog";
import { ESTIMATOR_STRINGS } from "./strings";
import {
  RESTAURATION_CT_TRAILER,
  type AllocatedLine,
  type EstimateContext,
  type EstimateLine,
  type EstimateRoom,
} from "./types";

/**
 * Worked sample — 1951 Rue Tansley, Montréal, apartment 102.
 *
 * The owner confirmed (7 Sep 2026) this claim genuinely has THREE separate
 * physical kitchens — stacked units on floors 1/2/3 with identical floor
 * plans, each 437.22 sq ft / 114'8" perimeter / 8'1" ceiling — plus one small
 * "Other" room (17.75 sq ft, apt-102 corridor/entrance closet) on the 2nd
 * floor. Every quantity below is transcribed from "My New Project Report
 * 9.pdf" (29 Aug 2026 / surveyed 2 Sep 2026); nothing is guessed EXCEPT the
 * items called out explicitly as [UNVERIFIED] in the comments beside them.
 *
 * ============================================================================
 * READ THIS BEFORE TRUSTING ANY WALL-INDEX OR WALL-LENGTH FIGURE BELOW
 * ============================================================================
 * The report prints, on each kitchen's own overview page, a dimension chain
 * of ~29 segments (26'6", 8'7", 3'7", 2'5", ... 14'10", 39'8", 16'). This is
 * NOT a wall schedule: summed, the chain totals ~154 ft against a printed
 * perimeter of 114'8" — it mixes the room's own wall run with interior
 * fixture and bounding-box dimensions with no way to tell which segment is
 * which wall from the text alone. Unlike the Blainville sample (whose 12
 * segments summed to within an inch of its printed perimeter and could be
 * read as one wall loop), this report's chain cannot be decomposed into a
 *真 per-wall schedule without an as-built site visit or a copy of the
 * magicplan project file.
 *
 * What IS legible from the floor-plan sketches: every "AFFECTED WALL AREA"
 * pin in each kitchen (1/3 on the 1st floor, 4/6/7/8 on the 2nd, 10/11/12 on
 * the 3rd) sits in the SAME small dogleg corner of the room — the
 * stairwell/closet nook beside the corridor door, where an "8' 7"" segment
 * is printed right against that corner on all three floor plans. There is no
 * way to tell from the sketch alone whether items 6/7/8 (2nd floor) or
 * 11/12 (3rd floor) sit on the SAME wall face as each other or on adjacent
 * faces a few feet apart — the icons are pinned close together at the scale
 * this PDF renders. This report's chain cannot be read as a true per-wall
 * schedule the way Blainville's could.
 *
 * Rather than inventing a distinct wall_index for each pin (which would
 * state confidence this report doesn't support), every wall-surface damage
 * in a kitchen is assigned wall_index 0, and wallLengthsM = [that one 8'7"
 * segment]. This is a real simplification with real consequences for
 * `wall.baseboard`, which prices E&R baseboard only across the wall(s) named
 * by the affected areas' wall_index — collapsing several possibly-distinct
 * walls onto one index means that rule's affected-wall baseboard footage
 * (as opposed to the full-room baseboard length, which is unaffected) may
 * UNDERSTATE the true trim run if the damage actually spans more than one
 * wall face. [UNVERIFIED] — flagged again in the final report to the owner.
 *
 * Door counts, and therefore the opening deduction and baseboard-minus-
 * doorways figure, are ALSO [UNVERIFIED]: this report prints no door/window
 * schedule for these rooms (unlike Blainville, which didn't either, but at
 * least that sample's door count was confirmed verbally). Door arcs visible
 * in the kitchen sketches are counted off the drawing: 3 per kitchen (the
 * top-left entrance, the stairwell/closet door, and the small door at the
 * bottom near the "Other" room), 1 for the "Other" room itself (the
 * corridor door marked "102"). Door leaf size is assumed at Blainville's own
 * surveyed 2'7" x 6'8" for lack of any other figure in this report.
 *
 * Asserts nothing; prints the devis. Run: npx vitest run tansley.sample
 */

const SQFT = 10.763910417;
const FT = 3.280839895;
const sqft = (v: number) => v / SQFT;
const ft = (v: number) => v / FT;

// A generic door leaf, borrowed from the Blainville sample for lack of any
// door schedule in this report. [UNVERIFIED]
const DOOR_W_FT = 2 + 7 / 12;
const DOOR_H_FT = 6 + 8 / 12;

describe("worked sample — 1951 Rue Tansley, apt 102, Montréal", () => {
  it("derives the devis from the surveyed quantities", () => {
    // ------------------------------------------------------------------
    // Shared kitchen geometry — identical on floors 1, 2 and 3 per the
    // report ("Kitchen … 437.22 sq ft … PERIMETER: 114' 8" … CEILING
    // HEIGHT: 8' 1"" on each of pages 5, 11 and 20).
    const kitchenFloorAreaSqm = sqft(437.22);
    const kitchenPerimeterM = ft(114 + 8 / 12);
    const kitchenCeilingHeightM = ft(8 + 1 / 12);
    // 3 doors per kitchen, counted off the sketch's door-swing arcs — no
    // door schedule in this report. [UNVERIFIED]
    const kitchenDoorCount = 3;
    const kitchenOpeningsSqm = kitchenDoorCount * ft(DOOR_W_FT) * ft(DOOR_H_FT);
    const kitchenWallAreaGrossSqm = kitchenPerimeterM * kitchenCeilingHeightM;
    const kitchenWallAreaNetSqm = kitchenWallAreaGrossSqm - kitchenOpeningsSqm;
    const kitchenBaseboardLengthM = kitchenPerimeterM - kitchenDoorCount * ft(DOOR_W_FT);

    // The one legible segment ("8' 7"") printed right at the dogleg corner
    // where every wall-damage pin in every kitchen sits. Not a wall
    // schedule — see the file-level note above. wall_index 0 is used for
    // every wall-surface AffectedArea in every kitchen room on that basis.
    // [UNVERIFIED]
    const kitchenWallLengthsM = [ft(8 + 7 / 12)];

    const objects: RoomObject[] = [];
    const equipment: EquipmentPlacement[] = [];
    const readings: MoistureReading[] = [];

    // ------------------------------------------------------------------
    // Kitchen / 1st Floor — items #1, #2, #3 (page 5-6).
    const kitchen1Areas: AffectedArea[] = [
      {
        id: "tansley-1f-k-dmg-1",
        created_at: "",
        room_scan_id: "tansley-1f-kitchen",
        // Not explicitly labelled "AFFECTED WALL AREA" in the report, but
        // the note describes isolation + drywall + plaster work, which is
        // wall-cavity work, not a floor or ceiling repair. [UNVERIFIED —
        // surface inferred from the described work, not printed on the page]
        surface: "wall",
        wall_index: 0,
        // Transcribed from the owner's English field note ("Water") into
        // the language the document is written in — the CALC citation on
        // every wall line quotes this name back verbatim.
        name: "Eau",
        // Name explicitly says "Water" — this is the one item in the whole
        // job that earns damage_type "water" on the name alone.
        damage_type: "water",
        color: null,
        area_sqm: sqft(20.7),
        polygon: [
          { x: 0, y: 0 },
          { x: 1.4, y: 0 },
          { x: 1.4, y: 1.37 },
          { x: 0, y: 1.37 },
        ],
        notes:
          "The isolation needs to be replaced and also the drywall needs to be installed the plaster to be ready for a level for painting finish so basically it needs to be plaster then send it three times",
        show_dimensions: false,
      },
      {
        id: "tansley-1f-k-dmg-2",
        created_at: "",
        room_scan_id: "tansley-1f-kitchen",
        // "matching paint for the entire ceiling" — ceiling.
        surface: "ceiling",
        wall_index: null,
        name: "À peindre",
        // No stated cause beyond "needs to be painted" — not "water".
        damage_type: "other",
        color: null,
        area_sqm: sqft(56.26),
        polygon: [
          { x: 0, y: 0 },
          { x: 2.28, y: 0 },
          { x: 2.28, y: 2.3 },
          { x: 0, y: 2.3 },
        ],
        notes: "So here we need to paint to be able to get the matching paint for the entire ceiling",
        show_dimensions: false,
      },
      {
        id: "tansley-1f-k-dmg-3",
        created_at: "",
        room_scan_id: "tansley-1f-kitchen",
        surface: "wall", // explicitly "AFFECTED WALL AREA" in the report
        wall_index: 0,
        name: "À peindre",
        damage_type: "other",
        color: null,
        area_sqm: sqft(59.22),
        polygon: [
          { x: 0, y: 0 },
          { x: 2.4, y: 0 },
          { x: 2.4, y: 2.3 },
          { x: 0, y: 2.3 },
        ],
        notes: null,
        show_dimensions: false,
      },
    ];

    const kitchen1: EstimateRoom = {
      roomScanId: "tansley-1f-kitchen",
      name: "Cuisine",
      stats: {
        level: "1st Floor",
        floorAreaSqm: kitchenFloorAreaSqm,
        perimeterM: kitchenPerimeterM,
        ceilingHeightM: kitchenCeilingHeightM,
        wallAreaGrossSqm: kitchenWallAreaGrossSqm,
        wallAreaNetSqm: kitchenWallAreaNetSqm,
        doorCount: kitchenDoorCount,
        windowCount: 0,
      },
      wallLengthsM: kitchenWallLengthsM,
      baseboardLengthM: kitchenBaseboardLengthM,
      floorFinish: null,
      affectedAreas: kitchen1Areas,
      objects,
    };

    // ------------------------------------------------------------------
    // Kitchen / 2nd Floor — items #4, #5, #6, #7, #8 (page 11-12).
    const kitchen2Areas: AffectedArea[] = [
      {
        id: "tansley-2f-k-dmg-4",
        created_at: "",
        room_scan_id: "tansley-2f-kitchen",
        surface: "wall", // new insulation + drywall + plaster + paint — wall cavity work
        wall_index: 0,
        name: "Dégât d'eau",
        damage_type: "water", // name explicitly says "water damage"
        color: null,
        area_sqm: sqft(29.49),
        polygon: [
          { x: 0, y: 0 },
          { x: 1.65, y: 0 },
          { x: 1.65, y: 1.66 },
          { x: 0, y: 1.66 },
        ],
        notes:
          "So because of the water damage, the drywall was removed and I also the isolation was removed so basically what we have to do we have to install a new isolation and beside that also we have to install a new drywall. We have to plaster it. Send it plaster saying to get the full level for finish and then we have to paint.",
        show_dimensions: false,
      },
      {
        id: "tansley-2f-k-dmg-5",
        created_at: "",
        room_scan_id: "tansley-2f-kitchen",
        surface: "ceiling", // "ceiling painting", to match rest of the living room
        wall_index: null,
        name: "Peinture du plafond",
        damage_type: "other",
        color: null,
        area_sqm: sqft(55.97),
        polygon: [
          { x: 0, y: 0 },
          { x: 2.27, y: 0 },
          { x: 2.27, y: 2.29 },
          { x: 0, y: 2.29 },
        ],
        notes: "Ceiling needs to be painted too much with the rest of the living room",
        show_dimensions: false,
      },
      {
        id: "tansley-2f-k-dmg-6",
        created_at: "",
        room_scan_id: "tansley-2f-kitchen",
        surface: "wall", // explicitly "AFFECTED WALL AREA"
        wall_index: 0,
        name: "Placoplâtre endommagé au pourtour de la porte",
        // "Drywall damage" — a cause of drywall damage is not stated as
        // water, so this stays "other" even though the job is clearly water
        // restoration work overall.
        damage_type: "other",
        color: null,
        area_sqm: sqft(36.53),
        polygon: [
          { x: 0, y: 0 },
          { x: 1.9, y: 0 },
          { x: 1.9, y: 1.79 },
          { x: 0, y: 1.79 },
        ],
        notes:
          "Drywall was removed. It needs to be painted in your drywall installed. Also, there needs to be added some solution probably and where is the door? There is actually two layers of drywall.",
        show_dimensions: false,
      },
      {
        id: "tansley-2f-k-dmg-7",
        created_at: "",
        room_scan_id: "tansley-2f-kitchen",
        surface: "wall", // explicitly "AFFECTED WALL AREA"
        wall_index: 0,
        name: "Dégât d'eau",
        damage_type: "water",
        color: null,
        area_sqm: sqft(19.35),
        polygon: [
          { x: 0, y: 0 },
          { x: 1.35, y: 0 },
          { x: 1.35, y: 1.33 },
          { x: 0, y: 1.33 },
        ],
        notes:
          "The drywall needs to be repaired here, and also the entire wall needs to be painted. The drywall repair is actually the lower part of the wall approximately the height of the baseboard and then after the baseboard needs to be installed, and also baseboard needs to be installed part of the door.",
        show_dimensions: false,
      },
      {
        id: "tansley-2f-k-dmg-8",
        created_at: "",
        room_scan_id: "tansley-2f-kitchen",
        surface: "wall", // explicitly "AFFECTED WALL AREA"
        wall_index: 0,
        name: "Dégât d'eau",
        damage_type: "water",
        color: null,
        area_sqm: sqft(4.59),
        polygon: [
          { x: 0, y: 0 },
          { x: 0.65, y: 0 },
          { x: 0.65, y: 0.66 },
          { x: 0, y: 0.66 },
        ],
        notes: "The drywall needs to be repaired and also the baseboard needs to be installed",
        show_dimensions: false,
      },
    ];

    const kitchen2: EstimateRoom = {
      roomScanId: "tansley-2f-kitchen",
      name: "Cuisine",
      stats: {
        level: "2nd Floor",
        floorAreaSqm: kitchenFloorAreaSqm,
        perimeterM: kitchenPerimeterM,
        ceilingHeightM: kitchenCeilingHeightM,
        wallAreaGrossSqm: kitchenWallAreaGrossSqm,
        wallAreaNetSqm: kitchenWallAreaNetSqm,
        doorCount: kitchenDoorCount,
        windowCount: 0,
      },
      wallLengthsM: kitchenWallLengthsM,
      baseboardLengthM: kitchenBaseboardLengthM,
      floorFinish: null,
      affectedAreas: kitchen2Areas,
      objects,
    };

    // ------------------------------------------------------------------
    // Other / 2nd Floor — apt-102 corridor/entrance closet. Item #9.
    const otherPerimeterM = ft(16 + 11.5 / 12);
    const otherCeilingHeightM = ft(8); // "CEILING HEIGHT: 8'" printed explicitly
    const otherDoorCount = 1; // the corridor door marked "102" in the photos
    const otherOpeningsSqm = otherDoorCount * ft(DOOR_W_FT) * ft(DOOR_H_FT);
    const otherWallAreaGrossSqm = otherPerimeterM * otherCeilingHeightM;
    const otherWallAreaNetSqm = otherWallAreaGrossSqm - otherOpeningsSqm;
    const otherBaseboardLengthM = otherPerimeterM - otherDoorCount * ft(DOOR_W_FT);

    const otherAreas: AffectedArea[] = [
      {
        id: "tansley-2f-other-dmg-9",
        created_at: "",
        room_scan_id: "tansley-2f-other",
        surface: "wall", // explicitly "AFFECTED WALL AREA"
        // This tiny room's own wall run isn't separately charted; treated as
        // one wall (index 0) at its own printed perimeter for baseboard
        // purposes. [UNVERIFIED — no per-wall breakdown for this room either]
        wall_index: 0,
        name: "Zone sinistrée 1",
        damage_type: "other", // no "water" in the name or note
        color: null,
        area_sqm: sqft(37.86),
        polygon: [
          { x: 0, y: 0 },
          { x: 1.9, y: 0 },
          { x: 1.9, y: 1.85 },
          { x: 0, y: 1.85 },
        ],
        notes:
          "This is in the corridor at the entrance of the apartment, 102 so this entire part needs to be added the drywall plaster and make it ready for the paint and then we have to paint this, but we have to paint a bit more than that to much with the other part of the entrance, so maybe 20% more for the paint surface",
        show_dimensions: false,
      },
    ];

    const otherRoom: EstimateRoom = {
      roomScanId: "tansley-2f-other",
      name: "Autre (corridor / entrée de l'app. 102)",
      stats: {
        level: "2nd Floor",
        floorAreaSqm: sqft(17.75),
        perimeterM: otherPerimeterM,
        ceilingHeightM: otherCeilingHeightM,
        wallAreaGrossSqm: otherWallAreaGrossSqm,
        wallAreaNetSqm: otherWallAreaNetSqm,
        doorCount: otherDoorCount,
        windowCount: 0,
      },
      wallLengthsM: [ft(4 + 9 / 12)], // one guessed wall at the room's own width. [UNVERIFIED]
      baseboardLengthM: otherBaseboardLengthM,
      floorFinish: null,
      affectedAreas: otherAreas,
      objects,
    };

    // ------------------------------------------------------------------
    // Kitchen / 3rd Floor — items #10, #11, #12 (page 20-21).
    const kitchen3Areas: AffectedArea[] = [
      {
        id: "tansley-3f-k-dmg-10",
        created_at: "",
        room_scan_id: "tansley-3f-kitchen",
        // The report's own field for the item's "name" is actually the
        // description ("Floor needs to be removed... entire area needs to
        // be replaced") — a hardwood floor removal/replacement, not a wall
        // or ceiling item.
        surface: "floor",
        wall_index: null,
        name: "Remplacement du plancher à agencer — bois franc",
        damage_type: "other", // no stated cause of loss in the name/note
        color: null,
        area_sqm: sqft(71.27),
        polygon: [
          { x: 0, y: 0 },
          { x: 3.0, y: 0 },
          { x: 3.0, y: 2.21 },
          { x: 0, y: 2.21 },
        ],
        notes:
          "Floor needs to be removed, subfloor inspected and maybe changed some places also, the floor is hardwood flooring so probably we won't be able to find the same one to change it locally we probably have to get a closer match that's gonna just match with the rest of the living room, but this entire area needs to be replaced",
        show_dimensions: false,
      },
      {
        id: "tansley-3f-k-dmg-11",
        created_at: "",
        room_scan_id: "tansley-3f-kitchen",
        surface: "wall", // explicitly "AFFECTED WALL AREA"
        wall_index: 0,
        name: "Dégât d'eau derrière le réfrigérateur",
        damage_type: "water",
        color: null,
        area_sqm: sqft(3.63),
        polygon: [
          { x: 0, y: 0 },
          { x: 0.6, y: 0 },
          { x: 0.6, y: 0.56 },
          { x: 0, y: 0.56 },
        ],
        notes:
          "This part needs to be repaired and also beside that customer asked us if he can put some caulking so when in the future things like this happen so with the water doesn't soak into the wall and go down. Take a deeper look maybe we have to open up a bit more to identify if there is a bit further damage has been done or no.",
        show_dimensions: false,
      },
      {
        id: "tansley-3f-k-dmg-12",
        created_at: "",
        room_scan_id: "tansley-3f-kitchen",
        surface: "wall", // explicitly "AFFECTED WALL AREA"
        wall_index: 0,
        name: "Placoplâtre endommagé",
        damage_type: "other", // "drywall damage", no stated water cause here
        color: null,
        area_sqm: sqft(5.82),
        polygon: [
          { x: 0, y: 0 },
          { x: 0.85, y: 0 },
          { x: 0.85, y: 0.64 },
          { x: 0, y: 0.64 },
        ],
        notes:
          "To lower part of this wall is a bit damaged they removed the baseboard and I think also they damaged the drywall so the baseboard needs to be installed for sure but maybe also we have to put the new drywall there",
        show_dimensions: false,
      },
    ];

    const kitchen3: EstimateRoom = {
      roomScanId: "tansley-3f-kitchen",
      name: "Cuisine",
      stats: {
        level: "3rd Floor",
        floorAreaSqm: kitchenFloorAreaSqm,
        perimeterM: kitchenPerimeterM,
        ceilingHeightM: kitchenCeilingHeightM,
        wallAreaGrossSqm: kitchenWallAreaGrossSqm,
        wallAreaNetSqm: kitchenWallAreaNetSqm,
        doorCount: kitchenDoorCount,
        windowCount: 0,
      },
      wallLengthsM: kitchenWallLengthsM,
      baseboardLengthM: kitchenBaseboardLengthM,
      floorFinish: "hardwood",
      affectedAreas: kitchen3Areas,
      objects,
    };

    const context: EstimateContext = {
      rooms: [kitchen1, kitchen2, otherRoom, kitchen3],
      equipment,
      readings,
      asOf: new Date("2026-09-02T12:00:00Z"),
    };

    // **Derived in French, because this document is read in French.** The
    // CALC citation and the scoping NOTE are generated sentences stored on
    // the line, not furniture the renderer swaps per export — see
    // ./strings.ts for the whole argument and for what it would take to make
    // them re-localizable at print time. `deriveLines` defaults to English;
    // this job passes the language its devis is written in.
    const rawDerivedLines: EstimateLine[] = applyMinimumCharges(
      mergeLines([], deriveLines(context, "fr")),
      {},
      "fr",
    );

    // ------------------------------------------------------------------
    // Owner instruction (7 Sep 2026): price only the documented damage, not
    // the engine's own "repaint/re-trim the whole room to match" defaults
    // (wall.paint, ceiling.paint, and the trim-paint half of wall.baseboard
    // all carry that default deliberately — see their comments in rules.ts —
    // but this job is to be scoped down to affected areas only).
    //
    // This is done here, on the derived lines, rather than by changing
    // rules.ts: that file's full-room default is a real, separately-made
    // design decision for the engine's normal behaviour, not something to
    // silently flip for every future job because of this one instruction.
    // Flagged back to the owner below.
    const affectedWallSqftByRoom = new Map<string, number>();
    const affectedCeilingSqftByRoom = new Map<string, number>();
    const affectedBaseboardFtByRoom = new Map<string, number>();
    for (const line of rawDerivedLines) {
      if (!line.roomScanId) continue;
      if (line.tradeSection === "walls" && line.itemCode === "DW-INST-12") {
        affectedWallSqftByRoom.set(line.roomScanId, line.quantity);
      }
      if (line.tradeSection === "ceiling" && line.itemCode === "DW-INST-12") {
        affectedCeilingSqftByRoom.set(line.roomScanId, line.quantity);
      }
      if (line.tradeSection === "trim" && line.itemCode === "TRIM-BASE-INST") {
        affectedBaseboardFtByRoom.set(line.roomScanId, line.quantity);
      }
    }

    // The same vocabulary the rules used, so a hand-written CALC on this
    // page and a generated one on the next quote their quantities the same
    // way (`79,92 pi²`, never `79.92`).
    const t = ESTIMATOR_STRINGS.fr;

    const derivedLines: EstimateLine[] = [];
    for (const line of rawDerivedLines) {
      const roomId = line.roomScanId;
      if (line.itemCode === "PNT-WALL-2" && line.tradeSection === "walls") {
        const q = roomId ? affectedWallSqftByRoom.get(roomId) : undefined;
        if (!q) continue; // no wall damage in this room — the full-room repaint drops entirely
        derivedLines.push({
          ...line,
          quantity: q,
          calc: `superficie de mur sinistrée ${t.qty(q)} pi² — limitée aux dommages constatés (directive du propriétaire, non la pièce entière)`,
          note: "Limité aux murs sinistrés seulement, 7 septembre 2026 — le comportement par défaut du moteur est la repeinture de la pièce entière.",
        });
        continue;
      }
      if (line.itemCode === "PNT-CEIL-2" && line.tradeSection === "ceiling") {
        const q = roomId ? affectedCeilingSqftByRoom.get(roomId) : undefined;
        if (!q) continue; // no ceiling damage documented in this room — drop entirely
        derivedLines.push({
          ...line,
          quantity: q,
          calc: `superficie de plafond sinistrée ${t.qty(q)} pi² — limitée aux dommages constatés (directive du propriétaire, non la pièce entière)`,
          note: "Limité au plafond sinistré seulement, 7 septembre 2026 — le comportement par défaut du moteur est la repeinture de la pièce entière.",
        });
        continue;
      }
      if (line.itemCode === "PNT-TRIM-LF" && line.tradeSection === "trim") {
        const q = roomId ? affectedBaseboardFtByRoom.get(roomId) : undefined;
        if (!q) continue; // no baseboard being replaced in this room — drop the full-room trim paint
        derivedLines.push({
          ...line,
          quantity: q,
          calc: `plinthe des murs sinistrés ${t.qty(q)} pi lin. — correspond à la plinthe réellement remplacée (directive du propriétaire, non la pièce entière)`,
          note: "Limité à la plinthe réellement remplacée, 7 septembre 2026 — le comportement par défaut du moteur est la peinture des boiseries de la pièce entière.",
        });
        continue;
      }
      // Owner's call, 7 Sep 2026: the corridor/entrance does not carry its
      // own site prep. Floor protection stays on the three kitchens, where
      // the work actually happens; the corridor is a pass-through the crew
      // is already protecting on its way in.
      if (line.itemCode === "GEN-FLOOR-PROT" && roomId === "tansley-2f-other") continue;
      derivedLines.push(line);
    }

    // ------------------------------------------------------------------
    // Item #9's own note asks for ~20% more paint than the measured 37.86
    // sq ft, "to much with the other part of the entrance" — paint that
    // extends past this room's own walls into the adjoining corridor,
    // which the rules engine has no way to see (wall.paint only ever
    // covers THIS room's own net wall area). Added by hand as a manual
    // line, the same way the app's operator would add anything a rule
    // cannot reach — the judgment call here (apply the 20% only to the
    // paint scope, not to the underlying drywall/plaster repair, since the
    // note specifically says "for the paint surface") is the owner's to
    // confirm or reject.
    const otherPaintUpliftSqft = 37.86 * 0.2;
    const manualUpliftLine: EstimateLine = {
      key: "manual:tansley-2f-other:paint-uplift-20pct",
      origin: "manual",
      provenance: "operator",
      roomScanId: "tansley-2f-other",
      roomName: otherRoom.name,
      tradeSection: "walls",
      activity: "install",
      itemCode: "PNT-WALL-2",
      removalItemCode: null,
      name: "Peinture supplémentaire pour agencer le corridor adjacent (+20 %)",
      unit: "sq ft",
      quantity: Math.round(otherPaintUpliftSqft * 100) / 100,
      removeRateCents: null,
      replaceRateCents: rateCents("PNT-WALL-2"),
      calc: `37,86 pi² × 20 % — note de l'item n° 9 : « peindre un peu plus… peut-être 20 % de plus pour la surface à peindre » afin de s'agencer au reste de l'entrée, au-delà des murs de cette pièce`,
      note: "JUGEMENT DE L'ESTIMATEUR : ligne ajoutée à la main, non par une règle — à confirmer avant l'envoi à l'assureur.",
      issues: [],
      taxable: true,
      removed: false,
    };

    // mergeLines's second argument is for RuleLine-shaped fresh derivations
    // (the app's normal re-run path); this manual line is already a full
    // EstimateLine an operator hand-added, so it is appended directly
    // rather than round-tripped through that contract.
    const allLines: EstimateLine[] = [...derivedLines, manualUpliftLine];

    const allocated: AllocatedLine[] = allocateLines(allLines, RESTAURATION_CT_TRAILER);
    const totals = estimateTotals(allocated);

    const m = (cents: number) =>
      (cents / 100).toLocaleString("fr-CA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    const out: string[] = [];
    out.push("DEVIS — 1951 Rue Tansley, apt. 102");
    out.push("H2K 0A4 Montréal, Québec");
    out.push(
      "3 cuisines identiques (étages 1, 2, 3) + 1 pièce « Autre » (corridor/entrée app. 102, étage 2)",
    );
    out.push("");
    out.push(
      `Cuisine (×3): AIRE 437,22 pi²  ·  PÉRIMÈTRE 114' 8"  ·  HAUTEUR 8' 1"`,
    );
    out.push(`Autre : AIRE 17,75 pi²  ·  PÉRIMÈTRE 16' 11½"  ·  HAUTEUR 8' 0"`);
    out.push("");
    out.push(
      "#   PIÈCE            SECTION      CODE             DESCRIPTION                            QTÉ        BASE      FG&P     TOTAL",
    );
    allocated.forEach((l, i) => {
      const code = l.itemCode ?? l.removalItemCode ?? "—";
      const removal = l.removalItemCode && l.itemCode ? ` (E&R ${l.removalItemCode})` : "";
      out.push(
        [
          String(i + 1).padEnd(4),
          (l.roomName + (l.roomScanId ? ` [${l.roomScanId.replace("tansley-", "")}]` : "")).slice(0, 16).padEnd(17),
          (l.tradeSection ?? "").padEnd(13),
          (code + removal).padEnd(17),
          l.name.slice(0, 36).padEnd(37),
          `${ESTIMATOR_STRINGS.fr.qty(l.quantity)} ${unitLabel(l.unit, "fr")}`.padStart(14),
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
    // **The profit basis is READ FROM THE TRAILER, never typed.** This line
    // said "Profit 5% (articles + Gén.)" for a document allocated with
    // RESTAURATION_CT_TRAILER, whose profit is computed on the items alone —
    // a hardcoded label describing a setting it does not consult, which is
    // exactly how a devis comes to state a basis it was not built on. The
    // report's own summary (ReportEstimateTable) already derives it; this
    // console dump now derives it from the same field.
    const trailer = RESTAURATION_CT_TRAILER;
    const rate = (fraction: number) =>
      `${(fraction * 100).toLocaleString("fr-CA", { maximumFractionDigits: 3 })}\u202f%`;
    const profitBasis =
      trailer.profitBasis === "items_plus_generals" ? "articles + généraux" : "articles";
    const somm: [string, number][] = [
      ["Ligne du total des articles", totals.itemsCents],
      [`Généraux ${rate(trailer.generalsPct)}`, totals.generalsCents],
      [`Profit ${rate(trailer.profitPct)} (${profitBasis})`, totals.profitCents],
      [`TPS ${rate(trailer.gstPct)}`, totals.gstCents],
      [`TVQ ${rate(trailer.qstPct)}`, totals.qstCents],
      ["VALEUR À NEUF", totals.totalCents],
    ];
    somm.forEach(([k, v]) => out.push(`  ${k.padEnd(30)}${m(v).padStart(14)}`));
    out.push(
      `  ${"Main-d'œuvre incorporée".padEnd(30)}${totals.totalLaborHours.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(11)} h`,
    );

    const text = out.join("\n");
    // eslint-disable-next-line no-console
    console.log("\n" + text + "\n");
    writeFileSync("/tmp/tansley-devis.txt", text);
    writeFileSync(
      "/tmp/tansley-devis.json",
      JSON.stringify({ lines: allocated, totals }, null, 2),
    );
  });
});
