"use client";

import { useEffect, useState } from "react";
import { tapFeedback } from "@/lib/haptics";
import {
  metersToFeet,
  roomScanSupport,
  scanRoom,
  showRoomModel,
  squareMetersToSquareFeet,
  toFloorPlan,
  totalFloorAreaSquareMeters,
  totalWallLengthMeters,
  type RoomScanResult,
  type ScanSupport,
} from "@/lib/roomScan";

/**
 * Measure a property with the phone, room by room.
 *
 * The scanning itself is Apple's RoomPlan — its own AR view, its own
 * wall-detection guidance — presented full-screen by the native plugin. What
 * comes back is geometry in metres; everything here turns that into the
 * imperial figures this price book is written in, because a scan that hands
 * back square metres to a business quoting in square feet has moved the
 * conversion problem rather than solved it.
 *
 * MULTI-ROOM IS THE POINT. A water-damage job is "the basement, the hallway
 * and the downstairs bathroom", not one room — so this keeps a list and
 * totals it. The running total across rooms is the number that actually goes
 * into a flooring line; a per-room figure means adding them up by hand at the
 * van, which is where mistakes come from.
 *
 * Deliberately does NOT auto-build a quote. The measurement is a fact; which
 * line items it justifies is a judgement, and this screen's job is to give
 * honest numbers to the person making it.
 */

/**
 * Which storey a room is on. RoomPlan scans one room at a time and has no
 * concept of a building, so the level is ours to track — and it has to be,
 * because "180 sq ft of flooring" means something different when it's split
 * across a basement and a second floor.
 */
const LEVELS = ["Basement", "Ground", "2nd", "3rd", "Attic"] as const;
type Level = (typeof LEVELS)[number];

type ScannedRoom = { id: string; name: string; level: Level; result: RoomScanResult };

type Status =
  | { kind: "checking" }
  | { kind: "unsupported"; support: ScanSupport }
  | { kind: "ready" }
  | { kind: "scanning" }
  | { kind: "failed"; message: string };

export default function RoomScanner() {
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [rooms, setRooms] = useState<ScannedRoom[]>([]);
  // The storey the next scan lands on, so a whole floor can be walked
  // without setting it per room.
  const [level, setLevel] = useState<Level>("Ground");

  useEffect(() => {
    let cancelled = false;
    roomScanSupport().then((support) => {
      if (cancelled) return;
      setStatus(
        support.state === "supported" ? { kind: "ready" } : { kind: "unsupported", support },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function start() {
    tapFeedback("medium");
    setStatus({ kind: "scanning" });
    try {
      const result = await scanRoom();
      setRooms((current) => [
        ...current,
        {
          id: `room-${Date.now()}`,
          name: `Room ${current.filter((r) => r.level === level).length + 1}`,
          level,
          result,
        },
      ]);
      setStatus({ kind: "ready" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Cancelling is not failing — it's the ordinary way to back out of a
      // scan, and an error card would read as something having gone wrong.
      if (/cancel/i.test(message)) setStatus({ kind: "ready" });
      else setStatus({ kind: "failed", message });
    }
  }

  if (status.kind === "checking") {
    return <p className="text-sm text-charcoal/45">Checking this device…</p>;
  }

  if (status.kind === "unsupported") {
    const { support } = status;
    return (
      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-sm font-bold text-charcoal">
          {support.state === "plugin-missing"
            ? "Scanning isn't wired up in this build"
            : support.state === "not-native"
              ? "Open this in the app to scan"
              : "This device can't scan rooms"}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-charcoal/60">
          {support.state === "plugin-missing" ? (
            <>
              The scanner is missing from the installed app, so this says
              nothing about the phone. Rebuild and reinstall from Xcode.
            </>
          ) : support.state === "not-native" ? (
            <>
              Room scanning uses the phone&apos;s LiDAR sensor, which a browser
              tab can&apos;t reach. Open Renovision on the iPhone.
            </>
          ) : (
            <>
              Room scanning needs the LiDAR sensor, which is on iPhone Pro
              models (12 Pro and later) and iPad Pro from 2020. Everything else
              in the app works normally here.
            </>
          )}
        </p>
        {support.state === "plugin-missing" && (
          <p className="mt-2 font-mono text-[11px] leading-snug text-charcoal/40">
            {support.detail}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {rooms.length === 0 && (
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="font-heading text-sm font-bold text-charcoal">Measure a property</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-charcoal/60">
            Walk each room slowly with the phone up, pointing at every wall in
            turn. Scan as many rooms as the job covers — they add up into one
            total you can price flooring, paint, drywall and baseboard from,
            without a tape measure.
          </p>
        </div>
      )}

      {status.kind === "failed" && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {status.message}
        </p>
      )}

      {rooms.length > 1 && <Totals rooms={rooms} />}

      {/* Which storey the next scan belongs to. A row of chips rather than a
          select: it gets set once per floor and then left alone, so it
          should be one tap and always visible, not hidden in a menu. */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {LEVELS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              tapFeedback();
              setLevel(option);
            }}
            aria-pressed={level === option}
            className={`shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
              level === option
                ? "bg-charcoal text-white"
                : "bg-black/[0.05] text-charcoal/55 hover:bg-black/[0.08]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {LEVELS.filter((l) => rooms.some((room) => room.level === l)).map((levelName) => {
        const levelRooms = rooms.filter((room) => room.level === levelName);
        return (
          <div key={levelName} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-charcoal/45">
                {levelName}
              </h2>
              <span className="text-xs font-semibold tabular-nums text-charcoal/40">
                {round(
                  levelRooms.reduce(
                    (sum, room) =>
                      sum + squareMetersToSquareFeet(totalFloorAreaSquareMeters(room.result)),
                    0,
                  ),
                )}{" "}
                sq ft
              </span>
            </div>
            {levelRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onRename={(name) =>
                  setRooms((current) =>
                    current.map((r) => (r.id === room.id ? { ...r, name } : r)),
                  )
                }
                onRemove={() => {
                  tapFeedback();
                  setRooms((current) => current.filter((r) => r.id !== room.id));
                }}
                defaultOpen={room.id === rooms[rooms.length - 1]?.id}
              />
            ))}
          </div>
        );
      })}

      <button
        type="button"
        onClick={start}
        disabled={status.kind === "scanning"}
        className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-brand-blue text-base font-bold text-white shadow-lg shadow-brand-blue/20 transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {status.kind === "scanning"
          ? "Scanning…"
          : rooms.length === 0
            ? "Start scan"
            : "Add another room"}
      </button>
    </div>
  );
}

/** The whole-job numbers. Only shown once there's more than one room to add
    up — with a single room it would just repeat the card below it. */
function Totals({ rooms }: { rooms: ScannedRoom[] }) {
  const floorSqFt = rooms.reduce(
    (sum, room) => sum + squareMetersToSquareFeet(totalFloorAreaSquareMeters(room.result)),
    0,
  );
  const perimeterFt = rooms.reduce(
    (sum, room) => sum + metersToFeet(totalWallLengthMeters(room.result)),
    0,
  );
  const wallAreaSqFt = rooms.reduce((sum, room) => sum + wallAreaOf(room.result), 0);

  return (
    <div className="rounded-2xl bg-charcoal-dark p-4 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-wide text-white/50">
        All {rooms.length} rooms
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <DarkFigure label="Floor" value={round(floorSqFt)} unit="sq ft" />
        <DarkFigure label="Wall area" value={round(wallAreaSqFt)} unit="sq ft" />
        <DarkFigure label="Perimeter" value={round(perimeterFt)} unit="ft" />
      </div>
    </div>
  );
}

function RoomCard({
  room,
  onRename,
  onRemove,
  defaultOpen,
}: {
  room: ScannedRoom;
  onRename: (name: string) => void;
  onRemove: () => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { result } = room;

  const floorSqFt = squareMetersToSquareFeet(totalFloorAreaSquareMeters(result));
  const perimeterFt = metersToFeet(totalWallLengthMeters(result));
  const heightFt = metersToFeet(tallestWallMeters(result));

  return (
    <section className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
        <input
          value={room.name}
          onChange={(event) => onRename(event.target.value)}
          aria-label="Room name"
          className="min-w-0 flex-1 bg-transparent font-heading text-base font-bold text-charcoal outline-none"
        />
        <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-charcoal/50">
          {round(floorSqFt)} sq ft
        </span>
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            setOpen((v) => !v);
          }}
          aria-label={open ? "Collapse" : "Expand"}
          aria-expanded={open}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-charcoal/40 transition-colors hover:bg-black/[0.04]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="space-y-4 p-4">
          <FloorPlanSketch result={result} name={room.name} />

          {result.modelId && (
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                void showRoomModel(result.modelId as string);
              }}
              className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-brand-blue/30 bg-brand-blue/[0.04] text-sm font-bold text-brand-blue transition-colors active:bg-brand-blue/[0.1]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 2 3 7v10l9 5 9-5V7z" strokeLinejoin="round" />
                <path d="M3 7l9 5 9-5M12 12v10" strokeLinejoin="round" />
              </svg>
              View 3D model
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Figure label="Floor" value={round(floorSqFt)} unit="sq ft" hint="Flooring, underlay" />
            <Figure
              label="Wall area"
              value={round(wallAreaOf(result))}
              unit="sq ft"
              hint="Paint, drywall"
            />
            <Figure label="Perimeter" value={round(perimeterFt)} unit="ft" hint="Baseboard, trim" />
            <Figure label="Ceiling" value={round(heightFt, 1)} unit="ft" hint="Tallest wall" />
          </div>

          <p className="text-sm text-charcoal/70">
            {result.walls.length} wall{result.walls.length === 1 ? "" : "s"} ·{" "}
            {result.doorCount} door{result.doorCount === 1 ? "" : "s"} ·{" "}
            {result.windowCount} window{result.windowCount === 1 ? "" : "s"}
            {result.openingCount > 0 &&
              ` · ${result.openingCount} opening${result.openingCount === 1 ? "" : "s"}`}
            {result.stairCount > 0 && (
              <span className="font-semibold text-brand-blue">
                {" "}
                · {result.stairCount} staircase{result.stairCount === 1 ? "" : "s"}
              </span>
            )}
          </p>

          {result.stairCount > 0 && (
            <p className="rounded-lg bg-brand-blue/[0.06] px-3 py-2 text-[11px] leading-snug text-brand-blue">
              A staircase was detected. Its treads and risers are not in the
              floor area above — price that separately.
            </p>
          )}

          <p className="text-[11px] leading-snug text-charcoal/45">
            Wall area is the perimeter × the tallest wall and does not deduct
            the doors and windows above — trim it down before pricing paint on
            a room with a lot of glass.
          </p>

          <button
            type="button"
            onClick={onRemove}
            className="cursor-pointer text-xs font-bold text-charcoal/35 transition-colors hover:text-red-600"
          >
            Remove this room
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * The room from above, drawn from the wall transforms.
 *
 * A plain SVG in metres with the viewBox doing the scaling, so it fits any
 * width without arithmetic here. Padded by half a metre so the strokes at the
 * extremes aren't clipped by the edge of the box.
 */
/**
 * The room as a drawn plan, in the drafting conventions a printed floor plan
 * actually uses — measured against Magicplan's own output rather than
 * invented:
 *
 *   - solid black walls with real thickness, light grey floor behind them
 *   - openings cut clean out of the wall, doors with a swing arc
 *   - dimensions on witness lines OUTSIDE the plan, with arrowheads, the
 *     overall span on the outer tier and per-wall breakdowns on the inner
 *     one; horizontal text across the top, rotated up the side
 *   - a scale bar, because a plan without one is a picture
 *
 * The earlier version rotated a bare number along each wall, which is why
 * it read as a sketch: no witness lines, no arrows, no overall span, and
 * labels that fought the walls they sat on.
 */
function FloorPlanSketch({ result, name }: { result: RoomScanResult; name: string }) {
  const plan = toFloorPlan(result);
  if (plan.segments.length === 0) return null;

  const WALL = 0.16;
  // Asymmetric on purpose: the vertical dimensions live off the right edge
  // and their rotated text needs more room than the bare left margin does.
  const padLeft = 1.1;
  const padRight = 2.0;
  const padTop = 1.5;
  const padBottom = 2.2;
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
    <div className="overflow-hidden rounded-xl border border-black/5 bg-white">
      <svg
        viewBox={`${-padLeft} ${-padTop} ${width + padLeft + padRight} ${height + padTop + padBottom}`}
        className="h-auto w-full"
        style={{ maxHeight: "56vh" }}
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

/** Perimeter × the tallest wall. The tallest rather than an average: a room
    with a raked ceiling is priced off the height material has to reach. */
function wallAreaOf(result: RoomScanResult): number {
  return metersToFeet(totalWallLengthMeters(result)) * metersToFeet(tallestWallMeters(result));
}

function tallestWallMeters(result: RoomScanResult): number {
  return result.walls.reduce((tallest, wall) => Math.max(tallest, wall.heightMeters), 0);
}

function Figure({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-black/5 bg-black/[0.015] p-3">
      <span className="text-xs font-bold uppercase tracking-wide text-charcoal/45">{label}</span>
      <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-charcoal">
        {value}
        <span className="ml-1 text-sm font-semibold text-charcoal/50">{unit}</span>
      </p>
      <p className="mt-0.5 text-[11px] text-charcoal/40">{hint}</p>
    </div>
  );
}

function DarkFigure({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <span className="text-[11px] font-bold uppercase tracking-wide text-white/45">{label}</span>
      <p className="mt-0.5 font-heading text-xl font-bold tabular-nums text-white">
        {value}
        <span className="ml-1 text-xs font-semibold text-white/50">{unit}</span>
      </p>
    </div>
  );
}

function round(value: number, decimals = 0): string {
  return value.toLocaleString("en-CA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
