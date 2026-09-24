import { Fragment } from "react";
import { PlanLegend } from "./ReportSymbols";
import {
  REPORT_STRINGS,
  formatArea,
  formatDate,
  formatLength,
} from "@/lib/report/strings";
import type { Locale } from "@/i18n/translations";
import type { ReportStrings } from "@/lib/report/strings";
import ReportStoreyPlan from "./ReportStoreyPlan";
import { type PlanObject } from "./PlanObjects";
import FloorPlan from "./FloorPlan";
import WallElevation, { RoomElevations } from "./WallElevation";
import {
  planCorners,
  toFloorPlan,
  type ScanGeometry,
} from "@/lib/roomScan";
import { measureDefinitions } from "@/lib/crm/measureDefinitions";
import { FLOOR_LEVELS, floorLabelFr } from "@/lib/crm/floors";
import {
  bySurface,
  ceilingAreas,
  floorAreas,
  planAreas,
  wallAreas,
  type AffectedArea,
} from "@/lib/crm/areaShapes";
import { AFFECTED_AREA_FILL } from "./planPalette";
import { unitDays, type EquipmentPlacement, type MoistureReading } from "@/lib/crm/dryingLog";
import type { CompanySetting, CustomFieldDef } from "@/lib/crm/settings";
import { isFieldVisible } from "@/lib/crm/settings";
import ReportEstimateTable, { groupLinesByApartment } from "./ReportEstimateTable";
import type {
  AllocatedLine,
  EstimateTotals,
  TrailerSettings,
} from "@/lib/estimator/insurance/types";

/**
 * The restoration report, as a printable document.
 *
 * Built to the layout measured off the client's own magicplan export — US
 * Letter, a running header, a rule, page numbers — because that page skeleton
 * is what makes a report read as professional, and it costs nothing to match.
 *
 * What it does NOT copy is the content. That report carries one table in
 * twenty pages, no claim number, no insured, no adjuster, no moisture reading
 * and no equipment. It is a geometry brochure handed to somebody whose job is
 * to reduce the invoice. This one leads with the claim identity on every
 * page, and ends with the drying record.
 *
 * Rendered as ordinary HTML and printed to PDF by the browser. No PDF library:
 * their own report is Chromium output, so the approach is proven, and an HTML
 * document is one that can be read on a phone as well as printed.
 */

export type ReportRoom = {
  id: string;
  name: string;
  level: string;
  floorAreaSqm: number;
  wallLengthM: number;
  ceilingHeightM: number;
  stairCount: number;
  /** Z765 living-area share, where one was set. Null means the whole room
      counts, which is what an unset percentage has always meant. */
  livingAreaPercent?: number | null;
  /** Bedroom, bathroom, garage… The cover counts bathrooms separately, so
      the type has to reach the report. */
  roomType?: string | null;
  /**
   * **Which apartment of a multi-unit building this room is in — `"103"`.**
   *
   * A triplex is one claim, one roof and three households, and a report that
   * runs the three units together makes the reader work out for themselves
   * which page priced which door. Set it on the rooms and the document
   * divides into sections: each unit's storey plan, room pages, photographs
   * and priced lines together, with its own sous-total, before the next unit
   * starts.
   *
   * **Undefined or blank means ungrouped, and ungrouped is the default.** A
   * single-family job — which is most of them — sets this nowhere and prints
   * exactly the document it printed yesterday, page for page: no headings, no
   * sous-totaux, storey plans and rooms and the one estimate block in their
   * existing order. The sectioning only appears once at least one room says
   * which unit it belongs to.
   *
   * The value is the identifier as it is written on the door — `103`, `4B`,
   * `RC`. The word in front of it (`Appartement`) belongs to the document's
   * language and lives in `report/strings.ts`.
   */
  apartment?: string | null;
  notes: string | null;
  /** Where the operator dragged this room on the storey canvas. Null means
      never placed — see `ReportStoreyPlan` for why that changes what the
      drawing is allowed to claim. */
  planX?: number | null;
  planY?: number | null;
  /** Fixtures standing in this room — see `PlanObjects`. */
  objects?: PlanObject[];
  geometry: ScanGeometry;
  areas: AffectedArea[];
  readings: MoistureReading[];
  photos: {
    id: string;
    url: string | null;
    note: string | null;
    /** Present for every row now; absent only from a caller that hasn't
        been updated to send it. Undefined and `"image/..."` are treated
        the same — video is the one value that changes anything. */
    contentType?: string | null;
    /** A video's poster frame. `url` above still points at the video
        itself — this is what actually gets drawn on paper. */
    thumbnailUrl?: string | null;
  }[];
  /** Wall index → "Display Elevation in Report", for the walls that have it
      set at all. Additive on top of the damaged-walls-only default. */
  wallDisplayElevation?: Map<number, boolean>;
};

export type ReportData = {
  company: CompanySetting;
  project: { name: string; description: string | null; started_on: string | null };
  client: { name: string; email?: string | null; phone?: string | null } | null;
  property: string | null;
  claimFields: CustomFieldDef[];
  claim: Record<string, string>;
  levels: string[];
  rooms: ReportRoom[];
  equipment: EquipmentPlacement[];
  generatedAt: string;
  /** Draw only the dimensions somebody set by hand (geometry.lockedEdges),
      each padlocked — for the adjuster who wants measured-by-hand figures
      and nothing inferred. Off by default: the full drawing is the report. */
  onlyLockedDimensions?: boolean;
  /**
   * Which of the reference's three export layouts to print.
   *
   * `full` is everything — the document as built. `onlyFloors` is their
   * third layout, the one that had never been generated: the cover, the
   * storey plans, and the signature. No room pages, no photos, no
   * definitions.
   *
   * **It is not a trimmed report; it is a different document.** An adjuster
   * asking for the floor plans wants the drawings, and sending forty pages
   * of photographs when they asked for four pages of plans is how a claim
   * file gets set aside unread.
   *
   * `noPlans` is the mirror image of `onlyFloors`, and it exists for the
   * same reason in reverse: **every drawing removed, nothing else.** The
   * cover, the claim summary, the contents, the room pages with their
   * figures and their affected-area listings, the photographs, the priced
   * estimate, the signature and the definitions all print exactly as they
   * do in `full` — only the storey plans, the room floor plans and the wall
   * elevations are gone.
   *
   * His ask, 7 Sep 2026: *"lets try without the floorplan, only photos and
   * line items."* The reason is worth writing down, because it is a good
   * one and it will come up again. A drawing traced from a sketch rather
   * than measured on site carries a few percent of area error and cannot
   * resolve where along a wall a patch of damage sits. Every figure in the
   * listings, every photograph and every priced line is a fact; a plan
   * drawn to within 5% is an argument. On a document going to an adjuster
   * whose job is to find the soft number, an honest approximation is still
   * the softest thing on the page — so there is a layout that carries only
   * what cannot be disputed.
   */
  layout?: "full" | "onlyFloors" | "noPlans";
  /**
   * Templates H/I from `Docs/Report-Estimate-Blueprint.md` — the priced
   * takeoff/scope table and its sommaire. Optional and additive: a report
   * with no estimate attached prints exactly as it always has. See
   * `ReportEstimateTable` for why this is a real section of the document
   * rather than a script that dumps a devis beside it.
   */
  estimate?: {
    lines: AllocatedLine[];
    totals: EstimateTotals;
    trailer: TrailerSettings;
  };
  /**
   * **The language of the DOCUMENT, not of the app.**
   *
   * His ask, 21 Aug 2026: *"our reports need to be in French. But me,
   * personally, I want to use the app in English. So when we create a
   * report, I wanna have an option to choose the language of the report
   * right when we're creating it."*
   *
   * Two separate decisions, so two separate settings. This one is chosen at
   * the moment of export and rides in the URL, like `layout` and
   * `dimensions`, because the page is server-rendered for print and a link
   * that says what the document shows can be shared showing the same thing.
   *
   * Defaults to French: the reports go to Québec clients and carriers, and
   * under Bill 96 the French version is the one that has to exist.
   */
  locale?: Locale;
};

/**
 * The scale bar and its ratio, as the reference prints them.
 *
 * **The ratio is DERIVED per drawing, not fixed.** Read off a real export:
 * 1:70 on the storey page, then 1:54, 1:64, 1:49, 1:45 on the room pages
 * that follow. Each page shows what that page had to fit, which is the only
 * honest thing a scale can say — a constant ratio printed under a drawing
 * that was scaled to the page is a lie an adjuster could measure.
 *
 * The bar itself is ticked in whole metres, so a reader can lay a ruler on
 * it and check.
 */
function ScaleBar({
  metresWide,
  metresTall,
  boxWidthMm,
  boxHeightMm,
  label,
}: {
  metresWide: number;
  metresTall: number;
  boxWidthMm: number;
  boxHeightMm: number;
  /** `Scale` or `Échelle`. */
  label: string;
}) {
  if (!(metresWide > 0) || !(metresTall > 0)) return null;

  // **The BAR is `FloorPlan`'s, not ours.** It has drawn a ticked scale
  // since long before this, and the first version of this printed a second
  // one underneath — two scale bars under one drawing is worse than none,
  // because a reader has to work out which to trust. What was missing is the
  // RATIO, so that is all this prints.
  //
  // And the ratio has to come from the box the drawing is fitted INTO. An
  // SVG with `preserveAspectRatio` fills whichever dimension runs out first,
  // so a tall room in a wide box is scaled by its height and a wide one by
  // its width. Taking the width every time printed `Scale 1:21` under a
  // drawing at nearer 1:55 — a number an adjuster can measure and disprove,
  // which is the worst kind of error this document can carry.
  const scale = Math.min(boxWidthMm / (metresWide * 1000), boxHeightMm / (metresTall * 1000));
  const ratio = Math.round(1 / scale);
  if (!Number.isFinite(ratio) || ratio <= 0) return null;

  return (
    <div className="scalebar">
      <span>{label} 1:{ratio}</span>
    </div>
  );
}

/** The box `.plan.large` gives the room drawing, in millimetres — the two
    numbers `ScaleBar` divides by, kept beside the CSS that sets them. */
const ROOM_PLAN_BOX = { width: 118, height: 66 };

const PHOTOS_PER_PAGE = 6;

/** A room's bounding extent — what the reference calls WIDTH and LENGTH. */
/**
 * The floor's own LABEL, not the id stored against a room.
 *
 * `room_scans.level` stores `2nd`; `2nd Floor` is what a person calls it.
 * The report printed the id, so a page headed "▼ 2nd" read as a fragment.
 * One vocabulary, `floors.ts`, decides both.
 */
function floorLabel(level: string, t: ReportStrings, locale: Locale): string {
  // The document's language wins over the operator's. `floors.ts` owns both
  // spellings so a storey cannot be named one way on the contents page and
  // another on the page it points at.
  if (locale === "fr") {
    const fr = floorLabelFr(level);
    if (fr !== level) return fr;
  }
  const known = FLOOR_LEVELS.find((entry) => entry.id === level)?.label;
  if (known) return known;
  // A bare number is a storey, not a name. Without this a page headed `2`
  // reads as a fragment of something — and `▼ 2` beside `▼ Kitchen` looks
  // like a bug, which is what a reader will report it as. In French the
  // ordinal is `1er` then `2e`, which is the one place a dictionary swap
  // would have produced `1st étage`.
  if (/^-?\d+$/.test(level)) {
    const n = Number(level);
    if (n === 0) return t.groundFloor;
    if (n < 0) return `${t.basement}${n < -1 ? ` ${Math.abs(n)}` : ""}`;
    return t.nthFloor(n);
  }
  return level;
}

/** The rooms sharing a storey, in the order the report prints them. */
function roomsOnLevel(rooms: ReportRoom[], level: string): ReportRoom[] {
  return rooms.filter((room) => room.level === level);
}

/**
 * A storey page's slot in the page plan, keyed by the SECTION it prints in.
 *
 * Two apartments can sit on one floor — a duplex over a shop, a divided
 * storey — and each gets its own storey page inside its own section. Keyed
 * by the level alone, the second would overwrite the first's page number and
 * the footer of one would point at the other. Costs nothing on the ordinary
 * job, where the unit is null and this is the level id with a prefix.
 */
function levelKey(unit: string | null, level: string): string {
  return `${unit ?? ""} ${level}`;
}

/**
 * The band that opens an apartment's section.
 *
 * Not a page of its own: a divider page would be a page added to a document
 * whose instruction was that nothing be added or taken away. It is a heading
 * on the first sheet of the section, set heavier than the page's own title
 * so the eye catches the boundary while flipping.
 */
function UnitBand({ label }: { label: string }) {
  return <p className="unit-band">{label}</p>;
}

function planExtent(geometry: ScanGeometry): { width: number; height: number } {
  const plan = toFloorPlan(geometry);
  return { width: plan.width, height: plan.height };
}

/** How wide a room's drawing is, in metres — what a scale ratio is against. */
function planWidthM(geometry: ScanGeometry): number {
  const plan = toFloorPlan(geometry);
  return plan.width > 0 ? plan.width : 0;
}

function isVideo(photo: { contentType?: string | null }): boolean {
  return Boolean(photo.contentType?.startsWith("video/"));
}

/** Every attachment's caption number, WITHIN ITS OWN KIND — a photo counts
    against other photos, a video against other videos, so the room's third
    attachment overall can still print as `Video 1` if the first two were
    photos. Videos do print (`<room> Video n`), per the reference's own
    numbering — see `Docs/reference/magicplan/object-model.md` §2e. */
function captionNumbers(room: ReportRoom): Map<string, number> {
  const numbers = new Map<string, number>();
  let photoCount = 0;
  let videoCount = 0;
  for (const photo of room.photos) {
    if (isVideo(photo)) numbers.set(photo.id, ++videoCount);
    else numbers.set(photo.id, ++photoCount);
  }
  return numbers;
}

/** One room's photos, split into pages of six. */
function photoPages(room: ReportRoom) {
  const usable = room.photos;
  const pages: (typeof usable)[] = [];
  for (let i = 0; i < usable.length; i += PHOTOS_PER_PAGE) {
    pages.push(usable.slice(i, i + PHOTOS_PER_PAGE));
  }
  return pages;
}

/**
 * **Metric, because the reference is and because he works in it.**
 *
 * His own export prints `78.68 m²`, `2.449 m`, `17.00 m`. The app already
 * follows his unit setting everywhere after ORD-21; the report was the one
 * surface still hard-coded to feet, which is exactly the split that
 * produced "keep the measurement units same across the page".
 *
 * Three decimals on a length and two on an area — theirs, and the precision
 * a scan actually has.
 */
/**
 * Gross wall area for one room — perimeter × the height the wall actually
 * stands at, not × the tallest wall in the room.
 *
 * The twin of `RoomScan.wallAreaGrossSqm` on the phone, and it exists for
 * the same reason: a commercial room commonly contains partitions that stop
 * short of the ceiling — a storage closet inside an office, a knee wall, a
 * boxed run. Pricing those to full height invents drywall and paint that
 * are not there, on every estimate, silently.
 *
 * RoomPlan reports each wall's own height and the geometry keeps all of
 * them, so the average is weighted by how much wall stands at each height —
 * a one-metre stub must not pull as hard as a six-metre wall. Applied to
 * the stored perimeter so that a corrected outline survives.
 */
function wallAreaGross(room: {
  wallLengthM: number;
  ceilingHeightM: number;
  geometry: ScanGeometry;
}): number {
  const walls = room.geometry?.walls ?? [];
  const length = walls.reduce((sum, w) => sum + (w.lengthMeters ?? 0), 0);
  if (length > 0.5) {
    const area = walls.reduce(
      (sum, w) => sum + (w.lengthMeters ?? 0) * (w.heightMeters ?? 0),
      0,
    );
    const average = area / length;
    // Outside a builder's range the heights are not trustworthy, and a
    // nonsense reading must not quietly halve an estimate.
    if (average > 1.5 && average <= room.ceilingHeightM + 0.01) {
      return room.wallLengthM * average;
    }
  }
  return room.wallLengthM * room.ceilingHeightM;
}




export default function ReportDocument({ data }: { data: ReportData }) {
  const {
    company,
    project,
    client,
    property,
    claimFields,
    claim,
    levels,
    rooms,
    equipment,
    generatedAt,
    onlyLockedDimensions = false,
    layout = "full",
    locale = "fr",
    estimate,
  } = data;
  const t = REPORT_STRINGS[locale];
  // Every figure in the document goes through these, so a French report
  // prints `78,64 m²` rather than `78.64 m²`. On a page that is mostly
  // numbers, getting that wrong is most of the page.
  const m2 = (sqm: number) => formatArea(locale, sqm);
  const m = (metres: number) => formatLength(locale, metres);
  const date = (iso: string | null | undefined) => formatDate(locale, iso);
  const floorsOnly = layout === "onlyFloors";
  /**
   * Whether this document draws anything at all.
   *
   * One flag rather than a guard per drawing, because "no plans" has to mean
   * NO plans: the cover's key plan, the storey pages, the room locator, the
   * room floor plan with its scale bar and numbered key, the elevations
   * under the room page and the small elevation figure beside each wall
   * area are six separate pieces of markup that all draw the same traced
   * geometry. Any one of them left behind makes the document a lie about
   * itself. Read from `layout` so the two document-shape decisions cannot
   * contradict each other — `onlyFloors` is all plans, `noPlans` is none,
   * and a boolean beside the union would have allowed both at once.
   */
  const showPlans = layout !== "noPlans";

  const floorAreaSqm = rooms.reduce((sum, room) => sum + room.floorAreaSqm, 0);
  // Living area is on every page of the reference's header, so it has to
  // reach the report and not only the phone. Falls back to the floor area
  // where a room carries no living-area percentage — equal, not absent,
  // which is what an unset percentage means.
  const livingAreaSqm = rooms.reduce(
    (sum, room) => sum + room.floorAreaSqm * ((room.livingAreaPercent ?? 100) / 100),
    0,
  );
  const wallAreaSqm = rooms.reduce((sum, room) => sum + wallAreaGross(room), 0);

  // By SURFACE, and never one grand total. Floor square footage and wall
  // square footage are different trades at different rates; added together
  // they price neither, and floor and ceiling cover the same footprint so a
  // sum of the two double-counts every square foot. An adjuster reading one
  // merged figure cannot check it against anything.
  //
  // These used to be split by damage cause as well. The cause is no longer
  // stated anywhere in this document, so the split has gone with it and each
  // surface carries one figure — which is also the figure the priced estimate
  // works from: the CALC line under a drywall item sums a wall's patches
  // whatever caused them, so a per-surface total is the number an adjuster
  // can actually check the estimate against.
  const damageAreas = bySurface(rooms.flatMap((room) => room.areas));
  const sumSqm = (list: AffectedArea[]) =>
    list.reduce((total, area) => total + Number(area.area_sqm), 0);
  const damage = {
    floor: { count: damageAreas.floor.length, sqm: sumSqm(damageAreas.floor) },
    wall: { count: damageAreas.wall.length, sqm: sumSqm(damageAreas.wall) },
    ceiling: { count: damageAreas.ceiling.length, sqm: sumSqm(damageAreas.ceiling) },
  };

  const now = new Date(generatedAt);
  const shownClaim = claimFields.filter(
    (field) => isFieldVisible(field, claim) && claim[field.id]?.trim(),
  );

  // The strip that identifies the file on every single page. An adjuster
  // reviewing a thirty-page PDF flips pages out of order; a page that cannot
  // say which claim it belongs to is a page that gets set aside.
  const identity = [
    claim.claim_number && `${t.claimTag} ${claim.claim_number}`,
    client?.name,
    claim.loss_date && `${t.lossTag} ${date(claim.loss_date)}`,
    claim.water_category,
    claim.water_class,
  ]
    .filter(Boolean)
    .join("  •  ");

  // **Page numbering, the reference's way: `Page n/19`.**
  //
  // Counted rather than left to CSS. `@page` margin boxes can print a page
  // counter, but browser support for them is patchy and the TOTAL is worse
  // still — and a report that says "Page 4 of 19" is making a claim about
  // completeness that has to be right. Everything here is generated from
  // one list, so the count is arithmetic rather than a guess.
  // **Their cover stacks the address, a line per part** — street, then
  // postal code and city, then province, then country. Ours arrives as one
  // joined string, so it is split back on the commas it was joined with.
  const addressLines = (property ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  // The rooms the cover's key plan draws: the first storey, and only the
  // ones whose walls actually closed into an outline. A scan that stopped
  // short has no shape to show and would print as a stray line.
  // A `noPlans` cover keeps its figures and its map and simply has no key
  // plan — the block below already prints nothing when this list is empty.
  const coverPlanRooms = !showPlans
    ? []
    : rooms
        .filter((room) => room.level === levels[0])
        .filter((room) => toFloorPlan(room.geometry).polygon.length >= 3)
        .slice(0, 6);

  /**
   * ------------------------------------------------ apartment sectioning
   *
   * **The document divided by unit, when the rooms say which unit they are
   * in.** His instruction, 8 Sep 2026, looking at the Tansley triplex:
   * *"give them pricing apartment per apartment. Let's say 103, and then it
   * describes everything, and then gives the line items. And then goes 102,
   * same thing… so like this, when they read, they understand this is for
   * this apartment, this is for that, and this is for the other."* And,
   * first: *"I wanted you to keep the previous structure with the photos and
   * everything. Just section them apartment by apartment."*
   *
   * So nothing is removed and nothing is summarised away. Every page this
   * document had it still has; they are dealt into sections.
   *
   * **The ORDER of the sections is the order of the rooms.** Not sorted —
   * `103` before `102` before `101` is what he asked for on this file, and
   * any rule that produced it (descending? by floor?) would be a rule
   * invented here rather than a decision the caller made. The caller already
   * decides the order rooms print in; the units follow it.
   */
  const unitOf = (room: ReportRoom): string | null => room.apartment?.trim() || null;
  const unitOrder: string[] = [];
  for (const room of rooms) {
    const unit = unitOf(room);
    if (unit !== null && !unitOrder.includes(unit)) unitOrder.push(unit);
  }
  /** **The switch, and it is off unless a room turned it on.** No room
      carrying an apartment means one section carrying everything, in exactly
      the order the document has always printed it — see `ReportRoom.apartment`. */
  const grouped = unitOrder.length > 0;

  /** The document's page order, as sections. Ungrouped is the single section
      that contains the whole job, which is how the single-unit document stays
      byte-for-byte the one it was. */
  const sections: { unit: string | null; rooms: ReportRoom[]; levels: string[] }[] = (
    grouped ? [...unitOrder, ...(rooms.some((r) => unitOf(r) === null) ? [null] : [])] : [null]
  ).map((unit) => {
    const inUnit = grouped ? rooms.filter((room) => unitOf(room) === unit) : rooms;
    return {
      unit,
      rooms: inUnit,
      // Storeys in the caller's own order, narrowed to the ones this unit
      // actually occupies. A storey page with no rooms on it was never
      // slotted and still is not.
      levels: levels.filter((level) => inUnit.some((room) => room.level === level)),
    };
  });

  /** The devis, cut the same way — see `groupLinesByApartment` for why the
      cut lives beside the table that prints it. The `#` column keeps running
      1..n across every section, so the 43 lines of a triplex are still 43
      numbered lines and not three estimates that each start at one. */
  const estimateGroups = estimate
    ? groupLinesByApartment(estimate.lines, grouped ? unitOrder : [], (roomScanId) =>
        rooms.find((room) => room.id === roomScanId)?.apartment ?? null,
      )
    : null;

  // Everything that used to crowd the cover now has a page of its own, and
  // that page only exists when it has something on it.
  const hasSummary =
    shownClaim.length > 0 ||
    client !== null ||
    damage.floor.count + damage.wall.count > 0 ||
    Boolean(project.description);

  /**
   * **The whole document, numbered before a line of it is drawn.**
   *
   * This used to be two independent things: a sum that guessed the total,
   * and a counter incremented inline as sections rendered. They disagreed —
   * the sum counted three kinds of page that are never rendered, and the
   * counter skipped the cover — so every footer in a nineteen-page file
   * said something else. Worse, neither could answer the question a long
   * report actually raises: *what page is the kitchen on?*
   *
   * Laying the pages out first fixes both. The footers read from this, the
   * contents page reads from this, and the total is the length of it.
   */
  const plan: {
    kind: string;
    label: string;
    sub?: string;
    page: number;
    /** The apartment this page belongs to, where the document is sectioned.
        Carried on the plan rather than recomputed for the contents page, so
        the heading a reader sees in the table of contents and the section a
        page actually sits in cannot disagree. */
    unit?: string | null;
  }[] = [];
  const push = (kind: string, label: string, sub?: string, unit?: string | null) => {
    plan.push({ kind, label, sub, page: plan.length + 1, unit: unit ?? null });
    return plan.length;
  };

  const coverPage = push("cover", project.name);
  const summaryPage = !floorsOnly && hasSummary ? push("summary", t.summary) : null;
  const contentsPage = !floorsOnly && rooms.length > 1 ? push("contents", t.contents) : null;

  // The storey pages are ONLY a drawing — a title, the assembled floor, the
  // legend. With no drawing there is nothing left to put on them, so they
  // are not slotted at all rather than slotted and left blank; the page
  // numbers below and the contents page are both counted off this list, so
  // dropping the slot is what keeps `Page n/N` right.
  const levelPages = new Map<string, number>();
  const roomPages = new Map<string, { page: number; photos: number[] }>();
  /** Where each apartment's own slice of the devis prints — immediately
      behind that apartment's own pages, which is the whole point of the
      exercise: *"it describes everything, and then gives the line items.
      And then goes 102, same thing."* */
  const unitEstimatePages = new Map<string, number>();

  // **One loop over the sections, where there used to be two over the whole
  // job.** With no apartments set there is exactly one section holding every
  // storey and every room in the caller's order, so this walks the same
  // pages in the same order and slots the same numbers.
  for (const section of sections) {
    if (showPlans) {
      for (const level of section.levels) {
        levelPages.set(
          levelKey(section.unit, level),
          push("level", floorLabel(level, t, locale), undefined, section.unit),
        );
      }
    }
    if (!floorsOnly) {
      for (const room of section.rooms) {
        const page = push("room", room.name, floorLabel(room.level, t, locale), section.unit);
        const photos = photoPages(room).map((_, index) =>
          push("photos", t.photosEntry(room.name), `${index + 1}`, section.unit),
        );
        roomPages.set(room.id, { page, photos });
      }
      const unitLines = section.unit
        ? estimateGroups?.units.get(section.unit)?.lines ?? []
        : [];
      if (section.unit && unitLines.length > 0) {
        unitEstimatePages.set(
          section.unit,
          push("estimate", t.estimate, t.unit(section.unit), section.unit),
        );
      }
    }
  }

  const equipmentPage =
    !floorsOnly && equipment.length > 0 ? push("equipment", t.drying) : null;
  const estimatePage =
    !floorsOnly && estimate && estimate.lines.length > 0 ? push("estimate", t.estimate) : null;
  const signaturePage = push("signature", t.signature);
  const definitionsPage =
    !floorsOnly && rooms.length > 0 ? push("definitions", t.howMeasured) : null;

  const totalPages = plan.length;
  void coverPage;

  // The three-line header the reference repeats on every page from two.
  // A bathroom by its type, however the operator spelled it. `room_type`
  // is a free-ish string and "Bathroom", "bathroom" and "Full bathroom"
  // are all the same room to somebody pricing one.
  const bathroomCount = rooms.filter((room) =>
    (room.roomType ?? "").toLowerCase().includes("bath"),
  ).length;

  const headerTotals = [
    `${t.totalArea.toUpperCase()}: ${m2(floorAreaSqm)}`,
    `${t.livingArea.toUpperCase()}: ${m2(livingAreaSqm)}`,
    `${t.floors.toUpperCase()}: ${levels.length}`,
    `${t.rooms.toUpperCase()}: ${rooms.length}`,
  ].join(" • ");

  return (
    <article className="report">
      {/* ---------------------------------------------------- cover */}
      <section className="page cover">
        <header className="cover-head">
          <h1>{project.name}</h1>
          <div className="brand">
            {/* Theirs prints the firm's MARK here, and again in the corner of
                every page after — which is what makes an export read as a
                document from a company rather than as output from a tool.
                Ours has a mark; it was only ever missing from the paper. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/renovision-logo.png" alt="" className="brand-mark" />
            <strong>{company.tradeName || company.legalName}</strong>
            {company.rbqLicence && <span>RBQ {company.rbqLicence}</span>}
          </div>
        </header>

        {/* **Their cover, in their order and nothing else on it** — read off
            the nineteen-page export: the project, `CREATED ON` with the date
            under it, `LOCATION` with the address stacked a line per part,
            then the four figures and the firm.

            What used to sit between them — the insured, the claim block, the
            wall total and the two damage tables — has not been thrown away.
            It is on the summary page that follows, which is where a total
            belongs anyway. A cover carrying eight blocks is not the document
            he is putting ours beside. */}
        <div className="cover-facts">
          <div>
            <p className="cover-label">{t.createdOn}</p>
            <p className="cover-value">{date(generatedAt)}</p>
          </div>
          {addressLines.length > 0 && (
            <div>
              <p className="cover-label">{t.location}</p>
              {addressLines.map((line) => (
                <p className="cover-value" key={line}>
                  {line}
                </p>
              ))}
            </div>
          )}

          {/* **The map, as theirs prints it** — beside the address, not
              instead of it. A claim file crosses several desks, and an
              address means nothing to an adjuster three cities away until
              they can see which building it is and what is around it.

              Proxied through our own route so the Maps key is never in the
              document's markup; see `api/admin/staticmap`. If it fails —
              no key, no network, no session — the image simply does not
              draw and the cover is the cover it was yesterday. A report
              must not depend on Google being up. */}
          {property && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="cover-map"
              src={`/api/admin/staticmap?address=${encodeURIComponent(property)}`}
              alt={`${t.location} — ${property}`}
            />
          )}
        </div>

        {/* **Their four cover figures, in their order.** Total area,
            Floors, Rooms — and BATHROOM, which is a room TYPE counted
            separately on the cover. An odd choice until you price a job:
            bathrooms carry the plumbing, the tile and the fan, and an
            adjuster reading a cover wants to know how many before anything
            else. We store `room_type`, so we can answer it. */}
        <div className="cover-figures">
          {[
            [t.totalArea, m2(floorAreaSqm)],
            [t.floors, String(levels.length)],
            [t.rooms, String(rooms.length)],
            // THE ZERO PRINTS. I hid it, reasoning that "Bathroom 0" reads
            // as a field somebody failed to fill in — a decent argument, and
            // not the one that was asked for. His instruction on this
            // document, 19 Aug: *"just duplicate whatever I send you. Don't
            // try to be creative whatever."* Their cover prints the zero, so
            // this does. It is also defensible on its own terms: on a claim,
            // "no bathrooms" is a fact worth stating rather than a gap.
            [t.bathroom, String(bathroomCount)],
          ].map(([label, value]) => (
            <div key={label}>
              {/* Label ABOVE the value, as theirs prints it. */}
              <span className="figure-label">{label}</span>
              <span className="figure-value">{value}</span>
            </div>
          ))}
        </div>

        {/* **The key plan.** Their cover is half a page of nothing, and so was
            ours — theirs by convention, ours by copying it. A cover with a
            dead middle reads as unfinished rather than as considered, and
            the obvious thing to put there is the building: an adjuster
            opening this file sees what the claim is about before reading a
            word. Drawn small and quiet, because it is an orientation, not
            the drawing — page two prints the floor at scale with its
            dimension chain.

            Only when there is something real to draw. A row of empty boxes
            where a plan should be is worse than the empty space it filled. */}
        {coverPlanRooms.length > 0 && (
          <div className="cover-plan">
            {/* The assembled storey, not a row of loose rooms — the same
                drawing page two prints at scale, small and quiet. A cover
                showing five disconnected rectangles says less about the
                property than no drawing at all. */}
            <ReportStoreyPlan
              locale={locale}
              rooms={coverPlanRooms.map((room) => ({
                id: room.id,
                name: room.name,
                geometry: room.geometry,
                floorAreaSqm: room.floorAreaSqm,
                planX: room.planX ?? null,
                planY: room.planY ?? null,
                areas: [],
              }))}
            />
            <p className="cover-plan-caption">
              {floorLabel(levels[0], t, locale)} — {t.roomCount(coverPlanRooms.length)}
            </p>
          </div>
        )}

        <footer className="cover-foot">
          <span>
            <strong>{company.tradeName || company.legalName}</strong>
            {company.email && <> · {company.email}</>}
          </span>
          <span>
            {[company.street1, company.city, company.province, company.postalCode]
              .filter(Boolean)
              .join(", ")}
          </span>
          <span>
            {company.phone}
            <br />
            Page 1/{totalPages}
          </span>
        </footer>
      </section>

      {/* ------------------------------------------------------ summary */}
      {/* The blocks the cover used to carry. Kept, because a claim without
          its number and a scope without its damage totals is not a smaller
          report — it is an unusable one. Moved, because their cover has
          none of it and this one is being read side by side with theirs. */}
      {!floorsOnly && hasSummary && (
        <section className="page">
          <Running project={project.name} address={property} totals={headerTotals} identity={identity} />
          <p className="marker">{t.summary}</p>
          <div className="cover-grid">
            <dl>
              <dt>{t.insured}</dt>
              <dd>{client?.name ?? "—"}</dd>
              <dt>{t.property}</dt>
              <dd>{property ?? "—"}</dd>
              <dt>{t.workStarted}</dt>
              <dd>{date(project.started_on)}</dd>
              <dt>{t.reportPrepared}</dt>
              <dd>{date(generatedAt)}</dd>
            </dl>

            <dl>
              {shownClaim.length === 0 ? (
                <>
                  <dt>{t.claimDetails}</dt>
                  <dd className="muted">{t.notRecorded}</dd>
                </>
              ) : (
                shownClaim.map((field) => (
                  <span key={field.id} style={{ display: "contents" }}>
                    <dt>{field.label}</dt>
                    <dd>{claim[field.id]}</dd>
                  </span>
                ))
              )}
            </dl>
          </div>

          {/* Wall area alone here: floor area, floors and rooms are on the
              cover, and the same figure twice in one document makes a reader
              stop reading and start checking whether the two agree. */}
          <table className="stats">
            <thead>
              <tr>
                {/* Named gross so the definitions appendix maps onto it. */}
                <th>{t.wallAreaGross}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{m2(wallAreaSqm)}</td>
              </tr>
            </tbody>
          </table>

          {/* One table per surface, never one for all of them. Named by
              surface, not just "affected area": all three of these are
              affected area, and an adjuster must be able to tell which
              surface a figure priced. Floor and ceiling especially — they
              cover the same footprint and would look like one figure
              double-counted if they were ever added. Each prints nothing
              at all when that surface has nothing on it. */}
          <DamageTotals locale={locale} title={t.affectedFloorArea} total={damage.floor} />
          <DamageTotals locale={locale} title={t.affectedWallArea} total={damage.wall} />
          <DamageTotals locale={locale} title={t.affectedCeilingArea} total={damage.ceiling} />
          {project.description && <p className="desc">{project.description}</p>}
          <PageFoot n={summaryPage ?? 0} of={totalPages} company={company} t={t} />
        </section>
      )}

      {/* ----------------------------------------------------- contents */}
      {/* **A nineteen-page document with no way into it.** Theirs has none
          either, and on five pages that is defensible; on nineteen it means
          finding the kitchen is a flick through every sheet. An adjuster
          checking one room, a contractor pricing one floor and a homeowner
          looking for their own photographs all arrive with a different
          question, and this is the page that answers all three in a second.

          Numbered from the same list the footers are, so the two cannot
          disagree. */}
      {contentsPage !== null && (
        <section className="page">
          <Running project={project.name} address={property} totals={headerTotals} identity={identity} />
          <p className="marker">{t.contents}</p>
          <ul className="contents">
            {/* **The apartments show up here first.** A reader opening a
                sectioned report looks at this page to find out how the
                document is arranged, so the arrangement has to be on it —
                a heading over each unit's own run of pages. Emitted from
                the same `plan` the footers are numbered from, so a heading
                cannot sit over a page that is in a different section. With
                no apartments set, `entry.unit` is null throughout and this
                list is exactly the list it has always been. */}
            {(() => {
              let openedUnit: string | null = null;
              return plan
                .filter((entry) => entry.kind !== "cover" && entry.kind !== "contents")
                .map((entry) => {
                  const opening =
                    entry.unit && entry.unit !== openedUnit ? entry.unit : null;
                  if (entry.unit) openedUnit = entry.unit;
                  return (
                    <Fragment key={`${entry.kind}-${entry.page}`}>
                      {opening && (
                        <li className="contents-unit">
                          <span className="contents-label">{t.unit(opening)}</span>
                          <span className="lead" />
                          <span className="contents-page">{entry.page}</span>
                        </li>
                      )}
                      <li className={`contents-${entry.kind}`}>
                        <span className="contents-label">
                          {entry.label}
                          {entry.sub &&
                            (entry.kind === "room" || entry.kind === "estimate") && (
                              <span className="contents-sub"> · {entry.sub}</span>
                            )}
                        </span>
                        <span className="lead" />
                        <span className="contents-page">{entry.page}</span>
                      </li>
                    </Fragment>
                  );
                });
            })()}
          </ul>
          <PageFoot n={contentsPage} of={totalPages} company={company} t={t} />
        </section>
      )}

      {/* ------------------------------------------------ the sections
          One apartment's storey plan, its rooms, their photographs and its
          priced lines, then the next apartment's. With no apartment set
          anywhere this is a single section holding the whole job in the
          order it has always printed — see the sectioning block above. */}
      {sections.map((section) => {
        const bandOnLevel = showPlans && section.levels.length > 0;
        const unitLabel = section.unit ? t.unit(section.unit) : null;
        return (
        <Fragment key={section.unit ?? "__ungrouped__"}>

      {/* ------------------------------------------- one page per floor */}
      {showPlans && section.levels.map((level, levelIndex) => {
        const onLevel = section.rooms.filter((room) => room.level === level);
        if (onLevel.length === 0) return null;
        const levelArea = onLevel.reduce((sum, room) => sum + room.floorAreaSqm, 0);

        return (
          <section className="page" key={level}>
            <Running project={project.name} address={property} totals={headerTotals} identity={identity} />
            {/* **The band that opens an apartment's section.** Printed once,
                on the section's first page, rather than on all of them: a
                reader needs to be told where a section begins, and a line
                repeated on thirty pages is a line nobody reads by the third.
                The pages inside carry the unit quietly, on the sub-line
                under their own title, at no cost in height. */}
            {unitLabel && levelIndex === 0 && <UnitBand label={unitLabel} />}
            <div className="section-head">
              <p className="marker">{floorLabel(level, t, locale)}</p>
              <Figures
                pairs={[
                  [t.totalArea.toUpperCase(), m2(levelArea)],
                  [t.rooms.toUpperCase(), String(onLevel.length)],
                ]}
              />
            </div>
            {/* **One building, not nine boxes.** This was a grid of room
                thumbnails, each in its own card with a caption underneath.
                Beside the reference's page 2 — a single connected floor,
                walls joined, doors swinging into the rooms they open, every
                room named where it stands — the difference is not taste. A
                grid says *here are the rooms we measured*; a floor plan says
                *here is the property*. */}
            <ReportStoreyPlan
              locale={locale}
              note={t.unregisteredStoreyNote}
              rooms={onLevel.map((room) => ({
                id: room.id,
                name: room.name,
                geometry: room.geometry,
                floorAreaSqm: room.floorAreaSqm,
                planX: room.planX ?? null,
                planY: room.planY ?? null,
                objects: room.objects,
                areas: planAreas(room.areas)
                  .filter((area) => area.polygon.length >= 3)
                  .map((area) => ({
                    id: area.id,
                    polygon: area.polygon,
                    // One colour for every patch — see AFFECTED_AREA_FILL.
                    color: AFFECTED_AREA_FILL,
                  })),
              }))}
            />
            <PlanLegend t={t} />
            <PageFoot
              n={levelPages.get(levelKey(section.unit, level)) ?? 0}
              of={totalPages}
              company={company}
              t={t}
            />
          </section>
        );
      })}

      {/* --------------------------------------------- one page per room */}
      {!floorsOnly && section.rooms.map((room, roomIndex) => (
        <Fragment key={room.id}>
        <section className="page">
          <Running project={project.name} address={property} totals={headerTotals} identity={identity} />
          {unitLabel && !bandOnLevel && roomIndex === 0 && <UnitBand label={unitLabel} />}

          {/* The reference's own two lines above the drawing, in its own
              order and wording: the room and its storey, then the figures
              on two rows. `WIDTH` and `LENGTH` are the drawing's extent,
              not the longest wall — which is why an L-shaped room's width
              is bigger than any single wall it has. */}
          <div className="section-head">
            <div>
              <p className="marker">{room.name}</p>
              {/* The storey, and — where the document is sectioned — the
                  apartment beside it. On the sub-line the page already has,
                  so a reader who flips into the middle of a triplex knows
                  whose kitchen this is without a millimetre added to the
                  sheet. */}
              <p className="marker-sub">
                {floorLabel(room.level, t, locale)}
                {unitLabel && ` · ${unitLabel}`}
              </p>
            </div>
            <Figures
              align="right"
              pairs={[
                [t.width, m(planExtent(room.geometry).width)],
                [t.length, m(planExtent(room.geometry).height)],
                [t.ceilingHeight, m(room.ceilingHeightM)],
                [t.area, m2(room.floorAreaSqm)],
                [t.perimeter, m(room.wallLengthM)],
              ]}
            />
          </div>

          {/* The grid exists to stand the locator beside the drawing. With
              neither of them there is one column of ordinary blocks, and
              leaving the class on would size that column to `auto` — the
              staircase row set in a narrow strip against a page of white. */}
          <div className={showPlans ? "room-body" : undefined}>
            {/* **The locator, and it is the best thing on their page.** His
                words looking at it, 21 Aug: *"do you see how it shows the
                room separate but at the same time showing what part of the
                house it is in on the left with greyed out plan? that is
                amazing."*

                It is, and for a nameable reason: a room page is a rectangle
                with a name on it, and nine of them in a row are nine
                rectangles. This answers the question the reader actually has
                — *which one is this?* — without a word, using the drawing
                already on the storey page rather than a new one.

                Ours used to be a ROW of separate room outlines with one
                shaded, because the report had no assembled floor to draw
                from. It has one now. */}
            {/* Scoped to the SECTION's rooms, not the whole job: on a
                sectioned document the locator has to show the apartment this
                room is in, and greying out a neighbour's kitchen because it
                happens to share a storey number would be worse than no
                locator. Identical on an ungrouped job, where the section is
                the whole job. */}
            {showPlans && roomsOnLevel(section.rooms, room.level).length > 1 && (
              <div className="locator">
                <ReportStoreyPlan
                  locale={locale}
                  highlight={room.id}
                  rooms={roomsOnLevel(section.rooms, room.level).map((other) => ({
                    id: other.id,
                    name: other.name,
                    geometry: other.geometry,
                    floorAreaSqm: other.floorAreaSqm,
                    planX: other.planX ?? null,
                    planY: other.planY ?? null,
                    areas: [],
                  }))}
                />
              </div>
            )}

            {/* Wrapped so the plan and its note share one grid cell. */}
            <div>
              {/* The drawing, its note, its scale and its numbered key —
                  one block, because the last three exist only to explain the
                  first. A scale ratio with nothing drawn under it, or badges
                  numbering patches on a plan that is not there, would be
                  worse than the drawing's absence. The areas themselves are
                  not lost with it: every one of them prints again in full,
                  with its measurement and its notes, in the affected-area
                  listings at the foot of this page. */}
              {showPlans && (
                <>
              <div className="plan large">
                <FloorPlan
                  result={room.geometry}
                  name={room.name}
                  locale={locale}
                  objects={room.objects}
                  dimensions={onlyLockedDimensions ? "locked" : "all"}
                  // Plan-space areas only — floor and ceiling, which share
                  // the plan's metres. A wall area's polygon is in its
                  // wall's own face space and belongs on the elevation.
                  areas={planAreas(room.areas)
                    .filter((area) => area.polygon.length >= 3)
                    .map((area) => ({
                      id: area.id,
                      polygon: area.polygon,
                      color: AFFECTED_AREA_FILL,
                    }))}
                />
              </div>
              {/* The printed page must say what it is showing — a plan with
                  dimensions missing and no explanation reads as an error. */}
              {onlyLockedDimensions && (
                <p className="fineprint">
                  {t.lockedDimensionsNote}
                </p>
              )}
              {/* **The ratio comes from the box the drawing is fitted INTO**,
                  not from a guessed width — see `ScaleBar`. */}
              <ScaleBar
                metresWide={planWidthM(room.geometry)}
                metresTall={planExtent(room.geometry).height}
                boxWidthMm={ROOM_PLAN_BOX.width}
                boxHeightMm={ROOM_PLAN_BOX.height}
                label={t.scale}
              />

            {/* **The numbered key.** Badges on the drawing against an
                itemised legend beside it, so a figure in the table can be
                pointed at on the plan. Without it an adjuster reading "wet
                area 4.2 m²" has no way to know WHICH patch that is, and a
                report that cannot be cross-referenced gets queried.

                Numbered per room rather than per report: a reader is
                looking at one page, and "3" meaning the third area in this
                room is easier to follow than "17" meaning the seventeenth
                in the property. */}
            {room.areas.length > 0 && (
              <table className="measure key">
                <tbody>
                  {planAreas(room.areas)
                    .filter((area) => area.polygon.length >= 3)
                    .map((area, index) => (
                    <tr key={area.id}>
                      <th>
                        <span
                          className="badge"
                          style={{ background: AFFECTED_AREA_FILL }}
                        >
                          {index + 1}
                        </span>
                        {area.name}
                      </th>
                      <td className="num">
                        {m2(Number(area.area_sqm))}
                        {/* The surface, and nothing else. This carried the
                            damage cause in front of it — `6,62 m² Autre ·
                            plancher` — and dropped the cause word AND the
                            separator with it rather than leaving a leading
                            middot in front of the surface. */}
                        <span className="surface">
                          {" "}
                          {area.surface === "wall"
                            ? t.wall.toLowerCase()
                            : area.surface === "ceiling"
                              ? t.ceiling.toLowerCase()
                              : t.floor.toLowerCase()}
                        </span>
                      </td>
                    </tr>
                    ))}
                </tbody>
              </table>
            )}
                </>
              )}

            {/* **What the two lines above do NOT already say.**
                This table used to repeat Floor, Perimeter and Ceiling height
                — all three of which are printed as running text at the top
                of this very page. The same figure twice on one page is worse
                than useless: a reader stops reading and starts checking
                whether the two agree.
                Wall area goes with them. The reference does not print it on
                a room page at all, and it is on the cover, where a total
                belongs. What is left is what nothing else states. */}
            <table className="measure">
              <tbody>
                {room.stairCount > 0 && (
                  <tr>
                    <th>{t.staircase}</th>
                    <td className="num">
                      {room.stairCount} — {t.staircaseNote}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* The damaged walls, seen straight on. The plan above cannot show
              them: it is a view from overhead, where a wall is a line with no
              height, and the height is the whole of what was marked. */}
          {/* Only the walls somebody asked for. Every damaged wall used to
              print here as well as inside its own affected-area block below
              — the same wall twice on one page, and 34mm of a sheet that
              did not have it. */}
          {showPlans && (
          <RoomElevations
            onlyFlagged
            locale={locale}
            wallWord={t.wall}
            contextLabel={t.shownForContext}
            corners={planCorners(toFloorPlan(room.geometry))}
            ceilingHeightM={room.ceilingHeightM}
            areas={wallAreas(room.areas)}
            wallFlags={room.wallDisplayElevation}
          />
          )}

          {room.readings.length > 0 && (
            <table className="listing">
              <thead>
                <tr>
                  <th>{t.reading}</th>
                  <th>{t.location}</th>
                  <th>{t.material}</th>
                  <th className="num">{t.moistureContent}</th>
                  <th className="num">{t.relativeHumidity}</th>
                  <th className="num">{t.temperature}</th>
                </tr>
              </thead>
              <tbody>
                {room.readings.map((reading) => (
                  <tr key={reading.id}>
                    <td>{date(reading.taken_at)}</td>
                    <td>{reading.location || "—"}</td>
                    <td>{reading.material ?? "—"}</td>
                    <td className="num">
                      {reading.material_percent === null ? "—" : `${reading.material_percent}%`}
                    </td>
                    <td className="num">
                      {reading.relative_humidity === null ? "—" : `${reading.relative_humidity}%`}
                    </td>
                    <td className="num">
                      {reading.temperature_c === null ? "—" : `${reading.temperature_c}°C`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {room.notes && <p className="notes">{room.notes}</p>}

          {/* **The block their room page ends on, duplicated.** Read off
              page 5 of the nineteen-page export, in this exact order:

                  ▼ 2nd bedroom/2nd Floor
                  Photos            7 Photos (see photos page)
                  1 AFFECTED WALL AREA
                  Area              2.59 m²
                  Name              Water damage
                  Notes             This area is heavily damaged

              Three things it settles. The photos are a POINTER, not the
              photographs — those follow on their own pages. The heading
              counts and names the surface, so `1 AFFECTED WALL AREA` and
              `2 AFFECTED FLOOR AREAS` never get read as the same figure.
              And each area is label-and-value rows, not a table column, so
              a sentence of notes prints as a sentence.

              A `Cause` row used to sit under `Name`, naming the peril —
              `Dégât d'eau`, `Moisissure` — which is a row the reference has
              no equivalent for. It came out on the owner's instruction of
              8 Sep 2026: the classification is still recorded against every
              area and the estimator still prices from it, it is simply not
              printed. The rows left are the reference's own. */}
          {(room.photos.length > 0 || room.areas.length > 0) && (
            <>
              <p className="marker marker-2">{room.name} / {floorLabel(room.level, t, locale)}</p>
              {room.photos.length > 0 && (
                <dl className="area-block">
                  <dt>{t.photos}</dt>
                  {/* `seePhotosPage` already carries the count — printing
                      `{length}` in front of it as well gave `7 7 photos`. */}
                  <dd>{t.seePhotosPage(room.photos.length)}</dd>
                </dl>
              )}
              {([
                ["FLOOR", floorAreas(room.areas), t.affectedFloorAreaCount],
                ["WALL", wallAreas(room.areas), t.affectedWallAreaCount],
                ["CEILING", ceilingAreas(room.areas), t.affectedCeilingAreaCount],
              ] as const).map(([surface, list, count]) =>
                list.length === 0 ? null : (
                  <Fragment key={surface}>
                    {/* The heading string pluralises itself. It used to be
                        given a second "S" here as well, which printed
                        "2 AFFECTED FLOOR AREASS". */}
                    <p className="area-count">{count(list.length)}</p>
                    {list.map((area) => (
                      <div className="area-entry" key={area.id}>
                      <dl className="area-block">
                        <dt>{t.area}</dt>
                        <dd>{m2(Number(area.area_sqm))}</dd>
                        <dt>{t.name}</dt>
                        <dd>{area.name}</dd>
                        {area.surface === "wall" && (
                          <>
                            <dt>{t.wall}</dt>
                            <dd>{(area.wall_index ?? 0) + 1}</dd>
                          </>
                        )}
                        {area.notes && (
                          <>
                            <dt>{t.notes}</dt>
                            {/* The AI pass over damage notes (`ensurePolishedNotes`
                                in `lib/crm/affectedAreas.ts`) runs before this
                                component ever renders, so a printed note is
                                already the polished text where one exists —
                                falling back to the operator's own words is
                                what happens on the very first export of a
                                note, before the pass has had anything to
                                cache, and if the pass ever fails outright. */}
                            <dd>{area.notes_polished || area.notes}</dd>
                          </>
                        )}
                      </dl>
                      {/* **The patch, drawn where it is.** Theirs prints a
                          small figure of the marked shape at the right of
                          this block, and it is the right place for it: a
                          wall area is a number until somebody can see that
                          the bottom metre is wet and the damage stops under
                          the window, which is the line a drywall price is
                          built on. Beside the block rather than in a section
                          of its own, so it costs the page nothing. */}
                      {showPlans && area.surface === "wall" && area.wall_index !== null && (
                        <div className="area-figure">
                          <WallElevation
                            locale={locale}
                            corners={planCorners(toFloorPlan(room.geometry))}
                            wallIndex={area.wall_index}
                            ceilingHeightM={room.ceilingHeightM}
                            areas={[area]}
                          />
                        </div>
                      )}
                      </div>
                    ))}
                  </Fragment>
                ),
              )}
            </>
          )}
          <PageFoot
            n={roomPages.get(room.id)?.page ?? 0}
            of={totalPages}
            company={company}
            t={t}
          />
        </section>

        {/* --------------------------------- this room's photos, interleaved
           **Behind their own room, not collected at the back.** The
           reference's structure, read page by page off a real 19-page
           export: room page, then that room's photos, then the next room.
           An adjuster reading about a bathroom wants the bathroom's photos
           on the next page, not forty photos in one pile at the end with
           the room name repeated in every caption.

           Six tiles a page, two columns, overflowing onto further pages
           with the same header — their layout exactly, down to the
           `<Room> Photo n` caption, which is what makes a photo citable in
           correspondence. */}
        {photoPages(room).map((batch, index) => {
          // One map for the whole page rather than one per tile — the
          // numbering is per ROOM (a video's count does not reset page to
          // page), so it has to be built from the room's full list either
          // way; building it once per page instead of once per tile just
          // avoids doing that six times over for the same six photos.
          const numbers = captionNumbers(room);
          return (
          <section className="page" key={`${room.id}-photos-${index}`}>
            <Running project={project.name} address={property} totals={headerTotals} identity={identity} />
            {/* Their section marker, without the glyph — see `.marker` in
                report.css for what replaced it. */}
            <p className="marker">
              {t.photosOf(room.name)}
              {unitLabel && ` · ${unitLabel}`}
            </p>
            <div className="photo-grid">
              {batch.map((photo) => {
                const video = isVideo(photo);
                // A video's `url` points at the clip itself — paper cannot
                // play it, so the poster frame is what's drawn. No poster
                // means no thumbnail was ever generated for this one; it
                // prints the same "unavailable" placeholder a broken photo
                // would, rather than a link nobody reading a page can follow.
                const src = video ? photo.thumbnailUrl : photo.url;
                return (
                  <figure key={photo.id}>
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={photo.note ?? room.name} />
                    ) : (
                      <div className="missing">{t.photoUnavailable}</div>
                    )}
                    {/* Two chips on the frame, theirs exactly: the room, then
                        which number it is. A caption printed under a tile is
                        attached to it by proximity alone, and proximity breaks
                        the moment the page is cropped, screenshotted or pasted
                        into an email — a chip on the image travels with the
                        image. The note, when there is one, gets a third in a
                        quieter colour so it never competes with the two that
                        identify the photograph. */}
                    <figcaption>
                      <span className="chip">{room.name}</span>
                      <span className="chip">
                        {video
                          ? t.videoNumber(numbers.get(photo.id) ?? 0)
                          : t.photoNumber(numbers.get(photo.id) ?? 0)}
                      </span>
                      {photo.note && <span className="chip note">{photo.note}</span>}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
            <PageFoot
              n={roomPages.get(room.id)?.photos[index] ?? 0}
              of={totalPages}
              company={company}
              t={t}
            />
          </section>
          );
        })}
        </Fragment>
      ))}

      {/* ------------------------------- this apartment's priced lines
          The end of the unit's section, and the reason for the section:
          having read this unit's rooms and looked at this unit's
          photographs, the reader is handed this unit's money before
          anything about the next one appears. The grand sommaire is NOT
          here — it belongs to the document and prints once, after the last
          unit and the project-level lines. */}
      {section.unit && unitEstimatePages.has(section.unit) && estimate && (
        <section className="page">
          <Running project={project.name} address={property} totals={headerTotals} identity={identity} />
          <p className="marker">{t.estimate} — {unitLabel}</p>
          <ReportEstimateTable
            lines={estimateGroups?.units.get(section.unit)?.lines ?? []}
            startIndex={estimateGroups?.units.get(section.unit)?.startIndex ?? 0}
            subtotalUnit={section.unit}
            trailer={estimate.trailer}
            locale={locale}
          />
          <PageFoot
            n={unitEstimatePages.get(section.unit) ?? 0}
            of={totalPages}
            company={company}
            t={t}
          />
        </section>
      )}
        </Fragment>
        );
      })}

      {/* ------------------------------------------------ drying record */}
      {!floorsOnly && equipment.length > 0 && (
        <section className="page">
          <Running project={project.name} address={property} totals={headerTotals} identity={identity} />
          <table className="listing">
            <thead>
              <tr>
                <th>{t.equipment}</th>
                <th className="num">{t.quantity}</th>
                <th>{t.inService}</th>
                <th>{t.outOfService}</th>
                <th className="num">{t.unitDays}</th>
              </tr>
            </thead>
            <tbody>
              {equipment.map((item) => (
                <tr key={item.id}>
                  <td>{item.kind}</td>
                  <td className="num">{item.quantity}</td>
                  <td>{date(item.in_service_at)}</td>
                  <td>{item.out_of_service_at ? date(item.out_of_service_at) : t.stillOnSite}</td>
                  <td className="num">{unitDays(item, now)}</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={4}>{t.total}</td>
                <td className="num">
                  {equipment.reduce((sum, item) => sum + unitDays(item, now), 0)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="fineprint">
            {t.equipmentNote(date(generatedAt))}
          </p>
          {/* This page and the definitions page printed no footer at all —
              no disclaimer, no page number — which made them read as
              something stapled on rather than as part of the document. */}
          <PageFoot n={equipmentPage ?? 0} of={totalPages} company={company} t={t} />
        </section>
      )}

      {/* ------------------------------------------------ takeoff & estimate
          Templates H/I (`Docs/Report-Estimate-Blueprint.md`) — the priced
          scope, printed as part of the document instead of handed over as a
          separate file. See `ReportEstimateTable`. */}
      {estimatePage !== null && estimate && (
        <section className="page">
          <Running project={project.name} address={property} totals={headerTotals} identity={identity} />
          <p className="marker">{t.estimate}</p>
          {/* **What is left, and the sommaire.** Ungrouped, "what is left"
              is the whole devis and this is the page it has always been.
              Sectioned, the apartments have already printed their own lines
              and their own sous-totaux, so what remains here is the work
              that belongs to no single door — débris, nettoyage final,
              frais généraux — and then the document's one grand total. */}
          <ReportEstimateTable
            lines={estimateGroups?.project.lines ?? []}
            startIndex={estimateGroups?.project.startIndex ?? 0}
            totals={estimate.totals}
            trailer={estimate.trailer}
            locale={locale}
          />
          <PageFoot n={estimatePage} of={totalPages} company={company} t={t} />
        </section>
      )}

      {/* ------------------------------------------------ signature page */}
      {/* The reference ends on one, and it is not decoration: a report
          nobody signed is a report nobody agreed to. Four labelled blanks,
          exactly theirs — signature, date, printed name, phone. */}
      <section className="page signature">
        <Running project={project.name} address={property} totals={headerTotals} identity={identity} />
        <p className="fineprint">
          {t.signingAcknowledges}
        </p>
        <div className="signature-grid">
          {[t.signature, t.signatureDate, t.printedFullName, t.phone].map((label) => (
            <div key={label}>
              <div className="rule" />
              <span>{label}</span>
            </div>
          ))}
        </div>
        <PageFoot n={signaturePage} of={totalPages} company={company} t={t} />
      </section>

      {/* --------------------------------------- measurement definitions */}
      {/* An adjuster-facing document must state its definitions: when their
          figure differs from ours, the definition is the whole argument.
          These are the same definitions the app shows beside each figure —
          MEASURE_DEFINITIONS is one list, so the report cannot drift from
          the screens. */}
      {!floorsOnly && rooms.length > 0 && (
        <section className="page">
          <Running project={project.name} address={property} totals={headerTotals} identity={identity} />
          <table className="measure definitions">
            <tbody>
              {Object.values(measureDefinitions(locale)).map((meaning) => (
                <tr key={meaning.id}>
                  <th>{meaning.title}</th>
                  <td>{meaning.definition}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fineprint">
            {t.measurementNote}
          </p>
          <PageFoot n={definitionsPage ?? 0} of={totalPages} company={company} t={t} />
        </section>
      )}
    </article>
  );
}

/**
 * One surface's affected area, totalled.
 *
 * Nothing recorded on that surface prints nothing at all — an empty table
 * headed "affected wall area" reads as a wall that was checked and found
 * dry, which is a claim this report has no basis to make. `count` is what
 * decides that, not the square metres: a recorded patch measuring nothing is
 * still a recorded patch, and printing no table for it would say the surface
 * was never marked.
 *
 * One row, because there is no longer anything to break it down BY. It was a
 * row per damage cause until the cause came out of this document; the header
 * and the figure are what survived, and they read as the same one-column
 * `stats` table the gross wall area above it is set in.
 */
function DamageTotals({
  locale,
  title,
  total,
}: {
  locale: Locale;
  title: string;
  total: { count: number; sqm: number };
}) {
  if (total.count === 0) return null;
  return (
    <table className="stats damage">
      <thead>
        <tr>
          <th>{title}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          {/* METRIC, like every other figure in this document. This table
              was still printing square feet while the running header above
              it said m² — the same "two places, two rules" fault the room
              table had, and missed when that one was fixed. An adjuster
              reading 29 next to 113.12 m² has to work out which unit is
              which, and on a claim that is not a cosmetic problem. */}
          <td>{formatArea(locale, total.sqm)}</td>
        </tr>
      </tbody>
    </table>
  );
}

/**
 * A run of label-and-value figures.
 *
 * **The reference prints these as one grey string** — `WIDTH: 5.205 m •
 * LENGTH: 3.300 m • …` — where the label and the measurement carry the same
 * weight and colour, so the eye has to read the words to find the numbers.
 * Splitting them lets the labels recede to a small letterspaced grey and the
 * figures lead in the document's own ink, which is how a technical sheet is
 * set. Same words, same order, same line; a reader looking for the area now
 * finds it without reading.
 */
function Figures({
  pairs,
  align = "left",
}: {
  pairs: [string, string][];
  /** Their room page sets these hard right, opposite the room's name. */
  align?: "left" | "right";
}) {
  return (
    <p className={align === "right" ? "figures figures-right" : "figures"}>
      {pairs.map(([label, value]) => (
        <span className="figure" key={label}>
          <span className="k">{label}</span>
          <span className="v">{value}</span>
        </span>
      ))}
    </p>
  );
}

/** The band that identifies the claim on every page after the cover. */
function Running({
  project,
  address,
  totals,
  identity,
}: {
  project: string;
  address: string | null;
  totals: string;
  /** Claim number, insured, loss date, category and class — joined upstream,
      empty when the job has no claim attached. */
  identity: string;
}) {
  // **The reference's header, duplicated.** Three lines on every page from
  // two onward: the project, the full address on ONE line, and the running
  // totals. Read straight off his own 19-page export.
  //
  // Both areas are printed on every page there — total AND living — which
  // is why the living-area figure has to reach the report rather than only
  // the phone.
  return (
    <header className="running">
      <div>
        {/* The claim leads, because it is what the page has to be filed
            under. An adjuster working several losses at once flips a page
            out of order and needs to know whose it is before they read a
            single measurement — the project name alone does not say that.
            Hidden entirely on a job with no claim attached, where it would
            be an empty rule taking a line on thirty pages. */}
        {identity && <div className="running-claim">{identity}</div>}
        <div className="running-project">{project}</div>
        {address && <div className="running-address">{address}</div>}
        <div className="running-totals">{totals}</div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/renovision-logo.png" alt="" className="brand-mark" />
    </header>
  );
}

/**
 * The foot of every page: the disclaimer, then `Page n/N`.
 *
 * Theirs names Sensopia because it is their software. Ours names this
 * company, because a disclaimer is only worth anything if it says who is
 * disclaiming — and putting a competitor's name in the foot of our report
 * would be absurd.
 */
function PageFoot({
  n,
  of,
  company,
  t,
}: {
  n: number;
  of: number;
  company: CompanySetting;
  t: ReportStrings;
}) {
  return (
    <footer className="page-foot">
      <p>{t.disclaimer((company.tradeName || company.legalName || "").toUpperCase())}</p>
      <span>{t.page(n, of)}</span>
    </footer>
  );
}
