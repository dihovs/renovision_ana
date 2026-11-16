import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import puppeteer from "puppeteer-core";
import { numberSheets } from "@/lib/report/sheets";
import { renderToStaticMarkup } from "react-dom/server";
import ReportDocument, { type ReportData, type ReportRoom } from "./ReportDocument";
import { DEFAULT_COMPANY } from "@/lib/crm/settings";
import type { ScanGeometry } from "@/lib/roomScan";
import type { Locale } from "@/i18n/translations";
import {
  LEVEL_GROUND,
  LEVEL_UP,
  ROOM_SHAPES,
  WALL_THICKNESS_M,
  feetToMetres as m,
  planObjects,
  roomFigures,
  roomId,
  sqftToSqm,
} from "@/lib/estimator/insurance/garderie.job";
import {
  GARDERIE_TRAILER,
  buildGarderieDevis,
  clientPaintNeeds,
  type GarderieSupply,
} from "@/lib/estimator/insurance/garderie.devis";

/**
 * Our report for the daycare's common areas — her plans redrawn by us
 * (garderie.job.ts), her site photos, our prices (garderie.devis.ts). Same
 * method as clark-report.render.test.tsx.
 *
 * - **Plans**: the ground floor (hall 310 and its stair) and the upper floor
 *   (Vestibule 200, and the kitchen A208 drawn as the option).
 * - **Photos**: five of her six; the one with a passer-by in it is left out.
 *   Not in the repo (client data): GARDERIE_PHOTO_DIR holds them with a
 *   manifest.json of `{ roomKey: [{ file, note }] }`.
 * - **Lines**: room by room, each room's priced lines under its own plan
 *   (the owner's way, `estimatePlacement: "rooms"`, the quote default); the
 *   job-wide lines and the summary at the end. The kitchen is an option:
 *   itemized on its own page, totalled apart, never in the document's total.
 * - **Client and address** come from GARDERIE_CLIENT / GARDERIE_ADDRESS.
 * - **Languages**: printed in French and in English. A photo's `noteEn` is
 *   its caption in the English copy.
 *
 * Asserts nothing; writes the files. Not part of `npm test`. Run:
 *   GARDERIE_PHOTO_DIR=… npx vitest run --config vitest.render.mts garderie-report
 *
 * → /tmp/garderie-report.{html,pdf} (fr), /tmp/garderie-report.en.{html,pdf}
 *   and the version where she buys the paint and primer (garderie.devis.ts):
 *   /tmp/garderie-report.labour{,.en}.{html,pdf}
 */

const PHOTO_DIR = process.env.GARDERIE_PHOTO_DIR || "/tmp/garderie-photos";
type Manifest = Record<string, Array<{ file: string; note: string | null; noteEn?: string | null }>>;

function loadManifest(): Manifest {
  const path = `${PHOTO_DIR}/manifest.json`;
  if (!existsSync(path)) throw new Error(`Missing ${path} (her site photos, kept out of the repo).`);
  return JSON.parse(readFileSync(path, "utf8")) as Manifest;
}

function photosFor(manifest: Manifest, key: string, locale: Locale): ReportRoom["photos"] {
  return (manifest[key] ?? []).map((photo) => ({
    id: photo.file,
    url: `data:image/jpeg;base64,${readFileSync(`${PHOTO_DIR}/${photo.file}`).toString("base64")}`,
    note: locale === "fr" ? photo.note : (photo.noteEn ?? photo.note),
    contentType: "image/jpeg",
  }));
}

function geometry(shape: (typeof ROOM_SHAPES)[number]): ScanGeometry {
  return {
    walls: [],
    floors: [],
    doors: [],
    windows: [],
    doorCount: shape.openingsFt.filter((o) => o.kind === "door").length,
    windowCount: shape.openingsFt.filter((o) => o.kind === "window").length,
    openingCount: shape.openingsFt.filter((o) => o.kind === "opening").length,
    // The stairs are drawn (objects), not counted: a counted stair prints
    // "billed separately", and nothing here bills stairs.
    stairCount: 0,
    editedPolygon: shape.polygonFt.map((p) => ({ x: m(p.x), y: m(p.y) })),
    editedOpenings: shape.openingsFt.map((o) => ({
      x1: m(o.x1),
      y1: m(o.y1),
      x2: m(o.x2),
      y2: m(o.y2),
      kind: o.kind,
      hinge: o.hinge,
      opens: o.opens,
    })),
  };
}

const money = (cents: number, locale: Locale) =>
  locale === "fr"
    ? (cents / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $"
    : "$" + (cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const NEED = clientPaintNeeds();

/** The project's own words, per language. */
const COPY = {
  fr: {
    project: "Garderie — peinture des aires communes",
    title: "Garderie — peinture (la peinture du client)",
    materials: (supply: GarderieSupply) =>
      supply === "client-paint"
        ? `La peinture et l'apprêt sont fournis par vous (environ ${NEED.base.paintGal} gallons de gris et ${NEED.base.primerGal} gallon d'apprêt; ${NEED.kitchen.paintGal} gallons et ${NEED.kitchen.primerGal} gallon de plus pour la cuisine); le plâtre pour les réparations et tout le matériel de protection sont fournis par nous et compris dans le prix. `
        : `Tous les matériaux sont fournis par nous et compris dans le prix : la peinture, le plâtre pour les réparations et tout le matériel de protection. `,
    description: (kitchen: string, materials: string) =>
      `Nouvelle couleur grise, deux couches, sur les murs du hall d'entrée et de l'escalier (rez-de-chaussée) et du vestibule 200 (étage), avec les petites réparations du bas des murs. ` +
      materials +
      `Plans redessinés par nous à partir des plans fournis, ajustés aux superficies imprimées; hauteurs relevées sur les photos, à confirmer sur place. ` +
      `Option : la cuisine A208, ${kitchen} taxes incluses, en plus.`,
    option: "Option — Cuisine A208 (non comprise dans le total)",
    client: "Garderie",
    property: "Adresse à confirmer",
  },
  en: {
    project: "Daycare — painting of the common areas",
    title: "Daycare — painting, client-supplied paint",
    materials: (supply: GarderieSupply) =>
      supply === "client-paint"
        ? `The paint and the primer are supplied by you (about ${NEED.base.paintGal} gallons of grey and ${NEED.base.primerGal} gallon of primer; ${NEED.kitchen.paintGal} more gallons and ${NEED.kitchen.primerGal} more gallon for the kitchen); the plaster for the repairs and all the protection materials are supplied by us and included in the price. `
        : `All materials are supplied by us and included in the price: the paint, the plaster for the repairs, and all the protection materials. `,
    description: (kitchen: string, materials: string) =>
      `New grey colour, two coats, on the walls of the entrance hall and stairs (ground floor) and Vestibule 200 (2nd floor), with the small repairs at the bottom of the walls. ` +
      materials +
      `Plans redrawn by us from the plans provided, matched to the printed areas; heights read from the photos, to be confirmed on site. ` +
      `Option: the kitchen A208, ${kitchen} taxes included, extra.`,
    option: "Option — Kitchen A208 (not included in the total)",
    client: "Daycare",
    property: "Address to be confirmed",
  },
} as const;

function buildData(locale: Locale, supply: GarderieSupply): ReportData {
  const c = COPY[locale];
  const devis = buildGarderieDevis(locale, supply);
  const kitchen = money(devis.kitchen.totals.totalCents, locale);
  const manifest = loadManifest();

  const rooms: ReportRoom[] = ROOM_SHAPES.map((shape): ReportRoom => {
    const id = roomId(shape.key);
    const figures = roomFigures(shape);
    return {
      id,
      name: shape.name[locale],
      level: shape.level,
      roomType: shape.roomType,
      floorAreaSqm: sqftToSqm(figures.floorSqFt),
      wallLengthM: m(figures.perimeterFt),
      ceilingHeightM: m(shape.ceilingFt),
      stairCount: 0,
      // The kitchen's option prints itemized on its own page (estimate.options).
      notes: null,
      planX: m(shape.atFt.x),
      planY: m(shape.atFt.y),
      objects: planObjects(shape, locale),
      geometry: geometry(shape),
      openWalls: [],
      areas: [],
      readings: [],
      photos: photosFor(manifest, shape.key, locale),
    };
  });

  return {
    layout: "full",
    company: {
      ...DEFAULT_COMPANY,
      legalName: "Renovision AnA inc.",
      city: "Laval",
      phone: "579-999-5979",
      email: "info@renovisionana.ca",
      website: "renovisionana.ca",
      taxRegistered: true,
      gstNumber: "778981019 RT0001",
      qstNumber: "1230209096 IC0001",
    },
    project: {
      name: supply === "client-paint" ? c.title : c.project,
      description: c.description(kitchen, c.materials(supply)),
      started_on: "2026-11-14",
    },
    client: { name: process.env.GARDERIE_CLIENT || c.client },
    property: process.env.GARDERIE_ADDRESS || c.property,
    claimFields: [],
    claim: {},
    levels: [LEVEL_GROUND, LEVEL_UP],
    rooms,
    equipment: [],
    generatedAt: new Date("2026-11-14T12:00:00-05:00").toISOString(),
    locale,
    // Her sheets carry no north arrow.
    northDeg: null,
    wallThicknessM: WALL_THICKNESS_M,
    estimate: {
      lines: devis.base.lines,
      totals: devis.base.totals,
      trailer: GARDERIE_TRAILER,
      options: [{ label: c.option, roomScanId: roomId("kitchen"), lines: devis.kitchen.lines, totals: devis.kitchen.totals }],
    },
    // A private client's quote, not an insurance claim.
    purpose: "quote",
  };
}

async function emit(locale: Locale, htmlPath: string, pdfPath: string, supply: GarderieSupply = "ours"): Promise<void> {
  const data = buildData(locale, supply);
  const body = renderToStaticMarkup(<ReportDocument data={data} />);
  const css = readFileSync("src/app/(internal)/admin/projects/[id]/report/report.css", "utf8");
  const html = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<title>${data.project.name}</title>
<style>${css}</style>
<style>
  /* The cover map comes from our signed-in route (/api/admin/staticmap),
     which a string rendered here cannot reach. Production fills it. */
  .report .cover-map { visibility: hidden; }
</style>
</head>
<body>${body}</body>
</html>`;
  writeFileSync(htmlPath, html);

  // Production's settings exactly (src/lib/report/pdf.ts).
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 120_000 });
    await page.evaluateHandle("document.fonts.ready");
    const options = {
      format: "letter" as const,
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "2cm", right: "2cm", bottom: "2cm", left: "2cm" },
    };
    await numberSheets(page, options);
    const pdf = await page.pdf(options);
    writeFileSync(pdfPath, pdf);
  } finally {
    await browser.close().catch(() => {});
  }
  console.log(`Wrote ${htmlPath} (${html.length} bytes) and ${pdfPath}`);
}

describe("our report — daycare common areas, grey", () => {
  it("renders both floor plans, the rooms, the photos and our priced lines, in French", async () => {
    await emit("fr", "/tmp/garderie-report.html", "/tmp/garderie-report.pdf");
  }, 180_000);
  it("renders both floor plans, the rooms, the photos and our priced lines, in English", async () => {
    await emit("en", "/tmp/garderie-report.en.html", "/tmp/garderie-report.en.pdf");
  }, 180_000);
  it("renders the version with her paint, in French", async () => {
    await emit("fr", "/tmp/garderie-report.labour.html", "/tmp/garderie-report.labour.pdf", "client-paint");
  }, 180_000);
  it("renders the version with her paint, in English", async () => {
    await emit("en", "/tmp/garderie-report.labour.en.html", "/tmp/garderie-report.labour.en.pdf", "client-paint");
  }, 180_000);
});
