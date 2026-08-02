"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { inputClass } from "./AddressFields";
import type { JobState } from "@/app/(internal)/admin/jobs/actions";
import type { ChecklistItem } from "@/lib/crm/opsTypes";

/**
 * The job checklist: what the crew must not forget on site.
 *
 * Same interaction grammar as the visit list — a tick circle, a remove
 * button, pending states on everything — so the screen reads as one tool
 * rather than two bolted together. Reordering is deliberate up/down taps,
 * not drag-and-drop: this gets used on a phone with gloves on.
 */

export default function JobChecklist({
  items,
  addAction,
  toggleAction,
  removeAction,
  moveAction,
}: {
  items: ChecklistItem[];
  addAction: (prev: JobState, formData: FormData) => Promise<JobState>;
  toggleAction: (itemId: string, done: boolean) => Promise<void>;
  removeAction: (itemId: string) => Promise<void>;
  moveAction: (itemId: string, direction: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addState, runAdd, adding] = useActionState(addAction, {} as JobState);
  const inputId = useId();

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

  const doneCount = items.filter((item) => item.done).length;

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-bold text-charcoal">Checklist</h2>
        {items.length > 0 && (
          <span className="text-xs font-semibold tabular-nums text-charcoal/45">
            {doneCount} of {items.length} done
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {items.length === 0 && (
        <p className="mt-3 text-sm text-charcoal/40">
          Nothing on the list. Add the steps the crew must not forget — photos before
          demolition, water off, gate locked.
        </p>
      )}

      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                item.done ? "border-black/5 bg-black/[0.015]" : "border-black/10"
              }`}
            >
              <button
                type="button"
                onClick={() => run(() => toggleAction(item.id, !item.done))}
                disabled={pending}
                aria-label={item.done ? "Mark not done" : "Mark done"}
                className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors disabled:cursor-wait disabled:opacity-50 ${
                  item.done
                    ? "border-brand-green bg-brand-green text-white"
                    : "border-black/20 hover:border-brand-green"
                }`}
              >
                {item.done && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              <span
                className={`min-w-0 flex-1 text-sm font-semibold ${
                  item.done ? "text-charcoal/45 line-through" : "text-charcoal"
                }`}
              >
                {item.label}
              </span>

              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => run(() => moveAction(item.id, "up"))}
                  disabled={pending || index === 0}
                  aria-label="Move up"
                  className="cursor-pointer rounded-md px-1.5 py-1 text-xs font-bold text-charcoal/35 transition-colors hover:bg-black/[0.04] hover:text-charcoal disabled:cursor-default disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => run(() => moveAction(item.id, "down"))}
                  disabled={pending || index === items.length - 1}
                  aria-label="Move down"
                  className="cursor-pointer rounded-md px-1.5 py-1 text-xs font-bold text-charcoal/35 transition-colors hover:bg-black/[0.04] hover:text-charcoal disabled:cursor-default disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => run(() => removeAction(item.id))}
                  disabled={pending}
                  aria-label="Remove item"
                  className="cursor-pointer rounded-md px-2 py-1 text-xs font-bold text-charcoal/35 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-50"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form action={runAdd} className="mt-3">
        {addState.error && (
          <p role="alert" className="mb-2 text-sm font-medium text-red-700">
            {addState.error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor={inputId} className="sr-only">
              New checklist item
            </label>
            <input
              id={inputId}
              name="label"
              placeholder="Add an item"
              maxLength={300}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="shrink-0 cursor-pointer rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-60"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    </section>
  );
}
