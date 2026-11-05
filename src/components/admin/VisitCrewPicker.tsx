"use client";

import { useState, useTransition } from "react";

export type CrewChip = { id: string; name: string; initials: string };

/**
 * The crew on one visit: their initials, and a picker to change them.
 * Saves the whole set on "Done" — one write per change of mind, not per tick.
 */
export default function VisitCrewPicker({
  assigned,
  team,
  save,
}: {
  assigned: CrewChip[];
  team: CrewChip[];
  save: (memberIds: string[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set(assigned.map((m) => m.id)));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (team.length === 0 && assigned.length === 0) return null;

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {assigned.map((m) => (
          <span
            key={m.id}
            title={m.name}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue text-[10px] font-bold text-white"
          >
            {m.initials}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="cursor-pointer rounded-full px-2 py-0.5 text-[11px] font-bold text-brand-blue hover:bg-brand-blue/[0.06]"
        >
          {assigned.length ? "Change crew" : "+ Assign crew"}
        </button>
      </div>
      {open && (
        <div className="mt-2 rounded-lg border border-black/10 bg-white p-2">
          <div className="grid gap-1 sm:grid-cols-2">
            {team.map((m) => (
              <label key={m.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm text-charcoal/80 hover:bg-black/[0.02]">
                <input
                  type="checkbox"
                  checked={picked.has(m.id)}
                  onChange={(e) => {
                    const next = new Set(picked);
                    if (e.target.checked) next.add(m.id);
                    else next.delete(m.id);
                    setPicked(next);
                  }}
                  className="h-4 w-4 accent-brand-blue"
                />
                {m.name}
              </label>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  try {
                    await save([...picked]);
                    setError(null);
                    setOpen(false);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not save the crew.");
                  }
                })
              }
              className="cursor-pointer rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Done"}
            </button>
            {error && <span className="text-xs text-red-700">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
