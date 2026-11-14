// Our devis for repainting a daycare's common areas — the street entrance
// and its stair (ground floor, room 310) and Vestibule 200 upstairs — with
// the kitchen A208 as an option. Every quantity comes off the drawing in
// garderie.job.ts. Printed by garderie.sample.test.ts (devis) and
// src/components/admin/garderie-report.render.test.tsx (our report), in
// French and in English.

import type { Locale } from "@/i18n/translations";
import { getLineItem } from "../catalog";
import {
  ROOM_SHAPES,
  STAIRWELL,
  roomFigures,
  roomId,
  stairwellSqFt,
  type GarderieRoomShape,
} from "./garderie.job";
import { ESTIMATOR_STRINGS } from "./strings";
import { allocateLines, estimateTotals, rateCents } from "./trailer";
import { RESTAURATION_CT_TRAILER, type EstimateLine } from "./types";

/**
 * The client's ask (14 Nov 2026, via Artush): change the colour of the
 * entrance and the vestibule to grey; small patches along the way — the
 * small damage at the bottom of the walls. The kitchen only if the price
 * suits, so it is priced on its own.
 *
 * No competitor document: every line is an operator line at our catalogue
 * rate, its quantity read off our drawing (garderie.job.ts → roomFigures).
 * The rates include the paint (PNT-WALL-2: two coats, standard light
 * colour).
 *
 * Operator calls:
 *  - **Prep where the damage is**: PNT-PREP-MIN on a 3 ft band along the
 *    bottom of every painted wall (her words), not the whole wall. The
 *    kitchen gets it on every wall: grease.
 *  - **Two coats** of grey over the light blue (PNT-WALL-2). A dark grey
 *    would add PNT-DARK; not included.
 *  - **Daily cleanup**, not a final clean: the entrance stays in use by the
 *    building's other tenants (dentist, physio… on the door) every day.
 *  - **One trip a day**, three days (two painters, ~52 h).
 *
 * Catalogue gap, priced as a provision for the owner to confirm: a stair
 * platform / planks for the walls over the flight.
 *
 * Trailer: his "15 %" (RESTAURATION_CT_TRAILER).
 *
 * The CALC and NOTE are written in the document's language when the lines
 * are built (see ./strings.ts on why they cannot be re-localized later).
 */

export const GARDERIE_TRAILER = RESTAURATION_CT_TRAILER;
const BAND_FT = 3;

const shape = (key: GarderieRoomShape["key"]) => ROOM_SHAPES.find((s) => s.key === key)!;
const ftin = (v: number) => {
  const inches = Math.round(v * 12);
  return `${Math.floor(inches / 12)}'-${inches % 12}"`;
};

type Spec = {
  key: string;
  room: GarderieRoomShape["key"] | null;
  section: EstimateLine["tradeSection"];
  code?: string;
  provision?: { name: string; rateCents: number; unit: EstimateLine["unit"] };
  quantity: number;
  calc: string;
  note?: string;
};

function writer(locale: Locale) {
  const ft = (v: number) => v.toLocaleString(locale === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 1 });
  const say = (fr: string, en: string) => (locale === "fr" ? fr : en);
  return { ft, say };
}

function line(s: Spec, locale: Locale): EstimateLine {
  const t = ESTIMATOR_STRINGS[locale];
  const item = s.code ? getLineItem(s.code) : undefined;
  if (s.code && !item) throw new Error(`unknown item ${s.code}`);
  return {
    key: `manual:garderie:${s.key}`,
    roomScanId: s.room ? roomId(s.room) : null,
    roomName: s.room ? shape(s.room).name[locale] : t.generalConditions,
    apartment: null,
    tradeSection: s.section,
    activity: "install",
    itemCode: s.code ?? null,
    removalItemCode: null,
    name: s.provision?.name ?? (locale === "fr" ? item?.nameFr : item?.name) ?? item?.name ?? "",
    unit: s.provision?.unit ?? item!.unit,
    quantity: s.quantity,
    calc: s.calc,
    note: s.note ?? null,
    origin: "manual",
    provenance: "operator",
    removeRateCents: null,
    replaceRateCents: s.provision ? s.provision.rateCents : rateCents(s.code),
    issues: [],
    taxable: item?.taxable ?? true,
    removed: false,
  };
}

/** The painted wall of a room and the CALC that shows where it comes from. */
function wallCalc(key: GarderieRoomShape["key"], locale: Locale) {
  const { ft, say } = writer(locale);
  const s = shape(key);
  const f = roomFigures(s);
  const parts = [say(`${ft(f.walledFt)} pi lin. de murs`, `${ft(f.walledFt)} lin ft of wall`) + ` × ${ftin(s.ceilingFt)} = ${ft(f.wallGrossSqFt)}`];
  if (f.openingSqFt) parts.push(`− ${ft(f.openingSqFt)} ${say("portes et fenêtres", "doors and windows")}`);
  if (f.extraSqFt) parts.push(`+ ${ft(f.extraSqFt)} ${say("murets", "half-walls")}`);
  if (f.hiddenSqFt) parts.push(`− ${ft(f.hiddenSqFt)} ${say("derrière comptoirs et électroménagers", "behind counters and appliances")}`);
  return { sqft: Math.round(f.paintSqFt), calc: parts.join(" ") };
}

function bandCalc(key: GarderieRoomShape["key"], locale: Locale) {
  const { ft, say } = writer(locale);
  const f = roomFigures(shape(key));
  return {
    sqft: Math.round(f.baseRunFt * BAND_FT),
    calc: say(
      `${ft(f.baseRunFt)} pi lin. (sans les portes) × ${BAND_FT} pi — bas des murs : coups, petits trous, ponçage`,
      `${ft(f.baseRunFt)} lin ft (doors excluded) × ${BAND_FT} ft — bottom of the walls: dents, small holes, sanding`,
    ),
  };
}

function specs(locale: Locale): Spec[] {
  const { ft, say } = writer(locale);
  const hallWall = wallCalc("entrance", locale);
  const hallBand = bandCalc("entrance", locale);
  const vestWall = wallCalc("vestibule", locale);
  const vestBand = bandCalc("vestibule", locale);
  const stair = Math.round(stairwellSqFt());
  const stairBand = Math.round(2 * STAIRWELL.runFt * BAND_FT);
  return [
    // Hall d'entrée et escalier
    { key: "entrance-prep", room: "entrance", section: "walls", code: "PNT-PREP-MIN", quantity: hallBand.sqft, calc: hallBand.calc },
    {
      key: "entrance-paint",
      room: "entrance",
      section: "walls",
      code: "PNT-WALL-2",
      quantity: hallWall.sqft,
      calc: hallWall.calc,
      note: say(
        "Gris, deux couches par-dessus le bleu pâle actuel. La façade vitrée n'a que ses deux trumeaux à peindre.",
        "Grey, two coats over the current light blue. The glass storefront has only its two piers to paint.",
      ),
    },
    {
      key: "stair-prep",
      room: "entrance",
      section: "walls",
      code: "PNT-PREP-MIN",
      quantity: stairBand,
      calc: say(
        `2 côtés × ${ft(STAIRWELL.runFt)} pi × ${BAND_FT} pi — le long des marches et des mains courantes`,
        `2 sides × ${ft(STAIRWELL.runFt)} ft × ${BAND_FT} ft — along the steps and the handrails`,
      ),
    },
    {
      key: "stair-paint",
      room: "entrance",
      section: "walls",
      code: "PNT-WALL-2",
      quantity: stair,
      calc:
        say("Cage d'escalier : ", "Stairwell: ") +
        STAIRWELL.parts.map((p) => `${p.label[locale].toLowerCase()} ${ft(p.sqft)}`).join(" + "),
      note: say("Gris, deux couches.", "Grey, two coats."),
    },
    {
      key: "stair-platform",
      room: "entrance",
      section: "misc",
      provision: {
        name: say(
          "Plateforme d'escalier / madriers — location, montage et démontage",
          "Stair platform / planks — rental, set-up and removal",
        ),
        rateCents: 17500,
        unit: "job",
      },
      quantity: 1,
      calc: say("Pour atteindre le haut des murs au-dessus des marches", "To reach the top of the walls over the steps"),
    },
    // Vestibule 200
    { key: "vestibule-prep", room: "vestibule", section: "walls", code: "PNT-PREP-MIN", quantity: vestBand.sqft, calc: vestBand.calc },
    {
      key: "vestibule-paint",
      room: "vestibule",
      section: "walls",
      code: "PNT-WALL-2",
      quantity: vestWall.sqft,
      calc: vestWall.calc,
      note: say(
        "Gris, deux couches, jusqu'au plafond suspendu. Comprend le palier de l'ascenseur, l'alcôve et les murets autour de l'escalier.",
        "Grey, two coats, up to the suspended ceiling. Includes the elevator landing, the alcove and the half-walls around the stairs.",
      ),
    },
    // Chantier
    {
      key: "site-prep",
      room: null,
      section: "misc",
      code: "GEN-SITE-PREP-MD",
      quantity: 1,
      calc: say(
        "Toiles sur la céramique et les marches, masquage des cadres, plinthes, plafond suspendu, portes vitrées, porte d'ascenseur et rampes; retrait de l'ancien ruban",
        "Drop cloths on the tile and the steps; masking of the frames, baseboards, suspended ceiling, glass doors, elevator door and railings; old tape removed",
      ),
      note: say(
        "Passage gardé libre : l'entrée sert aussi aux autres locataires.",
        "Passage kept clear: the entrance also serves the building's other tenants.",
      ),
    },
    {
      key: "clean",
      room: null,
      section: "misc",
      code: "GEN-CLEAN-DAY",
      quantity: 3,
      calc: say("3 jours — l'entrée reste propre et passable chaque soir", "3 days — the entrance left clean and passable every evening"),
    },
    { key: "travel", room: null, section: "misc", code: "GEN-TRAVEL", quantity: 3, calc: say("3 jours × 1 h", "3 days × 1 h") },
  ];
}

function kitchenSpecs(locale: Locale): Spec[] {
  const { say } = writer(locale);
  const wall = wallCalc("kitchen", locale);
  return [
    {
      key: "kitchen-move",
      room: "kitchen",
      section: "misc",
      code: "GEN-FURN-MOVE",
      quantity: 1,
      calc: say("1 h — dégager les comptoirs, protéger les électroménagers", "1 h — clear the counters, protect the appliances"),
    },
    {
      key: "kitchen-prep",
      room: "kitchen",
      section: "walls",
      code: "PNT-PREP-MIN",
      quantity: wall.sqft,
      calc: say("Tous les murs peints : dégraissage, petits trous, ponçage", "Every painted wall: degreasing, small holes, sanding"),
    },
    {
      key: "kitchen-paint",
      room: "kitchen",
      section: "walls",
      code: "PNT-WALL-2",
      quantity: wall.sqft,
      calc: wall.calc,
      note: say(
        "Fini lavable (velours ou semi-lustré), deux couches. Le nouveau mur avec porte au bas de la cuisine est compté comme existant.",
        "Washable finish (eggshell or semi-gloss), two coats. The new wall with the door at the bottom of the kitchen is counted as existing.",
      ),
    },
  ];
}

function priced(list: Spec[], locale: Locale) {
  const lines = allocateLines(
    list.map((s) => line(s, locale)),
    GARDERIE_TRAILER,
  );
  return { lines, totals: estimateTotals(lines) };
}

export function buildGarderieDevis(locale: Locale = "fr") {
  return { base: priced(specs(locale), locale), kitchen: priced(kitchenSpecs(locale), locale), trailer: GARDERIE_TRAILER };
}
