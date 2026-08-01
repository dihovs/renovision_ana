/**
 * Instant fallback while call transcripts stream in. Shaped like the real
 * list (caller, status badge, snippet, timestamp) so the layout doesn't
 * jump the moment the calls land.
 */
export default function CallsLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-32 rounded bg-black/10" />
                <div className="h-4 w-16 rounded-full bg-black/5" />
              </div>
              <div className="h-3 w-56 max-w-full rounded bg-black/5" />
              <div className="h-3 w-40 rounded bg-black/5" />
            </div>
            <div className="h-4 w-4 shrink-0 rounded bg-black/5" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading calls…</span>
    </div>
  );
}
