/**
 * Instant fallback while expenses and time entries stream in.
 *
 * Shaped like the real thing (tab pills + entry form + rows) rather than a
 * spinner, so the layout doesn't jump the moment data lands.
 */
export default function ExpensesLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="flex gap-2">
        <div className="h-8 w-28 rounded-full bg-black/5" />
        <div className="h-8 w-24 rounded-full bg-black/5" />
      </div>

      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-16 rounded bg-black/5" />
              <div className="h-9 rounded-lg bg-black/5" />
            </div>
          ))}
        </div>
        <div className="mt-4 h-9 w-32 rounded-lg bg-black/10" />
      </div>

      <ul className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 border-b border-black/5 px-4 py-3 last:border-b-0">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-48 rounded bg-black/10" />
              <div className="h-3 w-64 rounded bg-black/5" />
            </div>
            <div className="h-4 w-16 shrink-0 rounded bg-black/10" />
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading expenses…</span>
    </div>
  );
}
