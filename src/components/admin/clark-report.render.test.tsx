import { readFileSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import puppeteer from "puppeteer-core";
import { numberSheets } from "@/lib/report/sheets";
import { renderToStaticMarkup } from "react-dom/server";
import ReportDocument, { type ReportData, type ReportRoom } from "./ReportDocument";
import type { PlanObject } from "./PlanObjects";
import { DEFAULT_COMPANY } from "@/lib/crm/settings";
import type { ScanGeometry } from "@/lib/roomScan";
import {
  BATH_OBJECTS,
  ROOM_SHAPES,
  UNIT,
  WALL_THICKNESS_M,
  areasFor,
  feetToMetres as m,
  roomFigures,
  roomId,
  sqftToSqm,
} from "@/lib/estimator/insurance/clark.job";
import { CLARK_TRAILER, buildClarkDevis } from "@/lib/estimator/insurance/clark.devis";

/**
 * Our report for SDC du 7027 Clark, unit 5 — the other firm's measurements
 * (Lauresco, 3674_7027C_R), our drawing and our prices. Same method as
 * hymus-report.render.test.tsx: build `ReportData` by hand, render the real
 * `ReportDocument`, print it through a local headless Chrome with
 * production's PDF settings.
 *
 * - **Rooms**: the bathroom and the hall outside it, traced off their
 *   sketch's vectors (clark.job.ts); the hall's three open sides are drawn as
 *   open, not as walls.
 * - **No photographs**: their devis has none.
 * - **Lines**: buildClarkDevis — the same call the printed sample makes.
 *
 * Asserts nothing; writes the files. Not part of `npm test`. Run:
 *   npx vitest run --config vitest.render.mts clark-report
 *
 * → /tmp/clark-report.html, /tmp/clark-report.pdf
 */

function geometry(shape: (typeof ROOM_SHAPES)[number]): ScanGeometry {
  return {
    walls: [],
    floors: [],
    doors: [],
    windows: [],
    doorCount: shape.openingsFt.filter((o) => o.kind === "door").length,
    windowCount: 0,
    openingCount: shape.openingsFt.filter((o) => o.kind === "opening").length,
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

function bathObjects(): PlanObject[] {
  return BATH_OBJECTS.map((o, i) => ({
    id: `bath-obj-${i}`,
    kind: o.kind,
    name: o.name,
    x: m(o.atFt.x),
    y: m(o.atFt.y),
    rotation: o.rotation,
    widthM: m(o.widthFt),
    depthM: m(o.depthFt),
  }));
}

function buildData(): ReportData {
  const devis = buildClarkDevis();

  const rooms: ReportRoom[] = ROOM_SHAPES.map((shape): ReportRoom => {
    const id = roomId(shape.key);
    const figures = roomFigures(shape);
    return {
      id,
      name: shape.name,
      level: UNIT,
      roomType: shape.roomType,
      floorAreaSqm: sqftToSqm(figures.floorSqFt),
      wallLengthM: m(figures.perimeterFt),
      ceilingHeightM: m(shape.ceilingFt),
      stairCount: 0,
      notes: null,
      planX: m(shape.atFt.x),
      planY: m(shape.atFt.y),
      objects: shape.key === "bath" ? bathObjects() : [],
      geometry: geometry(shape),
      openWalls: shape.openEdges,
      areas: areasFor(id),
      readings: [],
      photos: [],
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
      name: "SDC du 7027 Clark — unité 5",
      description:
        "Réparations à la suite d'une fuite au drain du bain de l'unité 7, descendue par le plafond de la salle de bains de l'unité 5 et le bas d'un mur du corridor. Mesures relevées sur le croquis et le devis remis par le client; ouvertures faites pendant l'urgence par une autre firme.",
      started_on: "2026-10-19",
    },
    client: { name: "SDC du 7027 Clark" },
    property: "7027 rue Clark, Montréal (Québec)",
    claimFields: [],
    claim: {},
    levels: [UNIT],
    rooms,
    equipment: [],
    generatedAt: new Date("2026-10-19T12:00:00-04:00").toISOString(),
    locale: "fr",
    // Their sketch's arrow points up the page.
    northDeg: 0,
    // Their sketch draws every wall 4" (12,1 pt at 36,19 pt/ft).
    wallThicknessM: WALL_THICKNESS_M,
    estimate: { lines: devis.lines, totals: devis.totals, trailer: CLARK_TRAILER },
  };
}

async function emit(htmlPath: string, pdfPath: string): Promise<void> {
  const body = renderToStaticMarkup(<ReportDocument data={buildData()} />);
  const css = readFileSync("src/app/(internal)/admin/projects/[id]/report/report.css", "utf8");
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>SDC du 7027 Clark — unité 5</title>
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

describe("our report — SDC du 7027 Clark, unité 5", () => {
  it("renders the floor plan, the rooms and our priced lines", async () => {
    await emit("/tmp/clark-report.html", "/tmp/clark-report.pdf");
  }, 180_000);
});
