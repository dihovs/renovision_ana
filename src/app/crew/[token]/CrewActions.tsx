"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { CrewChecklistItem, CrewVisit } from "@/lib/crm/crewView";

/**
 * The interactive half of the crew page.
 *
 * Written for the actual reading conditions: outdoors, bright, one hand, often
 * gloved. Every control is a full-width row at least 60px tall, the label is
 * part of the tap target, and there is no drag, no long-press and no swipe —
 * gestures that need precision are gestures that get mis-fired on a ladder.
 *
 * Ticks apply optimistically. A phone on site is on one bar of LTE, and a
 * checkbox that waits a second and a half for a server round trip is a
 * checkbox that gets tapped three times. If the write is refused the row snaps
 * back and says so, out loud, rather than quietly pretending.
 */

/**
 * Plain strings only — a function cannot cross the server/client boundary, and
 * the tick count changes optimistically, so the count is a template the client
 * fills in rather than a sentence the server pre-computed.
 */
type Labels = {
  markDone: string;
  markNotDone: string;
  /** e.g. "{done} sur {total} faits" */
  doneTemplate: string;
  failed: string;
  visitDone: string;
  visitDoneUndo: string;
};

function fill(template: string, done: number, total: number): string {
  return template.replace("{done}", String(done)).replace("{total}", String(total));
}

export function CrewChecklist({
  items,
  labels,
  toggleAction,
}: {
  items: CrewChecklistItem[];
  labels: Labels;
  toggleAction: (itemId: string, done: boolean) => Promise<boolean>;
}) {
  const [, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const [optimistic, apply] = useOptimistic(
    items,
    (current: CrewChecklistItem[], change: { id: string; done: boolean }) =>
      current.map((item) => (item.id === change.id ? { ...item, done: change.done } : item)),
  );

  const doneCount = optimistic.filter((item) => item.done).length;

  function toggle(item: CrewChecklistItem) {
    setFailed(false);
    startTransition(async () => {
      apply({ id: item.id, done: !item.done });
      const ok = await toggleAction(item.id, !item.done).catch(() => false);
      if (!ok) setFailed(true);
    });
  }

  return (
    <div>
      <p className="mb-3 text-base font-bold tabular-nums text-charcoal/55">
        {fill(labels.doneTemplate, doneCount, optimistic.length)}
      </p>

      {failed && (
        <p
          role="alert"
          className="mb-3 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-base font-bold text-red-800"
        >
          {labels.failed}
        </p>
      )}

      <ul className="space-y-2">
        {optimistic.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => toggle(item)}
              aria-pressed={item.done}
              aria-label={`${item.label} — ${item.done ? labels.markNotDone : labels.markDone}`}
              className={`flex min-h-[64px] w-full cursor-pointer items-center gap-4 rounded-xl border-2 px-4 py-3 text-left transition-colors active:scale-[0.99] ${
                item.done
                  ? "border-brand-green/40 bg-brand-green-light"
                  : "border-black/15 bg-white hover:border-brand-green/50"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${
                  item.done
                    ? "border-brand-green bg-brand-green text-white"
                    : "border-black/25 bg-white"
                }`}
              >
                {item.done && (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                  >
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span
                className={`min-w-0 flex-1 text-lg font-semibold leading-snug ${
                  item.done ? "text-charcoal/45 line-through" : "text-charcoal"
                }`}
              >
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VisitDoneButton({
  visit,
  labels,
  toggleAction,
}: {
  visit: CrewVisit;
  labels: Labels;
  toggleAction: (visitId: string, completed: boolean) => Promise<boolean>;
}) {
  const [, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useOptimistic(
    visit.completedAt !== null,
    (_current: boolean, next: boolean) => next,
  );

  function toggle() {
    setFailed(false);
    startTransition(async () => {
      setDone(!done);
      const ok = await toggleAction(visit.id, !done).catch(() => false);
      if (!ok) setFailed(true);
    });
  }

  return (
    <div className="mt-3">
      {failed && (
        <p role="alert" className="mb-2 text-base font-bold text-red-800">
          {labels.failed}
        </p>
      )}
      <button
        type="button"
        onClick={toggle}
        aria-pressed={done}
        className={`flex min-h-[60px] w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-2 px-4 py-3 text-lg font-bold transition-colors active:scale-[0.99] ${
          done
            ? "border-brand-green bg-brand-green-light text-brand-green-dark"
            : "border-brand-green bg-brand-green text-white"
        }`}
      >
        {done ? `✓ ${labels.visitDoneUndo}` : labels.visitDone}
      </button>
    </div>
  );
}
