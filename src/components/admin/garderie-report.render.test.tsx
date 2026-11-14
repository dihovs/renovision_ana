import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import puppeteer from "puppeteer-core";
import { numberSheets } from "@/lib/report/sheets";
import { renderToStaticMarkup } from "react-dom/server";
import ReportDocument, { type ReportData, type ReportRoom } from "./ReportDocument";
import { DEFAULT_COMPANY } from "@/lib/crm/settings";
import type { ScanGeometry } from "@/lib/roomScan";
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
import { GARDERIE_TRAILER, buildGarderieDevis } from "@/lib/estimator/insurance/garderie.devis";

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
 * - **Lines**: the work she asked for. The kitchen is an option, priced on
 *   its own in the devis, so it is not in this document's total; its price
 *   is quoted in the project description.
 * - **Client and address** come from GARDERIE_CLIENT / GARDERIE_ADDRESS.
 *
 * Asserts nothing; writes the files. Not part of `npm test`. Run:
 *   GARDERIE_PHOTO_DIR=… npx vitest run --config vitest.render.mts garderie-report
 *
 * → /tmp/garderie-report.html, /tmp/garderie-report.pdf
 */

const PHOTO_DIR = process.env.GARDERIE_PHOTO_DIR || "/tmp/garderie-photos";
type Manifest = Record<string, Array<{ file: string; note: string | null }>>;

function loadManifest(): Manifest {
  const path = `${PHOTO_DIR}/manifest.json`;
  if (!existsSync(path)) throw new Error(`Missing ${path} (her site photos, kept out of the repo).`);
  return JSON.parse(readFileSync(path, "utf8")) as Manifest;
}

function photosFor(manifest: Manifest, key: string): ReportRoom["photos"] {
  return (manifest[key] ?? []).map((photo) => ({
    id: photo.file,
    url: `data:image/jpeg;base64,${readFileSync(`${PHOTO_DIR}/${photo.file}`).toString("base64")}`,
    note: photo.note,
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

const money = (cents: number) =>
  (cents / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";

function buildData(): ReportData {
  const devis = buildGarderieDevis();
  const manifest = loadManifest();

  const rooms: ReportRoom[] = ROOM_SHAPES.map((shape): ReportRoom => {
    const id = roomId(shape.key);
    const figures = roomFigures(shape);
    return {
      id,
      name: shape.name,
      level: shape.level,
      roomType: shape.roomType,
      floorAreaSqm: sqftToSqm(figures.floorSqFt),
      wallLengthM: m(figures.perimeterFt),
      ceilingHeightM: m(shape.ceilingFt),
      stairCount: 0,
      notes: shape.option
        ? `Option : peinture de la cuisine, ${money(devis.kitchen.totals.totalCents)} taxes incluses, en plus du total de ce document.`
        : null,
      planX: m(shape.atFt.x),
      planY: m(shape.atFt.y),
      objects: planObjects(shape),
      geometry: geometry(shape),
      openWalls: [],
      areas: [],
      readings: [],
      photos: photosFor(manifest, shape.key),
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
      name: "Garderie — peinture des aires communes",
      description:
        `Nouvelle couleur grise, deux couches, sur les murs du hall d'entrée et de l'escalier (rez-de-chaussée) et du vestibule 200 (étage), avec les petites réparations du bas des murs. ` +
        `Plans redessinés par nous à partir des plans fournis, ajustés aux superficies imprimées; hauteurs relevées sur les photos, à confirmer sur place. ` +
        `Option : la cuisine A208, ${money(devis.kitchen.totals.totalCents)} taxes incluses, en plus.`,
      started_on: "2026-11-14",
    },
    client: { name: process.env.GARDERIE_CLIENT || "Garderie" },
    property: process.env.GARDERIE_ADDRESS || "Adresse à confirmer",
    claimFields: [],
    claim: {},
    levels: [LEVEL_GROUND, LEVEL_UP],
    rooms,
    equipment: [],
    generatedAt: new Date("2026-11-14T12:00:00-05:00").toISOString(),
    locale: "fr",
    // Her sheets carry no north arrow.
    northDeg: null,
    wallThicknessM: WALL_THICKNESS_M,
    estimate: { lines: devis.base.lines, totals: devis.base.totals, trailer: GARDERIE_TRAILER },
  };
}

async function emit(htmlPath: string, pdfPath: string): Promise<void> {
  const body = renderToStaticMarkup(<ReportDocument data={buildData()} />);
  const css = readFileSync("src/app/(internal)/admin/projects/[id]/report/report.css", "utf8");
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Garderie — peinture des aires communes</title>
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
  it("renders both floor plans, the rooms, the photos and our priced lines", async () => {
    await emit("/tmp/garderie-report.html", "/tmp/garderie-report.pdf");
  }, 180_000);
});
