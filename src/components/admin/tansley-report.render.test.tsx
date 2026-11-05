import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { describe, it } from "vitest";
import puppeteer from "puppeteer-core";
import { renderToStaticMarkup } from "react-dom/server";
import ReportDocument, { type ReportData, type ReportRoom } from "./ReportDocument";
import { DEFAULT_COMPANY } from "@/lib/crm/settings";
import { RESTAURATION_CT_TRAILER, type AllocatedLine, type EstimateTotals } from "@/lib/estimator/insurance/types";
import type { AffectedArea } from "@/lib/crm/areaShapes";
import type { ScanGeometry } from "@/lib/roomScan";

/**
 * Standalone re-render of the 1951 Rue Tansley report — no Supabase, no
 * server, no real credentials. Same approach as the first pass: build the
 * `ReportData` this report needs by hand from the same source figures
 * (`My New Project Report 9.pdf`, `/tmp/tansley-devis.json`), render
 * `ReportDocument` to static markup, wrap it in the report's own stylesheet,
 * and hand the HTML to a local headless Chrome for the PDF — the same
 * browser-prints-the-page approach `src/lib/report/pdf.ts` uses in
 * production, just pointed at a string instead of a signed-in URL.
 *
 * Two things changed from the first render:
 *
 * 1. **Floor plans are traced, not solved.** The first pass built each
 *    room's `geometry` as a plain rectangle sized from the printed area and
 *    perimeter — arithmetic, not a shape. This one sets `editedPolygon` to
 *    an outline read directly off the source sketch's floor-plan pages
 *    (magicplan pages 4/5, 8, 11/12, 17, 20 — the dogleg kitchen with its
 *    stairwell nook and the small angled closet at the foot of it), plus
 *    `editedOpenings` (a new, small addition to `roomScan.ts` — see its
 *    comment) for the door swings visible on the same pages. Read off a
 *    printed drawing at this resolution, not a survey: the traced polygon's
 *    shoelace area comes out ~421.6 sq ft against the printed 437.22 for the
 *    kitchen, ~16.8 against 17.75 for the small "Other" room — both within
 *    the error a hand trace at this scale should carry, and both far closer
 *    to the real footprint than a rectangle, which by construction gets the
 *    outline wrong everywhere except its own four corners.
 *
 * 2. **The priced devis prints as a real page**, via the new
 *    `ReportEstimateTable` component (Templates H/I), fed the exact
 *    allocated lines and totals from `/tmp/tansley-devis.json` — the same
 *    $22,370.07 figure, unchanged, just laid out on the page instead of
 *    living only in a JSON file and a console dump.
 *
 * Two more changed on the third pass:
 *
 * 3. **The site photographs are in it.** The source PDF carries them —
 *    magicplan pages 7, 13/14, 16 and 22, one photo section per room — and
 *    the first two passes rendered every room with `photos: []`, so the
 *    document had a photo POINTER on each room page ("see photos page") and
 *    no photos page behind it. `scripts/extract-tansley-photos.py` pulls them
 *    out of the source PDF into `/tmp/tansley-photos`, and they are inlined
 *    here as data URIs so the HTML file is one self-contained document.
 *
 * 4. **A second, drawingless variant.** His ask, 7 Sep: *"lets try without
 *    the floorplan, only photos and line items."* That is `layout: "noPlans"`
 *    on the real component (see `ReportData`), not a switch in this script —
 *    a render script that quietly draws a different document from the app is
 *    a render script nobody can trust twice.
 *
 * And one on the fourth pass:
 *
 * 5. **The document is sectioned apartment by apartment.** His instruction,
 *    8 Sep: *"I wanted you to keep the previous structure with the photos
 *    and everything. Just section them apartment by apartment."* Nothing is
 *    removed and nothing is rewritten — every page the document had it still
 *    has. Each room now carries the unit it is in (`ReportRoom.apartment`),
 *    and `ReportDocument` deals the pages into 103, then 102, then 101, each
 *    unit's storey plan and rooms and photographs followed by that unit's own
 *    priced lines and its sous-total; the project-level lines and the grand
 *    sommaire come last. That is a capability of the report, not of this
 *    script — the third variant below renders the same job with no
 *    apartments set, which is the unsectioned document every other job gets.
 *
 * Asserts nothing; writes the files. It is not part of `npm test` — see
 * `vitest.render.mts` for why. Run:
 *   npx vitest run --config vitest.render.mts
 *
 * Writes, per variant, an `.html` and a `.pdf`:
 *   full      → /tmp/tansley-report.html, /tmp/tansley-report-full.pdf
 *   noPlans   → /tmp/tansley-report-photos-lines.{html,pdf}
 *   ungrouped → /tmp/tansley-report-ungrouped.{html,pdf} — the regression
 *               guard: the same job with no apartments, i.e. the document
 *               every single-unit job still renders.
 *
 * `/tmp/tansley-report.pdf` — the second pass's full render, before the
 * photographs went in — is deliberately NOT written, so the two can be held
 * side by side.
 */

const FT = 3.280839895;
const ft = (v: number) => v / FT;

// ---------------------------------------------------------------------
// The kitchen's traced outline — identical on floors 1, 2 and 3 per the
// source report (same 437.22 sq ft / 114'8" perimeter kitchen printed three
// times). Vertices read clockwise from the top-left corner off the zoomed
// floor-plan page, in feet, then converted to metres for `editedPolygon`.
// See the file-level note above for what this approximation is and isn't.
const KITCHEN_POLYGON_FT: [number, number][] = [
  [0.0, 0.0],
  [14.83, 0.0],
  [14.83, 26.5],
  [6.25, 26.5],
  [6.25, 32.4],
  [3.6, 34.4],
  [1.9, 32.5],
  [1.9, 24.9],
  [0.15, 24.6],
  [0.15, 18.3],
  [-1.4, 15.3],
  [0.0, 13.92],
];
const KITCHEN_POLYGON_M = KITCHEN_POLYGON_FT.map(([x, y]) => ({ x: ft(x), y: ft(y) }));

// Door swings read off the same pages: the top-left entrance, the small
// stairwell/closet door partway down the nook, and the closet door at its
// foot — the same three doors `tansley.sample.test.ts` counts off the
// sketch for the opening deduction. Positions are approximate — traced from
// where the arcs sit on the drawing, not measured.
// Only the entrance door lies on this room's own OUTER boundary — the swing
// visible at the top of the sketch, on the polygon's top edge. The sketch
// also shows two more door arcs lower down (the stairwell/closet doors), but
// those open onto interior partitions inside the nook that this outline
// (traced as one room, per the source report) does not itself resolve as
// separate wall segments — placing a door where there is no traced wall
// under it would draw an opening floating in the middle of the room, which
// is worse than the honest omission. Kept to what the traced outline can
// actually support.
const KITCHEN_DOORS_FT: [number, number, number, number][] = [
  [1.35, 0, 2.6, 0],
];
const KITCHEN_DOORS_M = KITCHEN_DOORS_FT.map(([x1, y1, x2, y2]) => ({
  x1: ft(x1),
  y1: ft(y1),
  x2: ft(x2),
  y2: ft(y2),
  kind: "door" as const,
}));

// The "Other" room (apt-102 corridor/entrance closet, 2nd floor only,
// 17.75 sq ft) — a small irregular pentagon per its own outline on page 8,
// not the rectangle the first pass used.
const OTHER_POLYGON_FT: [number, number][] = [
  [0, 0],
  [3.75, 0],
  [3.75, 3.5],
  [2.2, 4.75],
  [0, 4.75],
];
const OTHER_POLYGON_M = OTHER_POLYGON_FT.map(([x, y]) => ({ x: ft(x), y: ft(y) }));
const OTHER_DOORS_M = [
  { x1: ft(0.1), y1: ft(4.75), x2: ft(0.6), y2: ft(4.75), kind: "door" as const },
];

// ---------------------------------------------------------------------
// AffectedArea polygons — the actual fix.
//
// The first pass of this render gave every AffectedArea the same hardcoded
// 1×1 metre placeholder square, unrelated to its real area_sqm or its real
// position, and — for the floor/ceiling items that draw on the overhead
// plan — in the wrong coordinate frame besides: `toFloorPlan` shifts
// `editedPolygon` by its own bounding box's minX/minY (here, -1.4ft/0ft — the
// traced outline's own local origin is NOT its bounding box's top-left,
// because of the dogleg), so a polygon authored at raw (0,0) does not line
// up with the room's own drawn outline. That mismatch is what put the
// ceiling badge outside the room's own walls in the first render.
//
// The room's own file-level note (tansley.sample.test.ts) already narrows
// down WHERE every item in a kitchen sits: "every AFFECTED WALL AREA pin...
// sits in the SAME small dogleg corner of the room — the stairwell/closet
// nook". That nook is exactly `KITCHEN_POLYGON_FT`'s vertices 3..11 (the
// zig-zag tail below the main rectangle), and its own shoelace area comes out
// ~67.96 sq ft — within a hand-trace's error of item #10's own printed
// 71.27 sq ft (the hardwood-floor item, whose blue highlight in the source
// sketch — page 20 — draws exactly this nook, not the whole kitchen). That
// is real evidence, not a guess, for where the plan-space items belong.

/** The traced kitchen outline's own shift — the same minX/minY `toFloorPlan`
    subtracts from `editedPolygon` before drawing it. Anything meant to line
    up with the room's OWN drawn outline has to be shifted the same way. */
const KITCHEN_OFFSET_X_FT = Math.min(...KITCHEN_POLYGON_FT.map(([x]) => x));
const KITCHEN_OFFSET_Y_FT = Math.min(...KITCHEN_POLYGON_FT.map(([, y]) => y));
function kitchenPlanPoint(x: number, y: number): { x: number; y: number } {
  return { x: ft(x - KITCHEN_OFFSET_X_FT), y: ft(y - KITCHEN_OFFSET_Y_FT) };
}

/** The dogleg nook alone, in the SAME shifted plan metres `toFloorPlan`
    draws the room's own outline in — see the note above for why this,
    rather than the whole room, is the right shape for a kitchen's
    floor/ceiling AffectedAreas (the only ones this report draws on the
    overhead plan; wall areas draw on `WallElevation` instead). */
const KITCHEN_NOOK_M = KITCHEN_POLYGON_FT.slice(3).map(([x, y]) => kitchenPlanPoint(x, y));

// The one wall every kitchen wall-surface item is pinned to (wall_index 0),
// and its own ceiling height — both already established, from the printed
// figures, in tansley.sample.test.ts.
const WALL_LEN_KITCHEN_M = ft(8 + 7 / 12);
const CEILING_HEIGHT_KITCHEN_M = ft(8 + 1 / 12);
const WALL_LEN_OTHER_M = ft(4 + 9 / 12);
const CEILING_HEIGHT_OTHER_M = ft(8);

/**
 * A wall-face rectangle sized to the item's OWN area_sqm, fitted to the wall
 * it is pinned to — not a fixed 1×1 square repeated on every item regardless
 * of size.
 *
 * Two regimes: by default a full-height column, as wide as its area needs
 * (capped at the wall's own length). `lowerBand` switches to a full-width
 * band, as tall as its area needs, for the items whose OWN note says the
 * damage is confined to the wall's lower portion ("approximately the height
 * of the baseboard") — items #7, #8 and #12 below, all quoting that phrase
 * or "baseboard needs to be installed".
 *
 * Where along the wall each item sits (`x0`) is NOT read off the sketch —
 * the file-level note in tansley.sample.test.ts already says the pins are
 * too close together at this PDF's scale to resolve that — so this only
 * spreads items left-to-right in item order, which is a real improvement
 * over the placeholder (every item stacked on the exact same spot) without
 * pretending to a precision the source doesn't support.
 */
function wallPatch(
  areaSqm: number,
  wallLenM: number,
  ceilingHeightM: number,
  opts: { lowerBand?: boolean; x0?: number } = {},
): { x: number; y: number }[] {
  const x0 = opts.x0 ?? 0.1;
  const room = Math.max(0.1, wallLenM - x0);
  let width: number;
  let height: number;
  if (opts.lowerBand) {
    const bandHeight = 0.3;
    width = Math.min(room, areaSqm / bandHeight);
    height = areaSqm / width;
  } else {
    height = ceilingHeightM;
    width = areaSqm / height;
    if (width > room) {
      width = room;
      height = areaSqm / width;
    }
  }
  // Wound anticlockwise from the bottom-left, per `AffectedArea`'s own
  // convention — y is 0 at the floor and grows UP toward the ceiling.
  return [
    { x: x0, y: 0 },
    { x: x0 + width, y: 0 },
    { x: x0 + width, y: height },
    { x: x0, y: height },
  ];
}

function kitchenGeometry(): ScanGeometry {
  return {
    walls: [],
    floors: [{ areaSquareMeters: ft(437.22) * ft(1) }], // unused once editedPolygon is set
    doors: [],
    windows: [],
    doorCount: 3,
    windowCount: 0,
    openingCount: 0,
    stairCount: 1,
    editedPolygon: KITCHEN_POLYGON_M,
    editedOpenings: KITCHEN_DOORS_M,
  };
}

function otherGeometry(): ScanGeometry {
  return {
    walls: [],
    floors: [{ areaSquareMeters: ft(17.75) }],
    doors: [],
    windows: [],
    doorCount: 1,
    windowCount: 0,
    openingCount: 0,
    stairCount: 0,
    editedPolygon: OTHER_POLYGON_M,
    editedOpenings: OTHER_DOORS_M,
  };
}

// `polygon` is REQUIRED (not defaulted) on purpose: a default here is
// exactly how every item ended up with the same placeholder square last
// time. Every call site below now derives its own — `KITCHEN_NOOK_M` for a
// floor/ceiling item, `wallPatch(...)` for a wall item.
function area(id: string, roomScanId: string, opts: Partial<AffectedArea> & Pick<AffectedArea, "name" | "surface" | "area_sqm" | "notes" | "damage_type" | "polygon">): AffectedArea {
  return {
    id,
    created_at: "",
    room_scan_id: roomScanId,
    wall_index: opts.surface === "wall" ? 0 : null,
    color: null,
    show_dimensions: false,
    ...opts,
  };
}

/**
 * The site photographs, extracted from the source PDF.
 *
 * **Read off the source's own photo sections, not guessed.** magicplan puts
 * each room's photographs on their own page under a `▼Photos/<room>` marker
 * — page 7 for the 1st-floor kitchen, 13 and 14 for the 2nd, 16 for the
 * corridor, 22 for the 3rd — so which room a photograph belongs to is
 * printed in the source rather than inferred from its content.
 *
 * Byte-identical repeats are dropped: the source reuses one photograph
 * across two captions in two places (the 2nd-floor kitchen and the 3rd), and
 * printing the same picture twice on one page reads as a mistake.
 *
 * The two photo sections the source has that this report has no place for
 * are left out rather than reassigned: `▼Photos/My New Project` (6) and the
 * two `▼Photos/<storey>` sections (2 and 5). Those hang off the project and
 * off a storey, and `ReportRoom` only carries photographs on a ROOM. Filing
 * them under a room we picked would be inventing provenance.
 *
 * Produced by `scripts/extract-tansley-photos.py`, which carries the whole
 * argument for which photograph belongs where.
 */
const PHOTO_DIR = "/tmp/tansley-photos";
const ROOM_PHOTOS: Record<string, string[]> = {
  "tansley-1f-kitchen": ["1f-kitchen-1", "1f-kitchen-2", "1f-kitchen-3", "1f-kitchen-4", "1f-kitchen-5"],
  "tansley-2f-kitchen": ["2f-kitchen-1", "2f-kitchen-2", "2f-kitchen-3", "2f-kitchen-4", "2f-kitchen-5"],
  "tansley-2f-other": ["2f-other-1", "2f-other-2", "2f-other-3"],
  "tansley-3f-kitchen": ["3f-kitchen-1", "3f-kitchen-2", "3f-kitchen-3", "3f-kitchen-4", "3f-kitchen-5"],
};

/**
 * One room's photographs as data URIs.
 *
 * Inlined rather than linked because these files are rendered from a string
 * with no base URL — a relative `src` would resolve against nothing and the
 * photo pages would print as a grid of "unavailable" boxes, which is exactly
 * the failure this variant cannot afford. Costs about 250 KB of base64 across
 * the whole document.
 *
 * **No `note`.** The source captions several of these against an affected-area
 * item number ("10 Affected Area Photo 1"), and a few of those captions are
 * unambiguous — but on the pages where three photographs share one merged
 * caption block, which photograph documents which item cannot be recovered
 * from the PDF's text layer. Cross-referencing some photographs to items and
 * not others would make the ones without a note look unassigned. On a
 * document chosen specifically to carry only what is not in doubt, a caption
 * we are 80% sure of is the wrong thing to print.
 */
function photosFor(roomId: string): ReportRoom["photos"] {
  return (ROOM_PHOTOS[roomId] ?? []).map((stem) => {
    const path = `${PHOTO_DIR}/${stem}.jpg`;
    // **Loud, not silent.** `/tmp` does not survive a reboot, and a missing
    // photo file would otherwise render a document that says "5 photos, see
    // the photos page" with no photos page behind it — the exact defect the
    // first two passes shipped, and one nobody notices in a 22-page proof.
    if (!existsSync(path)) {
      throw new Error(
        `Missing ${path}. Run: python3 scripts/extract-tansley-photos.py`,
      );
    }
    const base64 = readFileSync(path).toString("base64");
    return {
      id: stem,
      url: `data:image/jpeg;base64,${base64}`,
      note: null,
      contentType: "image/jpeg",
    };
  });
}

function buildData(
  layout: NonNullable<ReportData["layout"]>,
  /**
   * **The regression guard, rendered rather than argued.**
   *
   * Apartment sectioning defaults to OFF, and every other job this company
   * runs — a house, a single condo — leaves it off. `false` here strips the
   * `apartment` off every room and restores the caller order the document
   * had before sectioning existed, so the third variant below is the
   * pre-change document: no bands, no sous-totaux, one devis block with the
   * grand sommaire, storeys ascending. If that ever stops matching, the
   * feature has broken the ordinary job to serve the triplex.
   */
  grouped = true,
): ReportData {
    const devis = JSON.parse(readFileSync("/tmp/tansley-devis.json", "utf8")) as {
      lines: AllocatedLine[];
      totals: EstimateTotals;
    };

    const k1_1_sqm = ft(20.7) * ft(1);
    const k1_2_sqm = ft(56.26) * ft(1);
    const k1_3_sqm = ft(59.22) * ft(1);
    const kitchen1Areas: AffectedArea[] = [
      area("k1-1", "tansley-1f-kitchen", {
        name: "Eau",
        surface: "wall",
        damage_type: "water",
        area_sqm: k1_1_sqm,
        notes:
          "Isolant remplacé, placoplâtre posé et plâtre tiré jusqu'à une finition de niveau 3 prête pour la peinture.",
        // A specific water spot on the same nook wall #3 covers broadly —
        // full-height column, positioned near the start of the wall.
        polygon: wallPatch(k1_1_sqm, WALL_LEN_KITCHEN_M, CEILING_HEIGHT_KITCHEN_M, { x0: 0.15 }),
      }),
      area("k1-2", "tansley-1f-kitchen", {
        name: "À peindre",
        surface: "ceiling",
        damage_type: "other",
        area_sqm: k1_2_sqm,
        notes: "Peinture agencée sur la totalité du plafond.",
        // The ceiling over the dogleg nook — see the file-level note above
        // on why the nook, not the whole kitchen, is the right shape.
        polygon: KITCHEN_NOOK_M,
      }),
      area("k1-3", "tansley-1f-kitchen", {
        name: "À peindre",
        surface: "wall",
        damage_type: "other",
        area_sqm: k1_3_sqm,
        notes: null,
        // "AFFECTED WALL AREA... needs to be painted" at 5.5 m² is nearly
        // the whole 2.6 m wall at full height — a repaint, not a patch.
        polygon: wallPatch(k1_3_sqm, WALL_LEN_KITCHEN_M, CEILING_HEIGHT_KITCHEN_M, { x0: 0.1 }),
      }),
    ];

    const k2_4_sqm = ft(29.49) * ft(1);
    const k2_5_sqm = ft(55.97) * ft(1);
    const k2_6_sqm = ft(36.53) * ft(1);
    const k2_7_sqm = ft(19.35) * ft(1);
    const k2_8_sqm = ft(4.59) * ft(1);
    const kitchen2Areas: AffectedArea[] = [
      area("k2-4", "tansley-2f-kitchen", {
        name: "Dégât d'eau",
        surface: "wall",
        damage_type: "water",
        area_sqm: k2_4_sqm,
        notes: "Nouvel isolant, placoplâtre, plâtre tiré au niveau, peinture.",
        polygon: wallPatch(k2_4_sqm, WALL_LEN_KITCHEN_M, CEILING_HEIGHT_KITCHEN_M, { x0: 0.1 }),
      }),
      area("k2-5", "tansley-2f-kitchen", {
        name: "Peinture du plafond",
        surface: "ceiling",
        damage_type: "other",
        area_sqm: k2_5_sqm,
        notes: "Pour s'agencer au reste du salon.",
        polygon: KITCHEN_NOOK_M,
      }),
      area("k2-6", "tansley-2f-kitchen", {
        name: "Placoplâtre endommagé au pourtour de la porte",
        surface: "wall",
        damage_type: "other",
        area_sqm: k2_6_sqm,
        notes: "Deux épaisseurs de placoplâtre au pourtour de la porte.",
        polygon: wallPatch(k2_6_sqm, WALL_LEN_KITCHEN_M, CEILING_HEIGHT_KITCHEN_M, { x0: 0.6 }),
      }),
      area("k2-7", "tansley-2f-kitchen", {
        name: "Dégât d'eau",
        surface: "wall",
        damage_type: "water",
        area_sqm: k2_7_sqm,
        notes: "Bas du mur + plinthe.",
        // Own note: "the lower part of the wall approximately the height
        // of the baseboard" — a low band, not a full-height column.
        polygon: wallPatch(k2_7_sqm, WALL_LEN_KITCHEN_M, CEILING_HEIGHT_KITCHEN_M, { lowerBand: true, x0: 0 }),
      }),
      area("k2-8", "tansley-2f-kitchen", {
        name: "Dégât d'eau",
        surface: "wall",
        damage_type: "water",
        area_sqm: k2_8_sqm,
        notes: "Réparation du placoplâtre + plinthe.",
        polygon: wallPatch(k2_8_sqm, WALL_LEN_KITCHEN_M, CEILING_HEIGHT_KITCHEN_M, { lowerBand: true, x0: 0.1 }),
      }),
    ];

    const o_9_sqm = ft(37.86) * ft(1);
    const otherAreas: AffectedArea[] = [
      area("o-9", "tansley-2f-other", {
        name: "Zone sinistrée 1",
        surface: "wall",
        damage_type: "other",
        area_sqm: o_9_sqm,
        notes:
          "Corridor à l'entrée de l'app. 102 — placoplâtre, plâtre, peinture (+20 % de peinture pour l'agencement).",
        // 3.52 m² on a 1.45 m-long, 2.44 m-tall wall IS that wall, full
        // height and nearly full width — this is the entrance wall itself,
        // not a patch on it, matching "this entire part needs..." in the
        // source note.
        polygon: wallPatch(o_9_sqm, WALL_LEN_OTHER_M, CEILING_HEIGHT_OTHER_M, { x0: 0 }),
      }),
    ];

    const k3_10_sqm = ft(71.27) * ft(1);
    const k3_11_sqm = ft(3.63) * ft(1);
    const k3_12_sqm = ft(5.82) * ft(1);
    const kitchen3Areas: AffectedArea[] = [
      area("k3-10", "tansley-3f-kitchen", {
        name: "Remplacement du plancher à agencer — bois franc",
        surface: "floor",
        damage_type: "other",
        area_sqm: k3_10_sqm,
        notes: "Bois franc le plus approchant, sur toute la superficie.",
        // The item this nook polygon was cross-checked against: its own
        // shoelace area (~67.96 sq ft) is within a hand trace's error of
        // this item's printed 71.27 sq ft, and the source sketch's own blue
        // highlight for item #10 (page 20) draws exactly this nook.
        polygon: KITCHEN_NOOK_M,
      }),
      area("k3-11", "tansley-3f-kitchen", {
        name: "Dégât d'eau derrière le réfrigérateur",
        surface: "wall",
        damage_type: "water",
        area_sqm: k3_11_sqm,
        notes: null,
        // Small and specific ("behind the fridge") — a thin full-height
        // sliver rather than a low band.
        polygon: wallPatch(k3_11_sqm, WALL_LEN_KITCHEN_M, CEILING_HEIGHT_KITCHEN_M, { x0: 0.1 }),
      }),
      area("k3-12", "tansley-3f-kitchen", {
        name: "Placoplâtre endommagé",
        surface: "wall",
        damage_type: "other",
        area_sqm: k3_12_sqm,
        notes: "Plinthe enlevée; le placoplâtre pourrait devoir être remplacé également.",
        // Own note: baseboard removed, lower wall — a low band.
        polygon: wallPatch(k3_12_sqm, WALL_LEN_KITCHEN_M, CEILING_HEIGHT_KITCHEN_M, { lowerBand: true, x0: 0.1 }),
      }),
    ];

    /**
     * **The rooms in APARTMENT order, 103 then 102 then 101.**
     *
     * His instruction, 8 Sep 2026: *"I wanted you to keep the previous
     * structure with the photos and everything. Just section them apartment
     * by apartment"* — and, on the order, *"Let's say 103, and then it
     * describes everything, and then gives the line items. And then goes
     * 102, same thing. And then does the same thing for 101."*
     *
     * **Which floor is which apartment is read off the source, not
     * assumed.** The corridor room's own note in `My New Project Report
     * 9.pdf` (page 15) says in as many words: *"This is in the corridor at
     * the entrance of the apartment, 102"*, and that room is on the 2nd
     * Floor. 2nd = 102 fixes the building's numbering, and 1st = 101 and
     * 3rd = 103 follow from it. Nothing else in the 23-page source names an
     * apartment — grep it for `apartment`/`app.` and that single note is the
     * only hit — so nothing in the source contradicts this.
     *
     * `ReportDocument` takes the section order from the room order, so this
     * array IS the print order: no sort, no rule about which way unit
     * numbers run, just the order he asked for.
     */
    const rooms: ReportRoom[] = [
      {
        id: "tansley-3f-kitchen",
        name: "Cuisine",
        level: "3rd Floor",
        apartment: "103",
        floorAreaSqm: ft(437.22) * ft(1),
        wallLengthM: ft(114 + 8 / 12),
        ceilingHeightM: ft(8 + 1 / 12),
        stairCount: 1,
        notes: null,
        geometry: kitchenGeometry(),
        areas: kitchen3Areas,
        readings: [],
        photos: photosFor("tansley-3f-kitchen"),
      },
      {
        id: "tansley-2f-kitchen",
        name: "Cuisine",
        level: "2nd Floor",
        apartment: "102",
        floorAreaSqm: ft(437.22) * ft(1),
        wallLengthM: ft(114 + 8 / 12),
        ceilingHeightM: ft(8 + 1 / 12),
        stairCount: 1,
        notes: null,
        geometry: kitchenGeometry(),
        areas: kitchen2Areas,
        readings: [],
        photos: photosFor("tansley-2f-kitchen"),
      },
      {
        id: "tansley-2f-other",
        name: "Autre (corridor / entrée de l'app. 102)",
        level: "2nd Floor",
        apartment: "102",
        floorAreaSqm: ft(17.75),
        wallLengthM: ft(16 + 11.5 / 12),
        ceilingHeightM: ft(8),
        stairCount: 0,
        notes: null,
        geometry: otherGeometry(),
        areas: otherAreas,
        readings: [],
        photos: photosFor("tansley-2f-other"),
      },
      {
        id: "tansley-1f-kitchen",
        name: "Cuisine",
        level: "1st Floor",
        apartment: "101",
        floorAreaSqm: ft(437.22) * ft(1),
        wallLengthM: ft(114 + 8 / 12),
        ceilingHeightM: ft(8 + 1 / 12),
        stairCount: 1,
        notes: null,
        geometry: kitchenGeometry(),
        areas: kitchen1Areas,
        readings: [],
        photos: photosFor("tansley-1f-kitchen"),
      },
    ];

    // The pre-sectioning document: no unit on any room, and the storeys back
    // in ascending order — 1st, 2nd, 2nd, 3rd — which is the order the
    // caller gave before 8 Sep.
    const ungrouped: ReportRoom[] = ["tansley-1f-kitchen", "tansley-2f-kitchen", "tansley-2f-other", "tansley-3f-kitchen"]
      .map((id) => rooms.find((room) => room.id === id)!)
      .map(({ apartment: _apartment, ...room }) => room);

    return {
      layout,
      company: {
        ...DEFAULT_COMPANY,
        legalName: "Renovision AnA inc.",
        street1: "",
        city: "Laval",
      },
      project: {
        name: "1951 Rue Tansley",
        description: null,
        started_on: "2026-09-02",
      },
      client: null,
      property: "1951 Rue Tansley, H2K 0A4, Montréal, Québec, Canada",
      claimFields: [],
      claim: {},
      levels: ["1st Floor", "2nd Floor", "3rd Floor"],
      rooms: grouped ? rooms : ungrouped,
      equipment: [],
      generatedAt: new Date("2026-09-07T12:00:00Z").toISOString(),
      locale: "fr",
      estimate: {
        lines: devis.lines,
        totals: devis.totals,
        // **The trailer has to be the one the money was actually computed
        // with.** `/tmp/tansley-devis.json` is allocated by
        // `tansley.sample.test.ts` with RESTAURATION_CT_TRAILER — profit on
        // the items alone, so généraux + profit come to exactly 15,0% — and
        // this passed POLYGON_TRAILER, whose profit is computed on items +
        // généraux. The figures were right (they are read from the JSON, not
        // recomputed here) but the sommaire printed "Profit 5 % (articles +
        // généraux)" over a profit of 840,83 that is 5% of the items alone.
        // A devis that misstates its own O&P basis is a devis an adjuster
        // can take apart, and the arithmetic beside the label proves the
        // label wrong.
        trailer: RESTAURATION_CT_TRAILER,
      },
    };
}

/**
 * The document as one self-contained HTML file, then as a PDF.
 *
 * The PDF half is `src/lib/report/pdf.ts` with the URL replaced by a string:
 * same local Chrome, same `format: "letter"`, same 2 cm margins, same
 * `printBackground`. It has to be the same settings and not merely similar
 * ones — page breaks move when a margin does, and a variant paginated
 * differently from production would be a preview of a document that does not
 * exist.
 *
 * `setContent` rather than `goto`: everything the page needs (the stylesheet,
 * the photographs) is already inside the string, so there is nothing left for
 * a base URL to resolve. The one exception is `/renovision-logo.png` in the
 * running header, which has no origin to load from here and simply does not
 * draw — a missing mark on a proof, not a missing figure.
 */
async function emit(
  layout: NonNullable<ReportData["layout"]>,
  htmlPath: string,
  pdfPath: string,
  grouped = true,
): Promise<void> {
  const body = renderToStaticMarkup(<ReportDocument data={buildData(layout, grouped)} />);
  const css = readFileSync(
    "src/app/(internal)/admin/projects/[id]/report/report.css",
    "utf8",
  );

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>1951 Rue Tansley</title>
<style>${css}</style>
</head>
<body>${body}</body>
</html>`;

  writeFileSync(htmlPath, html);

  const browser = await puppeteer.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    // `load`, not `networkidle0`: `setContent` only offers the two document
    // events, and it is enough here for the reason production needs more —
    // there is no network. The stylesheet and every photograph are already
    // in the string, so nothing arrives after first paint.
    await page.setContent(html, { waitUntil: "load", timeout: 120_000 });
    // Fonts settle after the network does, and a page measured mid-swap
    // paginates against the wrong text metrics — see pdf.ts.
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

describe("standalone re-render — 1951 Rue Tansley report", () => {
  it("renders the full document with traced floor plans and the priced estimate page", async () => {
    await emit("full", "/tmp/tansley-report.html", "/tmp/tansley-report-full.pdf");
  }, 180_000);

  // His ask, 7 Sep 2026: *"lets try without the floorplan, only photos and
  // line items."* Same data, same component, one different `layout`.
  it("renders the drawingless variant — photographs and priced lines only", async () => {
    await emit(
      "noPlans",
      "/tmp/tansley-report-photos-lines.html",
      "/tmp/tansley-report-photos-lines.pdf",
    );
  }, 180_000);

  // **The single-unit document, so the triplex cannot break it silently.**
  // Same data, same component, no apartment on any room: what a house or one
  // condo renders, and what this report rendered before 8 Sep. Written out
  // rather than asserted because the thing being checked is a printed page —
  // 17 pages, storeys ascending, one `Devis` page carrying every line and
  // the grand sommaire, and not one `Appartement` anywhere in it.
  it("renders the ungrouped document — the single-unit default, unsectioned", async () => {
    await emit(
      "full",
      "/tmp/tansley-report-ungrouped.html",
      "/tmp/tansley-report-ungrouped.pdf",
      false,
    );
  }, 180_000);
});
