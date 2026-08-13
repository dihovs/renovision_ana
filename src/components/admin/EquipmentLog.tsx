"use client";

import { useEffect, useState } from "react";
import { tapFeedback } from "@/lib/haptics";
import {
  EQUIPMENT_KINDS,
  totalUnitDays,
  unitDays,
  type EquipmentPlacement,
} from "@/lib/crm/dryingLog";

/**
 * Equipment on site, and what it has billed.
 *
 * Air movers and dehumidifiers are billed per unit per day, and the total is
 * usually the second-largest line on a water-damage invoice after labour. It
 * is also the line most often reduced, because "6 air movers for 5 days"
 * written on a worksheet at the end of the job is a recollection, not a
 * record.
 *
 * So the clock runs from a delivery that was logged and stops at a collection
 * that was logged. Equipment still running counts to today and says so —
 * a live job shows a growing number rather than a blank.
 */
export default function EquipmentLog({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<EquipmentPlacement[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch(`/api/v1/equipment?projectId=${encodeURIComponent(projectId)}`);
      if (!response.ok) throw new Error("load");
      setItems(((await response.json()) as { equipment: EquipmentPlacement[] }).equipment);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/equipment?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then((body: { equipment: EquipmentPlacement[] }) => {
        if (!cancelled) setItems(body.equipment);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Computed at render rather than stored: "days on site" for running
  // equipment is a function of what time it is now.
  const now = new Date();
  const running = (items ?? []).filter((item) => !item.out_of_service_at);
  const total = totalUnitDays(items ?? [], now);

  async function add() {
    if (!kind.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, kind, quantity: Number(quantity) || 1 }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not add the equipment.");
      }
      setKind("");
      setQuantity("1");
      setAdding(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the equipment.");
    } finally {
      setSaving(false);
    }
  }

  async function collect(id: string) {
    tapFeedback("medium");
    try {
      const response = await fetch(`/api/v1/equipment/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outOfServiceAt: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error("Could not stop the clock on that unit.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the equipment.");
    }
  }

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-bold text-charcoal">Equipment</h2>
        {total > 0 && (
          <span className="text-xs font-bold tabular-nums text-charcoal/45">
            {total.toLocaleString("en-CA")} unit-day{total === 1 ? "" : "s"}
            {running.length > 0 && <span className="ml-1 text-brand-blue">· {running.length} running</span>}
          </span>
        )}
      </div>

      {items === null ? (
        <p className="mt-3 text-sm text-charcoal/40">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm leading-snug text-charcoal/45">
          Nothing logged. Air movers and dehumidifiers bill per unit per day —
          logged when they land, they bill themselves.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-black/5">
          {items.map((item) => {
            const days = unitDays(item, now);
            const live = !item.out_of_service_at;
            return (
              <li key={item.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-charcoal">
                    {item.quantity > 1 && `${item.quantity}× `}
                    {item.kind}
                  </span>
                  <span className="block text-[11px] tabular-nums text-charcoal/45">
                    In{" "}
                    {new Date(item.in_service_at).toLocaleDateString("en-CA", {
                      month: "short",
                      day: "numeric",
                    })}
                    {item.out_of_service_at
                      ? ` · out ${new Date(item.out_of_service_at).toLocaleDateString("en-CA", {
                          month: "short",
                          day: "numeric",
                        })}`
                      : " · still running"}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-charcoal">
                  {days}
                  <span className="ml-0.5 text-[10px] font-semibold text-charcoal/40">
                    unit-day{days === 1 ? "" : "s"}
                  </span>
                </span>
                {live && (
                  <button
                    type="button"
                    onClick={() => collect(item.id)}
                    className="shrink-0 cursor-pointer rounded-lg bg-black/[0.05] px-2.5 py-1.5 text-[11px] font-bold text-charcoal/60 hover:bg-black/[0.09]"
                  >
                    Collected
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[11px] font-medium text-red-700">
          {error}
        </p>
      )}

      {adding ? (
        <div className="mt-3 space-y-2 border-t border-black/5 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT_KINDS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  tapFeedback();
                  setKind(option);
                }}
                aria-pressed={kind === option}
                className={`cursor-pointer rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                  kind === option ? "bg-charcoal text-white" : "bg-black/[0.05] text-charcoal/55"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              placeholder="What is it?"
              className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-charcoal outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
            />
            <input
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              inputMode="numeric"
              aria-label="How many"
              className="w-16 rounded-xl border border-black/10 bg-white px-2 py-2.5 text-center text-sm tabular-nums text-charcoal outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving || !kind.trim()}
              onClick={add}
              className="h-11 flex-1 cursor-pointer rounded-xl bg-brand-blue text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add to site"}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="h-11 cursor-pointer px-4 text-sm font-semibold text-charcoal/50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            tapFeedback("medium");
            setAdding(true);
          }}
          className="mt-3 h-11 w-full cursor-pointer rounded-xl border border-brand-blue/25 bg-white text-sm font-bold text-brand-blue active:bg-brand-blue/[0.06] sm:w-auto sm:px-5"
        >
          Add equipment
        </button>
      )}
    </section>
  );
}
