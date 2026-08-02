"use client";

/**
 * Catches anything that throws while rendering the quotes list, a quote, or
 * the builder — a bad id in the URL, a Supabase hiccup that isn't the
 * "migration pending" case pages already handle, etc. Without this, the
 * owner would be looking at Next's default crash screen mid-quote.
 */
export default function QuotesError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
      <h2 className="font-heading text-base font-bold text-red-900">Something went wrong</h2>
      <p className="mt-2 text-sm leading-relaxed text-red-900/75">
        This page couldn&apos;t load. Nothing has been changed — try again, and if it keeps
        happening, check the Supabase connection in Settings.
      </p>
      <button
        type="button"
        onClick={unstable_retry}
        className="mt-4 cursor-pointer rounded-lg bg-white px-4 py-2 text-sm font-bold text-red-900 shadow-sm transition-colors hover:bg-red-100"
      >
        Try again
      </button>
      {error.digest && (
        <p className="mt-3 font-mono text-[10px] text-red-900/40">Ref: {error.digest}</p>
      )}
    </div>
  );
}
