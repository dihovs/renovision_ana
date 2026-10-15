import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import puppeteer from "puppeteer-core";
import { renderToStaticMarkup } from "react-dom/server";
import ReportDocument, { type ReportData, type ReportRoom } from "./ReportDocument";
import type { PlanObject } from "./PlanObjects";
import { DEFAULT_COMPANY } from "@/lib/crm/settings";
import type { ScanGeometry } from "@/lib/roomScan";
import {
  BATH_102_OBJECTS,
  ROOM_SHAPES,
  UNITS,
  areasFor,
  feetToMetres as m,
  roomFigures,
  roomId,
  sqftToSqm,
} from "@/lib/estimator/insurance/hymus.job";
import { HYMUS_TRAILER, buildHymusDevis } from "@/lib/estimator/insurance/hymus.devis";

/**
 * Our report for SDC H1 Phase 3 — 122 boul. Hymus, Pointe-Claire, units 302,
 * 202 and 102. The owner, 14 Oct 2026: *"create our estimation … with the
 * floor plan, with the separate rooms"* — the document our app prints, built
 * from the other firm's measurements and priced with ours.
 *
 * Same method as tansley-report.render.test.tsx, which he has seen and
 * shaped: build `ReportData` by hand, render the real `ReportDocument`, print
 * it through a local headless Chrome with production's PDF settings.
 *
 * - **Rooms**: the inner wall faces read off their sketch's vectors
 *   (hymus.job.ts), each unit's three rooms placed where the sketch puts
 *   them, so each storey plan is a real drawing of the unit and not three
 *   boxes in a row.
 * - **Sectioned by unit**, 302 → 202 → 102 (the water's own path, and their
 *   devis' order): each unit's plan, room pages, photographs and priced lines,
 *   then the project lines and the sommaire.
 * - **Photographs**: theirs, filed by the room their captions name
 *   (scripts/extract-hymus-photos.py, which also says which three were left
 *   out and why).
 * - **Lines**: buildHymusDevis — the same call the printed sample makes.
 *
 * Asserts nothing; writes the files. Not part of `npm test`. Run:
 *   python3 scripts/extract-hymus-photos.py "<their devis avec photos>.pdf"
 *   npx vitest run --config vitest.render.mts hymus-report
 *
 * → /tmp/hymus-report.html, /tmp/hymus-report.pdf
 */

// HYMUS_PHOTO_DIR points the render at a downscaled copy for a light PDF.
const PHOTO_DIR = process.env.HYMUS_PHOTO_DIR || "/tmp/hymus-photos";

type Manifest = Record<string, Array<{ file: string; page: number; note: string | null }>>;

function loadManifest(): Manifest {
  const path = `${PHOTO_DIR}/manifest.json`;
  // Loud, not silent: a missing folder would print a report whose room pages
  // promise photographs that are not behind them.
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. Run: python3 scripts/extract-hymus-photos.py "<their devis avec photos>.pdf"`);
  }
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
    doorCount: shape.openingsFt.length,
    windowCount: 0,
    openingCount: 0,
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

/** The bathroom's fixtures on the plan. The vanity draws as the catalogue's
    vanity-with-basin; the wall cabinets hang over the toilet and are left off
    the floor plan, where they would sit on top of it. */
function bathObjects(): PlanObject[] {
  return BATH_102_OBJECTS.filter((o) => o.kind !== "wall_cabinet").map((o, i) => ({
    id: `bath-obj-${i}`,
    kind: o.kind === "vanity_cabinet" ? "vanity_24" : o.kind,
    name: o.name,
    x: m(o.atFt.x),
    y: m(o.atFt.y),
    rotation: o.rotation,
    widthM: m(o.widthFt),
    depthM: m(o.depthFt),
  }));
}

function buildData(): ReportData {
  const manifest = loadManifest();
  const devis = buildHymusDevis();

  const rooms: ReportRoom[] = UNITS.flatMap((unit) =>
    ROOM_SHAPES.map((shape): ReportRoom => {
      const id = roomId(unit.apartment, shape.key);
      const ceilingFt = unit.ceilingFt[shape.key];
      const figures = roomFigures(shape, ceilingFt);
      const photoKey = `${unit.apartment}-${shape.key}`;
      return {
        id,
        name: shape.name,
        level: unit.level,
        apartment: unit.apartment,
        roomType: shape.roomType,
        floorAreaSqm: sqftToSqm(figures.floorSqFt),
        wallLengthM: m(figures.perimeterFt),
        ceilingHeightM: m(ceilingFt),
        stairCount: 0,
        notes: null,
        planX: m(shape.atFt.x),
        planY: m(shape.atFt.y),
        objects: id === roomId("102", "bath") ? bathObjects() : [],
        geometry: geometry(shape),
        areas: areasFor(id),
        readings: [],
        photos: photosFor(manifest, photoKey),
      };
    }),
  );

  return {
    layout: "full",
    company: {
      ...DEFAULT_COMPANY,
      legalName: "Renovision AnA inc.",
      city: "Laval",
      phone: "579-999-5979",
      email: "info@renovisionana.ca",
      website: "renovisionana.ca",
      // Every client document carries both — a syndicate's accountant needs
      // them for its input tax credits.
      taxRegistered: true,
      gstNumber: "778981019 RT0001",
      qstNumber: "1230209096 IC0001",
    },
    project: {
      name: "SDC H1 Phase 3 — unités 302, 202 et 102",
      description:
        "Réparations à la suite d'un dégât d'eau qui a traversé trois unités superposées. Mesures relevées sur le croquis et le devis remis par le client; ouvertures faites pendant l'urgence par une autre firme.",
      started_on: "2026-10-14",
    },
    client: { name: "SDC H1 Phase 3" },
    property: "122 boul. Hymus, Pointe-Claire, Québec",
    claimFields: [],
    claim: {},
    levels: ["1st Floor", "2nd Floor", "3rd Floor"],
    rooms,
    equipment: [],
    generatedAt: new Date("2026-10-14T12:00:00-04:00").toISOString(),
    locale: "fr",
    estimate: { lines: devis.lines, totals: devis.totals, trailer: HYMUS_TRAILER },
  };
}

async function emit(htmlPath: string, pdfPath: string): Promise<void> {
  const body = renderToStaticMarkup(<ReportDocument data={buildData()} />);
  const css = readFileSync("src/app/(internal)/admin/projects/[id]/report/report.css", "utf8");
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>SDC H1 Phase 3 — 122 boul. Hymus</title>
<style>${css}</style>
<style>
  /* The cover map is served by our own signed-in route
     (/api/admin/staticmap), which a string rendered here has no origin for;
     left in, it prints as a broken-image box on the first page a client
     sees. Production fills it; this proof leaves the space empty. */
  .report .cover-map { visibility: hidden; }
</style>
</head>
<body>${body}</body>
</html>`;
  writeFileSync(htmlPath, html);

  // Production's settings exactly (src/lib/report/pdf.ts) — a different
  // margin would paginate a document that does not exist.
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 120_000 });
    await page.evaluateHandle("document.fonts.ready");
    const pdf = await page.pdf({
      format: "letter",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "2cm", right: "2cm", bottom: "2cm", left: "2cm" },
    });
    writeFileSync(pdfPath, pdf);
  } finally {
    await browser.close().catch(() => {});
  }
  console.log(`Wrote ${htmlPath} (${html.length} bytes) and ${pdfPath}`);
}

describe("our report — SDC H1 Phase 3, 122 boul. Hymus", () => {
  it("renders the floor plans, the rooms, the photographs and our priced lines", async () => {
    await emit("/tmp/hymus-report.html", "/tmp/hymus-report.pdf");
  }, 180_000);
});
