"use client";

import { useEffect } from "react";

/**
 * Catches render-time crashes in the task list. Fetch and migration failures
 * never reach here — the page catches those and renders AdminNotice — so this
 * is only for the unexpected.
 */
export default function TasksError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <h2 className="font-heading text-base font-bold text-brand-blue">
        Something went wrong loading tasks
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-charcoal/70">
        Nothing was lost — every note you dictated is still saved. Try again, and if it keeps
        happening let the office know.
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-4 cursor-pointer rounded-full bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90"
      >
        Try again
      </button>
    </div>
  );
}
