/**
 * Instant fallback while the quote list streams in.
 *
 * Shaped like the real thing (search + filter chips + rows) rather than a
 * spinner, so the layout doesn't jump the moment data lands — same idea as
 * admin/leads/loading.tsx and admin/inbox/loading.tsx.
 */
export default function QuotesLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-9 min-w-[200px] flex-1 rounded-lg bg-black/5" />
        <div className="h-9 w-28 shrink-0 rounded-lg bg-black/10" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-6 w-20 shrink-0 rounded-full bg-black/5" />
        ))}
      </div>

      <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-3 w-10 shrink-0 rounded bg-black/10" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3.5 w-40 rounded bg-black/10" />
              <div className="h-3 w-24 rounded bg-black/5" />
            </div>
            <div className="h-4 w-16 shrink-0 rounded-full bg-black/5" />
            <div className="h-4 w-16 shrink-0 rounded bg-black/10" />
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading quotes…</span>
    </div>
  );
}
