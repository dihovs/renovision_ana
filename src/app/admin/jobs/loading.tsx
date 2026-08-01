/**
 * Instant fallback while the job list streams in.
 *
 * Shaped like the real thing (status chips + rows) rather than a spinner, so
 * the layout doesn't jump the moment data lands.
 */
export default function JobsLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-6 w-16 shrink-0 rounded-full bg-black/5" />
        ))}
      </div>

      <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-3 w-10 shrink-0 rounded bg-black/5" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-40 rounded bg-black/10" />
              <div className="h-3 w-24 rounded bg-black/5" />
            </div>
            <div className="h-4 w-16 shrink-0 rounded-full bg-black/5" />
            <div className="h-3.5 w-14 shrink-0 rounded bg-black/10" />
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading jobs…</span>
    </div>
  );
}
