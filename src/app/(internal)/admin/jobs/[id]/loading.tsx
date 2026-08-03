/**
 * Instant fallback while a job's detail page streams in.
 */
export default function JobDetailLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="h-4 w-16 rounded bg-black/5" />

      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="h-3 w-24 rounded bg-black/5" />
        <div className="mt-2 h-5 w-56 rounded bg-black/10" />
        <div className="mt-2 h-3 w-32 rounded bg-black/5" />
      </div>

      <div className="h-16 rounded-xl border border-black/5 bg-white shadow-sm" />
      <div className="h-32 rounded-xl border border-black/5 bg-white shadow-sm" />
      <div className="h-40 rounded-xl border border-black/5 bg-white shadow-sm" />
      <span className="sr-only">Loading job…</span>
    </div>
  );
}
