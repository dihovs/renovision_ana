/**
 * Instant fallback while the dictated list loads. Shaped like the real rows
 * (tick circle, one line of dictated text, a meta line) so the layout doesn't
 * jump when the tasks land.
 */
export default function TasksLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-6">
      <section>
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
              <div className="mt-0.5 h-4 w-20 shrink-0 rounded-full bg-black/5" />
            </li>
          ))}
        </ul>
      </section>
      <span className="sr-only">Loading tasks…</span>
    </div>
  );
}
