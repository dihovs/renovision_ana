import { Fragment } from "react";
import FloorPlan from "./FloorPlan";
import { RoomElevations } from "./WallElevation";
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
function ScaleBar({ metresWide, pixelsWide }: { metresWide: number; pixelsWide: number }) {
  if (!(metresWide > 0) || !(pixelsWide > 0)) return null;
  // **The BAR is `FloorPlan`'s, not ours.** It has drawn a ticked scale in
  // feet since long before this, and the first version of this component
  // printed a second one underneath — two scale bars under one drawing,
  // which is worse than none: a reader has to work out which to trust.
  // What was genuinely missing is the RATIO, so that is all this prints.

  // A printed page is 96 CSS px to the inch, and an inch is 25.4mm, so the
  // ratio is metres-on-paper against metres-in-the-world.
  const metresOnPaper = (pixelsWide / 96) * 0.0254;
  const ratio = Math.round(metresWide / metresOnPaper);

  return (
    <div className="scalebar">
      <span>Scale 1:{ratio}</span>
    </div>
  );
}

/** Six to a page, two columns — the reference's own grid. */
const PHOTOS_PER_PAGE = 6;

/** A room's bounding extent — what the reference calls WIDTH and LENGTH. */
/**
 * The floor's own LABEL, not the id stored against a room.
 *
 * `room_scans.level` stores `2nd`; `2nd Floor` is what a person calls it.
 * The report printed the id, so a page headed "▼ 2nd" read as a fragment.
 * One vocabulary, `floors.ts`, decides both.
 */
function floorLabel(level: string): string {
  return FLOOR_LEVELS.find((entry) => entry.id === level)?.label ?? level;
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
const m2 = (sqm: number) => `${sqm.toFixed(2)} m²`;
const m = (metres: number) => `${metres.toFixed(3)} m`;

const sqft = (sqm: number) => Math.round(squareMetersToSquareFeet(sqm)).toLocaleString("en-CA");
const ft = (m: number) => Math.round(metersToFeet(m)).toLocaleString("en-CA");

function date(iso: string | null | undefined): string {
  if (!iso) return "—";
  const bare = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return new Date(bare ? `${iso}T12:00:00` : iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(bare ? {} : { timeZone: "America/Toronto" }),
  });
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
  } = data;
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
  const wallAreaSqm = rooms.reduce(
    (sum, room) => sum + room.wallLengthM * room.ceilingHeightM,
    0,
  );

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
  const photoPageCount = rooms.reduce((sum, room) => sum + photoPages(room).length, 0);
  const totalPages = floorsOnly
    ? 1 + levels.length + 1
    : 1 // cover
      + (shownClaim.length > 0 || client ? 1 : 0)
      + levels.length
      + rooms.length
      + photoPageCount
      + (damage.floor.length + damage.wall.length > 0 ? 1 : 0)
      + (rooms.some((room) => room.readings.length > 0) ? 1 : 0)
      + (equipment.length > 0 ? 1 : 0)
      + 1 // signature
      + 1; // definitions
  let pageNo = 0;
  const nextPage = () => ++pageNo;

  // The three-line header the reference repeats on every page from two.
  // A bathroom by its type, however the operator spelled it. `room_type`
  // is a free-ish string and "Bathroom", "bathroom" and "Full bathroom"
  // are all the same room to somebody pricing one.
  const bathroomCount = rooms.filter((room) =>
    (room.roomType ?? "").toLowerCase().includes("bath"),
  ).length;

  const headerTotals = [
    `TOTAL AREA: ${m2(floorAreaSqm)}`,
    `LIVING AREA: ${m2(livingAreaSqm)}`,
    `FLOORS: ${levels.length}`,
    `ROOMS: ${rooms.length}`,
  ].join(" • ");

  return (
    <article className="report">
      {/* ---------------------------------------------------- cover */}
      <section className="page cover">
        <header className="cover-head">
          <div>
            <h1>{project.name}</h1>
            {property && <p className="addr">{property}</p>}
          </div>
          <div className="brand">
            <strong>{company.tradeName || company.legalName}</strong>
            {company.rbqLicence && <span>RBQ {company.rbqLicence}</span>}
          </div>
        </header>

        {/* **Their four cover figures, in their order.** Total area,
            Floors, Rooms — and BATHROOM, which is a room TYPE counted
            separately on the cover. An odd choice until you price a job:
            bathrooms carry the plumbing, the tile and the fan, and an
            adjuster reading a cover wants to know how many before anything
            else. We store `room_type`, so we can answer it. */}
        <div className="cover-figures">
          {[
            ["Total area", m2(floorAreaSqm)],
            ["Floors", String(levels.length)],
            ["Rooms", String(rooms.length)],
            ["Bathroom", String(bathroomCount)],
          ].map(([label, value]) => (
            <div key={label}>
              <span className="figure-value">{value}</span>
              <span className="figure-label">{label}</span>
            </div>
          ))}
        </div>

        <div className="cover-grid">
          <dl>
            <dt>Insured</dt>
            <dd>{client?.name ?? "—"}</dd>
            <dt>Property</dt>
            <dd>{property ?? "—"}</dd>
            <dt>Work started</dt>
            <dd>{date(project.started_on)}</dd>
            <dt>Report prepared</dt>
            <dd>{date(generatedAt)}</dd>
          </dl>

          <dl>
            {shownClaim.length === 0 ? (
              <>
                <dt>Claim details</dt>
                <dd className="muted">Not recorded</dd>
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

        {/* Wall area alone here: floor area, floors and rooms are already
            in the four figures above, and printing them twice on one cover
            — as this did — makes a reader check whether the two agree. */}
        <table className="stats">
          <thead>
            <tr>
              {/* Named gross so the definitions appendix maps onto it. */}
              <th>Wall area (gross)</th>
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
        <DamageTotals title="Affected floor area by cause" totals={damage.floor} />
        <DamageTotals title="Affected wall area by cause" totals={damage.wall} />

        {project.description && <p className="desc">{project.description}</p>}

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
          <span>{company.phone}</span>
        </footer>
      </section>

      {/* ------------------------------------------- one page per floor */}
      {levels.map((level) => {
        const onLevel = rooms.filter((room) => room.level === level);
        if (onLevel.length === 0) return null;
        const levelArea = onLevel.reduce((sum, room) => sum + room.floorAreaSqm, 0);

        return (
          <section className="page" key={level}>
            <Running project={project.name} address={property} totals={headerTotals} />
            <p className="totals">
              ▼ {floorLabel(level)} — {m2(levelArea)} · {onLevel.length} room
              {onLevel.length === 1 ? "" : "s"}
            </p>
            <div className="plan-grid">
              {onLevel.map((room) => (
                <figure key={room.id}>
                  <div className="plan">
                    <FloorPlan result={room.geometry} name={room.name} variant="thumb" />
                  </div>
                  <figcaption>
                    {/* Their caption: name, area, and the extent in
                        brackets under it. */}
                    <strong>{room.name}</strong>
                    <span>
                      {m2(room.floorAreaSqm)} ({m(planExtent(room.geometry).width)} ×{" "}
                      {m(planExtent(room.geometry).height)})
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
            <PageFoot n={nextPage()} of={totalPages} company={company} />
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
          <p className="marker">▼ {room.name}</p>
          <p className="marker-sub">{floorLabel(room.level)}</p>
          <p className="figures">
            WIDTH: {m(planExtent(room.geometry).width)} • LENGTH:{" "}
            {m(planExtent(room.geometry).height)} • CEILING HEIGHT:{" "}
            {m(room.ceilingHeightM)}
          </p>
          <p className="figures">
            AREA: {m2(room.floorAreaSqm)} • PERIMETER: {m(room.wallLengthM)}
          </p>

          {/* **The locator**: this room picked out in its own floor, so a
              reader knows WHERE the drawing they are looking at sits. A
              room page without one is a rectangle with no address — and an
              adjuster reading nine of them in a row has no way to tell the
              2nd bedroom from the 3rd except by the label. */}
          {roomsOnLevel(rooms, room.level).length > 1 && (
            <div className="locator">
              {/* Every room on the storey at thumbnail size, THIS one
                  filled. Not a packed floor plan: the report has no
                  positions for rooms measured on separate visits, and
                  drawing a floor whose rooms are placed by guesswork would
                  be inventing a building. A row of outlines with one picked
                  out says exactly what it knows and nothing more. */}
              {roomsOnLevel(rooms, room.level).map((other) => (
                <figure
                  key={other.id}
                  className={other.id === room.id ? "here" : undefined}
                >
                  <FloorPlan result={other.geometry} name={other.name} variant="thumb" />
                </figure>
              ))}
              <figcaption>{floorLabel(room.level)} — this room shaded</figcaption>
            </div>
          )}

          <div className="room-body">
            {/* Wrapped so the plan and its note share one grid cell. */}
            <div>
              <div className="plan large">
                <FloorPlan
                  result={room.geometry}
                  name={room.name}
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
                  Only dimensions that were set by hand are shown on this plan.
                  A room with none shows no dimensions.
                </p>
              )}
              {/* 620px is what `.plan.large` is given in report.css; the
                  drawing is fitted to it, so that is the width the ratio is
                  computed against. */}
              <ScaleBar metresWide={planWidthM(room.geometry)} pixelsWide={620} />
            </div>

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
                          {DAMAGE_LABEL[area.damage_type] ?? area.damage_type}
                          {area.surface === "wall" ? " · wall" : " · floor"}
                        </span>
                      </td>
                    </tr>
                    ))}
                </tbody>
              </table>
            )}

            <table className="measure">
              <tbody>
                <tr>
                  <th>Floor</th>
                  <td className="num">{m2(room.floorAreaSqm)}</td>
                </tr>
                <tr>
                  <th>Wall area (gross)</th>
                  <td className="num">{m2(room.wallLengthM * room.ceilingHeightM)}</td>
                </tr>
                <tr>
                  <th>Perimeter</th>
                  <td className="num">{m(room.wallLengthM)}</td>
                </tr>
                <tr>
                  <th>Ceiling height</th>
                  <td className="num">{m(room.ceilingHeightM)}</td>
                </tr>
                {room.stairCount > 0 && (
                  <tr>
                    <th>Staircase</th>
                    <td className="num">
                      {room.stairCount} — priced separately, not in the floor area
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {room.areas.length > 0 && (
            /* Floor rows first, then the walls in wall order — and every row
               says which surface it measured. Without that column the table
               puts 40 sq ft of floor and 40 sq ft of wall in the same column
               under the same heading, and the two are priced by different
               trades. */
            <table className="listing">
              <thead>
                <tr>
                  <th>Affected area</th>
                  <th>Surface</th>
                  <th>Cause</th>
                  <th className="num">Measured</th>
                </tr>
              </thead>
              <tbody>
                {[...floorAreas(room.areas), ...wallAreas(room.areas)].map((area) => (
                  <tr key={area.id}>
                    <td>
                      <span className="swatch" style={{ background: areaColor(area) }} />
                      {area.name}
                    </td>
                    <td>
                      {area.surface === "wall"
                        ? `Wall ${(area.wall_index ?? 0) + 1}`
                        : "Floor"}
                    </td>
                    <td>{DAMAGE_LABEL[area.damage_type]}</td>
                    <td className="num">{sqft(Number(area.area_sqm))} sq ft</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* The damaged walls, seen straight on. The plan above cannot show
              them: it is a view from overhead, where a wall is a line with no
              height, and the height is the whole of what was marked. */}
          <RoomElevations
            corners={planCorners(toFloorPlan(room.geometry))}
            ceilingHeightM={room.ceilingHeightM}
            areas={wallAreas(room.areas)}
            wallFlags={room.wallDisplayElevation}
          />

          {room.readings.length > 0 && (
            <table className="listing">
              <thead>
                <tr>
                  <th>Reading</th>
                  <th>Location</th>
                  <th>Material</th>
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

          {/* The photos are NOT here. They follow, on their own pages —
              see below. What stays is the pointer the reference prints, so
              a reader on the plan page knows they exist and where. */}
          {room.photos.length > 0 && (
            <>
              <p className="marker">▼ {room.name}/{room.level}</p>
              <p className="photo-pointer">
                Photos — {room.photos.length}{" "}
                {room.photos.length === 1 ? "Photo" : "Photos"} (see photos page)
              </p>
            </>
          )}
          <PageFoot n={nextPage()} of={totalPages} company={company} />
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
            {/* Their section marker: `▼ Photos/1st bedroom`. */}
            <p className="marker">▼ Photos/{room.name}</p>
            <div className="photo-grid">
              {batch.map((photo, offset) => (
                <figure key={photo.id}>
                  {photo.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.url} alt={photo.note ?? room.name} />
                  ) : (
                    <div className="missing">Photo unavailable</div>
                  )}
                  <figcaption>
                    {room.name} Photo {index * PHOTOS_PER_PAGE + offset + 1}
                    {photo.note ? ` — ${photo.note}` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
            <PageFoot n={nextPage()} of={totalPages} company={company} />
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
                <th>Equipment</th>
                <th className="num">Qty</th>
                <th>In service</th>
                <th>Out of service</th>
                <th className="num">Unit-days</th>
              </tr>
            </thead>
            <tbody>
              {equipment.map((item) => (
                <tr key={item.id}>
                  <td>{item.kind}</td>
                  <td className="num">{item.quantity}</td>
                  <td>{date(item.in_service_at)}</td>
                  <td>{item.out_of_service_at ? date(item.out_of_service_at) : "Still on site"}</td>
                  <td className="num">{unitDays(item, now)}</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={4}>Total</td>
                <td className="num">
                  {equipment.reduce((sum, item) => sum + unitDays(item, now), 0)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="fineprint">
            Equipment is billed per unit per day on site. The day of delivery
            and the day of collection are both counted. Units shown as still on
            site are counted to {date(generatedAt)}.
          </p>
        </section>
      )}

      {/* ------------------------------------------------ signature page */}
      {/* The reference ends on one, and it is not decoration: a report
          nobody signed is a report nobody agreed to. Four labelled blanks,
          exactly theirs — signature, date, printed name, phone. */}
      <section className="page signature">
        <Running project={project.name} address={property} totals={headerTotals} />
        <p className="fineprint">
          Signing acknowledges that the areas, measurements and photographs in
          this report were taken at the property on the dates shown.
        </p>
        <div className="signature-grid">
          {["Signature", "Signature date", "Printed full name", "Phone"].map((label) => (
            <div key={label}>
              <div className="rule" />
              <span>{label}</span>
            </div>
          ))}
        </div>
        <PageFoot n={nextPage()} of={totalPages} company={company} />
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
            All measurements are taken in metres and converted for display.
            Figures in this report are rounded to the foot and the square foot.
          </p>
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
  title,
  totals,
}: {
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
              {DAMAGE_LABEL[type]}
            </td>
            <td className="num">{sqft(sqm)} sq ft</td>
          </tr>
        ))}
      </tbody>
    </table>
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
      <div className="running-project">{project}</div>
      {address && <div className="running-address">{address}</div>}
      <div className="running-totals">{totals}</div>
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
function PageFoot({ n, of, company }: { n: number; of: number; company: CompanySetting }) {
  return (
    <footer className="page-foot">
      <p>
        THIS FLOOR PLAN IS PROVIDED WITHOUT WARRANTY OF ANY KIND.{" "}
        {(company.tradeName || company.legalName || "").toUpperCase()} DISCLAIMS ANY
        WARRANTY INCLUDING, WITHOUT LIMITATION, SATISFACTORY QUALITY OR ACCURACY OF
        DIMENSIONS.
      </p>
      <span>
        Page {n}/{of}
      </span>
    </footer>
  );
}
