/**
 * Instant fallback while the week's visits stream in.
 *
 * Mirrors both responsive layouts (grid from lg, agenda below it) so nothing
 * reflows the moment real data lands.
 */
export default function ScheduleLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-4 w-48 rounded bg-black/10" />
          <div className="h-3 w-28 rounded bg-black/5" />
        </div>
        <div className="flex shrink-0 gap-1.5">
          <div className="h-8 w-9 rounded-lg bg-black/5" />
          <div className="h-8 w-16 rounded-lg bg-black/5" />
          <div className="h-8 w-9 rounded-lg bg-black/5" />
        </div>
      </div>

      <div className="hidden gap-2 lg:grid lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-black/5 bg-white p-3 shadow-sm">
            <div className="h-3 w-10 rounded bg-black/10" />
            <div className="h-12 rounded-lg bg-black/5" />
          </div>
        ))}
      </div>

      <div className="space-y-2 lg:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-black/5 bg-white p-3 shadow-sm">
            <div className="h-3.5 w-32 rounded bg-black/10" />
            <div className="mt-2 h-10 rounded-lg bg-black/5" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading schedule…</span>
    </div>
  );
}
