"use client";

import { useState } from "react";
import FloorPlan from "./FloorPlan";
import { tapFeedback } from "@/lib/haptics";
import {
  ceilingHeightMeters,
  metersToFeet,
  squareMetersToSquareFeet,
  totalFloorAreaSquareMeters,
  totalWallLengthMeters,
  type RoomScanResult,
} from "@/lib/roomScan";

/**
 * What just got measured, before it is filed.
 *
 * A scan used to save itself the instant RoomPlan handed it back, named
 * "Room 3". That is wrong in both directions: a bad capture got kept, and a
 * good one got a name nobody would recognise a week later at the desk.
 *
 * The operator is standing in the room when this appears, which is the only
 * moment they can do either thing well — name it, or walk it again. Ten
 * seconds here saves a return visit.
 */
export default function ScanReview({
  result,
  suggestedName,
  level,
  measuredBy = "scan",
  onSave,
  onRescan,
  onDiscard,
}: {
  result: RoomScanResult;
  suggestedName: string;
  level: string;
  /** How this was measured — decides the wording, and whether "Scan again"
      means the camera or the keypad. */
  measuredBy?: "scan" | "manual";
  onSave: (name: string) => void | Promise<void>;
  onRescan: () => void;
  onDiscard: () => void;
}) {
  const [name, setName] = useState(suggestedName);
  const [saving, setSaving] = useState(false);

  const floorSqFt = squareMetersToSquareFeet(totalFloorAreaSquareMeters(result));
  const perimeterFt = metersToFeet(totalWallLengthMeters(result));
  const ceilingFt = metersToFeet(ceilingHeightMeters(result));

  // A capture with no walls, or with no floor, is one RoomPlan could not make
  // sense of. Saying so here — where "Scan again" is one tap and the operator
  // has not left the room — is worth more than a clean-looking empty room in
  // the list. Typed rooms are exempt: a rectangle is four walls by
  // construction, so warning that it looks incomplete would be nonsense.
  const looksWrong = measuredBy === "scan" && (result.walls.length < 3 || floorSqFt < 5);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/45" />

      <div className="relative max-h-[94vh] overflow-y-auto rounded-t-3xl bg-[#f7f7f8] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
        <div className="mx-auto h-1 w-9 rounded-full bg-black/15" />
        <h2 className="mt-3 text-center font-heading text-base font-bold text-charcoal">
          Room measured
        </h2>
        <p className="mt-0.5 text-center text-xs text-charcoal/45">{level}</p>

        <div className="mt-3 overflow-hidden rounded-2xl border border-black/5 bg-white p-3">
          <FloorPlan result={result} name={name || "Room"} />
        </div>

        {looksWrong && (
          <p
            role="alert"
            className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-800"
          >
            This capture looks incomplete — {result.walls.length} wall
            {result.walls.length === 1 ? "" : "s"} and{" "}
            {Math.round(floorSqFt)} sq ft of floor. Walk the room again with the
            phone up, pointing at every wall in turn.
          </p>
        )}

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Figure label="Floor" value={floorSqFt} unit="sq ft" />
          <Figure label="Perimeter" value={perimeterFt} unit="ft" />
          <Figure label="Ceiling" value={ceilingFt} unit="ft" decimals={1} />
        </div>

        <label
          htmlFor="scan-room-name"
          className="mt-4 block text-xs font-bold uppercase tracking-wide text-charcoal/45"
        >
          Name this room
        </label>
        <input
          id="scan-room-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Kitchen, Basement bathroom…"
          autoComplete="off"
          className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-charcoal outline-none transition-colors placeholder:text-charcoal/30 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
        />

        {/* Common names, because typing on a phone in a wet basement with
            gloves on is the actual situation this is used in. */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_NAMES.map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => {
                tapFeedback();
                setName(quick);
              }}
              className="cursor-pointer rounded-full bg-black/[0.05] px-3 py-1.5 text-xs font-bold text-charcoal/60 active:bg-black/[0.09]"
            >
              {quick}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={async () => {
            tapFeedback("medium");
            setSaving(true);
            try {
              await onSave(name.trim());
            } finally {
              setSaving(false);
            }
          }}
          className="mt-4 h-13 w-full cursor-pointer rounded-2xl bg-brand-blue py-3.5 text-base font-bold text-white shadow-lg shadow-brand-blue/25 active:scale-[0.98] disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save room"}
        </button>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              tapFeedback("medium");
              onRescan();
            }}
            className="h-12 flex-1 cursor-pointer rounded-2xl bg-white text-sm font-bold text-charcoal/70 active:bg-black/[0.03] disabled:opacity-40"
          >
            {measuredBy === "manual" ? "Change the numbers" : "Scan again"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              tapFeedback();
              onDiscard();
            }}
            className="h-12 cursor-pointer px-5 text-sm font-semibold text-charcoal/40 active:text-red-600 disabled:opacity-40"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

const QUICK_NAMES = [
  "Kitchen",
  "Bathroom",
  "Bedroom",
  "Living room",
  "Hallway",
  "Laundry",
  "Storage",
];

function Figure({
  label,
  value,
  unit,
  decimals = 0,
}: {
  label: string;
  value: number;
  unit: string;
  decimals?: number;
}) {
  return (
    <div className="rounded-xl border border-black/5 bg-white px-2 py-2.5 text-center">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-charcoal/40">
        {label}
      </span>
      <span className="mt-0.5 block font-heading text-lg font-bold tabular-nums text-charcoal">
        {value.toLocaleString("en-CA", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
      </span>
      <span className="block text-[9px] font-semibold text-charcoal/40">{unit}</span>
    </div>
  );
}
