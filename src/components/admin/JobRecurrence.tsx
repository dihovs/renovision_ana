"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { inputClass, labelClass } from "./AddressFields";
import type { JobState } from "@/app/admin/jobs/actions";
import { GENERATION_CAP } from "@/lib/crm/recurrence";
import {
  RECURRENCE_FREQUENCIES,
  RECURRENCE_FREQUENCY_LABEL,
  type JobRecurrence as Recurrence,
  type RecurrenceFrequency,
} from "@/lib/crm/opsTypes";

/**
 * The "make this job repeat" card.
 *
 * A pattern here becomes real rows in the visits table — the summary line
 * says how many are on the calendar so the owner never has to trust an
 * abstraction. Editing keeps the anchor (weekday, time, duration come from the
 * first visit and stay put); only frequency and end date move.
 */

const TZ = "America/Toronto";

export type RecurrenceAnchor = { startsAt: string; endsAt: string | null; allDay: boolean };

export default function JobRecurrence({
  recurrence,
  anchor,
  upcomingCount,
  saveAction,
  stopAction,
}: {
  recurrence: Recurrence | null;
  /** The stored anchor, or the job's first visit when no pattern exists yet. */
  anchor: RecurrenceAnchor | null;
  upcomingCount: number;
  saveAction: (prev: JobState, formData: FormData) => Promise<JobState>;
  stopAction: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saveState, runSave, saving] = useActionState(saveAction, {} as JobState);
  const formId = useId();

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-bold text-charcoal">Repeats</h2>
        {!editing && anchor && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="cursor-pointer text-xs font-bold text-brand-blue transition-colors hover:text-brand-blue/70"
          >
            {recurrence ? "Edit" : "+ Make it repeat"}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {!anchor && (
        <p className="mt-3 text-sm text-charcoal/40">
          Schedule the first visit, then set it to repeat — the pattern copies that visit&apos;s
          day and time.
        </p>
      )}

      {anchor && !recurrence && !editing && (
        <p className="mt-3 text-sm text-charcoal/40">
          One-off job. Repeating it fills the schedule automatically, anchored on the first
          visit ({describeAnchor(anchor)}).
        </p>
      )}

      {anchor && recurrence && !editing && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-charcoal">
              {RECURRENCE_FREQUENCY_LABEL[recurrence.frequency]} ·{" "}
              {describeAnchor(anchor, recurrence.frequency)}
            </p>
            <p className="mt-0.5 text-xs text-charcoal/55">
              {recurrence.until_date ? `Until ${recurrence.until_date} · ` : ""}
              {upcomingCount} upcoming visit{upcomingCount === 1 ? "" : "s"} on the schedule
            </p>
          </div>
          <button
            type="button"
            onClick={() => run(stopAction)}
            disabled={pending}
            className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs font-bold text-charcoal/35 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-50"
          >
            {pending ? "Stopping…" : "Stop repeating"}
          </button>
        </div>
      )}

      {anchor && editing && (
        <form
          action={runSave}
          onSubmit={() => setTimeout(() => setEditing(false), 400)}
          className="mt-3 space-y-3 rounded-lg border border-brand-blue/20 bg-brand-blue/[0.02] p-3"
        >
          {saveState.error && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {saveState.error}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${formId}-frequency`} className={labelClass}>
                How often
              </label>
              <select
                id={`${formId}-frequency`}
                name="frequency"
                defaultValue={recurrence?.frequency ?? "weekly"}
                className={inputClass}
              >
                {RECURRENCE_FREQUENCIES.map((frequency: RecurrenceFrequency) => (
                  <option key={frequency} value={frequency}>
                    {RECURRENCE_FREQUENCY_LABEL[frequency]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${formId}-until`} className={labelClass}>
                Until (optional)
              </label>
              <input
                id={`${formId}-until`}
                type="date"
                name="until"
                defaultValue={recurrence?.until_date ?? ""}
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-[11px] text-charcoal/45">
            Anchored on {describeAnchor(anchor)}. Creates up to {GENERATION_CAP} future visits
            on the schedule — save again later to extend. Editing replaces only the upcoming
            generated visits; completed and hand-scheduled ones are never touched.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="cursor-pointer rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-60"
            >
              {saving ? "Generating…" : recurrence ? "Save & regenerate" : "Generate visits"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="cursor-pointer text-sm font-semibold text-charcoal/50 hover:text-charcoal"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* The form closes itself shortly after submit (same pattern as the
          visit form), so a verdict that arrives after that must still land
          somewhere visible. */}
      {!editing && saveState.error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {saveState.error}
        </p>
      )}
      {!editing && !saveState.error && saveState.ok && (
        <p className="mt-2 text-xs font-semibold text-brand-green">{saveState.ok}</p>
      )}
    </section>
  );
}

/** "Tuesdays · 08:00–12:00", "day 15 of the month · all day", etc. */
function describeAnchor(anchor: RecurrenceAnchor, frequency?: RecurrenceFrequency): string {
  const start = new Date(anchor.startsAt);
  const when =
    frequency === "monthly"
      ? `day ${start.toLocaleDateString("en-CA", { day: "numeric", timeZone: TZ })} of the month`
      : `${start.toLocaleDateString("en-CA", { weekday: "long", timeZone: TZ })}s`;

  if (anchor.allDay) return `${when} · all day`;

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-CA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: TZ,
    });

  return anchor.endsAt
    ? `${when} · ${time(anchor.startsAt)}–${time(anchor.endsAt)}`
    : `${when} · ${time(anchor.startsAt)}`;
}
