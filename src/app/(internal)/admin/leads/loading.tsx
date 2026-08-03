/**
 * Instant fallback while the lead list streams in.
 *
 * Shaped like the real thing (filter row + cards) rather than a spinner, so
 * the layout doesn't jump the moment data lands.
 */
export default function LeadsLoading() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-24 shrink-0 rounded-full bg-black/5" />
        ))}
      </div>

      <ul className="mt-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-40 rounded bg-black/10" />
                <div className="h-3 w-56 rounded bg-black/5" />
                <div className="h-3 w-24 rounded bg-black/5" />
              </div>
              <div className="h-5 w-16 shrink-0 rounded-full bg-black/5" />
            </div>
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading leads…</span>
    </div>
  );
}
