// Our devis for repainting a daycare's common areas — the street entrance
// and its stair (ground floor, room 310) and Vestibule 200 upstairs — with
// the kitchen A208 as an option. Every quantity comes off the drawing in
// garderie.job.ts. Printed by garderie.sample.test.ts (devis) and
// src/components/admin/garderie-report.render.test.tsx (our report).

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
 */

const t = ESTIMATOR_STRINGS.fr;
export const GARDERIE_TRAILER = RESTAURATION_CT_TRAILER;
const BAND_FT = 3;

const shape = (key: GarderieRoomShape["key"]) => ROOM_SHAPES.find((s) => s.key === key)!;
const ft = (v: number) => v.toLocaleString("fr-CA", { maximumFractionDigits: 1 });
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

function line(s: Spec): EstimateLine {
  const item = s.code ? getLineItem(s.code) : undefined;
  if (s.code && !item) throw new Error(`unknown item ${s.code}`);
  return {
    key: `manual:garderie:${s.key}`,
    roomScanId: s.room ? roomId(s.room) : null,
    roomName: s.room ? shape(s.room).name : t.generalConditions,
    apartment: null,
    tradeSection: s.section,
    activity: "install",
    itemCode: s.code ?? null,
    removalItemCode: null,
    name: s.provision?.name ?? item?.nameFr ?? item?.name ?? "",
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
function wallCalc(key: GarderieRoomShape["key"]) {
  const s = shape(key);
  const f = roomFigures(s);
  const parts = [`${ft(f.walledFt)} pi lin. de murs × ${ftin(s.ceilingFt)} = ${ft(f.wallGrossSqFt)}`];
  if (f.openingSqFt) parts.push(`− ${ft(f.openingSqFt)} portes et fenêtres`);
  if (f.extraSqFt) parts.push(`+ ${ft(f.extraSqFt)} murets`);
  if (f.hiddenSqFt) parts.push(`− ${ft(f.hiddenSqFt)} derrière comptoirs et électroménagers`);
  return { sqft: Math.round(f.paintSqFt), calc: parts.join(" ") };
}

function bandCalc(key: GarderieRoomShape["key"]) {
  const f = roomFigures(shape(key));
  return { sqft: Math.round(f.baseRunFt * BAND_FT), calc: `${ft(f.baseRunFt)} pi lin. (sans les portes) × ${BAND_FT} pi — bas des murs : coups, petits trous, ponçage` };
}

function specs(): Spec[] {
  const hallWall = wallCalc("entrance");
  const hallBand = bandCalc("entrance");
  const vestWall = wallCalc("vestibule");
  const vestBand = bandCalc("vestibule");
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
      note: "Gris, deux couches par-dessus le bleu pâle actuel. La façade vitrée n'a que ses deux trumeaux à peindre.",
    },
    {
      key: "stair-prep",
      room: "entrance",
      section: "walls",
      code: "PNT-PREP-MIN",
      quantity: stairBand,
      calc: `2 côtés × ${ft(STAIRWELL.runFt)} pi × ${BAND_FT} pi — le long des marches et des mains courantes`,
    },
    {
      key: "stair-paint",
      room: "entrance",
      section: "walls",
      code: "PNT-WALL-2",
      quantity: stair,
      calc: `Cage d'escalier : ${STAIRWELL.parts.map((p) => `${p.label.toLowerCase()} ${ft(p.sqft)}`).join(" + ")}`,
      note: "Gris, deux couches.",
    },
    {
      key: "stair-platform",
      room: "entrance",
      section: "misc",
      provision: { name: "Plateforme d'escalier / madriers — location, montage et démontage", rateCents: 17500, unit: "job" },
      quantity: 1,
      calc: "Pour atteindre le haut des murs au-dessus des marches",
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
      note: "Gris, deux couches, jusqu'au plafond suspendu. Comprend le palier de l'ascenseur, l'alcôve et les murets autour de l'escalier.",
    },
    // Chantier
    {
      key: "site-prep",
      room: null,
      section: "misc",
      code: "GEN-SITE-PREP-MD",
      quantity: 1,
      calc: "Toiles sur la céramique et les marches, masquage des cadres, plinthes, plafond suspendu, portes vitrées, porte d'ascenseur et rampes; retrait de l'ancien ruban",
      note: "Passage gardé libre : l'entrée sert aussi aux autres locataires.",
    },
    { key: "clean", room: null, section: "misc", code: "GEN-CLEAN-DAY", quantity: 3, calc: "3 jours — l'entrée reste propre et passable chaque soir" },
    { key: "travel", room: null, section: "misc", code: "GEN-TRAVEL", quantity: 3, calc: "3 jours × 1 h" },
  ];
}

function kitchenSpecs(): Spec[] {
  const wall = wallCalc("kitchen");
  return [
    { key: "kitchen-move", room: "kitchen", section: "misc", code: "GEN-FURN-MOVE", quantity: 1, calc: "1 h — dégager les comptoirs, protéger les électroménagers" },
    { key: "kitchen-prep", room: "kitchen", section: "walls", code: "PNT-PREP-MIN", quantity: wall.sqft, calc: "Tous les murs peints : dégraissage, petits trous, ponçage" },
    {
      key: "kitchen-paint",
      room: "kitchen",
      section: "walls",
      code: "PNT-WALL-2",
      quantity: wall.sqft,
      calc: wall.calc,
      note: "Fini lavable (velours ou semi-lustré), deux couches. Le nouveau mur avec porte au bas de la cuisine est compté comme existant.",
    },
  ];
}

function priced(list: Spec[]) {
  const lines = allocateLines(list.map(line), GARDERIE_TRAILER);
  return { lines, totals: estimateTotals(lines) };
}

export function buildGarderieDevis() {
  return { base: priced(specs()), kitchen: priced(kitchenSpecs()), trailer: GARDERIE_TRAILER };
}
