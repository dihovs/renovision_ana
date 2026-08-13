"use client";

import { metersToFeet, toFloorPlan, type RoomScanResult } from "@/lib/roomScan";

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
 */
export default function FloorPlan({
  result,
  name,
  variant = "full",
}: {
  result: RoomScanResult;
  name: string;
  variant?: "full" | "thumb";
}) {
  const plan = toFloorPlan(result);
  if (plan.segments.length === 0) return null;

  const thumb = variant === "thumb";
  const WALL = thumb ? 0.22 : 0.16;
  // Asymmetric on purpose: the vertical dimensions live off the right edge
  // and their rotated text needs more room than the bare left margin does.
  // A thumbnail has none of that, so it gets a tight even margin instead.
  const padLeft = thumb ? 0.4 : 1.1;
  const padRight = thumb ? 0.4 : 2.0;
  const padTop = thumb ? 0.4 : 1.5;
  const padBottom = thumb ? 0.4 : 2.2;
  const { width, height } = plan;

  // Which walls run across and which run up — a wall within ~15° of an axis
  // is treated as that axis, since a scanned wall is never exactly square.
  const horizontal = plan.segments.filter(
    (s) => Math.abs(s.y2 - s.y1) < Math.abs(s.x2 - s.x1) * 0.27,
  );
  const vertical = plan.segments.filter(
    (s) => Math.abs(s.x2 - s.x1) < Math.abs(s.y2 - s.y1) * 0.27,
  );

  
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

        {/* Butt caps, not round: a round cap on a 16cm wall bulges past the
            corner and reads as a smudge at this scale. */}
        {plan.segments.map((s, i) => (
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
        ))}

        {/* Drawn over the wall in white, which cuts a real gap rather than
            faking one — the same trick a printed plan uses. */}
        {plan.openings.map((o, i) => (
          <g key={`o${i}`}>
            <line
              x1={o.x1}
              y1={o.y1}
              x2={o.x2}
              y2={o.y2}
              stroke="#ffffff"
              strokeWidth={WALL * 1.25}
              strokeLinecap="butt"
            />
            {o.kind === "window" ? (
              <line x1={o.x1} y1={o.y1} x2={o.x2} y2={o.y2} stroke="#111111" strokeWidth={0.035} />
            ) : (
              <DoorSwing opening={o} />
            )}
          </g>
        ))}

        {/* Dimensions and the scale bar are dropped at thumbnail size:
            none of it is legible on a card, and the outline alone is what
            makes a project recognisable at a glance. */}
        {!thumb && (
          <>
        {/* Outer tier: the overall span, top and right. Inner tier: each
            wall on that side, but only when there is more than one — a
            single wall would just repeat the overall figure. */}
        <Dimension from={{ x: 0, y: 0 }} to={{ x: width, y: 0 }} offset={-1.05} axis="x" />
        {horizontal.length > 1 &&
          horizontal.map((s, i) => (
            <Dimension
              key={`hx${i}`}
              from={{ x: Math.min(s.x1, s.x2), y: 0 }}
              to={{ x: Math.max(s.x1, s.x2), y: 0 }}
              offset={-0.5}
              axis="x"
            />
          ))}

        <Dimension from={{ x: width, y: 0 }} to={{ x: width, y: height }} offset={1.05} axis="y" />
        {vertical.length > 1 &&
          vertical.map((s, i) => (
            <Dimension
              key={`vy${i}`}
              from={{ x: width, y: Math.min(s.y1, s.y2) }}
              to={{ x: width, y: Math.max(s.y1, s.y2) }}
              offset={0.5}
              axis="y"
            />
          ))}

        <ScaleBar y={height + 1.35} width={width} />
          </>
        )}
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
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  offset: number;
  axis: "x" | "y";
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

      {/* Arrowheads, drawn as triangles rather than SVG markers — markers
          scale by stroke width and go wrong in a metre-unit viewBox. */}
      {axis === "x" ? (
        <>
          <polygon points={`${a.x},${a.y} ${a.x + head},${a.y - head * 0.42} ${a.x + head},${a.y + head * 0.42}`} fill={grey} />
          <polygon points={`${b.x},${b.y} ${b.x - head},${b.y - head * 0.42} ${b.x - head},${b.y + head * 0.42}`} fill={grey} />
        </>
      ) : (
        <>
          <polygon points={`${a.x},${a.y} ${a.x - head * 0.42},${a.y + head} ${a.x + head * 0.42},${a.y + head}`} fill={grey} />
          <polygon points={`${b.x},${b.y} ${b.x - head * 0.42},${b.y - head} ${b.x + head * 0.42},${b.y - head}`} fill={grey} />
        </>
      )}

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
        {formatFeetInches(Math.abs(span))}
      </text>
    </g>
  );
}

/** Alternating black and white metre-ish blocks, as on a drawing. Feet
    here, to match every other measurement on this screen. */
function ScaleBar({ y, width }: { y: number; width: number }) {
  const totalFt = metersToFeet(width);
  // A round number of feet that fits comfortably under the plan.
  const step = totalFt > 40 ? 10 : totalFt > 16 ? 5 : 2;
  const blockM = step / 3.28084;
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
          {i * step}
        </text>
      ))}
      <text x={blocks * blockM + 0.14} y={y + 0.12} fontSize={0.22} fill="#8a8a8e">
        ft
      </text>
    </g>
  );
}

/** The quarter-circle a door sweeps — hinged at one end, opening into the
    room. Which side it actually opens to isn't in RoomPlan's data, so this
    is a drawing convention, not a measurement. */
function DoorSwing({ opening }: { opening: { x1: number; y1: number; x2: number; y2: number } }) {
  const dx = opening.x2 - opening.x1;
  const dy = opening.y2 - opening.y1;
  const width = Math.hypot(dx, dy);
  if (width < 0.05) return null;
  const px = -dy / width;
  const py = dx / width;
  return (
    <path
      d={`M ${opening.x1} ${opening.y1} L ${opening.x2} ${opening.y2} M ${opening.x2} ${opening.y2} A ${width} ${width} 0 0 1 ${opening.x1 + px * width} ${opening.y1 + py * width}`}
      fill="none"
      stroke="#b0b0b5"
      strokeWidth={0.028}
    />
  );
}

/** 12′ 4″ — how a tape measure reads, not 12.3 feet. */
function formatFeetInches(meters: number): string {
  const totalInches = Math.round(metersToFeet(meters) * 12);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return inches === 0 ? `${feet}′` : `${feet}′ ${inches}″`;
}
