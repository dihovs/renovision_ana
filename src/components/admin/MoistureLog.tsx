"use client";

import { useEffect, useState } from "react";
import { tapFeedback } from "@/lib/haptics";
import { MOISTURE_MATERIALS, type MoistureReading } from "@/lib/crm/dryingLog";

/**
 * Moisture readings for one room, newest first.
 *
 * The point of this screen is the trend, not any single number. One reading
 * of 38% proves nothing; 38 falling to 14 over five days proves the drying
 * was necessary, was carried out, and could stop when it did. That sequence
 * is what an adjuster pays on, and it is the thing magicplan's report has no
 * room for at all.
 *
 * Every field is optional except that ONE must be filled: instruments differ,
 * and a pin meter that only reads material moisture should not be forced to
 * invent a humidity. What is refused is an entirely empty reading, which
 * would show on the curve as a gap somebody has to explain.
 */
export default function MoistureLog({ roomId }: { roomId: string }) {
  const [readings, setReadings] = useState<MoistureReading[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    location: "",
    material: "",
    materialPercent: "",
    relativeHumidity: "",
    temperatureC: "",
  });

  async function load() {
    try {
      const response = await fetch(`/api/v1/moisture?roomScanId=${encodeURIComponent(roomId)}`);
      if (!response.ok) throw new Error("load");
      setReadings(((await response.json()) as { readings: MoistureReading[] }).readings);
    } catch {
      setReadings([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/moisture?roomScanId=${encodeURIComponent(roomId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then((body: { readings: MoistureReading[] }) => {
        if (!cancelled) setReadings(body.readings);
      })
      .catch(() => {
        if (!cancelled) setReadings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/moisture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomScanId: roomId,
          location: form.location,
          material: form.material || null,
          materialPercent: form.materialPercent || null,
          relativeHumidity: form.relativeHumidity || null,
          temperatureC: form.temperatureC || null,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not save the reading.");
      }
      setForm({ location: "", material: "", materialPercent: "", relativeHumidity: "", temperatureC: "" });
      setAdding(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the reading.");
    } finally {
      setSaving(false);
    }
  }

  // Oldest and newest of the material readings — the sentence an adjuster
  // actually reads, stated once at the top rather than left to be inferred
  // from a table.
  const withMaterial = (readings ?? []).filter((r) => r.material_percent !== null);
  const trend =
    withMaterial.length >= 2
      ? {
          from: Number(withMaterial[withMaterial.length - 1].material_percent),
          to: Number(withMaterial[0].material_percent),
        }
      : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-black/5 bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="font-heading text-sm font-bold text-charcoal">Moisture readings</h3>
        {trend && (
          <span className="text-xs font-bold tabular-nums text-charcoal/45">
            {trend.from}% → {trend.to}%
            {trend.to < trend.from && <span className="ml-1 text-green-600">drying</span>}
          </span>
        )}
      </div>

      {readings === null ? (
        <p className="px-4 pb-3 text-sm text-charcoal/40">Loading…</p>
      ) : readings.length === 0 ? (
        <p className="px-4 pb-3 text-sm leading-snug text-charcoal/45">
          None yet. A reading per visit, trending down, is what proves the
          drying was needed and when it could stop.
        </p>
      ) : (
        <ul className="divide-y divide-black/5 border-t border-black/5">
          {readings.map((reading) => (
            <li key={reading.id} className="px-4 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-charcoal">
                  {reading.location || reading.material || "Reading"}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-charcoal/45">
                  {new Date(reading.taken_at).toLocaleDateString("en-CA", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs tabular-nums text-charcoal/55">
                {reading.material_percent !== null && (
                  <span className="font-bold text-charcoal">{reading.material_percent}% MC</span>
                )}
                {reading.relative_humidity !== null && <span>{reading.relative_humidity}% RH</span>}
                {reading.temperature_c !== null && <span>{reading.temperature_c}°C</span>}
                {reading.material && <span className="text-charcoal/40">{reading.material}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="px-4 pb-2 text-[11px] font-medium text-red-700">
          {error}
        </p>
      )}

      {adding ? (
        <div className="space-y-2 border-t border-black/5 p-3">
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Where — north wall 24in up, subfloor by door"
            className={inputClass}
          />
          <div className="flex flex-wrap gap-1.5">
            {MOISTURE_MATERIALS.map((material) => (
              <button
                key={material}
                type="button"
                onClick={() => {
                  tapFeedback();
                  setForm({ ...form, material: form.material === material ? "" : material });
                }}
                aria-pressed={form.material === material}
                className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  form.material === material
                    ? "bg-charcoal text-white"
                    : "bg-black/[0.05] text-charcoal/55"
                }`}
              >
                {material}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Num label="% MC" value={form.materialPercent} onChange={(v) => setForm({ ...form, materialPercent: v })} />
            <Num label="% RH" value={form.relativeHumidity} onChange={(v) => setForm({ ...form, relativeHumidity: v })} />
            <Num label="°C" value={form.temperatureC} onChange={(v) => setForm({ ...form, temperatureC: v })} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="h-11 flex-1 cursor-pointer rounded-xl bg-brand-blue text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save reading"}
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
        <div className="border-t border-black/5 p-3">
          <button
            type="button"
            onClick={() => {
              tapFeedback("medium");
              setAdding(true);
            }}
            className="h-11 w-full cursor-pointer rounded-xl border border-brand-blue/25 bg-white text-sm font-bold text-brand-blue active:bg-brand-blue/[0.06]"
          >
            Log a reading
          </button>
        </div>
      )}
    </section>
  );
}

const inputClass =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-charcoal outline-none transition-colors placeholder:text-charcoal/30 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-charcoal/40">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        placeholder="—"
        className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2 py-2 text-center text-sm tabular-nums text-charcoal outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
      />
    </label>
  );
}
