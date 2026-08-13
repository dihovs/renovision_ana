"use client";

import { useMemo } from "react";
import { tapFeedback } from "@/lib/haptics";
import { packRooms, zoomTo, type Placed } from "@/lib/floorLayout";
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
 * The arrangement is packed, not surveyed: see `floorLayout.ts` for why
 * independently scanned rooms carry no true relative position, and why
 * pretending otherwise would be inventing the building.
 */
export default function FloorCanvas({
  rooms,
  selectedId,
  onSelect,
}: {
  rooms: SavedScan[];
  selectedId: string | null;
  onSelect: (room: SavedScan | null) => void;
}) {
  const layout = useMemo(() => {
    const plans = rooms.map((room) => toFloorPlan(room.geometry));
    const { placed, width, height } = packRooms(
      plans.map((plan) => ({ width: plan.width, height: plan.height })),
    );
    return { plans, placed, width, height };
  }, [rooms]);

  if (rooms.length === 0 || layout.width <= 0) return null;

  const pad = 1;
  const selectedIndex = rooms.findIndex((room) => room.id === selectedId);
  const target: Placed | null = selectedIndex >= 0 ? layout.placed[selectedIndex] : null;
  const sheet = { width: layout.width, height: layout.height };

  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
      <svg
        viewBox={`${-pad} ${-pad} ${layout.width + pad * 2} ${layout.height + pad * 2}`}
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
            const dimmed = selectedId !== null && !isSelected;

            // toFloorPlan already normalises each plan to the origin, so a
            // room only needs moving to its slot — nothing about its
            // geometry depends on where it landed on the sheet.
            return (
              <g
                key={room.id}
                transform={`translate(${at.x},${at.y})`}
                style={{
                  opacity: dimmed ? 0.22 : 1,
                  transition: "opacity 260ms ease",
                  cursor: "pointer",
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  tapFeedback();
                  onSelect(isSelected ? null : room);
                }}
              >
                {plan.polygon.length > 0 && (
                  <polygon
                    points={plan.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill={isSelected ? "#e8f0fb" : "#efeff0"}
                  />
                )}

                {plan.segments.map((s, i) => (
                  <line
                    key={i}
                    x1={s.x1}
                    y1={s.y1}
                    x2={s.x2}
                    y2={s.y2}
                    stroke={isSelected ? "#1f6fd0" : "#141414"}
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
          Each room is drawn to scale from its own scan. They are laid out side
          by side, not joined — a scan measures one room and does not record
          where it sits against the next. Tap a room to open it.
        </p>
      )}
    </div>
  );
}
