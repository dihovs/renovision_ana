import { resolvePlacements } from "@/lib/floorLayout";
import { toFloorPlan, type FloorPlan, type ScanGeometry } from "@/lib/roomScan";
import PlanObjects, { type PlanObject } from "./PlanObjects";
import { formatArea, formatBare } from "@/lib/report/strings";
import type { Locale } from "@/i18n/translations";
import {
  DAMAGE_MARK_FILL,
  DAMAGE_MARK_LABEL,
  LOCATOR_INK_FILL,
  LOCATOR_PALE_FILL,
  LOCATOR_PALE_INK,
  PLAN_FILL,
  PLAN_INK,
  PLAN_LABEL,
  PLAN_LABEL_HALO,
  PLAN_RULE,
} from "./planPalette";

/**
 * A storey as ONE drawing.
 *
 * **What this replaces, and why it had to.** The report drew a floor as a
 * grid of separate room thumbnails, each in its own box with a caption
 * underneath. Put beside the reference's page 2 — a single connected
 * building, walls joined, doors swinging into the rooms they open, every
 * room labelled where it stands — the difference is not a matter of taste.
 * A grid of boxes says *here are nine rooms we measured*. A floor plan says
 * *here is the property*, and the second is the document an adjuster is
 * being asked to price.
 *
 * The arrangement is not invented here: `plan_x`/`plan_y` are what the
 * operator dragged on the phone's storey canvas, and `resolvePlacements` is
 * the same function that canvas uses. What he arranged is what prints.
 *
 * **Where a room has never been placed, this says so.** Rooms scanned on
 * separate visits carry no true relative position; the packer drops them
 * into free slots so nothing overlaps, and a slot is a layout, not a
 * measurement. Drawing an overall dimension across packed rooms would be
 * inventing a building — so the outer chain appears only when every room on
 * the storey was actually positioned, and a line under the drawing says
 * which case the reader is looking at.
 */

/** Wall thickness on the page, in plan metres. */
const T = 0.11;
/** The heavier cut face on each side of the wall body — the poché convention. */
const CUT = 0.022;

type StoreyRoom = {
  id: string;
  name: string;
  geometry: ScanGeometry;
  floorAreaSqm: number;
  planX: number | null;
  planY: number | null;
  areas: { id: string; polygon: { x: number; y: number }[]; color: string }[];
  /** The bath, the toilet, the counter run — what makes a floor plan a
      drawing of a property rather than of five empty rectangles. */
  objects?: PlanObject[];
};

/** **Set once per drawing, from the document's language.** A French report
    that labels a room `Cuisine` and then dimensions it `5.524` has only
    half-translated itself: the comma IS the decimal mark in French, and a
    page of figures is mostly figures. */
/**
 * **The document's language, threaded rather than stashed.**
 *
 * The first cut of this held the two formatters in module-level `let`s and
 * set them from the component. That works exactly until two reports render
 * at once — a French export and an English one on the same server — and then
 * whichever set them last formats both. Passing them down is a few more
 * characters and cannot go wrong.
 *
 * A French report that labels a room `Cuisine` and then dimensions it
 * `5.524` has only half-translated itself: the comma IS the decimal mark in
 * French, and a page of figures is mostly figures.
 */
type Format = { area: (sqm: number) => string; bare: (metres: number) => string };

function formatter(locale: Locale): Format {
  return {
    area: (sqm) => formatArea(locale, sqm),
    bare: (metres) => formatBare(locale, metres),
  };
}

/**
 * The wall band as one path, with each end extended half a thickness where
 * it meets another wall — which is what closes a corner square instead of
 * leaving a notch of white at every junction.
 */
function wallPath(plan: FloorPlan): string {
  const joints = plan.segments.flatMap((s) => [
    { x: s.x1, y: s.y1 },
    { x: s.x2, y: s.y2 },
  ]);
  const meetsAnother = (x: number, y: number) =>
    joints.filter((j) => Math.hypot(j.x - x, j.y - y) < 0.06).length > 1;

  return plan.segments
    .map((s) => {
      const dx = s.x2 - s.x1;
      const dy = s.y2 - s.y1;
      const length = Math.hypot(dx, dy) || 1;
      const ux = dx / length;
      const uy = dy / length;
      const e1 = meetsAnother(s.x1, s.y1) ? T / 2 : 0;
      const e2 = meetsAnother(s.x2, s.y2) ? T / 2 : 0;
      return `M ${s.x1 - ux * e1} ${s.y1 - uy * e1} L ${s.x2 + ux * e2} ${s.y2 + uy * e2}`;
    })
    .join(" ");
}


/** Is a point inside this ring? Ray casting, the usual way. */
function inside(point: { x: number; y: number }, ring: { x: number; y: number }[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      hit = !hit;
    }
  }
  return hit;
}

/**
 * The dimension chain, hugging the outside of the building.
 *
 * **Only the walls that face outdoors get one.** The reference runs its chain
 * around the outside of the floor and leaves the party walls between rooms
 * bare, and the reason is legibility: a nine-room storey has forty-odd wall
 * segments, and dimensioning every one buries the drawing under its own
 * numbers. Which wall is "outside" is not guessed — a wall is outer when a
 * point stepped off its face lands in no other room on the storey.
 *
 * The whole chain is suppressed when any room on the floor was never placed,
 * for the reason `ReportStoreyPlan` states: a packed slot is a layout, and
 * dimensions taken across one measure the packing.
 */
function OuterChain({
  rooms,
  fmt,
}: {
  rooms: { plan: FloorPlan; at: { x: number; y: number } }[];
  fmt: Format;
}) {
  /** How far off the wall the dimension line sits, in plan metres. */
  const OFFSET = 0.42;
  /** Below this a segment is a jamb return or a stub, not a wall worth a
      number — and its label would not fit beside it anyway. */
  const SHORTEST = 0.55;

  // Every room's outline in STOREY coordinates, which is what the
  // inside-test has to run against: a wall of the kitchen is only an outer
  // wall if no OTHER room is on the far side of it.
  const rings = rooms
    .filter((room) => room.plan.polygon.length >= 3)
    .map((room) => room.plan.polygon.map((p) => ({ x: p.x + room.at.x, y: p.y + room.at.y })));

  const marks: { x1: number; y1: number; x2: number; y2: number; label: string }[] = [];

  for (const room of rooms) {
    for (const segment of room.plan.segments) {
      const x1 = segment.x1 + room.at.x;
      const y1 = segment.y1 + room.at.y;
      const x2 = segment.x2 + room.at.x;
      const y2 = segment.y2 + room.at.y;
      const length = Math.hypot(x2 - x1, y2 - y1);
      if (length < SHORTEST) continue;

      const ux = (x2 - x1) / length;
      const uy = (y2 - y1) / length;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      // Which way is out? The normal whose step leaves this room's own
      // outline. A wall with no outline to test against is skipped rather
      // than guessed at.
      const step = 0.2;
      const candidates = [
        { nx: -uy, ny: ux },
        { nx: uy, ny: -ux },
      ];
      const own = rings[rooms.indexOf(room)];
      const out = own
        ? candidates.find(
            (n) => !inside({ x: midX + n.nx * step, y: midY + n.ny * step }, own),
          )
        : undefined;
      if (!out) continue;

      // An outer wall is one with nothing on the far side of it.
      const beyond = { x: midX + out.nx * step, y: midY + out.ny * step };
      if (rings.some((ring) => inside(beyond, ring))) continue;

      marks.push({
        x1: x1 + out.nx * OFFSET,
        y1: y1 + out.ny * OFFSET,
        x2: x2 + out.nx * OFFSET,
        y2: y2 + out.ny * OFFSET,
        label: fmt.bare(length),
      });
    }
  }

  // **Two faces of the same gap get one number.** Where rooms sit apart —
  // scanned separately, or genuinely separated by a chase — the wall on each
  // side of the gap is legitimately an outer wall, and both were being
  // dimensioned. The drawing then carries `3.900` twice, 200mm apart, which
  // reads as two different measurements that happen to agree.
  const kept: typeof marks = [];
  for (const mark of marks) {
    const midX = (mark.x1 + mark.x2) / 2;
    const midY = (mark.y1 + mark.y2) / 2;
    const near = kept.some((other) => {
      if (other.label !== mark.label) return false;
      const ox = (other.x1 + other.x2) / 2;
      const oy = (other.y1 + other.y2) / 2;
      return Math.hypot(ox - midX, oy - midY) < 1.1;
    });
    if (!near) kept.push(mark);
  }
  marks.length = 0;
  marks.push(...kept);

  if (marks.length === 0) return null;

  return (
    <g className="outer-chain" stroke={PLAN_RULE} fill="none">
      {marks.map((mark, index) => {
        const dx = mark.x2 - mark.x1;
        const dy = mark.y2 - mark.y1;
        const length = Math.hypot(dx, dy) || 1;
        const ux = dx / length;
        const uy = dy / length;
        const nx = -uy;
        const ny = ux;
        const midX = (mark.x1 + mark.x2) / 2;
        const midY = (mark.y1 + mark.y2) / 2;
        // Text always reads left-to-right and never upside down, which is
        // what the flip is for.
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (angle > 90 || angle < -90) angle += 180;
        return (
          <g key={index}>
            <line x1={mark.x1} y1={mark.y1} x2={mark.x2} y2={mark.y2} strokeWidth={0.012} />
            {[0, 1].map((end) => {
              const px = end === 0 ? mark.x1 : mark.x2;
              const py = end === 0 ? mark.y1 : mark.y2;
              return (
                <line
                  key={end}
                  x1={px - nx * 0.07}
                  y1={py - ny * 0.07}
                  x2={px + nx * 0.07}
                  y2={py + ny * 0.07}
                  strokeWidth={0.012}
                />
              );
            })}
            <text
              x={midX - nx * 0.13}
              y={midY - ny * 0.13}
              transform={`rotate(${angle} ${midX - nx * 0.13} ${midY - ny * 0.13})`}
              textAnchor="middle"
              fontSize={0.21}
              fill={PLAN_LABEL}
              stroke={PLAN_LABEL_HALO}
              strokeWidth={0.07}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {mark.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** One room, drawn where it stands. */
function Room({
  room,
  plan,
  at,
  areaStart,
  fmt,
  tone = "full",
}: {
  room: StoreyRoom;
  fmt: Format;
  plan: FloorPlan;
  at: { x: number; y: number };
  areaStart: number;
  /** `full` is the drawing. `pale` and `ink` are the locator's two states:
      the storey drawn faint with one room in black. */
  tone?: "full" | "pale" | "ink";
}) {
  const label = `${fmt.bare(plan.width)} × ${fmt.bare(plan.height)}`;
  const locator = tone !== "full";
  const wallInk = tone === "pale" ? LOCATOR_PALE_INK : PLAN_INK;
  const fill = tone === "pale" ? LOCATOR_PALE_FILL : tone === "ink" ? LOCATOR_INK_FILL : PLAN_FILL;
  // Sized off the room's SMALLER side: a long thin closet has plenty of
  // length and no width, and it is the width that the text runs out of.
  const short = Math.min(plan.width, plan.height);
  const nameSize = Math.max(0.16, Math.min(0.3, short * 0.13));
  // Below this the two lines cannot both fit inside the room at a size
  // anybody could read — and now that fixtures are drawn, the middle of a
  // small room is where the bath is.
  const tiny = short < 1.9;
  // Smaller still and even the name does not fit: it goes outside, to the
  // right of the room, where the reference puts the labels it cannot fit
  // either.
  const outside = short < 1.15;
  // The CENTROID, not the middle of the bounding box. An L-shaped kitchen's
  // bounding-box centre can fall in the notch — outside the room entirely —
  // which is how a label ends up sitting on somebody else's floor.
  const centre =
    plan.polygon.length >= 3
      ? plan.polygon.reduce(
          (acc, point, index, all) => {
            // The ring repeats its first corner; averaging it twice pulls
            // the label toward that corner.
            const last = index === all.length - 1 &&
              Math.hypot(point.x - all[0].x, point.y - all[0].y) < 1e-6;
            if (last) return acc;
            acc.x += point.x / (all.length - 1);
            acc.y += point.y / (all.length - 1);
            return acc;
          },
          { x: 0, y: 0 },
        )
      : { x: plan.width / 2, y: plan.height / 2 };
  const labelX = outside ? plan.width + 0.25 : centre.x;
  const labelY = centre.y;
  const anchor = outside ? "start" : "middle";
  return (
    <g transform={`translate(${at.x},${at.y})`}>
      {plan.polygon.length > 0 && (
        <polygon points={plan.polygon.map((p) => `${p.x},${p.y}`).join(" ")} fill={fill} />
      )}

      {/* Damage under the walls, so a patch never covers the line it was
          measured to. */}
      {!locator && room.areas.map((area, index) => {
        if (area.polygon.length < 3) return null;
        const cx = area.polygon.reduce((sum, p) => sum + p.x, 0) / area.polygon.length;
        const cy = area.polygon.reduce((sum, p) => sum + p.y, 0) / area.polygon.length;
        return (
          <g key={area.id}>
            <polygon
              points={area.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={area.color}
              fillOpacity={0.35}
              stroke={area.color}
              strokeWidth={0.02}
            />
            <circle cx={cx} cy={cy} r={0.2} fill={DAMAGE_MARK_FILL} />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={0.26}
              fontWeight={700}
              fill={DAMAGE_MARK_LABEL}
            >
              {areaStart + index + 1}
            </text>
          </g>
        );
      })}

      {/* Two passes: the body at true thickness over a slightly wider stroke,
          which leaves the heavier cut faces on both sides. */}
      <path d={wallPath(plan)} stroke={wallInk} strokeWidth={T + 2 * CUT} fill="none" />
      <path d={wallPath(plan)} stroke={wallInk} strokeWidth={T} fill="none" />

      {!locator && plan.openings.map((opening, index) => {
        const dx = opening.x2 - opening.x1;
        const dy = opening.y2 - opening.y1;
        const width = Math.hypot(dx, dy);
        if (width < 0.05) return null;
        const ux = dx / width;
        const uy = dy / width;
        const nx = -uy;
        const ny = ux;

        return (
          <g key={`o${index}`}>
            {/* Knock the opening out of the band. */}
            <line
              x1={opening.x1}
              y1={opening.y1}
              x2={opening.x2}
              y2={opening.y2}
              stroke={PLAN_LABEL_HALO}
              strokeWidth={T + 2 * CUT + 0.006}
              strokeLinecap="butt"
            />
            {/* The jambs ARE cut by the plan plane, so they keep the cut
                weight — this is what stops an opening reading as a hole
                somebody forgot to draw. */}
            {[
              [opening.x1, opening.y1],
              [opening.x2, opening.y2],
            ].map(([px, py], k) => (
              <line
                key={k}
                x1={px - (nx * T) / 2}
                y1={py - (ny * T) / 2}
                x2={px + (nx * T) / 2}
                y2={py + (ny * T) / 2}
                stroke={PLAN_INK}
                strokeWidth={CUT}
              />
            ))}
            {opening.kind === "window" && (
              <line
                x1={opening.x1}
                y1={opening.y1}
                x2={opening.x2}
                y2={opening.y2}
                stroke={PLAN_INK}
                strokeWidth={0.02}
              />
            )}
            {opening.kind === "door" && (
              <>
                {/* Leaf from the hinge, quarter arc to the latch. Which jamb
                    hinges is not in the sensor's data; the leaf is drawn from
                    the first jamb, which is the same convention the room
                    plan uses, so the two drawings never disagree. */}
                <path
                  d={`M ${opening.x1} ${opening.y1} L ${opening.x1 + nx * width} ${
                    opening.y1 + ny * width
                  }`}
                  stroke={PLAN_INK}
                  strokeWidth={0.02}
                  fill="none"
                />
                <path
                  d={`M ${opening.x1 + nx * width} ${opening.y1 + ny * width} A ${width} ${width} 0 0 ${
                    nx * uy - ny * ux > 0 ? 1 : 0
                  } ${opening.x2} ${opening.y2}`}
                  stroke={PLAN_INK}
                  strokeWidth={0.016}
                  fill="none"
                />
              </>
            )}
          </g>
        );
      })}

      {/* Fixtures over the wall band, under the label: a vanity drawn
          beneath the walls would have its back edge eaten by the wall it
          stands against, and one drawn over the label would strike the
          room's name through. */}
      {!locator && room.objects && room.objects.length > 0 && (
        <PlanObjects objects={room.objects} />
      )}

      {/* The room named where it stands, with its area and extent under it —
          the reference's own label, and the reason its plan reads without a
          legend. A white halo behind the glyphs because a label sits at the
          centre of the bounding box and a wall can run through that point. */}
      {!locator && (
        <>
          {/* **The label is sized by the room it is in.** At one fixed size
              a laundry room 0.8m wide printed its name and its dimensions
              straight through the bathroom next door. Scaled to the room's
              smaller side and floored so it never becomes unreadable —
              below that floor the figures are dropped and only the name is
              kept, because a name half-legible is still a name and two
              overlapping lines of numbers are neither. */}
          <text
            x={labelX}
            y={labelY - (tiny ? 0 : 0.12)}
            textAnchor={anchor}
            dominantBaseline={tiny ? "central" : undefined}
            stroke={PLAN_LABEL_HALO}
            strokeWidth={nameSize * 0.45}
            strokeLinejoin="round"
            paintOrder="stroke"
            fontSize={nameSize}
            fontWeight={600}
            fill={PLAN_LABEL}
          >
            {room.name}
          </text>
          {!tiny && (
            <text
              x={labelX}
              y={labelY + nameSize * 0.95}
              textAnchor={anchor}
              stroke={PLAN_LABEL_HALO}
              strokeWidth={nameSize * 0.4}
              strokeLinejoin="round"
              paintOrder="stroke"
              fontSize={nameSize * 0.84}
              fill={PLAN_LABEL}
            >
              {fmt.area(room.floorAreaSqm)} ({label})
            </text>
          )}
        </>
      )}
    </g>
  );
}

export default function ReportStoreyPlan({
  rooms,
  highlight,
  locale = "fr",
  note,
}: {
  rooms: StoreyRoom[];
  /** The document's language — the dimensions are formatted in it. */
  locale?: Locale;
  /** The line printed under an arrangement that was packed rather than
      placed, already in the document's language. */
  note?: string;
  /**
   * **The locator, which is the best idea on their page.** His words looking
   * at it, 21 Aug: *"do you see how it shows the room separate but at the
   * same time showing what part of the house it is in on the left with
   * greyed out plan? that is amazing."*
   *
   * He is right, and it is amazing for a reason worth naming: a room page is
   * a rectangle with a name on it, and nine of them in a row are nine
   * rectangles. The locator answers the question the reader actually has —
   * *which one is this?* — without a word, and it does it with the drawing
   * already on page two rather than with a new one.
   *
   * Passing a room id draws the whole storey faint with that room in ink,
   * and drops every label, dimension and door: at 40mm wide none of them is
   * legible and all of them are noise.
   */
  highlight?: string;
}) {
  const fmt = formatter(locale);
  const drawable = rooms.filter((room) => toFloorPlan(room.geometry).segments.length > 0);
  if (drawable.length === 0) return null;

  const plans = drawable.map((room) => toFloorPlan(room.geometry));
  const layout = resolvePlacements(
    plans.map((plan) => ({ width: plan.width, height: plan.height })),
    drawable.map((room) =>
      room.planX === null || room.planY === null
        ? null
        : { x: Number(room.planX), y: Number(room.planY) },
    ),
  );

  const registered = drawable.every((room) => room.planX !== null && room.planY !== null);
  const isLocator = highlight !== undefined;

  // Room-by-room running count, so the badge numbers across a storey are one
  // sequence rather than each room restarting at 1.
  //
  // A prefix sum rather than a `let` mutated inside `map`: the lint rule is
  // right that reassigning a captured binding during render is a hazard, and
  // the reduce says "each room starts where the last one ended" more directly
  // than a counter does anyway.
  const badgeCounts = drawable.map(
    (room) => room.areas.filter((area) => area.polygon.length >= 3).length,
  );
  const runningTotals = badgeCounts.reduce<number[]>(
    (acc, count) => [...acc, (acc[acc.length - 1] ?? 0) + count],
    [],
  );
  // Each room starts where the previous one ended, so the first starts at 0
  // and the last total — the storey's whole count — is not a start at all.
  const starts = [0, ...runningTotals.slice(0, -1)];

  // Enough margin for the outer chain and for the wall band itself, which is
  // drawn centred on the segment and so overhangs the extent by half.
  const pad = isLocator ? 0.35 : registered ? 1.9 : 0.5;

  return (
    <div className={isLocator ? "storey-plan locator-plan" : "storey-plan"}>
      <svg
        viewBox={`${-pad} ${-pad} ${layout.width + pad * 2} ${layout.height + pad * 2}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Floor plan with ${drawable.length} rooms`}
      >
        {drawable.map((room, index) => (
          <Room
            key={room.id}
            room={room}
            plan={plans[index]}
            at={layout.placed[index]}
            areaStart={starts[index]}
            fmt={fmt}
            tone={
              !isLocator ? "full" : room.id === highlight ? "ink" : "pale"
            }
          />
        ))}

        {registered && !isLocator && (
          <OuterChain
            rooms={drawable.map((_, index) => ({
              plan: plans[index],
              at: layout.placed[index],
            }))}
            fmt={fmt}
          />
        )}

        {registered && !isLocator && (
          <>
            {/* The overall extent, on two sides. Only here, and only when
                every room was really positioned — an overall dimension taken
                across rooms the packer arranged is a measurement of the
                packing, which is worse than no dimension at all. */}
            <g stroke={PLAN_RULE} strokeWidth={0.014} fill="none">
              <line x1={0} y1={layout.height + 0.75} x2={layout.width} y2={layout.height + 0.75} />
              <line x1={0} y1={layout.height + 0.55} x2={0} y2={layout.height + 0.95} />
              <line
                x1={layout.width}
                y1={layout.height + 0.55}
                x2={layout.width}
                y2={layout.height + 0.95}
              />
              <line x1={layout.width + 0.75} y1={0} x2={layout.width + 0.75} y2={layout.height} />
              <line x1={layout.width + 0.55} y1={0} x2={layout.width + 0.95} y2={0} />
              <line
                x1={layout.width + 0.55}
                y1={layout.height}
                x2={layout.width + 0.95}
                y2={layout.height}
              />
            </g>
            <text
              x={layout.width / 2}
              y={layout.height + 1.25}
              textAnchor="middle"
              fontSize={0.3}
              fill={PLAN_LABEL}
            >
              {fmt.bare(layout.width)}
            </text>
            <text
              x={layout.width + 1.25}
              y={layout.height / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={0.3}
              fill={PLAN_LABEL}
              transform={`rotate(-90 ${layout.width + 1.25} ${layout.height / 2})`}
            >
              {fmt.bare(layout.height)}
            </text>
          </>
        )}
      </svg>

      {!registered && !isLocator && note && (
        <p className="storey-note">{note}</p>
      )}
    </div>
  );
}
