// The rules table: measurements → price book lines. Rules are data with
// tests, reviewable as a table before any screen exists — the shape the
// owner already approved for the guided protocol (Estimator-Spec.md §3.5).
//
// Two disciplines, both load-bearing:
//   - Quantities come ONLY from figures the app already computes. Nothing
//     here measures anything; two things that measure separately will
//     disagree, and here the disagreement is money.
//   - A rule that cannot find its item or price still emits a line — with
//     quantity, unit, and a visible issue flag. A gap gets filled; a
//     plausible invention gets sent to an insurer.
//
// The patterns are the reference claims' own (see
// Docs/Estimator-Xactimate-Conventions.md): protection on every affected
// room's floor, seal coat at 125% of the drywall patch, floating floors
// replaced wall-to-wall while removal is billed at the measured area,
// baseboard following the floor, antimicrobial at the affected surfaces,
// equipment per unit-day off the drying log.

import type { AffectedArea } from "../../crm/areaShapes";
import { ceilingAreas as ceilingAreasOf, floorAreas as floorAreasOf } from "../../crm/areaShapes";
import type { RoomObject } from "../../crm/roomObjects";
import type { EquipmentPlacement, MoistureReading } from "../../crm/dryingLog";
import { unitDays } from "../../crm/dryingLog";
import type { EstimateContext, EstimateRoom, FloorFinish, RuleLine } from "./types";
import type { EstimatorStrings } from "./strings";
import { mToLinFt, roundQuantity, sqmToSqFt } from "./units";

export type RoomRule = {
  id: string;
  title: string;
  /** `t` is the document's own vocabulary — see ./strings.ts for why the
      CALC citation is chosen at derivation time and not at print time. */
  lines: (room: EstimateRoom, t: EstimatorStrings) => RuleLine[];
};

export type ObjectRule = {
  id: string;
  title: string;
  lines: (object: RoomObject, room: EstimateRoom, t: EstimatorStrings) => RuleLine[];
};

export type ProjectRule = {
  id: string;
  title: string;
  lines: (ctx: EstimateContext, t: EstimatorStrings) => RuleLine[];
};

// ---------------------------------------------------------------------------
// Small shared derivations

// The three surface filters delegate to areaShapes rather than re-deriving
// "not a wall" here. That negative form was this file's own bug: it read a
// ceiling area as a floor area, and a wet ceiling priced as a wet floor is
// the wrong trade at the wrong rate inside a document that goes to an
// insurer. One definition of each surface, in the module that defines the
// surfaces.
function floorAreas(room: EstimateRoom): AffectedArea[] {
  return floorAreasOf(room.affectedAreas);
}

function wallAreas(room: EstimateRoom): AffectedArea[] {
  return room.affectedAreas.filter((area) => area.surface === "wall");
}

function ceilingAreas(room: EstimateRoom): AffectedArea[] {
  return ceilingAreasOf(room.affectedAreas);
}

function affectedFloorSqFt(room: EstimateRoom): number {
  return sqmToSqFt(floorAreas(room).reduce((sum, area) => sum + area.area_sqm, 0));
}

function affectedWallSqFt(room: EstimateRoom): number {
  return sqmToSqFt(wallAreas(room).reduce((sum, area) => sum + area.area_sqm, 0));
}

function affectedCeilingSqFt(room: EstimateRoom): number {
  return sqmToSqFt(ceilingAreas(room).reduce((sum, area) => sum + area.area_sqm, 0));
}

function areaNames(areas: AffectedArea[]): string {
  return areas.map((area) => area.name).join(" + ");
}

/** The removal and install items per floor finish, and how far the install
    reaches. A floating floor cannot be patched to match, so it installs
    wall to wall while removal bills at the measured damage — the reference
    claims' own pattern (removal 132 P2, install at P). Tile CAN be patched:
    membrane, tile and grout over undamaged floor would bill work nobody
    performs, so tile installs at the affected area. */
const FLOOR_FINISH_ITEMS: Record<
  FloorFinish,
  {
    removal: string;
    /** `unpricedLabel` marks the one install with no book code: its name
        comes from the document's own vocabulary (`t.carpetInstallLabel`),
        not from this table, so the table carries the flag and not the
        words. */
    install: Array<{ code: string; unpricedLabel?: true }>;
    installScope: "full" | "affected";
  }
> = {
  laminate: {
    removal: "DEM-LAM",
    install: [{ code: "FLR-UNDERLAY" }, { code: "FLR-LAM-INST" }],
    installScope: "full",
  },
  lvp: {
    removal: "DEM-LAM",
    install: [{ code: "FLR-UNDERLAY" }, { code: "FLR-LVP-INST" }],
    installScope: "full",
  },
  engineered: {
    removal: "DEM-LAM",
    install: [{ code: "FLR-UNDERLAY" }, { code: "FLR-ENG-INST" }],
    installScope: "full",
  },
  hardwood: {
    removal: "DEM-HARDWOOD",
    install: [{ code: "FLR-HW-NAIL" }],
    installScope: "full",
  },
  carpet: {
    removal: "DEM-CARPET",
    // The book has no carpet install item — the line derives unpriced.
    install: [{ code: "", unpricedLabel: true }],
    installScope: "full",
  },
  tile: {
    removal: "DEM-TILE-FLR",
    install: [{ code: "TILE-MEM-FLR" }, { code: "TILE-FLR-STD" }, { code: "TILE-GROUT" }],
    installScope: "affected",
  },
};

// ---------------------------------------------------------------------------
// Room rules

export const ROOM_RULES: RoomRule[] = [
  {
    id: "floor.protection",
    title: "Surface protection in every room with damage",
    lines: (room, t) => {
      if (room.affectedAreas.length === 0) return [];
      const sqft = roundQuantity(sqmToSqFt(room.stats.floorAreaSqm));
      return [
        {
          itemCode: "GEN-FLOOR-PROT",
          activity: "install",
          tradeSection: "floor",
          unit: "sq ft",
          quantity: sqft,
          calc: t.floorAreaFullRoom(sqft),
        },
      ];
    },
  },
  {
    id: "floor.replace",
    title: "Floor covering: remove at the measured damage; install reach depends on the finish",
    lines: (room, t) => {
      const areas = floorAreas(room);
      if (areas.length === 0) return [];
      const removedSqFt = roundQuantity(affectedFloorSqFt(room));
      const fullSqFt = roundQuantity(sqmToSqFt(room.stats.floorAreaSqm));
      if (!room.floorFinish) {
        return [
          {
            keyHint: "unknown-finish",
            itemCode: null,
            label: t.floorCoveringLabel,
            activity: "replace",
            tradeSection: "floor",
            unit: "sq ft",
            quantity: fullSqFt,
            calc: t.floorFinishNotRecorded(removedSqFt, fullSqFt),
            issues: ["unknown_finish"],
          },
        ];
      }
      const finish = FLOOR_FINISH_ITEMS[room.floorFinish];
      const installSqFt = finish.installScope === "full" ? fullSqFt : removedSqFt;
      const installCalc =
        finish.installScope === "full"
          ? t.fullFloorReplaced(fullSqFt, room.floorFinish)
          : t.affectedAreaPatched(removedSqFt, room.floorFinish);
      const lines: RuleLine[] = [
        {
          keyHint: `remove:${finish.removal}`,
          itemCode: null,
          removalItemCode: finish.removal,
          activity: "remove",
          tradeSection: "floor",
          unit: "sq ft",
          quantity: removedSqFt,
          calc: t.affectedFloor(areaNames(areas), removedSqFt),
        },
      ];
      for (const install of finish.install) {
        lines.push({
          keyHint: install.code || "install-unpriced",
          itemCode: install.code || null,
          label: install.unpricedLabel ? t.carpetInstallLabel : undefined,
          activity: "install",
          tradeSection: "floor",
          unit: "sq ft",
          quantity: installSqFt,
          calc: installCalc,
          issues: install.code ? undefined : ["no_item"],
        });
      }
      return lines;
    },
  },
  {
    id: "floor.baseboard",
    title: "Baseboard follows the floor — at the baseboard length, not the perimeter",
    lines: (room, t) => {
      if (floorAreas(room).length === 0) return [];
      // Trim does not run across a doorway. The app's own baseboard figure
      // (perimeter minus door widths) is what this trade is priced against;
      // billing the raw perimeter overstates every room with a door.
      const lengthFt = roundQuantity(mToLinFt(room.baseboardLengthM));
      if (lengthFt === 0) return [];
      const calc = t.baseboardLength(lengthFt);
      return [
        {
          itemCode: "TRIM-BASE-INST",
          removalItemCode: "DEM-BASE",
          activity: "replace",
          tradeSection: "trim",
          unit: "linear ft",
          quantity: lengthFt,
          calc,
        },
        {
          itemCode: "PNT-TRIM-LF",
          activity: "install",
          tradeSection: "trim",
          unit: "linear ft",
          quantity: lengthFt,
          calc,
        },
      ];
    },
  },
  {
    id: "wall.baseboard",
    title: "Baseboard off the affected walls, paint around the whole room",
    // The two sides of trim have DIFFERENT reaches and billing them at one
    // length is wrong whichever length is picked. Baseboard comes off the
    // wall the drywall comes off — nowhere else — so the E&R follows the
    // affected walls. Paint follows the repaint, and the repaint is the
    // room: a painter who cuts in one wall's trim and leaves the other
    // eleven feet in the old sheen has not finished the room, and the
    // owner's own scoping of the first real job says so ("paint the entire
    // room, every wall, the ceiling, and also the trims"). Same convention
    // wall.paint already sets for the walls themselves — full room by
    // default, trimmed down by the operator when the claim is partial.
    lines: (room, t) => {
      if (floorAreas(room).length > 0) return []; // floor.baseboard already owns it
      const walls = wallAreas(room);
      if (walls.length === 0) return [];
      const indices = [...new Set(walls.map((area) => area.wall_index ?? 0))];
      const affectedFt = roundQuantity(
        mToLinFt(indices.reduce((sum, i) => sum + (room.wallLengthsM[i] ?? 0), 0)),
      );
      // Trim does not run across a doorway; the app's baseboard figure is the
      // perimeter minus the door widths, and the raw perimeter overstates
      // every room with a door.
      const roomFt = roundQuantity(mToLinFt(room.baseboardLengthM));
      const lines: RuleLine[] = [];
      if (affectedFt > 0) {
        lines.push({
          itemCode: "TRIM-BASE-INST",
          removalItemCode: "DEM-BASE",
          activity: "replace",
          tradeSection: "trim",
          unit: "linear ft",
          quantity: affectedFt,
          calc: t.affectedWallsRun(indices.join(", "), affectedFt),
        });
      }
      if (roomFt > 0) {
        lines.push({
          itemCode: "PNT-TRIM-LF",
          activity: "install",
          tradeSection: "trim",
          unit: "linear ft",
          quantity: roomFt,
          calc: t.baseboardLengthFullRoom(roomFt),
          note: t.trimPaintNote(affectedFt, indices.join(", ")),
        });
      }
      return lines;
    },
  },
  {
    id: "wall.drywall",
    title: "Wet drywall out and back at the measured area",
    lines: (room, t) => {
      const walls = wallAreas(room);
      if (walls.length === 0) return [];
      const sqft = roundQuantity(affectedWallSqFt(room));
      const calc = t.affectedWalls(areaNames(walls), sqft);
      return [
        {
          itemCode: "DW-INST-12",
          removalItemCode: "DEM-DRYWALL",
          activity: "replace",
          tradeSection: "walls",
          unit: "sq ft",
          quantity: sqft,
          calc,
        },
        {
          itemCode: "DW-TAPE-L4",
          activity: "install",
          tradeSection: "walls",
          unit: "sq ft",
          quantity: sqft,
          calc,
        },
        {
          // The reference's own convention: the seal coat covers 125% of the
          // patch, blending it past the joint (CALC "32*1,25").
          itemCode: "PNT-STAINBLOCK",
          activity: "install",
          tradeSection: "walls",
          unit: "sq ft",
          quantity: roundQuantity(sqft * 1.25),
          calc: t.sealPastJoint(sqft),
        },
      ];
    },
  },
  {
    id: "wall.paint",
    title: "Repaint the room's walls after a wall repair",
    lines: (room, t) => {
      if (wallAreas(room).length === 0) return [];
      const sqft = roundQuantity(sqmToSqFt(room.stats.wallAreaNetSqm));
      return [
        {
          itemCode: "PNT-WALL-2",
          activity: "install",
          tradeSection: "walls",
          unit: "sq ft",
          quantity: sqft,
          calc: t.netWallArea(sqft),
          note: t.wallPaintNote,
        },
      ];
    },
  },
  {
    id: "ceiling.drywall",
    title: "Wet ceiling drywall out and back at the measured area",
    // The wall pattern, with the ceiling's own removal item. DEM-CEILING
    // exists in the book separately from DEM-DRYWALL because taking board
    // down overhead is not the same job as taking it off a wall, and the
    // rates say so; the install side is the same board either way.
    lines: (room, t) => {
      const ceilings = ceilingAreas(room);
      if (ceilings.length === 0) return [];
      const sqft = roundQuantity(affectedCeilingSqFt(room));
      const calc = t.affectedCeiling(areaNames(ceilings), sqft);
      return [
        {
          itemCode: "DW-INST-12",
          removalItemCode: "DEM-CEILING",
          activity: "replace",
          tradeSection: "ceiling",
          unit: "sq ft",
          quantity: sqft,
          calc,
        },
        {
          itemCode: "DW-TAPE-L4",
          activity: "install",
          tradeSection: "ceiling",
          unit: "sq ft",
          quantity: sqft,
          calc,
        },
        {
          itemCode: "PNT-STAINBLOCK",
          activity: "install",
          tradeSection: "ceiling",
          unit: "sq ft",
          quantity: roundQuantity(sqft * 1.25),
          calc: t.sealPastJoint(sqft),
        },
      ];
    },
  },
  {
    id: "ceiling.paint",
    title: "Repaint the ceiling when the room is repainted",
    // Fires off a WALL area as well as a ceiling one, and that is the point.
    // Repainting a room's walls and leaving the ceiling in its old sheen
    // finishes nothing — the cut line between them is the most looked-at
    // edge in the room — so the ceiling goes with the repaint the same way
    // the trim does. PNT-CEIL-2 sat unused in the book until this rule; the
    // first real job derived nine lines and the operator hand-added this one.
    //
    // Quantity is the FLOOR area, because the ceiling is the floor's plane:
    // one measured figure, not a second one that could disagree with it.
    lines: (room, t) => {
      if (wallAreas(room).length === 0 && ceilingAreas(room).length === 0) return [];
      const sqft = roundQuantity(sqmToSqFt(room.stats.floorAreaSqm));
      if (sqft === 0) return [];
      return [
        {
          itemCode: "PNT-CEIL-2",
          activity: "install",
          tradeSection: "ceiling",
          unit: "sq ft",
          quantity: sqft,
          calc: t.ceilingIsFloorArea(sqft),
          note: t.ceilingPaintNote,
        },
      ];
    },
  },
  {
    id: "room.antimicrobial",
    title: "Antimicrobial on every affected surface of a water loss",
    lines: (room, t) => {
      const water = room.affectedAreas.filter((area) => area.damage_type === "water");
      if (water.length === 0) return [];
      const sqft = roundQuantity(sqmToSqFt(water.reduce((sum, area) => sum + area.area_sqm, 0)));
      return [
        {
          itemCode: "RST-ANTIMIC",
          activity: "install",
          tradeSection: "misc",
          unit: "sq ft",
          quantity: sqft,
          calc: t.affectedSurfaces(areaNames(water), sqft),
        },
      ];
    },
  },
];

// ---------------------------------------------------------------------------
// Object rules — the room_objects table was built for exactly this:
// disposition and included have been waiting for an estimator to read them.

/** Catalogue slug → price book items, by EXACT slug. The slugs are the Swift
    ObjectCatalog's vocabulary, copied here deliberately: a substring match
    prices `toilet_roll_holder` as a toilet — a silent mispricing an insurer
    would catch and this table exists to make impossible. A slug with no
    entry derives visibly unpriced, never guessed. When ObjectCatalog gains
    entries, this table is where they get their money meaning. */
type ObjectItems = {
  removal: string | null;
  install: string | null;
  perLinearFt?: boolean;
};

const OBJECT_ITEM_GROUPS: Array<{ slugs: string[]; items: ObjectItems }> = [
  {
    slugs: ["toilet", "wall_hung_toilet"],
    items: { removal: "DEM-TOILET", install: "BATH-TOILET-INST" },
  },
  {
    slugs: [
      "bathtub",
      "corner_bathtub",
      "corner_bathtub_round",
      "oval_bathtub",
      "space_saving_bathtub",
    ],
    items: { removal: "DEM-TUB", install: "BATH-TUB-INST" },
  },
  {
    slugs: ["vanity_24", "vanity_cabinet", "double_vanity"],
    items: { removal: "DEM-VANITY", install: "BATH-VANITY-INST" },
  },
  { slugs: ["mirror"], items: { removal: null, install: "BATH-MIRROR" } },
  { slugs: ["kitchen_sink"], items: { removal: null, install: "KITCH-SINK" } },
  {
    slugs: [
      "base_cabinet",
      "base_cabinet_drawer",
      "base_corner_left",
      "base_corner_right",
      "base_corner_carousel",
      "base_sink_cabinet",
      "sink_cabinet",
      "double_sink_cabinet",
      "tall_broom_cabinet",
      "tall_oven_cabinet",
      "tall_pantry",
      "high_cabinet",
      "cabinet",
      "island",
    ],
    items: { removal: "DEM-CAB-LF", install: "CAB-INST-BASE", perLinearFt: true },
  },
  {
    slugs: ["wall_cabinet", "wall_cabinet_double"],
    items: { removal: "DEM-CAB-LF", install: "CAB-INST-WALL", perLinearFt: true },
  },
  {
    slugs: ["countertop_run", "countertop_peninsula"],
    items: { removal: "DEM-COUNTER", install: "COUNTER-LAM", perLinearFt: true },
  },
  { slugs: ["shower_door"], items: { removal: null, install: "BATH-SCREEN" } },
  {
    slugs: ["exhaust_fan", "bath_fan_light"],
    items: { removal: null, install: "SUB-ELEC-FAN" },
  },
  { slugs: ["range_hood", "range_hood_insert"], items: { removal: null, install: "KITCH-HOOD" } },
];

const OBJECT_ITEMS_BY_SLUG = new Map<string, ObjectItems>(
  OBJECT_ITEM_GROUPS.flatMap((group) =>
    group.slugs.map((slug) => [slug, group.items] as const),
  ),
);

function objectItems(object: RoomObject): ObjectItems | null {
  return OBJECT_ITEMS_BY_SLUG.get(object.kind) ?? null;
}

function objectLabel(object: RoomObject): string {
  return object.name?.trim() || object.kind;
}

export const OBJECT_RULES: ObjectRule[] = [
  {
    id: "object.disposition",
    title: "Placed objects billed by their disposition",
    lines: (object, _room, t) => {
      if (!object.included) return []; // excluded from the claim — the dollhouse's translucent objects
      if (object.disposition === "none") return [];

      const items = objectItems(object);
      const label = objectLabel(object);
      const perLf = items?.perLinearFt ?? false;
      const widthFt = roundQuantity(mToLinFt(object.width));
      const unit = perLf ? "linear ft" : "each";
      const quantity = perLf ? roundQuantity(widthFt * object.quantity) : object.quantity;
      const calc = perLf
        ? t.objectPerLinearFt(label, widthFt, object.quantity)
        : t.objectEach(label, object.quantity);

      if (object.disposition === "protect") {
        return [
          {
            itemCode: null,
            label: t.protectInPlace(label),
            activity: "memo",
            tradeSection: "misc",
            unit: "each",
            quantity: object.quantity,
            calc,
            note: t.protectInPlaceNote,
          },
        ];
      }

      if (object.disposition === "reset") {
        // Détacher et réinstaller — the price book has no detach & reset
        // items yet, so the line derives visibly unpriced.
        return [
          {
            itemCode: null,
            label: t.detachReset(label),
            activity: "detachReset",
            tradeSection: "misc",
            unit,
            quantity,
            calc,
            issues: ["no_item"],
          },
        ];
      }

      if (object.disposition === "remove") {
        return [
          {
            itemCode: null,
            removalItemCode: items?.removal ?? null,
            label: items?.removal ? undefined : t.removeLabel(label),
            activity: "remove",
            tradeSection: "misc",
            unit,
            quantity,
            calc,
            issues: items?.removal ? undefined : ["no_item"],
          },
        ];
      }

      // replace — E&R, both rates on one line when the book has both codes.
      return [
        {
          itemCode: items?.install ?? null,
          removalItemCode: items?.removal ?? null,
          label: items?.install ? undefined : t.removeAndReplace(label),
          activity: "replace",
          tradeSection: "misc",
          unit,
          quantity,
          calc,
          issues: items?.install ? undefined : ["no_item"],
        },
      ];
    },
  },
];

// ---------------------------------------------------------------------------
// Project rules — the "Frais généraux" pseudo-room and the drying record.

function equipmentItem(kind: string): string | null {
  const k = kind.toLowerCase();
  if (k.includes("dehumidifier")) return "RST-DEHUM";
  if (k.includes("air mover")) return "RST-AIRMOVER";
  return null;
}

/** The business operates in Québec; a visit is a local-time event. Grouping
    readings by the UTC date splits one 19:30 + 20:30 EDT evening visit
    across two "days" — a 195 $ overbill per occurrence — because UTC
    midnight lands at 8 pm local. Monitoring bills local days. */
export const BUSINESS_TIME_ZONE = "America/Toronto";

const LOCAL_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function localDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return LOCAL_DAY.format(date); // en-CA formats as YYYY-MM-DD
}

function distinctReadingDays(readings: MoistureReading[]): number {
  return new Set(readings.map((reading) => localDay(reading.taken_at))).size;
}

function placementDays(placement: EquipmentPlacement, asOf: Date): number {
  return unitDays(placement, asOf);
}

export const PROJECT_RULES: ProjectRule[] = [
  {
    id: "drying.equipment",
    title: "Drying equipment per unit-day, straight off the drying log",
    lines: (ctx, t) =>
      ctx.equipment.flatMap((placement): RuleLine[] => {
        const days = placementDays(placement, ctx.asOf);
        if (days === 0) return [];
        const code = equipmentItem(placement.kind);
        const span = `${placement.in_service_at.slice(0, 10)} → ${
          placement.out_of_service_at?.slice(0, 10) ?? t.stillInService
        }`;
        return [
          {
            // Keyed by the placement's own id: keyed by position, an edit to
            // "the third dehumidifier" would silently become an edit to
            // whichever placement is third after the next re-run.
            keyHint: placement.id,
            itemCode: code,
            label: code ? undefined : t.equipmentRental(placement.kind),
            activity: "install",
            tradeSection: "misc",
            unit: "day",
            quantity: days,
            calc: t.equipmentUnitDays(
              `${placement.kind}${
                placement.identifier ? ` ${placement.identifier}` : ""
              } × ${placement.quantity}`,
              span,
              days,
            ),
            issues: code ? undefined : ["no_item"],
          },
        ];
      }),
  },
  {
    id: "drying.monitoring",
    title: "One monitoring visit per local day a reading was taken",
    lines: (ctx, t) => {
      const visits = distinctReadingDays(ctx.readings);
      if (visits === 0) return [];
      return [
        {
          itemCode: "RST-MONITOR",
          activity: "install",
          tradeSection: "misc",
          unit: "visit",
          quantity: visits,
          calc: t.monitoringVisits(visits),
        },
      ];
    },
  },
  {
    id: "drying.documentation",
    title: "Photo and moisture documentation, once per documented job",
    lines: (ctx, t) => {
      if (ctx.readings.length === 0) return [];
      return [
        {
          itemCode: "RST-DOC",
          activity: "install",
          tradeSection: "misc",
          unit: "report",
          quantity: 1,
          calc: t.readingsOnFile(ctx.readings.length),
        },
      ];
    },
  },
  {
    id: "general.debris",
    title: "Debris out — one small load until the scope says otherwise",
    lines: (ctx, t) => {
      const anyDamage = ctx.rooms.some((room) => room.affectedAreas.length > 0);
      if (!anyDamage) return [];
      return [
        {
          itemCode: null,
          removalItemCode: "GEN-DUMP-SM",
          activity: "remove",
          tradeSection: "misc",
          unit: "load",
          quantity: 1,
          calc: t.debrisLoad,
        },
      ];
    },
  },
  {
    id: "general.finalClean",
    title: "Final cleanup once per job",
    lines: (ctx, t) => {
      const anyDamage = ctx.rooms.some((room) => room.affectedAreas.length > 0);
      if (!anyDamage) return [];
      return [
        {
          itemCode: "GEN-FINAL-CLEAN",
          activity: "install",
          tradeSection: "misc",
          unit: "job",
          quantity: 1,
          calc: t.oncePerJob,
        },
      ];
    },
  },
];
