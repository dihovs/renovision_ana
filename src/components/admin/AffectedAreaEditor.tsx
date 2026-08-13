"use client";

import { useState } from "react";
import { tapFeedback } from "@/lib/haptics";
import { squareMetersToSquareFeet, toFloorPlan, type RoomScanResult } from "@/lib/roomScan";
import {
  areaColor,
  polygonAreaSqm,
  DAMAGE_LABEL,
  DAMAGE_TYPES,
  type AffectedArea,
  type AreaPoint,
  type DamageType,
} from "@/lib/crm/areaShapes";

/**
 * Mark the damaged part of a room, on the plan.
 *
 * The interaction is REDUCTIVE, which is how a restoration estimator thinks
 * and how the tools they already use behave: a new area opens covering the
 * whole floor, and the operator pulls it in to the wet part. Drawing from
 * nothing would mean tracing a shape freehand on a phone, standing in a
 * basement, which is slower and less accurate than dragging four corners.
 *
 * Corners are dragged with a pointer; tapping an edge inserts a corner
 * there, so an L-shaped patch is three taps rather than a redraw.
 *
 * Everything is in metres in the plan's own coordinate space — the same
 * space the walls are drawn in — so an area needs no transform to line up
 * with the room, and none of the maths cares what units the screen shows.
 */

export type DraftArea = {
  name: string;
  damageType: DamageType;
  polygon: AreaPoint[];
};

export default function AffectedAreaEditor({
  result,
  existing,
  onCancel,
  onSave,
}: {
  result: RoomScanResult;
  /** Areas already recorded on this room, drawn behind for context. */
  existing?: AffectedArea[];
  onCancel: () => void;
  onSave: (draft: DraftArea) => void | Promise<void>;
}) {
  const plan = toFloorPlan(result);

  const [draft, setDraft] = useState<DraftArea>(() => ({
    name: "Affected area",
    damageType: "water",
    // Opens covering the room: its outline if the walls closed into one,
    // otherwise the bounding box, which is still a sane thing to pull in
    // from when a scan left the room open.
    polygon:
      plan.polygon.length >= 3
        ? plan.polygon.slice(0, -1).map((p) => ({ x: p.x, y: p.y }))
        : [
            { x: 0, y: 0 },
            { x: plan.width, y: 0 },
            { x: plan.width, y: plan.height },
            { x: 0, y: plan.height },
          ],
  }));
  const [dragging, setDragging] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const pad = 0.6;
  const colour = areaColor({ color: null, damage_type: draft.damageType });
  const sqft = squareMetersToSquareFeet(polygonAreaSqm(draft.polygon));

  /** Screen point → plan metres, via the SVG's own coordinate system. */
  function toPlan(event: React.PointerEvent<SVGSVGElement>): AreaPoint | null {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const vbWidth = plan.width + pad * 2;
    const vbHeight = plan.height + pad * 2;
    // preserveAspectRatio="xMidYMid meet": the smaller scale wins and the
    // remainder is split as margin, which has to be undone here or every
    // drag lands offset on a non-square plan.
    const scale = Math.min(rect.width / vbWidth, rect.height / vbHeight);
    const offsetX = (rect.width - vbWidth * scale) / 2;
    const offsetY = (rect.height - vbHeight * scale) / 2;
    return {
      x: (event.clientX - rect.left - offsetX) / scale - pad,
      y: (event.clientY - rect.top - offsetY) / scale - pad,
    };
  }

  function moveCorner(event: React.PointerEvent<SVGSVGElement>) {
    if (dragging === null) return;
    const point = toPlan(event);
    if (!point) return;
    setDraft((current) => ({
      ...current,
      polygon: current.polygon.map((p, i) => (i === dragging ? point : p)),
    }));
  }

  /** Insert a corner at the midpoint of an edge — how an L gets made. */
  function splitEdge(index: number) {
    tapFeedback();
    setDraft((current) => {
      const next = [...current.polygon];
      const a = next[index];
      const b = next[(index + 1) % next.length];
      next.splice(index + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      return { ...current, polygon: next };
    });
  }

  function removeCorner(index: number) {
    // Three corners is the floor: fewer encloses nothing.
    if (draft.polygon.length <= 3) return;
    tapFeedback("medium");
    setDraft((current) => ({
      ...current,
      polygon: current.polygon.filter((_, i) => i !== index),
    }));
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-black/5 bg-white">
        <svg
          viewBox={`${-pad} ${-pad} ${plan.width + pad * 2} ${plan.height + pad * 2}`}
          className="h-auto w-full touch-none"
          style={{ maxHeight: "56vh" }}
          onPointerMove={moveCorner}
          onPointerUp={() => setDragging(null)}
          onPointerLeave={() => setDragging(null)}
        >
          {plan.polygon.length > 0 && (
            <polygon points={plan.polygon.map((p) => `${p.x},${p.y}`).join(" ")} fill="#ebebeb" />
          )}
          {plan.segments.map((s, i) => (
            <line
              key={`w${i}`}
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
              stroke="#111111"
              strokeWidth={0.16}
              strokeLinecap="square"
            />
          ))}

          {/* Already-recorded areas, so a new one can be placed beside them
              rather than blindly on top. */}
          {(existing ?? []).map((area) => (
            <polygon
              key={area.id}
              points={area.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={areaColor(area)}
              fillOpacity={0.16}
              stroke={areaColor(area)}
              strokeWidth={0.04}
              strokeDasharray="0.18 0.12"
            />
          ))}

          <polygon
            points={draft.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={colour}
            fillOpacity={0.3}
            stroke={colour}
            strokeWidth={0.06}
          />

          {/* Edge handles: the small circle at each midpoint adds a corner. */}
          {draft.polygon.map((p, i) => {
            const next = draft.polygon[(i + 1) % draft.polygon.length];
            return (
              <circle
                key={`e${i}`}
                cx={(p.x + next.x) / 2}
                cy={(p.y + next.y) / 2}
                r={0.11}
                fill="#ffffff"
                stroke={colour}
                strokeWidth={0.035}
                className="cursor-pointer"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  splitEdge(i);
                }}
              />
            );
          })}

          {/* Corner handles. Generous radius — this is dragged with a thumb,
              on a phone, in a basement. */}
          {draft.polygon.map((p, i) => (
            <circle
              key={`c${i}`}
              cx={p.x}
              cy={p.y}
              r={0.17}
              fill={colour}
              stroke="#ffffff"
              strokeWidth={0.05}
              className="cursor-grab"
              onPointerDown={(event) => {
                event.stopPropagation();
                (event.target as Element).releasePointerCapture?.(event.pointerId);
                tapFeedback();
                setDragging(i);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                removeCorner(i);
              }}
            />
          ))}
        </svg>
      </div>

      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between gap-2">
          <input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            aria-label="Area name"
            className="min-w-0 flex-1 bg-transparent font-heading text-base font-bold text-charcoal outline-none"
          />
          <span className="shrink-0 font-heading text-lg font-bold tabular-nums text-charcoal">
            {Math.round(sqft).toLocaleString("en-CA")}
            <span className="ml-1 text-xs font-semibold text-charcoal/50">sq ft</span>
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {DAMAGE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                tapFeedback();
                setDraft({ ...draft, damageType: type });
              }}
              aria-pressed={draft.damageType === type}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                draft.damageType === type
                  ? "text-white"
                  : "bg-black/[0.05] text-charcoal/55 hover:bg-black/[0.08]"
              }`}
              style={
                draft.damageType === type
                  ? { backgroundColor: areaColor({ color: null, damage_type: type }) }
                  : undefined
              }
            >
              {DAMAGE_LABEL[type]}
            </button>
          ))}
        </div>

        <p className="mt-2.5 text-[11px] leading-snug text-charcoal/45">
          Drag a corner to pull the area in. Tap the small circle on an edge to
          add a corner; double-tap a corner to remove it.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={saving || polygonAreaSqm(draft.polygon) <= 0}
            onClick={async () => {
              tapFeedback("medium");
              setSaving(true);
              try {
                await onSave(draft);
              } finally {
                setSaving(false);
              }
            }}
            className="h-11 flex-1 cursor-pointer rounded-xl bg-brand-blue text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save area"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-11 cursor-pointer px-4 text-sm font-semibold text-charcoal/50 transition-colors hover:text-charcoal"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
