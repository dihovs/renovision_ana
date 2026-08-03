/**
 * Instant fallback while the invoice list streams in.
 *
 * Shaped like the real thing (stat cards + filter chips + rows) so the layout
 * doesn't jump the moment data lands.
 */
export default function InvoicesLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
            <div className="h-3 w-20 rounded bg-black/5" />
            <div className="mt-2 h-7 w-28 rounded bg-black/10" />
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-20 shrink-0 rounded-full bg-black/5" />
        ))}
      </div>

      <ul className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        {Array.from({ length: 6 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-3 border-b border-black/5 px-4 py-3 last:border-0"
          >
            <div className="h-3 w-10 shrink-0 rounded bg-black/10" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-32 rounded bg-black/10" />
              <div className="h-3 w-44 rounded bg-black/5" />
            </div>
            <div className="h-4 w-16 shrink-0 rounded-full bg-black/5" />
            <div className="h-4 w-16 shrink-0 rounded bg-black/10" />
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading invoices…</span>
    </div>
  );
}
