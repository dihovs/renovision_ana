/**
 * Instant fallback while the price book streams in — shaped like the search
 * row plus the item list, so the layout doesn't jump when data lands.
 */
export default function PriceBookLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-9 min-w-[200px] flex-1 rounded-lg bg-black/5" />
        <div className="h-9 w-24 shrink-0 rounded-lg bg-black/10" />
      </div>

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <ul className="divide-y divide-black/5">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3.5 w-44 rounded bg-black/10" />
                <div className="h-3 w-28 rounded bg-black/5" />
              </div>
              <div className="h-6 w-20 shrink-0 rounded bg-black/5" />
              <div className="h-6 w-16 shrink-0 rounded bg-black/10" />
            </li>
          ))}
        </ul>
      </div>
      <span className="sr-only">Loading price book…</span>
    </div>
  );
}
