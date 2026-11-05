// The estimator's own prose, in the language the document is written in.
//
// **Why this exists beside `src/lib/report/strings.ts` rather than inside
// it.** That module translates the report's FURNITURE — headings, legends,
// the disclaimer — which the renderer picks per document at print time. This
// one translates the CALC citation and the scoping NOTE that a rule writes
// onto a line, and those are not furniture: they are generated sentences
// about specific measured numbers, they are stored on the line
// (`insurance_estimate_lines.calc` is one `text` column — see migration
// 0042), and an operator may edit them. So they are chosen once, when the
// estimate is derived, and they stay as written.
//
// **The consequence, stated plainly.** An estimate derived in English and
// printed with `?lang=fr` prints French headings over English CALC lines.
// The item NAME re-localizes at print time (it is a catalog lookup on
// `itemCode` — see `lineItemName`), but the citation cannot: the arithmetic
// was already turned into a sentence. Deriving in the language the document
// will be read in is therefore the contract, and `deriveLines(ctx, locale)`
// is where it is set. Making the citation re-localizable would mean storing
// it structured — a key plus its parameters — which is a schema change to
// the estimate line table, not a string change; it is the right eventual
// shape and it is deliberately not being done inside a translation pass.
//
// **Register.** The vocabulary is the one the reference Xactimate documents
// print (`Docs/Estimator-Xactimate-Conventions.md`): `placoplâtre`, `pi²`,
// `pi lin.`, `zone sinistrée`, `E&R`. A CALC line is read by an adjuster
// checking a quantity, so it has to sound like the estimates that land on
// their desk every day.

import type { Locale } from "@/i18n/translations";
import type { FloorFinish } from "./types";

export type EstimatorStrings = {
  /** The units as they appear INSIDE a citation sentence. The QTÉ column's
      own abbreviation is `unitLabel` in ../catalog.ts; they agree. */
  sqFt: string;
  linFt: string;
  /**
   * **A measured quantity, inside the sentence that cites it.**
   *
   * A CALC reading `murs sinistrés : Eau = 79.92 pi²` beside a QTÉ column
   * reading `79,92 pi²` states the same number two ways on one line, and the
   * anglophone one is the one an adjuster stops at. Two decimals, because
   * quantities are two-decimal by contract (`units.ts roundQuantity`) and
   * the reference documents print `88,20 P2`, never `88,2`.
   */
  qty: (value: number) => string;
  /** A plain count — days, visits, readings, a number of fixtures. No
      decimals: `3 visites`, not `3,00`. */
  count: (value: number) => string;

  /** floor.protection */
  floorAreaFullRoom: (sqft: number) => string;
  /** floor.replace */
  floorCoveringLabel: string;
  floorFinishNotRecorded: (affected: number, full: number) => string;
  fullFloorReplaced: (full: number, finish: FloorFinish) => string;
  affectedAreaPatched: (affected: number, finish: FloorFinish) => string;
  affectedFloor: (names: string, sqft: number) => string;
  carpetInstallLabel: string;
  /** floor.baseboard / wall.baseboard */
  baseboardLength: (ft: number) => string;
  baseboardLengthFullRoom: (ft: number) => string;
  affectedWallsRun: (indices: string, ft: number) => string;
  trimPaintNote: (ft: number, indices: string) => string;
  /** wall.drywall / ceiling.drywall */
  affectedWalls: (names: string, sqft: number) => string;
  affectedCeiling: (names: string, sqft: number) => string;
  sealPastJoint: (sqft: number) => string;
  /** wall.paint / ceiling.paint */
  netWallArea: (sqft: number) => string;
  wallPaintNote: string;
  ceilingIsFloorArea: (sqft: number) => string;
  ceilingPaintNote: string;
  /** room.antimicrobial */
  affectedSurfaces: (names: string, sqft: number) => string;
  /** object.disposition */
  protectInPlace: (label: string) => string;
  protectInPlaceNote: string;
  detachReset: (label: string) => string;
  removeLabel: (label: string) => string;
  removeAndReplace: (label: string) => string;
  objectPerLinearFt: (label: string, widthFt: number, quantity: number) => string;
  objectEach: (label: string, quantity: number) => string;
  /** drying.* */
  equipmentRental: (kind: string) => string;
  equipmentUnitDays: (subject: string, span: string, days: number) => string;
  stillInService: string;
  monitoringVisits: (visits: number) => string;
  readingsOnFile: (readings: number) => string;
  /** general.* */
  debrisLoad: string;
  oncePerJob: string;
  /** derive.ts */
  unpricedWork: string;
  minimumLabourCharge: (category: string) => string;
  minimumCalc: (minimum: string, billed: string) => string;
  /** The pseudo-room project-level lines print under. */
  generalConditions: string;
};

/** The finish, named — a CALC that says `hardwood replaced wall to wall`
    has to say `bois franc` on a French devis, and the finish is an enum, not
    a word the estimator typed. */
const FINISH_EN: Record<FloorFinish, string> = {
  laminate: "laminate",
  lvp: "luxury vinyl plank",
  engineered: "engineered hardwood",
  hardwood: "hardwood",
  carpet: "carpet",
  tile: "tile",
};

const FINISH_FR: Record<FloorFinish, string> = {
  laminate: "stratifié",
  lvp: "vinyle de luxe",
  engineered: "bois d'ingénierie",
  hardwood: "bois franc",
  carpet: "tapis",
  tile: "céramique",
};

/** The document's own number format. `fr-CA` puts a comma on the decimal and
    a narrow no-break space on the thousands — the same rule
    `report/strings.ts formatNumber` applies to every figure the report
    prints, applied here to the figures a citation quotes. */
function numberFormatter(locale: Locale, digits: number): Intl.NumberFormat {
  return new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const EN_QTY = numberFormatter("en", 2);
const EN_COUNT = numberFormatter("en", 0);
const FR_QTY = numberFormatter("fr", 2);
const FR_COUNT = numberFormatter("fr", 0);

const enQty = (v: number) => EN_QTY.format(v);
const frQty = (v: number) => FR_QTY.format(v);

const en: EstimatorStrings = {
  sqFt: "sq ft",
  linFt: "lin ft",
  qty: enQty,
  count: (v) => EN_COUNT.format(v),

  floorAreaFullRoom: (sqft) => `floor area ${enQty(sqft)} sq ft — full room`,
  floorCoveringLabel: "Floor covering removal and replacement",
  floorFinishNotRecorded: (affected, full) =>
    `floor finish not recorded — affected ${enQty(affected)} sq ft of ${enQty(full)}`,
  fullFloorReplaced: (full, finish) =>
    `full floor ${enQty(full)} sq ft — ${FINISH_EN[finish]} replaced wall to wall`,
  affectedAreaPatched: (affected, finish) =>
    `affected area ${enQty(affected)} sq ft — ${FINISH_EN[finish]} patched, not relaid`,
  affectedFloor: (names, sqft) => `affected floor: ${names} = ${enQty(sqft)} sq ft`,
  carpetInstallLabel: "Install carpet and underpad",
  baseboardLength: (ft) => `baseboard length ${enQty(ft)} lin ft (perimeter minus doorways)`,
  baseboardLengthFullRoom: (ft) =>
    `baseboard length ${enQty(ft)} lin ft (perimeter minus doorways) — full room`,
  affectedWallsRun: (indices, ft) => `walls ${indices} — ${enQty(ft)} lin ft`,
  trimPaintNote: (ft, indices) =>
    `Full room by default; ${enQty(ft)} lin ft of it is the trim coming off wall ${indices}.`,
  affectedWalls: (names, sqft) => `affected walls: ${names} = ${enQty(sqft)} sq ft`,
  affectedCeiling: (names, sqft) => `affected ceiling: ${names} = ${enQty(sqft)} sq ft`,
  sealPastJoint: (sqft) => `${enQty(sqft)} sq ft × 1.25 — seal past the patch joint`,
  netWallArea: (sqft) => `net wall area ${enQty(sqft)} sq ft — trim to the affected walls if partial`,
  wallPaintNote: "Full room by default; the reference claims often paint affected walls only.",
  ceilingIsFloorArea: (sqft) => `ceiling area = floor area ${enQty(sqft)} sq ft — full room`,
  ceilingPaintNote: "Full room by default; delete it when the ceiling is untouched and staying.",
  affectedSurfaces: (names, sqft) => `affected surfaces: ${names} = ${enQty(sqft)} sq ft`,
  protectInPlace: (label) => `Protect in place — ${label}`,
  protectInPlaceNote:
    "Protection is carried by the room's surface-protection line; recorded here at no charge.",
  detachReset: (label) => `Detach and reset — ${label}`,
  removeLabel: (label) => `Remove — ${label}`,
  removeAndReplace: (label) => `Remove and replace — ${label}`,
  objectPerLinearFt: (label, widthFt, quantity) =>
    `${label}: width ${enQty(widthFt)} lin ft × ${EN_COUNT.format(quantity)}`,
  objectEach: (label, quantity) => `${label} × ${EN_COUNT.format(quantity)}`,
  equipmentRental: (kind) => `${kind} rental`,
  equipmentUnitDays: (subject, span, days) => `${subject}, ${span} = ${EN_COUNT.format(days)} unit-days`,
  stillInService: "in service",
  monitoringVisits: (visits) => `${EN_COUNT.format(visits)} distinct days with moisture readings (local time)`,
  readingsOnFile: (readings) => `${EN_COUNT.format(readings)} readings on file`,
  debrisLoad: "1 load — resize to the demolition actually scoped",
  oncePerJob: "once per job",
  unpricedWork: "Unpriced work",
  minimumLabourCharge: (category) => `Minimum labour charge — ${category}`,
  minimumCalc: (minimum, billed) => `minimum ${minimum} − billed ${billed}`,
  generalConditions: "General conditions",
};

const fr: EstimatorStrings = {
  sqFt: "pi²",
  linFt: "pi lin.",
  qty: frQty,
  count: (v) => FR_COUNT.format(v),

  floorAreaFullRoom: (sqft) => `superficie de plancher ${frQty(sqft)} pi² — pièce entière`,
  floorCoveringLabel: "Enlever et remplacer le revêtement de sol",
  floorFinishNotRecorded: (affected, full) =>
    `revêtement de sol non consigné — ${frQty(affected)} pi² sinistrés sur ${frQty(full)}`,
  fullFloorReplaced: (full, finish) =>
    `plancher entier ${frQty(full)} pi² — ${FINISH_FR[finish]} remplacé mur à mur`,
  affectedAreaPatched: (affected, finish) =>
    `zone sinistrée ${frQty(affected)} pi² — ${FINISH_FR[finish]} réparé, non reposé au complet`,
  affectedFloor: (names, sqft) => `plancher sinistré : ${names} = ${frQty(sqft)} pi²`,
  carpetInstallLabel: "Poser un tapis et sa thibaude",
  baseboardLength: (ft) => `longueur de plinthe ${frQty(ft)} pi lin. (périmètre moins les baies de porte)`,
  baseboardLengthFullRoom: (ft) =>
    `longueur de plinthe ${frQty(ft)} pi lin. (périmètre moins les baies de porte) — pièce entière`,
  affectedWallsRun: (indices, ft) => `murs ${indices} — ${frQty(ft)} pi lin.`,
  trimPaintNote: (ft, indices) =>
    `Pièce entière par défaut; ${frQty(ft)} pi lin. correspondent à la plinthe enlevée du mur ${indices}.`,
  affectedWalls: (names, sqft) => `murs sinistrés : ${names} = ${frQty(sqft)} pi²`,
  affectedCeiling: (names, sqft) => `plafond sinistré : ${names} = ${frQty(sqft)} pi²`,
  // The reference's own convention, CALC `32*1,25`: the seal coat blends the
  // patch past its joint rather than stopping at the new board.
  sealPastJoint: (sqft) => `${frQty(sqft)} pi² × 1,25 — sceller au-delà du joint de raccord`,
  netWallArea: (sqft) =>
    `superficie nette des murs ${frQty(sqft)} pi² — réduire aux murs sinistrés si partiel`,
  wallPaintNote:
    "Pièce entière par défaut; les devis de référence ne peignent souvent que les murs sinistrés.",
  ceilingIsFloorArea: (sqft) =>
    `superficie du plafond = superficie de plancher ${frQty(sqft)} pi² — pièce entière`,
  ceilingPaintNote:
    "Pièce entière par défaut; supprimer cette ligne si le plafond est intact et conservé.",
  affectedSurfaces: (names, sqft) => `surfaces sinistrées : ${names} = ${frQty(sqft)} pi²`,
  protectInPlace: (label) => `Protéger sur place — ${label}`,
  protectInPlaceNote:
    "La protection est portée par la ligne de protection des surfaces de la pièce; consignée ici sans frais.",
  // `Détacher et réinstaller` is Xactimate's own wording, printed verbatim
  // in the reference (`Toilette - Détacher et réinstaller`).
  detachReset: (label) => `Détacher et réinstaller — ${label}`,
  removeLabel: (label) => `Enlever — ${label}`,
  removeAndReplace: (label) => `Enlever et remplacer — ${label}`,
  objectPerLinearFt: (label, widthFt, quantity) =>
    `${label} : largeur ${frQty(widthFt)} pi lin. × ${FR_COUNT.format(quantity)}`,
  objectEach: (label, quantity) => `${label} × ${FR_COUNT.format(quantity)}`,
  equipmentRental: (kind) => `Location — ${kind}`,
  equipmentUnitDays: (subject, span, days) => `${subject}, ${span} = ${FR_COUNT.format(days)} jours-appareil`,
  stillInService: "toujours en service",
  monitoringVisits: (visits) =>
    `${FR_COUNT.format(visits)} jours distincts avec relevés d'humidité (heure locale)`,
  readingsOnFile: (readings) => `${FR_COUNT.format(readings)} relevés au dossier`,
  debrisLoad: "1 voyage — ajuster à la démolition réellement prévue",
  oncePerJob: "une fois par chantier",
  unpricedWork: "Travaux non chiffrés",
  // The reference's own section heading: `Coûts minimaux de main-d'œuvre
  // appliqués`.
  minimumLabourCharge: (category) => `Coût minimal de main-d'œuvre — ${category}`,
  minimumCalc: (minimum, billed) => `minimum ${minimum} − facturé ${billed}`,
  generalConditions: "Frais généraux",
};

export const ESTIMATOR_STRINGS: Record<Locale, EstimatorStrings> = { en, fr };
