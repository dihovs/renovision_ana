/**
 * Instant fallback while a single quote loads — shaped like the header card,
 * the actions bar, and the line-items panel underneath it.
 */
export default function QuoteDetailLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="h-4 w-20 rounded bg-black/5" />

      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="h-3 w-24 rounded bg-black/10" />
        <div className="mt-2 h-5 w-52 rounded bg-black/10" />
        <div className="mt-2 h-3 w-40 rounded bg-black/5" />
      </div>

      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-lg bg-black/10" />
          <div className="h-9 w-24 rounded-lg bg-black/5" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="border-b border-black/5 px-4 py-3">
          <div className="h-3.5 w-24 rounded bg-black/10" />
        </div>
        <ul className="divide-y divide-black/5">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3.5 w-48 rounded bg-black/10" />
                <div className="h-3 w-28 rounded bg-black/5" />
              </div>
              <div className="h-4 w-14 shrink-0 rounded bg-black/10" />
            </li>
          ))}
        </ul>
        <div className="space-y-2 border-t border-black/5 bg-black/[0.015] px-4 py-3">
          <div className="h-3 w-full rounded bg-black/5" />
          <div className="h-3 w-full rounded bg-black/5" />
          <div className="h-4 w-full rounded bg-black/10" />
        </div>
      </div>
      <span className="sr-only">Loading quote…</span>
    </div>
  );
}
