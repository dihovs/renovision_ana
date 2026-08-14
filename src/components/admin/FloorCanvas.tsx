"use client";

import { useMemo, useRef, useState } from "react";
import { tapFeedback } from "@/lib/haptics";
import { resolvePlacements, zoomTo, type Placed } from "@/lib/floorLayout";
import {
  squareMetersToSquareFeet,
  toFloorPlan,
  totalFloorAreaSquareMeters,
  type SavedScan,
} from "@/lib/roomScan";

/**
 * A floor's rooms as one drawing, room by room.
 *
 * Tapping a room zooms to it and fades the rest — the plan becomes a way of
 * choosing a room rather than a picture of one. That is the behaviour the
 * operator asked for after using Magicplan, and it is what turns a list of
 * cards into something that reads as a floor.
 *
 * The arrangement honours `plan_x`/`plan_y` where set — rooms scanned in one
 * native capture visit arrive with true registered positions, and dragged
 * rooms keep theirs — and packs the rest: see `floorLayout.ts` for why
 * independently scanned rooms carry no true relative position, and why
 * pretending otherwise would be inventing the building.
 */
export default function FloorCanvas({
  rooms,
  selectedId,
  onSelect,
  arranging = false,
  onPlace,
}: {
  rooms: SavedScan[];
  selectedId: string | null;
  onSelect: (room: SavedScan | null) => void;
  /** In arrange mode a drag moves a room instead of selecting it. Kept as a
      mode rather than a long-press because a plan you can nudge by accident
      while trying to open a room is worse than one extra tap. */
  arranging?: boolean;
  onPlace?: (roomId: string, at: { x: number; y: number }) => void;
}) {
  // Where a room is being dragged right now, before it is committed. Local
  // so the drag is smooth without a round trip per frame.
  const [dragging, setDragging] = useState<{ id: string; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const grabOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const layout = useMemo(() => {
    const plans = rooms.map((room) => toFloorPlan(room.geometry));
    const { placed, width, height } = resolvePlacements(
      plans.map((plan) => ({ width: plan.width, height: plan.height })),
      rooms.map((room) =>
        room.plan_x === null || room.plan_x === undefined || room.plan_y === null || room.plan_y === undefined
          ? null
          : { x: Number(room.plan_x), y: Number(room.plan_y) },
      ),
    );
    return { plans, placed, width, height };
  }, [rooms]);

  if (rooms.length === 0 || layout.width <= 0) return null;

  const pad = 1;
  const selectedIndex = rooms.findIndex((room) => room.id === selectedId);
  // Arranging means seeing the whole floor; zooming to a room while dragging
  // it would move the ground under the finger.
  const target: Placed | null =
    !arranging && selectedIndex >= 0 ? layout.placed[selectedIndex] : null;
  const sheet = { width: layout.width, height: layout.height };

  /** Pointer position in plan metres, undoing the SVG's own letterboxing. */
  function toPlan(event: React.PointerEvent): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const vbW = layout.width + pad * 2;
    const vbH = layout.height + pad * 2;
    // preserveAspectRatio="xMidYMid meet" is the default: the smaller scale
    // wins and the remainder becomes margin, which has to be undone or every
    // drag lands offset on a non-square sheet.
    const scale = Math.min(rect.width / vbW, rect.height / vbH);
    const offX = (rect.width - vbW * scale) / 2;
    const offY = (rect.height - vbH * scale) / 2;
    return {
      x: (event.clientX - rect.left - offX) / scale - pad,
      y: (event.clientY - rect.top - offY) / scale - pad,
    };
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
      <svg
        ref={svgRef}
        viewBox={`${-pad} ${-pad} ${layout.width + pad * 2} ${layout.height + pad * 2}`}
        onPointerMove={(event) => {
          if (!dragging) return;
          const at = toPlan(event);
          if (!at) return;
          setDragging({
            id: dragging.id,
            x: at.x - grabOffset.current.dx,
            y: at.y - grabOffset.current.dy,
          });
        }}
        onPointerUp={() => {
          if (!dragging) return;
          onPlace?.(dragging.id, { x: dragging.x, y: dragging.y });
          setDragging(null);
        }}
        onPointerLeave={() => {
          if (!dragging) return;
          onPlace?.(dragging.id, { x: dragging.x, y: dragging.y });
          setDragging(null);
        }}
        className="h-auto w-full touch-none"
        style={{ maxHeight: "62vh" }}
        role="img"
        aria-label={`Floor plan with ${rooms.length} rooms`}
        onClick={() => {
          // Tapping the sheet outside any room clears the selection, which
          // is how you get back out of a zoom without a button.
          if (selectedId) {
            tapFeedback();
            onSelect(null);
          }
        }}
      >
        <g
          transform={zoomTo(target, sheet)}
          style={{ transition: "transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1)" }}
        >
          {rooms.map((room, index) => {
            const plan = layout.plans[index];
            const at = layout.placed[index];
            const isSelected = room.id === selectedId;
            const isDragging = dragging?.id === room.id;
            const dimmed = !arranging && selectedId !== null && !isSelected;
            const px = isDragging ? dragging.x : at.x;
            const py = isDragging ? dragging.y : at.y;

            // toFloorPlan already normalises each plan to the origin, so a
            // room only needs moving to its slot — nothing about its
            // geometry depends on where it landed on the sheet.
            return (
              <g
                key={room.id}
                transform={`translate(${px},${py})`}
                style={{
                  opacity: dimmed ? 0.22 : 1,
                  transition: isDragging ? "none" : "opacity 260ms ease",
                  cursor: arranging ? "grab" : "pointer",
                }}
                onPointerDown={(event) => {
                  if (!arranging) return;
                  event.stopPropagation();
                  const start = toPlan(event);
                  if (!start) return;
                  // Grab the room where it was touched, so it does not jump
                  // its own corner to the finger.
                  grabOffset.current = { dx: start.x - at.x, dy: start.y - at.y };
                  tapFeedback("medium");
                  setDragging({ id: room.id, x: at.x, y: at.y });
                }}
                onClick={(event) => {
                  if (arranging) return;
                  event.stopPropagation();
                  tapFeedback();
                  onSelect(isSelected ? null : room);
                }}
              >
                {plan.polygon.length > 0 && (
                  <polygon
                    points={plan.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill={isSelected || isDragging ? "#e8f0fb" : "#efeff0"}
                  />
                )}

                {plan.segments.map((s, i) => (
                  <line
                    key={i}
                    x1={s.x1}
                    y1={s.y1}
                    x2={s.x2}
                    y2={s.y2}
                    stroke={isSelected || isDragging ? "#1f6fd0" : "#141414"}
                    strokeWidth={0.14}
                    strokeLinecap="square"
                  />
                ))}

                {/* An invisible hit area over the room's box: thin wall
                    strokes are a hard target for a thumb. */}
                <rect width={plan.width} height={plan.height} fill="transparent" />

                {/* White halo under the glyphs. A label sits at the centre
                    of the room's bounding box, and a wall can run straight
                    through that point — without this, the name of an
                    L-shaped room is drawn struck through. paint-order puts
                    the stroke behind the fill so the letters stay sharp. */}
                <text
                  x={plan.width / 2}
                  y={plan.height / 2 - 0.1}
                  textAnchor="middle"
                  stroke="#ffffff"
                  strokeWidth={0.16}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                  style={{ fontSize: 0.42, fontWeight: 700, fill: "#1a1a1a", pointerEvents: "none" }}
                >
                  {room.name}
                </text>
                <text
                  x={plan.width / 2}
                  y={plan.height / 2 + 0.5}
                  textAnchor="middle"
                  stroke="#ffffff"
                  strokeWidth={0.14}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                  style={{ fontSize: 0.34, fill: "#6b6b70", pointerEvents: "none" }}
                >
                  {Math.round(
                    squareMetersToSquareFeet(totalFloorAreaSquareMeters(room.geometry)),
                  ).toLocaleString("en-CA")}{" "}
                  sq ft
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {rooms.length > 1 && (
        <p className="border-t border-black/5 px-3 py-2 text-[11px] leading-snug text-charcoal/40">
          {arranging
            ? "Drag each room into place. Every room stays exactly the size it was measured — moving one never resizes it."
            : "Each room is drawn to scale from its own scan. Tap a room to open it, or Arrange to drag them into place."}
        </p>
      )}
    </div>
  );
}
