"use client";

import { useEffect } from "react";

/**
 * Catches crashes loading the new-client form — most commonly a database
 * blip fetching tax rates, lead sources, or custom field definitions.
 */
export default function NewClientError({
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
        Something went wrong loading this form
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-charcoal/70">
        Nothing was lost. Try again, and if it keeps happening let the office know.
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
