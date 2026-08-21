import type { Locale } from "@/i18n/translations";

/**
 * The report, in the language the reader needs rather than the language the
 * operator works in.
 *
 * **Why these are separate from the app's own strings.** The owner runs the
 * app in English and sends reports to French-speaking clients, adjusters and
 * carriers in Québec, and those are two different decisions. His words, 21
 * Aug 2026: *"our reports need to be in French. But me, personally, I want to
 * use the app in English. So when we create a report, I wanna have an option
 * to choose the language of the report right when we're creating it."*
 *
 * So the language is a property of the DOCUMENT, chosen at the moment it is
 * generated, and it never touches the interface. It rides in the URL for the
 * same reason `layout` and `dimensions` do: the page is server-rendered for
 * print, and a link that says what the document shows is a link that can be
 * shared showing the same thing.
 *
 * **Bill 96 is the reason this is not a nicety.** A contract or an estimate
 * put to a consumer in Québec must be available in French, and a restoration
 * report is the document a scope of work is agreed from. Shipping an
 * English-only report meant every French job needed the numbers retyped into
 * a Word file by hand — which is where transcription errors come from.
 *
 * **Translated by meaning, not by dictionary.** `Affected area` is `Zone
 * sinistrée` because *sinistre* is the word an insurer actually uses for a
 * loss; `Claim` is `Réclamation`; `Insured` is `Assuré`. A report that reads
 * as machine-translated is a report an adjuster trusts less, which is the
 * opposite of what it is for.
 */
export type ReportStrings = {
  createdOn: string;
  location: string;
  totalArea: string;
  livingArea: string;
  floors: string;
  rooms: string;
  bathroom: string;
  summary: string;
  insured: string;
  property: string;
  workStarted: string;
  reportPrepared: string;
  claimDetails: string;
  notRecorded: string;
  wallAreaGross: string;
  affectedFloorByCause: string;
  affectedWallByCause: string;
  width: string;
  length: string;
  ceilingHeight: string;
  area: string;
  perimeter: string;
  wall: string;
  floor: string;
  name: string;
  cause: string;
  notes: string;
  photo: string;
  photos: string;
  photoOne: string;
  photoMany: string;
  /** `6 Photos (see photos page)` — the cross-reference, not the count. */
  seePhotosPage: (count: number) => string;
  affectedFloorAreaCount: (count: number) => string;
  affectedWallAreaCount: (count: number) => string;
  photosOf: (room: string) => string;
  photoNumber: (n: number) => string;
  /** Videos are numbered in their own series — `Video 1`, `Video 2` — never
      merged with the photo count, so a room's third attachment overall can
      still be captioned `Video 1` if the first two were photos. */
  videoNumber: (n: number) => string;
  photoUnavailable: string;
  staircase: string;
  staircaseNote: string;
  scale: string;
  page: (n: number, of: number) => string;
  disclaimer: (company: string) => string;
  signature: string;
  signatureDate: string;
  printedFullName: string;
  phone: string;
  signingAcknowledges: string;
  drying: string;
  equipment: string;
  quantity: string;
  inService: string;
  outOfService: string;
  stillOnSite: string;
  unitDays: string;
  total: string;
  equipmentNote: (asOf: string) => string;
  reading: string;
  material: string;
  temperature: string;
  howMeasured: string;
  measurementNote: string;
  lockedDimensionsNote: string;
  keyToDrawing: string;
  legendDoor: string;
  legendWindow: string;
  legendOpening: string;
  legendFloorArea: string;
  legendWallArea: string;
  legendKeyed: string;
  legendNote: string;
  northNote: string;
  unregisteredStoreyNote: string;
  shownForContext: string;
  contents: string;
  /** Storey names, for the levels stored as bare numbers. */
  groundFloor: string;
  basement: string;
  nthFloor: (n: number) => string;
};

const en: ReportStrings = {
  createdOn: "CREATED ON",
  location: "LOCATION",
  totalArea: "Total area",
  livingArea: "Living area",
  floors: "Floors",
  rooms: "Rooms",
  bathroom: "Bathroom",
  summary: "Summary",
  insured: "Insured",
  property: "Property",
  workStarted: "Work started",
  reportPrepared: "Report prepared",
  claimDetails: "Claim details",
  notRecorded: "Not recorded",
  wallAreaGross: "Wall area (gross)",
  affectedFloorByCause: "Affected floor area by cause",
  affectedWallByCause: "Affected wall area by cause",
  width: "WIDTH",
  length: "LENGTH",
  ceilingHeight: "CEILING HEIGHT",
  area: "AREA",
  perimeter: "PERIMETER",
  wall: "Wall",
  floor: "Floor",
  name: "Name",
  cause: "Cause",
  notes: "Notes",
  photo: "Photo",
  photos: "Photos",
  photoOne: "Photo",
  photoMany: "Photos",
  seePhotosPage: (count) =>
    `${count} ${count === 1 ? "Photo" : "Photos"} (see photos page)`,
  affectedFloorAreaCount: (count) =>
    `${count} AFFECTED FLOOR AREA${count === 1 ? "" : "S"}`,
  affectedWallAreaCount: (count) =>
    `${count} AFFECTED WALL AREA${count === 1 ? "" : "S"}`,
  photosOf: (room) => `Photos / ${room}`,
  photoNumber: (n) => `Photo ${n}`,
  videoNumber: (n) => `Video ${n}`,
  photoUnavailable: "Photo unavailable",
  staircase: "Staircase",
  staircaseNote: "priced separately, not in the floor area",
  scale: "Scale",
  page: (n, of) => `Page ${n}/${of}`,
  disclaimer: (company) =>
    `THIS FLOOR PLAN IS PROVIDED WITHOUT WARRANTY OF ANY KIND. ${company} DISCLAIMS ANY WARRANTY INCLUDING, WITHOUT LIMITATION, SATISFACTORY QUALITY OR ACCURACY OF DIMENSIONS.`,
  signature: "Signature",
  signatureDate: "Signature date",
  printedFullName: "Printed full name",
  phone: "Phone",
  signingAcknowledges:
    "Signing acknowledges that the areas, measurements and photographs in this report were taken at the property on the dates shown.",
  drying: "Drying record",
  equipment: "Equipment",
  quantity: "Qty",
  inService: "In service",
  outOfService: "Out of service",
  stillOnSite: "Still on site",
  unitDays: "Unit-days",
  total: "Total",
  equipmentNote: (asOf) =>
    `Equipment is billed per unit per day on site. The day of delivery and the day of collection are both counted. Units shown as still on site are counted to ${asOf}.`,
  reading: "Reading",
  material: "Material",
  temperature: "Temp",
  howMeasured: "How each figure is measured",
  measurementNote:
    "All measurements are taken and printed in metres. Lengths are given to the millimetre and areas to the hundredth of a square metre, which is the precision the scan itself carries.",
  lockedDimensionsNote:
    "Only dimensions that were set by hand are shown on this plan. A room with none shows no dimensions.",
  keyToDrawing: "KEY TO THE DRAWING",
  legendDoor: "Door, opening as drawn",
  legendWindow: "Window",
  legendOpening: "Opening, no door",
  legendFloorArea: "Affected floor area",
  legendWallArea: "Affected wall area, shown on its elevation",
  legendKeyed: "Keyed to the list beside the plan",
  legendNote:
    "Every plan is turned square to the page, so north is not implied. Dimensions are metres; the scale bar under each drawing is the one it was drawn to.",
  northNote: "north is not implied",
  unregisteredStoreyNote:
    "Rooms measured on separate visits carry no true position relative to one another. They are arranged here so that none overlaps; each room is drawn to its own scan, and no dimension is taken across the arrangement.",
  shownForContext: "Shown for context — no damage marked",
  contents: "Contents",
  groundFloor: "Ground floor",
  basement: "Basement",
  nthFloor: (n) => {
    const suffix =
      n % 10 === 1 && n % 100 !== 11 ? "st"
      : n % 10 === 2 && n % 100 !== 12 ? "nd"
      : n % 10 === 3 && n % 100 !== 13 ? "rd"
      : "th";
    return `${n}${suffix} floor`;
  },
};

const fr: ReportStrings = {
  createdOn: "CRÉÉ LE",
  location: "EMPLACEMENT",
  totalArea: "Superficie totale",
  livingArea: "Superficie habitable",
  floors: "Étages",
  rooms: "Pièces",
  bathroom: "Salle de bain",
  summary: "Sommaire",
  // `Assuré` is the insurance term, not `Client` — this document goes to a
  // carrier, and the carrier's file calls that person the insured.
  insured: "Assuré",
  property: "Immeuble",
  workStarted: "Début des travaux",
  reportPrepared: "Rapport préparé le",
  claimDetails: "Détails de la réclamation",
  notRecorded: "Non consigné",
  wallAreaGross: "Superficie des murs (brute)",
  // `Sinistre` is what an insurer calls a loss, so a damaged region is a
  // `zone sinistrée`. `Zone affectée` would be an anglicism an adjuster
  // notices immediately.
  affectedFloorByCause: "Superficie de plancher sinistrée par cause",
  affectedWallByCause: "Superficie de mur sinistrée par cause",
  width: "LARGEUR",
  length: "LONGUEUR",
  ceilingHeight: "HAUTEUR SOUS PLAFOND",
  area: "SUPERFICIE",
  perimeter: "PÉRIMÈTRE",
  wall: "Mur",
  floor: "Plancher",
  name: "Nom",
  cause: "Cause",
  notes: "Notes",
  photo: "Photo",
  photos: "Photos",
  photoOne: "photo",
  photoMany: "photos",
  seePhotosPage: (count) =>
    `${count} ${count === 1 ? "photo" : "photos"} (voir la page des photos)`,
  affectedFloorAreaCount: (count) =>
    `${count} ZONE${count === 1 ? "" : "S"} DE PLANCHER SINISTRÉE${count === 1 ? "" : "S"}`,
  affectedWallAreaCount: (count) =>
    `${count} ZONE${count === 1 ? "" : "S"} DE MUR SINISTRÉE${count === 1 ? "" : "S"}`,
  photosOf: (room) => `Photos / ${room}`,
  photoNumber: (n) => `Photo ${n}`,
  photoUnavailable: "Photo indisponible",
  staircase: "Escalier",
  staircaseNote: "facturé séparément, non compris dans la superficie de plancher",
  scale: "Échelle",
  page: (n, of) => `Page ${n}/${of}`,
  disclaimer: (company) =>
    `CE PLAN EST FOURNI SANS GARANTIE D'AUCUNE SORTE. ${company} EXCLUT TOUTE GARANTIE, NOTAMMENT QUANT À LA QUALITÉ SATISFAISANTE OU À L'EXACTITUDE DES DIMENSIONS.`,
  signature: "Signature",
  signatureDate: "Date de la signature",
  printedFullName: "Nom en lettres moulées",
  phone: "Téléphone",
  signingAcknowledges:
    "La signature atteste que les superficies, les mesures et les photographies contenues dans ce rapport ont été relevées à l'immeuble aux dates indiquées.",
  drying: "Registre de séchage",
  equipment: "Équipement",
  quantity: "Qté",
  inService: "Mise en service",
  outOfService: "Retrait",
  stillOnSite: "Toujours sur place",
  unitDays: "Jours-appareil",
  total: "Total",
  equipmentNote: (asOf) =>
    `L'équipement est facturé par appareil et par jour sur place. Le jour de la livraison et celui de la récupération sont tous deux comptés. Les appareils indiqués comme toujours sur place sont comptés jusqu'au ${asOf}.`,
  reading: "Relevé",
  material: "Matériau",
  temperature: "Temp.",
  howMeasured: "Comment chaque mesure est prise",
  measurementNote:
    "Toutes les mesures sont prises et présentées en mètres. Les longueurs sont données au millimètre et les superficies au centième de mètre carré, soit la précision que porte le relevé lui-même.",
  lockedDimensionsNote:
    "Seules les dimensions saisies à la main figurent sur ce plan. Une pièce qui n'en a aucune n'affiche aucune dimension.",
  keyToDrawing: "LÉGENDE DU PLAN",
  legendDoor: "Porte, sens d'ouverture tel que dessiné",
  legendWindow: "Fenêtre",
  legendOpening: "Ouverture, sans porte",
  legendFloorArea: "Zone de plancher sinistrée",
  legendWallArea: "Zone de mur sinistrée, illustrée en élévation",
  legendKeyed: "Renvoi à la liste à côté du plan",
  legendNote:
    "Chaque plan est aligné sur la page; le nord n'est donc pas indiqué. Les dimensions sont en mètres; l'échelle sous chaque dessin est celle à laquelle il a été tracé.",
  northNote: "le nord n'est pas indiqué",
  unregisteredStoreyNote:
    "Les pièces mesurées lors de visites distinctes n'ont pas de position réelle les unes par rapport aux autres. Elles sont disposées ici de façon à ne pas se chevaucher; chaque pièce est tracée d'après son propre relevé, et aucune dimension n'est prise à travers cette disposition.",
  shownForContext: "Présenté à titre indicatif — aucun dommage marqué",
  contents: "Table des matières",
  groundFloor: "Rez-de-chaussée",
  basement: "Sous-sol",
  // `1er étage`, then `2e`, `3e` — French ordinals, and the one place a
  // dictionary swap would have produced `1st étage`.
  nthFloor: (n) => `${n}${n === 1 ? "er" : "e"} étage`,
};

export const REPORT_STRINGS: Record<Locale, ReportStrings> = { en, fr };

/** The document's language, from the `?lang=` the export sheet sets. */
export function reportLocale(value: string | string[] | undefined): Locale {
  return value === "en" ? "en" : value === "fr" ? "fr" : "fr";
}

/**
 * **Numbers, which is where a translated report gives itself away.**
 *
 * French uses the comma as its decimal mark and a narrow no-break space as
 * its thousands separator: `78,64 m²`, not `78.64 m²`. Swapping the words and
 * leaving the figures in anglophone form produces a document that reads as
 * an English report with French labels — and on a page that is mostly
 * figures, that is most of the page.
 *
 * A NO-BREAK SPACE before `m²` and the percent sign, too, which is the
 * French typographic rule and what stops `78,64` and `m²` landing on
 * different lines.
 */
export function formatNumber(locale: Locale, value: number, digits: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** `78,64 m²` / `78.64 m²` */
export function formatArea(locale: Locale, sqm: number): string {
  return `${formatNumber(locale, sqm, 2)} m²`;
}

/** `5,205 m` / `5.205 m` */
export function formatLength(locale: Locale, metres: number): string {
  return `${formatNumber(locale, metres, 3)} m`;
}

/** Bare, for a dimension on a drawing — the unit lives on the scale bar. */
export function formatBare(locale: Locale, metres: number): string {
  return formatNumber(locale, metres, 3);
}

/**
 * `21 août 2026` / `August 21, 2026`.
 *
 * Pinned to America/Toronto because a date-only column read in UTC prints
 * yesterday for anything entered after 7pm — the report is written in Laval
 * and read in Laval.
 */
export function formatDate(locale: Locale, iso: string | null | undefined): string {
  if (!iso) return "—";
  const bare = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const at = new Date(bare ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(at.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Toronto",
  }).format(at);
}
