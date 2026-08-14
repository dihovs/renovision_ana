"use client";

import { useEffect, useState } from "react";
import MeasureInfo from "./MeasureInfo";
import { squareMetersToSquareFeet } from "@/lib/roomScan";
import { LIVING_AREA_DEFINITION, type LivingAreaTotals } from "@/lib/crm/livingArea";

/**
 * What counts as living area on this property, and why.
 *
 * The totals AND the working. A living-area figure with no breakdown is one
 * an adjuster has to take on faith, and they will not — so every room that
 * contributed nothing says why it contributed nothing, right there.
 *
 * The web half of the native `LivingAreaCard` (LevelCanvas.swift): same
 * endpoint, same shape of information — above grade leads, below grade is
 * never folded into it, the excluded figure is stated rather than left as a
 * gap somebody has to reconcile, and the definition is one tap away.
 */

type LivingAreaResponse = {
  totals: LivingAreaTotals;
  definition: string;
};

const sqft = (sqm: number) =>
  Math.round(squareMetersToSquareFeet(sqm)).toLocaleString("en-CA");

export default function LivingAreaCard({ projectId }: { projectId: string }) {
  const [result, setResult] = useState<LivingAreaResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showingDefinition, setShowingDefinition] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/living-area?projectId=${encodeURIComponent(projectId)}`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load the living area.");
        return response.json() as Promise<LivingAreaResponse>;
      })
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const totals = result?.totals;

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <button
        type="button"
        onClick={() => setShowingDefinition(true)}
        aria-label="Living area — what this figure means"
        className="flex cursor-pointer items-center gap-1 font-heading text-sm font-bold text-charcoal"
      >
        Living area
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-charcoal/40" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8v.5" strokeLinecap="round" />
        </svg>
      </button>

      {failed ? (
        <p className="mt-2 text-sm text-charcoal/45">
          Could not load the living area — reload to try again.
        </p>
      ) : !totals ? (
        <p className="mt-2 text-sm text-charcoal/45">Working it out…</p>
      ) : totals.rooms.length === 0 ? (
        <p className="mt-2 text-sm text-charcoal/45">
          Measure some rooms and set their types to see this.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div>
              <p className="font-heading text-2xl font-bold tabular-nums text-charcoal">
                {sqft(totals.aboveGradeSqm)}
                <span className="ml-1 text-xs font-semibold text-charcoal/50">sq ft</span>
              </p>
              <p className="text-[11px] text-charcoal/45">above grade</p>
            </div>
            {/* Below grade is its own figure, never summed into the headline:
                a total that silently includes a basement is the most common
                way a living-area number gets challenged. */}
            {totals.belowGradeSqm > 0 && (
              <div>
                <p className="font-heading text-lg font-semibold tabular-nums text-charcoal/75">
                  {sqft(totals.belowGradeSqm)}
                  <span className="ml-1 text-xs font-semibold text-charcoal/50">sq ft</span>
                </p>
                <p className="text-[11px] text-charcoal/45">below grade</p>
              </div>
            )}
          </div>

          {totals.excludedSqm > 0 && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              {sqft(totals.excludedSqm)} sq ft measured but not counted
            </p>
          )}

          <button
            type="button"
            onClick={() => setExpanded((on) => !on)}
            className="mt-2 cursor-pointer text-xs font-semibold text-brand-blue"
          >
            {expanded ? "Hide the working" : "Show the working"}
          </button>

          {expanded && (
            <ul className="mt-2 space-y-1.5 border-t border-black/5 pt-2">
              {totals.rooms.map((room) => (
                <li key={room.id} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-charcoal">{room.name}</span>
                  {/* Why a room contributed less than its floor area — the
                      answer to the question before it gets asked. */}
                  {room.belowMinHeight ? (
                    <span className="shrink-0 text-[10px] text-amber-700">ceiling under 7 ft</span>
                  ) : room.band === "excluded" ? (
                    <span className="shrink-0 text-[10px] text-charcoal/40">not living area</span>
                  ) : room.percentApplied !== 100 ? (
                    <span className="shrink-0 text-[10px] text-charcoal/40">
                      {Math.round(room.percentApplied)}%
                    </span>
                  ) : null}
                  <span
                    className={`shrink-0 font-semibold tabular-nums ${
                      room.countedSqm > 0 ? "text-charcoal" : "text-charcoal/40"
                    }`}
                  >
                    {sqft(room.countedSqm)} sq ft
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* The definition is imported from the same module the API serves it
          from, so it is available before — and identical to — the response. */}
      {showingDefinition && (
        <MeasureInfo
          meaning={{ id: "living-area", title: "Living area", definition: LIVING_AREA_DEFINITION }}
          onClose={() => setShowingDefinition(false)}
        />
      )}
    </section>
  );
}
