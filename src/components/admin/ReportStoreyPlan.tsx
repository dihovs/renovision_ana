import { resolvePlacements } from "@/lib/floorLayout";
import { toFloorPlan, type FloorPlan, type ScanGeometry } from "@/lib/roomScan";

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
};

const m2 = (sqm: number) => `${sqm.toFixed(2)} m²`;
const m = (metres: number) => metres.toFixed(3);

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

/** One room, drawn where it stands. */
function Room({
  room,
  plan,
  at,
  areaStart,
  tone = "full",
}: {
  room: StoreyRoom;
  plan: FloorPlan;
  at: { x: number; y: number };
  areaStart: number;
  /** `full` is the drawing. `pale` and `ink` are the locator's two states:
      the storey drawn faint with one room in black. */
  tone?: "full" | "pale" | "ink";
}) {
  const label = `${m(plan.width)} × ${m(plan.height)}`;
  const locator = tone !== "full";
  const wallInk = tone === "pale" ? "#c9ccd2" : "#111111";
  const fill = tone === "pale" ? "#f6f7f8" : tone === "ink" ? "#e9eaec" : "#efeff0";
  // Sized off the room's SMALLER side: a long thin closet has plenty of
  // length and no width, and it is the width that the text runs out of.
  const short = Math.min(plan.width, plan.height);
  const nameSize = Math.max(0.15, Math.min(0.3, short * 0.13));
  // Below this the two lines cannot both fit inside the room at any size a
  // person could read.
  const tiny = short < 1.5;
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
            <circle cx={cx} cy={cy} r={0.2} fill="#e2a13a" />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={0.26}
              fontWeight={700}
              fill="#1b1c1f"
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
              stroke="#ffffff"
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
                stroke="#111111"
                strokeWidth={CUT}
              />
            ))}
            {opening.kind === "window" && (
              <line
                x1={opening.x1}
                y1={opening.y1}
                x2={opening.x2}
                y2={opening.y2}
                stroke="#111111"
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
                  stroke="#111111"
                  strokeWidth={0.02}
                  fill="none"
                />
                <path
                  d={`M ${opening.x1 + nx * width} ${opening.y1 + ny * width} A ${width} ${width} 0 0 ${
                    nx * uy - ny * ux > 0 ? 1 : 0
                  } ${opening.x2} ${opening.y2}`}
                  stroke="#111111"
                  strokeWidth={0.016}
                  fill="none"
                />
              </>
            )}
          </g>
        );
      })}

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
            x={plan.width / 2}
            y={plan.height / 2 - (tiny ? 0 : 0.12)}
            textAnchor="middle"
            dominantBaseline={tiny ? "central" : undefined}
            stroke="#ffffff"
            strokeWidth={nameSize * 0.45}
            strokeLinejoin="round"
            paintOrder="stroke"
            fontSize={nameSize}
            fontWeight={600}
            fill="#14161a"
          >
            {room.name}
          </text>
          {!tiny && (
            <text
              x={plan.width / 2}
              y={plan.height / 2 + nameSize * 0.95}
              textAnchor="middle"
              stroke="#ffffff"
              strokeWidth={nameSize * 0.4}
              strokeLinejoin="round"
              paintOrder="stroke"
              fontSize={nameSize * 0.84}
              fill="#40454d"
            >
              {m2(room.floorAreaSqm)} ({label})
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
}: {
  rooms: StoreyRoom[];
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
  let seen = 0;
  const starts = drawable.map((room) => {
    const start = seen;
    seen += room.areas.filter((area) => area.polygon.length >= 3).length;
    return start;
  });

  // Enough margin for the outer chain and for the wall band itself, which is
  // drawn centred on the segment and so overhangs the extent by half.
  const pad = isLocator ? 0.35 : registered ? 1.6 : 0.5;

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
            tone={
              !isLocator ? "full" : room.id === highlight ? "ink" : "pale"
            }
          />
        ))}

        {registered && !isLocator && (
          <>
            {/* The overall extent, on two sides. Only here, and only when
                every room was really positioned — an overall dimension taken
                across rooms the packer arranged is a measurement of the
                packing, which is worse than no dimension at all. */}
            <g stroke="#8a8f97" strokeWidth={0.014} fill="none">
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
              fill="#40454d"
            >
              {m(layout.width)}
            </text>
            <text
              x={layout.width + 1.25}
              y={layout.height / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={0.3}
              fill="#40454d"
              transform={`rotate(-90 ${layout.width + 1.25} ${layout.height / 2})`}
            >
              {m(layout.height)}
            </text>
          </>
        )}
      </svg>

      {!registered && !isLocator && (
        <p className="storey-note">
          Rooms measured on separate visits carry no true position relative to
          one another. They are arranged here so that none overlaps; each room
          is drawn to its own scan, and no dimension is taken across the
          arrangement.
        </p>
      )}
    </div>
  );
}
