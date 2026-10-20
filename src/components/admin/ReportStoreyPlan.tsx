import { resolvePlacements } from "@/lib/floorLayout";
import { bandPath, exteriorRuns, wallBand, type Pt } from "./wallBand";
import { toFloorPlan, type FloorPlan, type ScanGeometry } from "@/lib/roomScan";
import { openSegmentFlags } from "@/lib/openWalls";
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

/** Wall thickness on the page, in plan metres, unless the report says what
    the job's walls actually are (`ReportData.wallThicknessM`). */
const DEFAULT_WALL = 0.11;
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
  /** Edges with no wall on them — open into the next room. Drawn dashed
      instead of as wall (lib/openWalls.ts). */
  openWalls?: number[];
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
function wallPath(plan: FloorPlan, open: boolean[] = [], T = DEFAULT_WALL): string {
  // Joints from EVERY segment, open or not: a wall that meets an open side
  // still closes its corner square, it just has no wall continuing past it.
  const joints = plan.segments.flatMap((s) => [
    { x: s.x1, y: s.y1 },
    { x: s.x2, y: s.y2 },
  ]);
  const meetsAnother = (x: number, y: number) =>
    joints.filter((j) => Math.hypot(j.x - x, j.y - y) < 0.06).length > 1;

  return plan.segments
    .filter((_, i) => !open[i])
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
  /** How far off the wall the dimension line sits, in plan metres — INSIDE
      the room, along the wall's inside face, the way the reference sketches
      carry a room's own lengths; outside the building is the outside face's
      chain (ExteriorChain). Negative: toward the room. */
  const OFFSET = -0.36;
  /** Below this a segment is a jamb return or a stub, not a wall worth a
      number — and its label would not fit beside it anyway. */
  const SHORTEST = 0.55;

  // Every room's outline in STOREY coordinates, which is what the
  // inside-test has to run against: a wall of the kitchen is only an outer
  // wall if no OTHER room is on the far side of it.
  const rings = rooms
    .filter((room) => room.plan.polygon.length >= 3)
    .map((room) => room.plan.polygon.map((p) => ({ x: p.x + room.at.x, y: p.y + room.at.y })));

  const marks: { x1: number; y1: number; x2: number; y2: number; label: string; lx: number; ly: number }[] = [];

  for (const room of rooms) {
    // A room's own lengths go inside it only where there is room for them:
    // in a 5'-1" × 3'-2" laundry the figures sat on its name. A small room's
    // lengths are on its own page.
    if (Math.min(room.plan.width, room.plan.height) < 2) continue;
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
        // The label stands on the room's side of the line.
        lx: -out.nx,
        ly: -out.ny,
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
              x={midX + mark.lx * 0.17}
              y={midY + mark.ly * 0.17}
              transform={`rotate(${angle} ${midX + mark.lx * 0.17} ${midY + mark.ly * 0.17})`}
              textAnchor="middle"
              dominantBaseline="central"
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

/** Whether the edge a→b of this outline is an open side (no wall on it). */
function openEdgeTest(plan: FloorPlan, openWalls: number[] | undefined) {
  const flags = openSegmentFlags(plan, openWalls);
  return (a: Pt, b: Pt) =>
    plan.segments.some(
      (s, i) =>
        flags[i] &&
        ((Math.hypot(s.x1 - a.x, s.y1 - a.y) < 0.02 && Math.hypot(s.x2 - b.x, s.y2 - b.y) < 0.02) ||
          (Math.hypot(s.x1 - b.x, s.y1 - b.y) < 0.02 && Math.hypot(s.x2 - a.x, s.y2 - a.y) < 0.02)),
    );
}

/**
 * **The building's outside face, dimensioned.** The reference sketches print
 * every room's own lengths inside and the building's outside lengths beyond
 * the walls — Polygon's Hymus sketch: `17' 3"` outside a `16' 7"` room,
 * `15' 11"` from the corner to the bathroom's outside wall. These are the
 * runs `exteriorRuns` finds: the rooms grown by their walls, merged, the
 * boundary kept where it faces outside. Checked against that sketch, all
 * twelve outside figures agree to the inch.
 */
function ExteriorChain({
  rooms,
  fmt,
  wall,
}: {
  rooms: { plan: FloorPlan; at: { x: number; y: number }; openWalls?: number[] }[];
  fmt: Format;
  wall: number;
}) {
  const OFFSET = 0.3;
  const closed = rooms.filter((room) => room.plan.polygon.length >= 3);
  const runs = exteriorRuns(
    closed.map((room) => room.plan.polygon.map((p) => ({ x: p.x + room.at.x, y: p.y + room.at.y }))),
    wall,
    closed.map((room) => {
      const test = openEdgeTest(room.plan, room.openWalls);
      return (a: Pt, b: Pt) =>
        test({ x: a.x - room.at.x, y: a.y - room.at.y }, { x: b.x - room.at.x, y: b.y - room.at.y });
    }),
  );
  if (!runs) return null;
  // Longest first, and each run steps further out until its label clears the
  // ones already placed — two short faces meeting at a corner (the laundry's
  // 3'-7" side and the 3'-6" stretch beside it) printed on top of each other.
  type Box = { x0: number; y0: number; x1: number; y1: number };
  const placed: Box[] = [];
  const overlaps = (a: Box) => placed.some((b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0);
  const layout = runs
    .map((run) => ({ run, length: Math.hypot(run.x2 - run.x1, run.y2 - run.y1) }))
    .filter(({ length }) => length >= 0.3)
    .sort((a, b) => b.length - a.length)
    .map(({ run, length }) => {
      const vertical = Math.abs(run.x1 - run.x2) < 1e-6;
      const text = fmt.bare(length);
      const along = text.length * 0.21 * 0.56;
      let offset = OFFSET;
      for (let step = 0; step < 4; step += 1) {
        const mx = (run.x1 + run.x2) / 2 + run.out.x * (offset + 0.17);
        const my = (run.y1 + run.y2) / 2 + run.out.y * (offset + 0.17);
        const box = vertical
          ? { x0: mx - 0.13, y0: my - along / 2, x1: mx + 0.13, y1: my + along / 2 }
          : { x0: mx - along / 2, y0: my - 0.13, x1: mx + along / 2, y1: my + 0.13 };
        if (!overlaps(box) || step === 3) {
          placed.push(box);
          break;
        }
        offset += 0.32;
      }
      return { run, length, offset, vertical };
    });
  return (
    <g className="exterior-chain" stroke={PLAN_RULE} fill="none">
      {layout.map(({ run, length, offset, vertical }, index) => {
        const x1 = run.x1 + run.out.x * offset;
        const y1 = run.y1 + run.out.y * offset;
        const x2 = run.x2 + run.out.x * offset;
        const y2 = run.y2 + run.out.y * offset;
        const midX = (x1 + x2) / 2 + run.out.x * 0.17;
        const midY = (y1 + y2) / 2 + run.out.y * 0.17;
        // Tick marks across the line at both ends, and extension lines back
        // to the wall's outside face.
        const tx = run.out.y === 0 ? 0 : 0.07;
        const ty = run.out.x === 0 ? 0 : 0.07;
        return (
          <g key={index}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={0.012} />
            {[
              [x1, y1, run.x1, run.y1],
              [x2, y2, run.x2, run.y2],
            ].map(([ax, ay, wx, wy], k) => (
              <g key={k}>
                <line x1={ax} y1={ay} x2={wx + run.out.x * 0.04} y2={wy + run.out.y * 0.04} strokeWidth={0.008} />
                <line
                  x1={ax - (vertical ? 0.07 : tx)}
                  y1={ay - (vertical ? ty : 0.07)}
                  x2={ax + (vertical ? 0.07 : tx)}
                  y2={ay + (vertical ? ty : 0.07)}
                  strokeWidth={0.012}
                />
              </g>
            ))}
            <text
              x={midX}
              y={midY}
              transform={vertical ? `rotate(-90 ${midX} ${midY})` : undefined}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={0.21}
              fill={PLAN_LABEL}
              stroke={PLAN_LABEL_HALO}
              strokeWidth={0.07}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {fmt.bare(length)}
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
  wall = DEFAULT_WALL,
}: {
  /** The wall's thickness, plan metres. */
  wall?: number;
  room: StoreyRoom;
  fmt: Format;
  plan: FloorPlan;
  at: { x: number; y: number };
  areaStart: number;
  /** `full` is the drawing. `pale` and `ink` are the locator's two states:
      the storey drawn faint with one room in black. */
  tone?: "full" | "pale" | "ink";
}) {
  const T = wall;
  const label = `${fmt.bare(plan.width)} × ${fmt.bare(plan.height)}`;
  const openFlags = openSegmentFlags(plan, room.openWalls);
  // Walls stand OUTSIDE the outline (wallBand.ts): a shared wall prints once
  // at its true thickness. Null without a closed outline — the old centred
  // stroke then.
  const isOpenEdge = openEdgeTest(plan, room.openWalls);
  const band = wallBand(plan.polygon, T, plan.openings, isOpenEdge);
  const locator = tone !== "full";
  const wallInk = tone === "pale" ? LOCATOR_PALE_INK : PLAN_INK;
  const fill = tone === "pale" ? LOCATOR_PALE_FILL : tone === "ink" ? LOCATOR_INK_FILL : PLAN_FILL;
  // Sized off the room's SMALLER side: a long thin closet has plenty of
  // length and no width, and it is the width that the text runs out of.
  const short = Math.min(plan.width, plan.height);
  // **Inside whenever the name fits.** The label used to go outside, to the
  // room's right, for any room under 1,15 m on its short side — straight
  // into the storey's dimension chain, where the 5'-1" × 3'-2" laundry's
  // name printed under its own figures (SDC H1 Hymus, 15 Oct 2026). Now the
  // name is measured against the room: shrunk a little if that is what it
  // takes, and sent outside only when even the smallest size cannot fit.
  const textWidth = (text: string, size: number) => text.length * size * 0.56;
  const roomForText = plan.width * 0.9;
  let nameSize = Math.max(0.16, Math.min(0.3, short * 0.13));
  while (nameSize > 0.135 && textWidth(room.name, nameSize) > roomForText) nameSize -= 0.01;
  const outside = textWidth(room.name, nameSize) > roomForText || nameSize * 1.4 > plan.height;
  // The second line — area and extent — only where it fits too; and now
  // that fixtures are drawn, the middle of a small room is where the bath is.
  const areaLine = `${fmt.area(room.floorAreaSqm)} (${label})`;
  const tiny =
    short < 1.9 || textWidth(areaLine, nameSize * 0.84) > roomForText || plan.height < nameSize * 3;
  // Where the label stands: the area centroid, or — for an L whose centroid
  // falls in its own notch — the average of its corners. Both counted over
  // the DISTINCT corners: the old average divided by one corner too few on
  // an outline that does not repeat its first point, which pulled every
  // label down and to the right (the Hymus open area's name sat on its own
  // damage markers).
  const ring =
    plan.polygon.length > 1 &&
    Math.hypot(
      plan.polygon[0].x - plan.polygon[plan.polygon.length - 1].x,
      plan.polygon[0].y - plan.polygon[plan.polygon.length - 1].y,
    ) < 1e-6
      ? plan.polygon.slice(0, -1)
      : plan.polygon;
  const centre = (() => {
    if (ring.length < 3) return { x: plan.width / 2, y: plan.height / 2 };
    let a = 0;
    let cx = 0;
    let cy = 0;
    ring.forEach((p, i) => {
      const q = ring[(i + 1) % ring.length];
      const cross = p.x * q.y - q.x * p.y;
      a += cross;
      cx += (p.x + q.x) * cross;
      cy += (p.y + q.y) * cross;
    });
    if (Math.abs(a) > 1e-9) {
      const centroid = { x: cx / (3 * a), y: cy / (3 * a) };
      if (inside(centroid, ring)) return centroid;
    }
    return {
      x: ring.reduce((sum, p) => sum + p.x, 0) / ring.length,
      y: ring.reduce((sum, p) => sum + p.y, 0) / ring.length,
    };
  })();
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
      {band ? (
        <path d={bandPath(band)} fill={wallInk} stroke={wallInk} strokeWidth={0.004} strokeLinejoin="miter" />
      ) : (
        <>
          <path d={wallPath(plan, openFlags, T)} stroke={wallInk} strokeWidth={T + 2 * CUT} fill="none" />
          <path d={wallPath(plan, openFlags, T)} stroke={wallInk} strokeWidth={T} fill="none" />
        </>
      )}

      {/* Open sides — the room's edge with no wall on it, so an open-plan
          entry and dining room print as one space with a dashed line where
          one room's floor area hands over to the next. */}
      {plan.segments.map((s, i) =>
        openFlags[i] ? (
          <line
            key={`open${i}`}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke={wallInk}
            strokeWidth={0.022}
            strokeDasharray="0.14 0.1"
          />
        ) : null,
      )}

      {!locator && plan.openings.map((opening, index) => {
        const dx = opening.x2 - opening.x1;
        const dy = opening.y2 - opening.y1;
        const width = Math.hypot(dx, dy);
        if (width < 0.05) return null;
        const ux = dx / width;
        const uy = dy / width;
        const nx = -uy;
        const ny = ux;

        // On the band, an opening is already a gap; its outside normal says
        // which way the wall runs from the edge. Off the band (no outline,
        // or a scanned door the outline does not run under), the old way:
        // knock it out of a centred wall.
        const out = band?.openingNormals[index] ?? null;
        const across = (px: number, py: number) =>
          out
            ? { x1: px, y1: py, x2: px + out.x * T, y2: py + out.y * T }
            : { x1: px - (nx * T) / 2, y1: py - (ny * T) / 2, x2: px + (nx * T) / 2, y2: py + (ny * T) / 2 };
        const mid = out ? T / 2 : 0;

        return (
          <g key={`o${index}`}>
            {!out && (
              <line
                x1={opening.x1}
                y1={opening.y1}
                x2={opening.x2}
                y2={opening.y2}
                stroke={PLAN_LABEL_HALO}
                strokeWidth={T + 2 * CUT + 0.006}
                strokeLinecap="butt"
              />
            )}
            {/* The jambs ARE cut by the plan plane, so they keep the cut
                weight — this is what stops an opening reading as a hole
                somebody forgot to draw. */}
            {[
              [opening.x1, opening.y1],
              [opening.x2, opening.y2],
            ].map(([px, py], k) => (
              <line key={k} {...across(px, py)} stroke={PLAN_INK} strokeWidth={CUT} />
            ))}
            {opening.kind === "window" && (
              <line
                x1={opening.x1 + (out ? out.x * mid : 0)}
                y1={opening.y1 + (out ? out.y * mid : 0)}
                x2={opening.x2 + (out ? out.x * mid : 0)}
                y2={opening.y2 + (out ? out.y * mid : 0)}
                stroke={PLAN_INK}
                strokeWidth={0.02}
              />
            )}
            {opening.kind === "door" && (() => {
              // Leaf from the hinge, quarter arc to the latch. Which jamb
              // hinges is not in the sensor's data; by default the leaf is
              // drawn from the first jamb toward its left. A traced or
              // authored door can say which jamb and which way it opens
              // (`hinge`, `opens`), and then the room's own centroid decides
              // which side of the wall "into this room" is.
              const explicit = opening.hinge !== undefined || opening.opens !== undefined;
              const atEnd = opening.hinge === "end";
              let side = 1;
              if (explicit && plan.polygon.length >= 3) {
                const hx0 = atEnd ? opening.x2 : opening.x1;
                const hy0 = atEnd ? opening.y2 : opening.y1;
                const cx = plan.polygon.reduce((a, p) => a + p.x, 0) / plan.polygon.length;
                const cy = plan.polygon.reduce((a, p) => a + p.y, 0) / plan.polygon.length;
                const inward = Math.sign((cx - hx0) * nx + (cy - hy0) * ny) || 1;
                side = opening.opens === "out" ? -inward : inward;
              }
              // A door swinging out of the room hangs on the wall's far
              // face — the room's band lies between it and the room.
              const shift = out && side * (nx * out.x + ny * out.y) > 0 ? T : 0;
              const sx = out ? out.x * shift : 0;
              const sy = out ? out.y * shift : 0;
              const hx = (atEnd ? opening.x2 : opening.x1) + sx;
              const hy = (atEnd ? opening.y2 : opening.y1) + sy;
              const lx = (atEnd ? opening.x1 : opening.x2) + sx;
              const ly = (atEnd ? opening.y1 : opening.y2) + sy;
              const tipX = hx + side * nx * width;
              const tipY = hy + side * ny * width;
              const sweep = (tipX - hx) * (ly - hy) - (tipY - hy) * (lx - hx) > 0 ? 1 : 0;
              return (
                <>
                  <path
                    d={`M ${hx} ${hy} L ${tipX} ${tipY}`}
                    stroke={PLAN_INK}
                    strokeWidth={0.02}
                    fill="none"
                  />
                  <path
                    d={`M ${tipX} ${tipY} A ${width} ${width} 0 0 ${explicit || out ? sweep : nx * uy - ny * ux > 0 ? 1 : 0} ${lx} ${ly}`}
                    stroke={PLAN_INK}
                    strokeWidth={0.016}
                    fill="none"
                  />
                </>
              );
            })()}
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
  north = null,
  wallThickness = DEFAULT_WALL,
}: {
  rooms: StoreyRoom[];
  /** The job's wall thickness, plan metres (`ReportData.wallThicknessM`). */
  wallThickness?: number;
  /** Degrees clockwise from the top of the page that north points; null
      draws no arrow (see `ReportData.northDeg`). */
  north?: number | null;
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
            wall={wallThickness}
            tone={
              !isLocator ? "full" : room.id === highlight ? "ink" : "pale"
            }
          />
        ))}

        {/* The north arrow, top right, as the reference sketches carry it —
            only where north is actually known. */}
        {!isLocator && north !== null && (
          <g
            transform={`translate(${layout.width + pad - 0.5} ${-pad + 0.75}) rotate(${north})`}
            fill={PLAN_INK}
          >
            <path d="M 0 -0.42 L 0.17 0.2 L 0 0.1 L -0.17 0.2 Z" />
            <text x={0} y={-0.5} textAnchor="middle" fontSize={0.26} fontWeight={700} fill={PLAN_INK}>
              N
            </text>
          </g>
        )}

        {registered && !isLocator && (
          <ExteriorChain
            rooms={drawable.map((room, index) => ({
              plan: plans[index],
              at: layout.placed[index],
              openWalls: room.openWalls,
            }))}
            fmt={fmt}
            wall={wallThickness}
          />
        )}

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
