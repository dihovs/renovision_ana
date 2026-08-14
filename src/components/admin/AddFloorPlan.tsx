"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { tapFeedback } from "@/lib/haptics";
import { rememberFloor } from "@/lib/floorMemory";
import { FLOOR_LEVELS } from "@/lib/crm/floors";

/**
 * Start a floor plan for a storey that has none yet.
 *
 * The storeys are offered as a fixed list rather than a free text box: they
 * are the same five in every house in Quebec, and typing "Bsmt" on one job
 * and "Basement" on the next silently splits one floor into two in every
 * total that groups by level.
 */

export default function AddFloorPlan({
  projectId,
  existing,
}: {
  projectId: string;
  /** Storeys already measured — offered last, since the usual reason to
      open this is to start a floor that does not exist yet. */
  existing: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const fresh = FLOOR_LEVELS.filter((level) => !existing.includes(level.id));

  function go(level: string) {
    tapFeedback("medium");
    // Remembered before navigating, so backing out of an empty floor leaves
    // the floor behind rather than losing it. A room landing on it later
    // makes it real and this is reconciled away.
    rememberFloor(projectId, level);
    router.push(`/admin/projects/${projectId}/floors/${encodeURIComponent(level)}`);
  }

  return (
    <>
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

            <div className="mt-3 space-y-2">
              {[
                ...fresh,
                ...FLOOR_LEVELS.filter((level) => existing.includes(level.id)),
              ].map((level) => (
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
              ))}
            </div>

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
