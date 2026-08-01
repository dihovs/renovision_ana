/**
 * Instant fallback while the client list streams in.
 *
 * Shaped like the real thing (search bar + rows) rather than a spinner, so
 * the layout doesn't jump the moment data lands.
 */
export default function ClientsLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-9 min-w-[200px] flex-1 rounded-lg bg-black/5" />
        <div className="h-9 w-28 shrink-0 rounded-lg bg-black/10" />
      </div>

      <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-40 rounded bg-black/10" />
              <div className="h-3 w-56 rounded bg-black/5" />
            </div>
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading clients…</span>
    </div>
  );
}
