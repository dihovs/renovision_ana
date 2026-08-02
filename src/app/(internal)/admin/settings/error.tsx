"use client";

import { useEffect } from "react";

/**
 * Catches render-time crashes loading the settings form. A blank screen
 * here is worse than most — this is where the RBQ licence and tax
 * registration live, so the way back has to be obvious.
 */
export default function SettingsError({
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
        Something went wrong loading settings
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-charcoal/70">
        Nothing was changed or lost. Try again, and if it keeps happening let the office know.
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
