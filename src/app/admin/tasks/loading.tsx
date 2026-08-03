/**
 * Instant fallback while both lists load. Shaped like the real page — a call
 * queue above, the dictated notes below — so the layout doesn't jump when the
 * rows land and the notes don't appear to move down the screen.
 */
export default function TasksLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-8">
      <section>
        <div className="mb-3 space-y-2">
          <div className="h-5 w-32 rounded bg-black/10" />
          <div className="h-3 w-80 max-w-full rounded bg-black/5" />
        </div>
        <div className="mb-2 h-3 w-20 rounded bg-black/10" />
        <ul className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-3 rounded-xl border border-black/5 bg-white p-3 shadow-sm sm:p-4"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-52 max-w-full rounded bg-black/10" />
                <div className="h-3 w-64 max-w-full rounded bg-black/5" />
                <div className="h-3 w-40 max-w-full rounded bg-black/5" />
              </div>
              <div className="h-6 w-16 shrink-0 rounded-full bg-black/5" />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-3 space-y-2">
          <div className="h-5 w-36 rounded bg-black/10" />
          <div className="h-3 w-72 max-w-full rounded bg-black/5" />
        </div>
        <div className="mb-2 h-3 w-20 rounded bg-black/10" />
        <ul className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-xl border border-black/5 bg-white p-3 shadow-sm sm:p-4"
            >
              <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-black/10" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-64 max-w-full rounded bg-black/10" />
                <div className="h-3 w-44 max-w-full rounded bg-black/5" />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <span className="sr-only">Loading calls and tasks…</span>
    </div>
  );
}
