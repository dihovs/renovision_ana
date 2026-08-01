"use client";

import { useState, useTransition } from "react";

/**
 * Move a project between statuses.
 *
 * Every status other than the current one is offered — projects have no
 * one-way lifecycle the way invoices do, and a small crew corrects mistakes
 * by tapping the right state, not by asking why the button is missing.
 * Labels come from the server so this component can't drift from the lib's
 * vocabulary.
 */

export default function ProjectStatusButtons({
  current,
  options,
  statusAction,
}: {
  current: string;
  options: { value: string; label: string }[];
  statusAction: (status: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function move(status: string) {
    setError(null);
    startTransition(async () => {
      try {
        await statusAction(status);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update the status.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="font-heading text-sm font-bold text-charcoal">Move this project along</h2>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {options
          .filter((option) => option.value !== current)
          .map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => move(option.value)}
              disabled={pending}
              className="cursor-pointer rounded-lg border border-black/10 px-3 py-1.5 text-sm font-bold text-charcoal transition-colors hover:bg-black/[0.03] disabled:cursor-wait disabled:opacity-50"
            >
              {option.label}
            </button>
          ))}
      </div>
    </section>
  );
}
