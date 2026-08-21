"use client";

import { toFloorPlan, type ScanGeometry } from "@/lib/roomScan";
import PlanObjects, { type PlanObject } from "./PlanObjects";

/**
 * A scanned room drawn as an actual floor plan.
 *
 * Shared, because the same drawing is the scan screen's main view AND the
 * thumbnail on a project card — and a thumbnail that renders differently
 * from the thing it is a thumbnail OF is its own small lie.
 *
 * `variant="thumb"` drops the dimensions, scale bar and labels: at card size
 * none of them are legible, and the outline alone is what makes a project
 * recognisable at a glance.
 *
 * `dimensions="locked"` draws ONLY the dimensions that were set by hand
 * (`geometry.lockedEdges`), each with a padlock — the report option for an
 * adjuster who wants the measured-by-hand figures and nothing inferred.
 * Locked edge indices are editedPolygon edge indices, and in that case
 * `toFloorPlan` returns one segment per edge in order, so segment index i IS
 * edge i. A room that was never hand-edited has no editedPolygon and can
 * have no locks (locks are only written by the editor, alongside the
 * polygon), so it honestly shows no dimensions in this mode. Known limit: a
 * locked edge that is not near-axis has no place in the renderer's two
 * projected dimension tiers and is not drawn — stated here rather than
 * approximated.
 */

/**
 * A wall, cut at its openings.
 *
 * **The reference's third tier of dimensions**, read off his own export:
 * `1.688 · 0.788 · 2.966` along one wall of a bedroom — pier, door, pier.
 * Ours printed `5.442` and stopped, which says how long the wall is and
 * nothing about where the door is in it. That is the figure somebody
 * ordering trim or framing a rough opening actually needs, and it is the
 * one measurement on a plan you cannot recover from the others.
 *
 * Returns the runs along the wall's own axis, or an empty array when the
 * wall has no openings and there is therefore nothing to split.
 */
function splitAtOpenings(
  lo: number,
  hi: number,
  openings: { a: number; b: number }[],
): { lo: number; hi: number }[] {
  const cuts = openings
    .map((o) => ({ a: Math.max(lo, Math.min(o.a, o.b)), b: Math.min(hi, Math.max(o.a, o.b)) }))
    .filter((o) => o.b - o.a > 0.03)
    .sort((x, y) => x.a - y.a);
  if (cuts.length === 0) return [];

  const runs: { lo: number; hi: number }[] = [];
  let at = lo;
  for (const cut of cuts) {
    if (cut.a - at > 0.03) runs.push({ lo: at, hi: cut.a });
    runs.push({ lo: cut.a, hi: cut.b });
    at = Math.max(at, cut.b);
  }
  if (hi - at > 0.03) runs.push({ lo: at, hi });
  return runs.length > 1 ? runs : [];
}

export default function FloorPlan({
  result,
  name,
  variant = "full",
  sections,
  dimensions = "all",
  areas,
  objects,
}: {
  result: ScanGeometry;
  name: string;
  /** Fixtures standing in the room, in the same plan metres the walls use.
      See `PlanObjects` for why a plan without them is worth less than it
      looks. */
  objects?: PlanObject[];
  variant?: "full" | "thumb";
  /** Room labels from a merged structure, drawn at their centres. */
  sections?: { label: string; centerX: number; centerZ: number }[];
  /** "all" is the drawing as always. "locked" renders only hand-set
      dimensions, padlocked, for the report option that consumes them. */
  dimensions?: "all" | "locked";
  /**
   * Damaged regions, drawn in their cause colour with a NUMBERED badge —
   * the report's numbered key.
   *
   * The plan has never drawn these, which left the report listing "wet
   * area 4.2 m²" in a table beside a drawing that showed no wet area. A
   * figure an adjuster cannot point at on the plan is a figure that gets
   * queried, and answering the query costs more than drawing it would
   * have.
   *
   * Floor areas only. A wall area's polygon is in its wall's FACE space —
   * x along the wall, y above the floor — and drawing it here would put a
   * shape from one coordinate system on top of another, which is the
   * mistake `AffectedArea.polygon` documents at length.
   */
  areas?: { id: string; polygon: { x: number; y: number }[]; color: string }[];
}) {
  const plan = toFloorPlan(result);
  if (plan.segments.length === 0) return null;

  const thumb = variant === "thumb";
  // A merged floor has dozens of walls; per-wall dimension tiers stack into
  // an unreadable smear. Keep the overall spans, drop the breakdowns.
  const dense = result.walls.length > 12;
  // The REAL wall: 2x4 partition + drywall, 0.114 m, drawn at true thickness
  // with a heavier cut face — the double-line-with-poché convention every
  // drafted plan uses. Thumbnails keep a single solid band (the spec's L0):
  // at card size the two face lines merge anyway.
  const T = 0.114;
  const CUT = 0.018;
  const WALL = thumb ? 0.22 : T;

  // Where walls meet. A centreline stroked to its exact length leaves a
  // notched corner; extending each end that SHARES a joint by half a
  // thickness closes the mitre — the two-pass trick from the renderer spec.
  const joints: { x: number; y: number }[] = [];
  {
    const pts = plan.segments.flatMap((s) => [
      { x: s.x1, y: s.y1 },
      { x: s.x2, y: s.y2 },
    ]);
    for (let i = 0; i < pts.length; i += 1) {
      for (let j = i + 1; j < pts.length; j += 1) {
        if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < 0.06) {
          joints.push({ x: (pts[i].x + pts[j].x) / 2, y: (pts[i].y + pts[j].y) / 2 });
        }
      }
    }
  }
  const nearJoint = (x: number, y: number) =>
    joints.some((j) => Math.hypot(j.x - x, j.y - y) < 0.06);

  const wallPath = plan.segments
    .map((s) => {
      const dx = s.x2 - s.x1;
      const dy = s.y2 - s.y1;
      const L = Math.hypot(dx, dy) || 1;
      const ux = dx / L;
      const uy = dy / L;
      const e1 = nearJoint(s.x1, s.y1) ? T / 2 : 0;
      const e2 = nearJoint(s.x2, s.y2) ? T / 2 : 0;
      return `M ${s.x1 - ux * e1} ${s.y1 - uy * e1} L ${s.x2 + ux * e2} ${s.y2 + uy * e2}`;
    })
    .join(" ");
  // Asymmetric on purpose: the vertical dimensions live off the right edge
  // and their rotated text needs more room than the bare left margin does.
  // A thumbnail has none of that, so it gets a tight even margin instead.
  const padLeft = thumb ? 0.4 : 1.1;
  const padRight = thumb ? 0.4 : 2.6;
  const padTop = thumb ? 0.4 : 2.1;
  const padBottom = thumb ? 0.4 : 2.2;
  const { width, height } = plan;

  // Which walls run across and which run up — a wall within ~15° of an axis
  // is treated as that axis, since a scanned wall is never exactly square.
  // Indexed BEFORE filtering: in the edited-polygon case the segment index
  // is the edge index `lockedEdges` refers to, and the filter must not
  // renumber it.
  const indexed = plan.segments.map((s, index) => ({ ...s, index }));
  const horizontal = indexed.filter(
    (s) => Math.abs(s.y2 - s.y1) < Math.abs(s.x2 - s.x1) * 0.27,
  );
  const vertical = indexed.filter(
    (s) => Math.abs(s.x2 - s.x1) < Math.abs(s.y2 - s.y1) * 0.27,
  );

  // Hand-set dimensions. The indices only mean something against an edited
  // polygon's edges; without one there is nothing a lock could refer to.
  const lockedOnly = dimensions === "locked";
  const locked =
    result.editedPolygon && result.editedPolygon.length >= 3
      ? new Set(result.lockedEdges ?? [])
      : new Set<number>();


  return (
    <div
      className={
        thumb ? "h-full w-full" : "overflow-hidden rounded-xl border border-black/5 bg-white"
      }
    >
      <svg
        viewBox={`${-padLeft} ${-padTop} ${width + padLeft + padRight} ${height + padTop + padBottom}`}
        className={thumb ? "h-full w-full" : "h-auto w-full"}
        preserveAspectRatio="xMidYMid meet"
        style={thumb ? undefined : { maxHeight: "56vh" }}
        role="img"
        aria-label={`Floor plan of ${name}`}
      >
        {plan.polygon.length > 0 && (
          <polygon points={plan.polygon.map((p) => `${p.x},${p.y}`).join(" ")} fill="#ebebeb" />
        )}

        {/* The damaged regions, under the walls so a patch never covers the
            line it was measured to. */}
        {(areas ?? []).map((area, index) => {
          if (area.polygon.length < 3) return null;
          const points = area.polygon.map((p) => `${p.x},${p.y}`).join(" ");
          const cx = area.polygon.reduce((sum, p) => sum + p.x, 0) / area.polygon.length;
          const cy = area.polygon.reduce((sum, p) => sum + p.y, 0) / area.polygon.length;
          return (
            <g key={area.id}>
              <polygon
                points={points}
                fill={area.color}
                fillOpacity={0.35}
                stroke={area.color}
                strokeWidth={0.02}
              />
              {!thumb && (
                <>
                  <circle cx={cx} cy={cy} r={0.22} fill={area.color} />
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={0.28}
                    fill="#fff"
                    fontWeight={700}
                  >
                    {index + 1}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Two passes: the wall body at true thickness over a slightly wider
            ink stroke, which leaves the heavier CUT face lines on both sides
            and closes every shared corner square — the poché convention. At
            thumbnail size a single band, per the spec's smallest level. */}
        {thumb ? (
          plan.segments.map((s, i) => (
            <line
              key={`w${i}`}
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
              stroke="#111111"
              strokeWidth={WALL}
              strokeLinecap="square"
            />
          ))
        ) : (
          <>
            <path d={wallPath} stroke="#111111" strokeWidth={T + 2 * CUT} fill="none" strokeLinecap="butt" />
            <path d={wallPath} stroke="#111111" strokeWidth={T} fill="none" strokeLinecap="butt" />
          </>
        )}

        {/* Openings knocked out of the band, then re-drawn as their proper
            symbols: jamb caps at cut weight (the jambs ARE cut by the plan
            plane), a three-line window, a door with its leaf and quarter
            swing. Thumbnails keep plain gaps. */}
        {plan.openings.map((o, i) => {
          const dx = o.x2 - o.x1;
          const dy = o.y2 - o.y1;
          const w = Math.hypot(dx, dy);
          if (w < 0.05) return null;
          const ux = dx / w;
          const uy = dy / w;
          const nx = -uy;
          const ny = ux;

          return (
            <g key={`o${i}`}>
              <line
                x1={o.x1}
                y1={o.y1}
                x2={o.x2}
                y2={o.y2}
                stroke="#ffffff"
                strokeWidth={thumb ? WALL * 1.25 : T + 2 * CUT + 0.006}
                strokeLinecap="butt"
              />

              {!thumb && (
                <>
                  {[
                    { px: o.x1, py: o.y1 },
                    { px: o.x2, py: o.y2 },
                  ].map(({ px, py }, k) => (
                    <line
                      key={`j${k}`}
                      x1={px - (nx * T) / 2}
                      y1={py - (ny * T) / 2}
                      x2={px + (nx * T) / 2}
                      y2={py + (ny * T) / 2}
                      stroke="#111111"
                      strokeWidth={CUT}
                    />
                  ))}

                  {o.kind === "window" && (
                    <>
                      {[1, -1].map((side) => (
                        <line
                          key={`f${side}`}
                          x1={o.x1 + (side * nx * T) / 2}
                          y1={o.y1 + (side * ny * T) / 2}
                          x2={o.x2 + (side * nx * T) / 2}
                          y2={o.y2 + (side * ny * T) / 2}
                          stroke="#111111"
                          strokeWidth={0.014}
                        />
                      ))}
                      <line x1={o.x1} y1={o.y1} x2={o.x2} y2={o.y2} stroke="#111111" strokeWidth={0.01} />
                    </>
                  )}

                  {o.kind === "door" && w >= 0.45 && (
                    <Door opening={o} joints={joints} polygon={plan.polygon} T={T} />
                  )}
                </>
              )}
            </g>
          );
        })}

        {/* Fixtures over the wall band, under the dimensions. */}
        {!thumb && objects && objects.length > 0 && (
          <PlanObjects objects={objects} labels />
        )}

        {/* Dimensions and the scale bar are dropped at thumbnail size:
            none of it is legible on a card, and the outline alone is what
            makes a project recognisable at a glance. */}
        {!thumb && !lockedOnly && (
          <>
        {/* Outer tier: the overall span, top and right. Inner tier: each
            wall on that side, but only when there is more than one — a
            single wall would just repeat the overall figure. */}
        <Dimension from={{ x: 0, y: 0 }} to={{ x: width, y: 0 }} offset={-1.6} axis="x" />
        {!dense && horizontal.length > 1 &&
          horizontal.map((s, i) => (
            <Dimension
              key={`hx${i}`}
              from={{ x: Math.min(s.x1, s.x2), y: 0 }}
              to={{ x: Math.max(s.x1, s.x2), y: 0 }}
              offset={-1.05}
              axis="x"
            />
          ))}

        {/* The third tier, nearest the drawing: each wall cut at its
            openings. Only walls that HAVE openings appear here — a wall
            with none would repeat the tier above it. */}
        {!dense &&
          horizontal.flatMap((s, i) => {
            const lo = Math.min(s.x1, s.x2);
            const hi = Math.max(s.x1, s.x2);
            const on = plan.openings
              .filter(
                (o) =>
                  Math.abs((o.y1 + o.y2) / 2 - (s.y1 + s.y2) / 2) < 0.3 &&
                  Math.abs(o.y2 - o.y1) < Math.abs(o.x2 - o.x1),
              )
              .map((o) => ({ a: o.x1, b: o.x2 }));
            return splitAtOpenings(lo, hi, on).map((run, k) => (
              <Dimension
                key={`hs${i}-${k}`}
                from={{ x: run.lo, y: 0 }}
                to={{ x: run.hi, y: 0 }}
                offset={-0.5}
                axis="x"
              />
            ));
          })}

        <Dimension from={{ x: width, y: 0 }} to={{ x: width, y: height }} offset={1.6} axis="y" />
        {!dense && vertical.length > 1 &&
          vertical.map((s, i) => (
            <Dimension
              key={`vy${i}`}
              from={{ x: width, y: Math.min(s.y1, s.y2) }}
              to={{ x: width, y: Math.max(s.y1, s.y2) }}
              offset={1.05}
              axis="y"
            />
          ))}

        {!dense &&
          vertical.flatMap((s, i) => {
            const lo = Math.min(s.y1, s.y2);
            const hi = Math.max(s.y1, s.y2);
            const on = plan.openings
              .filter(
                (o) =>
                  Math.abs((o.x1 + o.x2) / 2 - (s.x1 + s.x2) / 2) < 0.3 &&
                  Math.abs(o.x2 - o.x1) < Math.abs(o.y2 - o.y1),
              )
              .map((o) => ({ a: o.y1, b: o.y2 }));
            return splitAtOpenings(lo, hi, on).map((run, k) => (
              <Dimension
                key={`vs${i}-${k}`}
                from={{ x: width, y: run.lo }}
                to={{ x: width, y: run.hi }}
                offset={0.5}
                axis="y"
              />
            ));
          })}

        <ScaleBar y={height + 1.35} width={width} />
          </>
        )}

        {/* Only what was set by hand, each padlocked. The overall spans are
            derived rather than set, so they are dropped with the rest, and
            the `dense` guard does not apply — the locked dims are the whole
            point of this mode, and an edited outline is never dozens of
            edges. A room with no hand-set dimension shows none, which is
            the truthful rendering of this option. */}
        {!thumb && lockedOnly && (
          <>
            {horizontal
              .filter((s) => locked.has(s.index))
              .map((s, i) => (
                <Dimension
                  key={`lhx${i}`}
                  from={{ x: Math.min(s.x1, s.x2), y: 0 }}
                  to={{ x: Math.max(s.x1, s.x2), y: 0 }}
                  offset={-0.55}
                  axis="x"
                  locked
                />
              ))}
            {vertical
              .filter((s) => locked.has(s.index))
              .map((s, i) => (
                <Dimension
                  key={`lvy${i}`}
                  from={{ x: width, y: Math.min(s.y1, s.y2) }}
                  to={{ x: width, y: Math.max(s.y1, s.y2) }}
                  offset={0.55}
                  axis="y"
                  locked
                />
              ))}
            <ScaleBar y={height + 1.35} width={width} />
          </>
        )}

        {/* Room names the merge recognised, at their own centres. */}
        {!thumb &&
          (sections ?? [])
            .filter((s) => s.label && s.label !== "unidentified")
            .map((s, i) => (
              <text
                key={`sec${i}`}
                x={s.centerX - plan.offsetX}
                y={s.centerZ - plan.offsetY}
                textAnchor="middle"
                fontSize={0.3}
                fontWeight={700}
                fill="#3c3c43"
                style={{ textTransform: "capitalize" }}
              >
                {s.label.replace(/([A-Z])/g, " $1").toLowerCase()}
              </text>
            ))}
      </svg>
    </div>
  );
}

/**
 * One dimension: witness lines out to an offset, a line with arrowheads
 * between them, and the measurement centred on it — horizontal text on an
 * x dimension, rotated a quarter turn on a y one, as a drawing does.
 *
 * `offset` is signed and perpendicular: negative is above (x) or left (y).
 */
function Dimension({
  from,
  to,
  offset,
  axis,
  locked = false,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  offset: number;
  axis: "x" | "y";
  /** Draw the hand-set provenance mark beside the figure. */
  locked?: boolean;
}) {
  const span = axis === "x" ? to.x - from.x : to.y - from.y;
  // Anything under ~30cm has a label wider than the run it describes.
  if (Math.abs(span) < 0.3) return null;

  const line = axis === "x" ? from.y + offset : from.x + offset;
  const a = axis === "x" ? { x: from.x, y: line } : { x: line, y: from.y };
  const b = axis === "x" ? { x: to.x, y: line } : { x: line, y: to.y };
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const head = 0.12;
  const grey = "#8a8a8e";
  const label = formatPlanLength(Math.abs(span));
  // Where the label ends, near enough: ~0.15 per character at this font
  // size. Only used to place the padlock clear of the text.
  const halfLabel = label.length * 0.075;

  return (
    <g>
      {/* Witness lines, from the wall out past the dimension line. */}
      <line
        x1={from.x}
        y1={from.y}
        x2={axis === "x" ? from.x : line + Math.sign(offset) * 0.12}
        y2={axis === "x" ? line + Math.sign(offset) * 0.12 : from.y}
        stroke={grey}
        strokeWidth={0.018}
      />
      <line
        x1={to.x}
        y1={to.y}
        x2={axis === "x" ? to.x : line + Math.sign(offset) * 0.12}
        y2={axis === "x" ? line + Math.sign(offset) * 0.12 : to.y}
        stroke={grey}
        strokeWidth={0.018}
      />

      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={grey} strokeWidth={0.022} />

      {/* 45-degree ticks, not arrowheads — the drafting convention for
          dimension strings. Arrowheads stay reserved for leaders. */}
      {[a, b].map((p, k) => (
        <line
          key={k}
          x1={p.x - head * 0.6}
          y1={p.y + head * 0.6}
          x2={p.x + head * 0.6}
          y2={p.y - head * 0.6}
          stroke={grey}
          strokeWidth={0.03}
        />
      ))}

      <text
        x={mid.x}
        y={axis === "x" ? mid.y - 0.11 : mid.y}
        textAnchor="middle"
        dominantBaseline={axis === "x" ? "auto" : "middle"}
        fontSize={0.26}
        fill="#3c3c43"
        transform={axis === "y" ? `rotate(-90 ${mid.x} ${mid.y})` : undefined}
        dy={axis === "y" ? -0.1 : undefined}
      >
        {label}
      </text>

      {/* The provenance mark, riding the text's own frame so a rotated
          dimension keeps its padlock beside the figure. */}
      {locked &&
        (axis === "x" ? (
          <Padlock x={mid.x + halfLabel + 0.08} baseline={mid.y - 0.11} />
        ) : (
          <g transform={`rotate(-90 ${mid.x} ${mid.y})`}>
            <Padlock x={mid.x + halfLabel + 0.08} baseline={mid.y} />
          </g>
        ))}
    </g>
  );
}

/**
 * A padlock beside a figure somebody typed — the provenance mark for a
 * hand-set dimension, matching the plan editor's convention. Drawn as
 * geometry rather than an icon font or emoji, so it prints identically
 * everywhere the report does.
 */
function Padlock({ x, baseline }: { x: number; baseline: number }) {
  const w = 0.15;
  const bodyH = 0.11;
  const r = 0.045;
  return (
    <g>
      <path
        d={`M ${x + w / 2 - r} ${baseline - bodyH} v -0.025 a ${r} ${r} 0 0 1 ${2 * r} 0 v 0.025`}
        fill="none"
        stroke="#3c3c43"
        strokeWidth={0.022}
      />
      <rect x={x} y={baseline - bodyH} width={w} height={bodyH} rx={0.02} fill="#3c3c43" />
    </g>
  );
}

/**
 * Alternating black and white blocks, as on a drawing — and THE one place
 * the unit is written.
 *
 * Metric, because every dimension on the plan and every figure in the
 * report is. It used to be feet while the cover said m², and the comment
 * here claimed it matched "every other measurement on this screen", which
 * had stopped being true.
 *
 * The bar carries the unit precisely so the dimensions do not have to: a
 * plan repeats a number twenty times, and twenty `m` suffixes crowd the
 * short walls until the figures collide. Stated once, under the drawing,
 * where a reader looks for it.
 */
function ScaleBar({ y, width }: { y: number; width: number }) {
  // A round number of METRES that fits comfortably under the plan — the
  // 0.5 step is what the reference uses on a small room, where whole metres
  // would give a two-block bar that says nothing about scale.
  const step = width > 12 ? 3 : width > 6 ? 1 : 0.5;
  const blockM = step;
  // Never draw a scale wider than the plan it measures — a bar running past
  // the room reads as part of the drawing.
  const blocks = Math.max(2, Math.min(4, Math.floor(width / blockM)));

  return (
    <g>
      {Array.from({ length: blocks }).map((_, i) => (
        <rect
          key={i}
          x={i * blockM}
          y={y}
          width={blockM}
          height={0.13}
          fill={i % 2 === 0 ? "#111111" : "#ffffff"}
          stroke="#111111"
          strokeWidth={0.014}
        />
      ))}
      {Array.from({ length: blocks + 1 }).map((_, i) => (
        <text key={i} x={i * blockM} y={y - 0.12} textAnchor="middle" fontSize={0.22} fill="#8a8a8e">
          {Number.isInteger(step) ? i * step : (i * step).toFixed(1)}
        </text>
      ))}
      <text x={blocks * blockM + 0.14} y={y + 0.12} fontSize={0.22} fill="#8a8a8e">
        m
      </text>
    </g>
  );
}

/**
 * A door as a drawing draws one: leaf from the hinge, quarter arc to the
 * latch. Which jamb hinges and which way it swings are not in RoomPlan's
 * data, so both are the spec's stated heuristics — hinge at the jamb nearer
 * a wall joint (doors hinge beside the adjoining wall), swing toward the
 * room's interior — and are conventions, not measurements.
 */
function Door({
  opening,
  joints,
  polygon,
  T,
}: {
  opening: { x1: number; y1: number; x2: number; y2: number };
  joints: { x: number; y: number }[];
  polygon: { x: number; y: number }[];
  T: number;
}) {
  const dx = opening.x2 - opening.x1;
  const dy = opening.y2 - opening.y1;
  const w = Math.hypot(dx, dy);
  const ux = dx / w;
  const uy = dy / w;
  const nx = -uy;
  const ny = ux;

  const dist = (x: number, y: number) =>
    joints.length === 0 ? 9 : Math.min(...joints.map((j) => Math.hypot(j.x - x, j.y - y)));
  const hingeAtStart = dist(opening.x1, opening.y1) <= dist(opening.x2, opening.y2);
  const [hx, hy, lx, ly] = hingeAtStart
    ? [opening.x1, opening.y1, opening.x2, opening.y2]
    : [opening.x2, opening.y2, opening.x1, opening.y1];

  // Interior side: where the floor's centroid sits relative to this wall.
  let cx = 0;
  let cy = 0;
  if (polygon.length >= 3) {
    cx = polygon.reduce((a, p) => a + p.x, 0) / polygon.length;
    cy = polygon.reduce((a, p) => a + p.y, 0) / polygon.length;
  }
  const side = Math.sign((cx - hx) * nx + (cy - hy) * ny) || 1;

  const H = { x: hx + (side * nx * T) / 2, y: hy + (side * ny * T) / 2 };
  const L = { x: lx + (side * nx * T) / 2, y: ly + (side * ny * T) / 2 };
  const tip = { x: H.x + side * nx * w, y: H.y + side * ny * w };
  const sweep = (tip.x - H.x) * (L.y - H.y) - (tip.y - H.y) * (L.x - H.x) > 0 ? 1 : 0;

  return (
    <g>
      <line x1={H.x} y1={H.y} x2={tip.x} y2={tip.y} stroke="#111111" strokeWidth={0.016} />
      <path
        d={`M ${tip.x} ${tip.y} A ${w} ${w} 0 0 ${sweep} ${L.x} ${L.y}`}
        fill="none"
        stroke="#111111"
        strokeWidth={0.01}
      />
    </g>
  );
}

/**
 * A dimension on the plan, in the SAME unit as the document around it.
 *
 * The report prints 113.12 m² on its cover and used to print 18'-1 1/2" on
 * every dimension of every plan inside it. One document, two systems, and a
 * reader left to convert. The reference does not do this: its plans carry
 * bare metric numbers — `4.654`, `1.434` — with the unit stated once, on the
 * scale bar.
 *
 * Bare, deliberately. A drawing repeats a dimension twenty times and the
 * unit does not change between them; printing `m` on each one is noise that
 * crowds short walls until the numbers overlap. The scale bar says which
 * unit, once, which is what a drawing has always done.
 */
function formatPlanLength(meters: number): string {
  // Millimetre precision, the reference's own: 4.654, not 4.65. On a claim
  // the third decimal is the difference between a wall measured and a wall
  // rounded.
  return meters.toFixed(3);
}

