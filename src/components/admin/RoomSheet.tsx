"use client";

import { useEffect, useState } from "react";
import FloorPlan from "./FloorPlan";
import AffectedAreaEditor, { type DraftArea } from "./AffectedAreaEditor";
import MeasureInfo from "./MeasureInfo";
import RoomEvidence from "./RoomEvidence";
import MoistureLog from "./MoistureLog";
import { tapFeedback } from "@/lib/haptics";
import { MEASURE_DEFINITIONS, type MeasureDefinition } from "@/lib/crm/measureDefinitions";
import { createArea, deleteArea, listRoomAreas } from "@/lib/areasClient";
import { areaColor, DAMAGE_LABEL, type AffectedArea } from "@/lib/crm/areaShapes";
import {
  deleteSavedScan,
  metersToFeet,
  savedCeilingHeightMeters,
  savedFloorAreaSquareMeters,
  savedPerimeterMeters,
  savedWallAreaSquareMeters,
  showRoomModel,
  squareMetersToSquareFeet,
  updateSavedScan,
  type SavedScan,
} from "@/lib/roomScan";

/**
 * One room, opened from the floor plan.
 *
 * A bottom sheet rather than a page, because the room is a detail OF the
 * floor and the plan should stay visible behind it — that is how every
 * scanning app on this phone behaves, and it is what the operator expects
 * when they tap a room on a drawing.
 *
 * The order of the sections is the order the work happens in: what the room
 * measures, then what is damaged in it. The damaged areas are the reason a
 * restoration contractor opened the room at all, so they are never more than
 * one screen away.
 */
export default function RoomSheet({
  room,
  onClose,
  onChanged,
}: {
  room: SavedScan;
  onClose: () => void;
  /** A room was renamed or removed — the floor behind needs to reload. */
  onChanged: () => void;
}) {
  const [name, setName] = useState(room.name);
  const [areas, setAreas] = useState<AffectedArea[] | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which figure's definition is open, if any — the (i) beside each stat.
  const [defining, setDefining] = useState<MeasureDefinition | null>(null);

  const result = room.geometry;

  useEffect(() => {
    let cancelled = false;
    listRoomAreas(room.id)
      .then((list) => {
        if (!cancelled) setAreas(list);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setAreas([]);
        setError(err instanceof Error ? err.message : "Could not load the affected areas.");
      });
    return () => {
      cancelled = true;
    };
  }, [room.id]);

  // From the stored columns, not recomputed from the raw geometry — the
  // columns carry the hand-corrected figures after a plan edit, and they are
  // what the phone, the report and the estimates already read.
  const floorSqFt = squareMetersToSquareFeet(savedFloorAreaSquareMeters(room));
  const wallSqFt = squareMetersToSquareFeet(savedWallAreaSquareMeters(room).net);
  const perimeterFt = metersToFeet(savedPerimeterMeters(room));
  const ceilingFt = metersToFeet(savedCeilingHeightMeters(room));

  async function saveArea(draft: DraftArea) {
    try {
      await createArea({
        roomScanId: room.id,
        name: draft.name,
        damageType: draft.damageType,
        polygon: draft.polygon,
      });
      setAreas(await listRoomAreas(room.id));
      setDrawing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the affected area.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-pointer bg-black/40"
      />

      <div className="relative max-h-[92vh] overflow-y-auto rounded-t-3xl bg-[#f7f7f8] pb-8 shadow-2xl">
        {/* The grab handle: this sheet is dragged up and down on a phone, so
            it has to look like something that can be. */}
        <div className="sticky top-0 z-10 rounded-t-3xl bg-[#f7f7f8]/95 px-4 pb-2 pt-2.5 backdrop-blur">
          <div className="mx-auto h-1 w-9 rounded-full bg-black/15" />
          <div className="mt-2.5 flex items-center gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => {
                if (name.trim() && name !== room.name) {
                  void updateSavedScan(room.id, { name: name.trim() }).then(onChanged);
                }
              }}
              aria-label="Room name"
              className="min-w-0 flex-1 bg-transparent font-heading text-xl font-bold text-charcoal outline-none"
            />
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/[0.06] text-charcoal/50"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {drawing ? (
          <div className="px-4 pt-2">
            <AffectedAreaEditor
              result={result}
              existing={areas ?? []}
              onCancel={() => setDrawing(false)}
              onSave={saveArea}
            />
          </div>
        ) : (
          <div className="space-y-3 px-4 pt-1">
            <div className="overflow-hidden rounded-2xl border border-black/5 bg-white p-3">
              <FloorPlan result={result} name={name} />
            </div>

            <div className="grid grid-cols-4 gap-2">
              {/* The Walls tile shows the NET area, so that is the definition
                  it carries — a tile defined as something it does not show
                  would be worse than no definition. */}
              <Stat
                label="Floor"
                value={floorSqFt}
                unit="sq ft"
                onInfo={() => setDefining(MEASURE_DEFINITIONS.floorArea)}
              />
              <Stat
                label="Walls"
                value={wallSqFt}
                unit="sq ft"
                onInfo={() => setDefining(MEASURE_DEFINITIONS.wallAreaNet)}
              />
              <Stat
                label="Perim."
                value={perimeterFt}
                unit="ft"
                onInfo={() => setDefining(MEASURE_DEFINITIONS.perimeter)}
              />
              <Stat
                label="Ceiling"
                value={ceilingFt}
                unit="ft"
                decimals={1}
                onInfo={() => setDefining(MEASURE_DEFINITIONS.ceilingHeight)}
              />
            </div>

            {result.modelId && (
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  void showRoomModel(result.modelId as string);
                }}
                className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-brand-blue/25 bg-white text-sm font-bold text-brand-blue active:bg-brand-blue/[0.06]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 2 3 7v10l9 5 9-5V7z" strokeLinejoin="round" />
                  <path d="M3 7l9 5 9-5M12 12v10" strokeLinejoin="round" />
                </svg>
                View in 3D
              </button>
            )}

            {/* Affected areas — the measurement that becomes money. */}
            <section className="overflow-hidden rounded-2xl border border-black/5 bg-white">
              <div className="flex items-center justify-between px-4 py-3">
                <h3 className="font-heading text-sm font-bold text-charcoal">Affected areas</h3>
                {areas !== null && areas.length > 0 && (
                  <span className="text-xs font-bold tabular-nums text-charcoal/45">
                    {Math.round(
                      squareMetersToSquareFeet(
                        areas.reduce((sum, area) => sum + Number(area.area_sqm), 0),
                      ),
                    ).toLocaleString("en-CA")}{" "}
                    sq ft
                  </span>
                )}
              </div>

              {areas === null ? (
                <p className="px-4 pb-3 text-sm text-charcoal/40">Loading…</p>
              ) : areas.length === 0 ? (
                <p className="px-4 pb-3 text-sm leading-snug text-charcoal/45">
                  Nothing marked yet. Add the wet, burnt or mouldy part of this
                  room and it gets measured for you.
                </p>
              ) : (
                <ul className="divide-y divide-black/5 border-t border-black/5">
                  {areas.map((area) => (
                    <li key={area.id} className="flex items-center gap-2.5 px-4 py-2.5">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: areaColor(area) }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-charcoal">
                          {area.name}
                        </span>
                        <span className="block text-[11px] text-charcoal/45">
                          {DAMAGE_LABEL[area.damage_type]}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-charcoal">
                        {Math.round(squareMetersToSquareFeet(Number(area.area_sqm)))} sq ft
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${area.name}`}
                        onClick={async () => {
                          tapFeedback("medium");
                          await deleteArea(area.id);
                          setAreas(await listRoomAreas(room.id));
                        }}
                        className="shrink-0 cursor-pointer p-1 text-charcoal/25 hover:text-red-600"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-black/5 p-3">
                <button
                  type="button"
                  onClick={() => {
                    tapFeedback("medium");
                    setDrawing(true);
                  }}
                  className="h-11 w-full cursor-pointer rounded-xl bg-brand-blue text-sm font-bold text-white active:bg-brand-blue/90"
                >
                  Add a new area
                </button>
              </div>
            </section>

            <MoistureLog roomId={room.id} />

            <RoomEvidence roomId={room.id} initialNotes={room.notes ?? null} />

            <p className="px-1 text-[11px] leading-snug text-charcoal/45">
              {result.walls.length} wall{result.walls.length === 1 ? "" : "s"} ·{" "}
              {result.doorCount} door{result.doorCount === 1 ? "" : "s"} ·{" "}
              {result.windowCount} window{result.windowCount === 1 ? "" : "s"}
              {result.stairCount > 0 && " · staircase"}
            </p>

            {error && (
              <p role="alert" className="px-1 text-xs font-medium text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={async () => {
                tapFeedback("medium");
                await deleteSavedScan(room.id);
                onChanged();
                onClose();
              }}
              className="w-full cursor-pointer py-2 text-xs font-bold text-charcoal/35 hover:text-red-600"
            >
              Remove this room
            </button>
          </div>
        )}
      </div>

      {defining && <MeasureInfo meaning={defining} onClose={() => setDefining(null)} />}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  decimals = 0,
  onInfo,
}: {
  label: string;
  value: number;
  unit: string;
  decimals?: number;
  /** Opens the figure's definition. The whole tile is the target — a 9px
      glyph alone is not something a thumb can hit on site. */
  onInfo?: () => void;
}) {
  const body = (
    <>
      <span className="flex items-center justify-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-charcoal/40">
        {label}
        {onInfo && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8v.5" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <span className="mt-0.5 block font-heading text-base font-bold tabular-nums text-charcoal">
        {value.toLocaleString("en-CA", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
      </span>
      <span className="block text-[9px] font-semibold text-charcoal/40">{unit}</span>
    </>
  );

  if (!onInfo) {
    return <div className="rounded-xl border border-black/5 bg-white px-2 py-2 text-center">{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onInfo}
      aria-label={`${label} — what this figure means`}
      className="cursor-pointer rounded-xl border border-black/5 bg-white px-2 py-2 text-center active:bg-black/[0.03]"
    >
      {body}
    </button>
  );
}
