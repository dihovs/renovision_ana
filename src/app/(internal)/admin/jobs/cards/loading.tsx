/**
 * Instant fallback while the job cards stream in — same idea as the dense
 * list's own loading.tsx, reshaped for cards instead of rows.
 */
export default function JobCardsLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4 pb-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-6 w-16 shrink-0 rounded-full bg-black/5" />
        ))}
      </div>

      <ul className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="h-3 w-10 rounded bg-black/5" />
              <div className="h-4 w-16 rounded-full bg-black/10" />
            </div>
            <div className="mt-2 h-4 w-40 rounded bg-black/10" />
            <div className="mt-1.5 h-3 w-28 rounded bg-black/5" />
            <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3">
              <div className="h-5 w-20 rounded bg-black/10" />
              <div className="h-3 w-10 rounded bg-black/5" />
            </div>
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading jobs…</span>
    </div>
  );
}
