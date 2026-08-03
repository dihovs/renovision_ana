/**
 * Instant fallback while quotes, invoices and payments are pulled and
 * summed. Shaped like the real thing (stat grid + six-month chart) so the
 * layout doesn't jump the moment the numbers land.
 */
export default function ReportsLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-6">
      <section>
        <div className="mb-2 h-3 w-28 rounded bg-black/5" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="h-3 w-20 rounded bg-black/5" />
              <div className="mt-3 h-6 w-16 rounded bg-black/10" />
              <div className="mt-2 h-3 w-24 rounded bg-black/5" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 h-3 w-24 rounded bg-black/5" />
        <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex gap-4">
            <div className="h-3 w-16 rounded bg-black/5" />
            <div className="h-3 w-20 rounded bg-black/5" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="mb-1 flex justify-between">
                  <div className="h-3 w-16 rounded bg-black/10" />
                  <div className="h-3 w-24 rounded bg-black/5" />
                </div>
                <div className="h-5 rounded bg-black/5" />
              </div>
            ))}
          </div>
        </div>
      </section>
      <span className="sr-only">Loading reports…</span>
    </div>
  );
}
