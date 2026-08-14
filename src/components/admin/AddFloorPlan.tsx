"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tapFeedback } from "@/lib/haptics";
import { rememberFloor } from "@/lib/floorMemory";
import { COMMON_FLOOR_IDS, FLOOR_LEVELS, type FloorLevel } from "@/lib/crm/floors";
import { AddTile } from "./CollectionShell";

/**
 * Start a floor plan for a storey that has none yet.
 *
 * The storeys are offered as a fixed list rather than a free text box: they
 * are the same five in every house in Quebec, and typing "Bsmt" on one job
 * and "Basement" on the next silently splits one floor into two in every
 * total that groups by level.
 *
 * Most-common-first (spec §6.11): the sheet leads with the three storeys
 * nearly every job is on — `COMMON_FLOOR_IDS` — and keeps the rest one tap
 * behind "See more", the way the reference's Add Floor sheet does.
 */

export default function AddFloorPlan({
  projectId,
  existing,
  variant = "button",
}: {
  projectId: string;
  /** Storeys already measured — marked, since the usual reason to open
      this is to start a floor that does not exist yet. */
  existing: string[];
  /** How the trigger renders: the collection rail's dashed `+` tile, or a
      plain button where there is no rail to lead. */
  variant?: "button" | "tile";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const common = COMMON_FLOOR_IDS.flatMap(
    (id) => FLOOR_LEVELS.filter((level) => level.id === id),
  );
  const rest = FLOOR_LEVELS.filter((level) => !COMMON_FLOOR_IDS.includes(level.id));

  function go(level: string) {
    tapFeedback("medium");
    // Remembered before navigating, so backing out of an empty floor leaves
    // the floor behind rather than losing it. A room landing on it later
    // makes it real and this is reconciled away.
    rememberFloor(projectId, level);
    router.push(`/admin/projects/${projectId}/floors/${encodeURIComponent(level)}`);
  }

  function row(level: FloorLevel) {
    return (
      <button
        key={level.id}
        type="button"
        onClick={() => go(level.id)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left active:bg-black/[0.03]"
      >
        <span className="flex-1 font-heading text-[15px] font-bold text-charcoal">
          {level.label}
        </span>
        {existing.includes(level.id) && (
          <span className="text-[11px] font-semibold text-charcoal/40">measured</span>
        )}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-charcoal/25" aria-hidden>
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  return (
    <>
      {variant === "tile" ? (
        <AddTile
          label="Add floor plan"
          onClick={() => {
            tapFeedback();
            setOpen(true);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            setOpen(true);
          }}
          className="cursor-pointer rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-brand-blue/90"
        >
          Add floor plan
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-pointer bg-black/40"
          />
          <div className="relative rounded-t-3xl bg-[#f7f7f8] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
            <div className="mx-auto h-1 w-9 rounded-full bg-black/15" />
            <h2 className="mt-3 text-center font-heading text-base font-bold text-charcoal">
              Which floor?
            </h2>

            <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-charcoal/40">
              Most common
            </p>
            <div className="mt-1.5 space-y-2">{common.map(row)}</div>

            {showAll ? (
              <>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-charcoal/40">
                  Other floors
                </p>
                <div className="mt-1.5 space-y-2">{rest.map(row)}</div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1 rounded-2xl py-2.5 text-sm font-bold text-brand-blue"
              >
                See more
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-2 h-12 w-full cursor-pointer rounded-2xl bg-white text-sm font-bold text-charcoal/60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
