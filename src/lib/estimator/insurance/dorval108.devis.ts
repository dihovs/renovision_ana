// Our devis for SDC Faubourg Dorval, app. 108 (205 av. Dorval) — priced from
// Restauration CT's estimate 2026-11-04-0957 (1 661,41 $, 7 lines, no sketch,
// no photos). Printed by dorval108.sample.test.ts.

import { getLineItem } from "../catalog";
import { ESTIMATOR_STRINGS } from "./strings";
import { allocateLines, estimateTotals, rateCents } from "./trailer";
import { RESTAURATION_CT_TRAILER, type EstimateLine } from "./types";

/**
 * Their scope, line for line, at our catalogue rates (owner's standing ruling:
 * our pricing, never theirs). They give no room, no sketch and no photos, so
 * the rules engine has no room to derive from: every line is an operator line
 * carrying their measured quantity, in their order.
 *
 * Their quantities: 60 pi² floor protection, 24 pi² 6" mineral wool, 20 pi²
 * plaster (two coats, no lath), 8 pi² ceramic, one pipe penetration through
 * the concrete sealed, one magnetic access door, 1 h cleaning. No removal on
 * any line: the opening was made before (plumbing repair).
 *
 * Operator calls:
 *  - **Plaster, 20 pi²** is over the 16 pi² patch item: board + level-4 finish
 *    by the square foot (DW-INST-12 + DW-TAPE-L4).
 *  - **Tile, 8 pi²**: our install (TILE-WALL-STD — wall assumed until the
 *    photos) and grout. Our install excludes the tile itself → a purchase
 *    provision. A matching tile may not exist; noted.
 *  - **Two visits** (plaster must dry before tile): 2 h GEN-TRAVEL.
 *
 * Catalogue gaps, priced as provisions for the owner to confirm: the tile
 * purchase, the fire-stop at the pipe through the slab, the magnetic access
 * panel.
 *
 * Not included (rule default he may add): paint. Their scope has none; our
 * rules would prime and repaint the patched surface — 20 pi² prime + two
 * coats = 64,00 $ before O&P, or the whole wall once we know the room.
 *
 * Trailer: his "15 %" (RESTAURATION_CT_TRAILER), same as theirs.
 */

const t = ESTIMATOR_STRINGS.fr;
export const DORVAL108_TRAILER = RESTAURATION_CT_TRAILER;
/** Restauration CT's total, taxes included. */
export const DORVAL108_THEIRS_CENTS = 166141;
/** His target: about 5 % under theirs. */
export const DORVAL108_TARGET_CENTS = Math.round(DORVAL108_THEIRS_CENTS * 0.95);

const ROOM = "App. 108 — zone de la réparation";

type Spec = {
  key: string;
  section: EstimateLine["tradeSection"];
  code?: string;
  /** For provisions: no catalogue item. */
  provision?: { name: string; rateCents: number; unit: EstimateLine["unit"] };
  quantity: number;
  calc: string;
  note?: string;
  general?: boolean;
};

function line(s: Spec): EstimateLine {
  const item = s.code ? getLineItem(s.code) : undefined;
  if (s.code && !item) throw new Error(`unknown item ${s.code}`);
  return {
    key: `manual:dorval108:${s.key}`,
    roomScanId: null,
    roomName: s.general ? t.generalConditions : ROOM,
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

export const DORVAL108_SPECS: Spec[] = [
  {
    key: "floor-prot",
    section: "floor",
    code: "GEN-FLOOR-PROT",
    quantity: 60,
    calc: "60 pi² — protection du plancher de la zone de travail et du passage",
  },
  {
    key: "mineral-wool",
    section: "walls",
    code: "INS-ROXUL",
    quantity: 24,
    calc: "24 pi² — laine minérale 6 po (acoustique et coupe-feu) dans l'ouverture",
    note: "Ouverture déjà faite lors de la réparation de plomberie : rien à enlever.",
  },
  {
    key: "board",
    section: "walls",
    code: "DW-INST-12",
    quantity: 20,
    calc: "20 pi² — refermer l'ouverture",
  },
  {
    key: "finish",
    section: "walls",
    code: "DW-TAPE-L4",
    quantity: 20,
    calc: "20 pi² — joints et plâtrage, deux couches et ponçage",
  },
  {
    key: "tile",
    section: "walls",
    code: "TILE-WALL-STD",
    quantity: 8,
    calc: "8 pi² — céramique remise en place autour de la réparation",
  },
  {
    key: "grout",
    section: "walls",
    code: "TILE-GROUT",
    quantity: 8,
    calc: "8 pi²",
  },
  {
    key: "tile-buy",
    section: "walls",
    provision: { name: "Provision — achat de céramique", rateCents: 800, unit: "sq ft" },
    quantity: 8,
    calc: "8 pi² × 8,00 $",
    note: "Céramique semblable à l'existante; un agencement parfait n'est pas garanti.",
  },
  {
    key: "firestop",
    section: "plumbing",
    provision: { name: "Coupe-feu au passage du tuyau dans la dalle de béton", rateCents: 15000, unit: "each" },
    quantity: 1,
    calc: "1 passage — scellant coupe-feu homologué et laine minérale",
  },
  {
    key: "access-panel",
    section: "walls",
    provision: { name: "Trappe d'accès à fermeture magnétique (fournie et posée)", rateCents: 17500, unit: "each" },
    quantity: 1,
    calc: "1 trappe — accès au robinet / à la plomberie",
  },
  {
    key: "clean",
    section: "misc",
    code: "GEN-CLEAN-DAY",
    quantity: 1,
    calc: "1 nettoyage à la fin des travaux",
    general: true,
  },
  {
    key: "travel",
    section: "misc",
    code: "GEN-TRAVEL",
    quantity: 2,
    calc: "2 visites × 1 h — le plâtre doit sécher avant la céramique",
    general: true,
  },
];

export function buildDorval108Devis() {
  const lines = DORVAL108_SPECS.map(line);
  const allocated = allocateLines(lines, DORVAL108_TRAILER);
  return { lines: allocated, totals: estimateTotals(allocated), trailer: DORVAL108_TRAILER };
}
