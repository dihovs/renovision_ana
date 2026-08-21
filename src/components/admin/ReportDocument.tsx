import { Fragment } from "react";
import { CauseTag, PlanLegend } from "./ReportSymbols";
import {
  REPORT_STRINGS,
  formatArea,
  formatBare,
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
  squareMetersToSquareFeet,
  metersToFeet,
  toFloorPlan,
  type ScanGeometry,
} from "@/lib/roomScan";
import { MEASURE_DEFINITIONS } from "@/lib/crm/measureDefinitions";
import { FLOOR_LEVELS } from "@/lib/crm/floors";
import {
  areaColor,
  damageLabel,
  floorAreas,
  totalsBySurface,
  wallAreas,
  DAMAGE_LABEL,
  type AffectedArea,
  type DamageType,
} from "@/lib/crm/areaShapes";
import { unitDays, type EquipmentPlacement, type MoistureReading } from "@/lib/crm/dryingLog";
import type { CompanySetting, CustomFieldDef } from "@/lib/crm/settings";
import { isFieldVisible } from "@/lib/crm/settings";

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
  photos: { id: string; url: string | null; note: string | null }[];
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
   */
  layout?: "full" | "onlyFloors";
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
function floorLabel(level: string, t: ReportStrings): string {
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

function planExtent(geometry: ScanGeometry): { width: number; height: number } {
  const plan = toFloorPlan(geometry);
  return { width: plan.width, height: plan.height };
}

/** How wide a room's drawing is, in metres — what a scale ratio is against. */
function planWidthM(geometry: ScanGeometry): number {
  const plan = toFloorPlan(geometry);
  return plan.width > 0 ? plan.width : 0;
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


const sqft = (sqm: number) => Math.round(squareMetersToSquareFeet(sqm)).toLocaleString("en-CA");
const ft = (m: number) => Math.round(metersToFeet(m)).toLocaleString("en-CA");


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
  } = data;
  const t = REPORT_STRINGS[locale];
  // Every figure in the document goes through these, so a French report
  // prints `78,64 m²` rather than `78.64 m²`. On a page that is mostly
  // numbers, getting that wrong is most of the page.
  const m2 = (sqm: number) => formatArea(locale, sqm);
  const m = (metres: number) => formatLength(locale, metres);
  const date = (iso: string | null | undefined) => formatDate(locale, iso);
  const floorsOnly = layout === "onlyFloors";

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

  // By cause, never one grand total: causes do not share a trade or a rate,
  // and areas may overlap, so a single sum would double-count the square
  // footage that is both wet and smoke-stained.
  //
  // And by surface, for the same reason one step out. Floor square footage
  // and wall square footage are different trades at different rates; added
  // together they price neither. An adjuster reading one merged figure
  // cannot check it against anything.
  const damage = totalsBySurface(rooms.flatMap((room) => room.areas));

  const now = new Date(generatedAt);
  const shownClaim = claimFields.filter(
    (field) => isFieldVisible(field, claim) && claim[field.id]?.trim(),
  );

  // The strip that identifies the file on every single page. An adjuster
  // reviewing a thirty-page PDF flips pages out of order; a page that cannot
  // say which claim it belongs to is a page that gets set aside.
  const identity = [
    claim.claim_number && `CLAIM ${claim.claim_number}`,
    client?.name,
    claim.loss_date && `LOSS ${date(claim.loss_date)}`,
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

  // Only the causes this job actually has. A legend listing five kinds of
  // damage on a job with one is a legend nobody reads twice.
  const causesInUse = Array.from(
    new Set(rooms.flatMap((room) => room.areas.map((area) => area.damage_type))),
  );

  // The rooms the cover's key plan draws: the first storey, and only the
  // ones whose walls actually closed into an outline. A scan that stopped
  // short has no shape to show and would print as a stray line.
  const coverPlanRooms = rooms
    .filter((room) => room.level === levels[0])
    .filter((room) => toFloorPlan(room.geometry).polygon.length >= 3)
    .slice(0, 6);

  // Everything that used to crowd the cover now has a page of its own, and
  // that page only exists when it has something on it.
  const hasSummary =
    shownClaim.length > 0 ||
    client !== null ||
    damage.floor.length + damage.wall.length > 0 ||
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
  const plan: { kind: string; label: string; sub?: string; page: number }[] = [];
  const push = (kind: string, label: string, sub?: string) => {
    plan.push({ kind, label, sub, page: plan.length + 1 });
    return plan.length;
  };

  const coverPage = push("cover", project.name);
  const summaryPage = !floorsOnly && hasSummary ? push("summary", "Summary") : null;
  const contentsPage = !floorsOnly && rooms.length > 1 ? push("contents", "Contents") : null;

  const levelPages = new Map<string, number>();
  for (const level of levels) {
    if (!rooms.some((room) => room.level === level)) continue;
    levelPages.set(level, push("level", floorLabel(level, t)));
  }

  const roomPages = new Map<string, { page: number; photos: number[] }>();
  if (!floorsOnly) {
    for (const room of rooms) {
      const page = push("room", room.name, floorLabel(room.level, t));
      const photos = photoPages(room).map((_, index) =>
        push("photos", `Photos — ${room.name}`, `${index + 1}`),
      );
      roomPages.set(room.id, { page, photos });
    }
  }

  const equipmentPage =
    !floorsOnly && equipment.length > 0 ? push("equipment", "Drying record") : null;
  const signaturePage = push("signature", "Signature");
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
              {floorLabel(levels[0], t)} — {coverPlanRooms.length} room
              {coverPlanRooms.length === 1 ? "" : "s"}
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
          <Running project={project.name} address={property} totals={headerTotals} />
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

          {/* Two tables, never one. Named by surface, not just "affected
              area": both of these are affected area, and an adjuster must be
              able to tell which surface a figure priced. */}
          <DamageTotals locale={locale} title={t.affectedFloorByCause} totals={damage.floor} />
          <DamageTotals locale={locale} title={t.affectedWallByCause} totals={damage.wall} />
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
          <Running project={project.name} address={property} totals={headerTotals} />
          <p className="marker">{t.contents}</p>
          <ul className="contents">
            {plan
              .filter((entry) => entry.kind !== "cover" && entry.kind !== "contents")
              .map((entry) => (
                <li
                  key={`${entry.kind}-${entry.page}`}
                  className={`contents-${entry.kind}`}
                >
                  <span className="contents-label">
                    {entry.label}
                    {entry.sub && entry.kind === "room" && (
                      <span className="contents-sub"> · {entry.sub}</span>
                    )}
                  </span>
                  <span className="lead" />
                  <span className="contents-page">{entry.page}</span>
                </li>
              ))}
          </ul>
          <PageFoot n={contentsPage} of={totalPages} company={company} t={t} />
        </section>
      )}

      {/* ------------------------------------------- one page per floor */}
      {levels.map((level) => {
        const onLevel = rooms.filter((room) => room.level === level);
        if (onLevel.length === 0) return null;
        const levelArea = onLevel.reduce((sum, room) => sum + room.floorAreaSqm, 0);

        return (
          <section className="page" key={level}>
            <Running project={project.name} address={property} totals={headerTotals} />
            <div className="section-head">
              <p className="marker">{floorLabel(level, t)}</p>
              <Figures
                pairs={[
                  ["TOTAL AREA", m2(levelArea)],
                  ["ROOMS", String(onLevel.length)],
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
                areas: room.areas
                  .filter((area) => area.surface !== "wall" && area.polygon.length >= 3)
                  .map((area) => ({
                    id: area.id,
                    polygon: area.polygon,
                    color: areaColor(area),
                  })),
              }))}
            />
            <PlanLegend causes={causesInUse} locale={locale} t={t} />
            <PageFoot n={levelPages.get(level) ?? 0} of={totalPages} company={company} t={t} />
          </section>
        );
      })}

      {/* --------------------------------------------- one page per room */}
      {!floorsOnly && rooms.map((room) => (
        <Fragment key={room.id}>
        <section className="page">
          <Running project={project.name} address={property} totals={headerTotals} />

          {/* The reference's own two lines above the drawing, in its own
              order and wording: the room and its storey, then the figures
              on two rows. `WIDTH` and `LENGTH` are the drawing's extent,
              not the longest wall — which is why an L-shaped room's width
              is bigger than any single wall it has. */}
          <div className="section-head">
            <div>
              <p className="marker">{room.name}</p>
              <p className="marker-sub">{floorLabel(room.level, t)}</p>
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

          <div className="room-body">
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
            {roomsOnLevel(rooms, room.level).length > 1 && (
              <div className="locator">
                <ReportStoreyPlan
                  locale={locale}
                  highlight={room.id}
                  rooms={roomsOnLevel(rooms, room.level).map((other) => ({
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
              <div className="plan large">
                <FloorPlan
                  result={room.geometry}
                  name={room.name}
                  locale={locale}
                  objects={room.objects}
                  dimensions={onlyLockedDimensions ? "locked" : "all"}
                  // Floor areas only — a wall area's polygon is in its
                  // wall's own face space and belongs on the elevation.
                  areas={room.areas
                    .filter((area) => area.surface !== "wall" && area.polygon.length >= 3)
                    .map((area) => ({
                      id: area.id,
                      polygon: area.polygon,
                      color: areaColor(area),
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
                  {room.areas
                    .filter((area) => area.surface !== "wall" && area.polygon.length >= 3)
                    .map((area, index) => (
                    <tr key={area.id}>
                      <th>
                        <span
                          className="badge"
                          style={{ background: areaColor(area) }}
                        >
                          {index + 1}
                        </span>
                        {area.name}
                      </th>
                      <td className="num">
                        {m2(Number(area.area_sqm))}
                        <span className="cause">
                          {" "}
                          {damageLabel(area.damage_type, locale)}
                          {area.surface === "wall" ? " · wall" : " · floor"}
                        </span>
                      </td>
                    </tr>
                    ))}
                </tbody>
              </table>
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

          {room.readings.length > 0 && (
            <table className="listing">
              <thead>
                <tr>
                  <th>{t.reading}</th>
                  <th>{t.location}</th>
                  <th>{t.material}</th>
                  <th className="num">MC</th>
                  <th className="num">RH</th>
                  <th className="num">Temp</th>
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

              One row is ours: `Cause`. Theirs has no equivalent because
              magicplan is not a restoration tool — but water, fire and mould
              are different trades at different rates, and an area whose
              cause is not stated cannot be priced. It is one more row in
              their own idiom, not a structure they do not have. */}
          {(room.photos.length > 0 || room.areas.length > 0) && (
            <>
              <p className="marker marker-2">{room.name} / {floorLabel(room.level, t)}</p>
              {room.photos.length > 0 && (
                <dl className="area-block">
                  <dt>{t.photos}</dt>
                  {/* `seePhotosPage` already carries the count — printing
                      `{length}` in front of it as well gave `7 7 photos`. */}
                  <dd>{t.seePhotosPage(room.photos.length)}</dd>
                </dl>
              )}
              {([
                ["FLOOR", floorAreas(room.areas)],
                ["WALL", wallAreas(room.areas)],
              ] as const).map(([surface, list]) =>
                list.length === 0 ? null : (
                  <Fragment key={surface}>
                    <p className="area-count">
                      {surface === "WALL"
                        ? t.affectedWallAreaCount(list.length)
                        : t.affectedFloorAreaCount(list.length)}
                      {list.length === 1 ? "" : "S"}
                    </p>
                    {list.map((area) => (
                      <div className="area-entry" key={area.id}>
                      <dl className="area-block">
                        <dt>{t.area}</dt>
                        <dd>{m2(Number(area.area_sqm))}</dd>
                        <dt>{t.name}</dt>
                        <dd>{area.name}</dd>
                        <dt>{t.cause}</dt>
                        <dd>
                          <CauseTag cause={area.damage_type} locale={locale} />
                        </dd>
                        {area.surface === "wall" && (
                          <>
                            <dt>{t.wall}</dt>
                            <dd>{(area.wall_index ?? 0) + 1}</dd>
                          </>
                        )}
                        {area.notes && (
                          <>
                            <dt>{t.notes}</dt>
                            <dd>{area.notes}</dd>
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
                      {area.surface === "wall" && area.wall_index !== null && (
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
        {photoPages(room).map((batch, index) => (
          <section className="page" key={`${room.id}-photos-${index}`}>
            <Running project={project.name} address={property} totals={headerTotals} />
            {/* Their section marker, without the glyph — see `.marker` in
                report.css for what replaced it. */}
            <p className="marker">{t.photosOf(room.name)}</p>
            <div className="photo-grid">
              {batch.map((photo, offset) => (
                <figure key={photo.id}>
                  {photo.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.url} alt={photo.note ?? room.name} />
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
                      {t.photoNumber(index * PHOTOS_PER_PAGE + offset + 1)}
                    </span>
                    {photo.note && <span className="chip note">{photo.note}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
            <PageFoot
              n={roomPages.get(room.id)?.photos[index] ?? 0}
              of={totalPages}
              company={company}
              t={t}
            />
          </section>
        ))}
        </Fragment>
      ))}

      {/* ------------------------------------------------ drying record */}
      {!floorsOnly && equipment.length > 0 && (
        <section className="page">
          <Running project={project.name} address={property} totals={headerTotals} />
          <table className="listing">
            <thead>
              <tr>
                <th>{t.equipment}</th>
                <th className="num">Qty</th>
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

      {/* ------------------------------------------------ signature page */}
      {/* The reference ends on one, and it is not decoration: a report
          nobody signed is a report nobody agreed to. Four labelled blanks,
          exactly theirs — signature, date, printed name, phone. */}
      <section className="page signature">
        <Running project={project.name} address={property} totals={headerTotals} />
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
          <Running project={project.name} address={property} totals={headerTotals} />
          <table className="measure definitions">
            <tbody>
              {Object.values(MEASURE_DEFINITIONS).map((meaning) => (
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
 * One surface's damage, totalled by cause.
 *
 * Nothing recorded on that surface prints nothing at all — an empty table
 * headed "affected wall area" reads as a wall that was checked and found
 * dry, which is a claim this report has no basis to make.
 */
function DamageTotals({
  locale,
  title,
  totals,
}: {
  locale: Locale;
  title: string;
  totals: { type: DamageType; sqm: number }[];
}) {
  if (totals.length === 0) return null;
  return (
    <table className="stats damage">
      <thead>
        <tr>
          <th colSpan={2}>{title}</th>
        </tr>
      </thead>
      <tbody>
        {totals.map(({ type, sqm }) => (
          <tr key={type}>
            <td>
              <span className="swatch" style={{ background: areaColor({ color: null, damage_type: type }) }} />
              {damageLabel(type, locale)}
            </td>
            {/* METRIC, like every other figure in this document. This
                table was still printing square feet while the running
                header above it said m² — the same "two places, two rules"
                fault the room table had, and missed when that one was
                fixed. An adjuster reading 29 next to 113.12 m² has to work
                out which unit is which, and on a claim that is not a
                cosmetic problem. */}
            <td className="num">{formatArea(locale, sqm)}</td>
          </tr>
        ))}
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
}: {
  project: string;
  address: string | null;
  totals: string;
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
