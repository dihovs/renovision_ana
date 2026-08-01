/** Instant fallback while an invoice streams in. */
export default function InvoiceLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="h-4 w-20 rounded bg-black/5" />

      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-black/10" />
            <div className="h-5 w-40 rounded bg-black/10" />
            <div className="h-3 w-32 rounded bg-black/5" />
          </div>
          <div className="space-y-2">
            <div className="ml-auto h-7 w-28 rounded bg-black/10" />
            <div className="ml-auto h-3 w-24 rounded bg-black/5" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex gap-2">
          <div className="h-9 w-32 rounded-lg bg-black/10" />
          <div className="h-9 w-24 rounded-lg bg-black/5" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="border-b border-black/5 px-4 py-3">
          <div className="h-3.5 w-24 rounded bg-black/10" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-black/5 px-4 py-3 last:border-0"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-40 rounded bg-black/10" />
              <div className="h-3 w-24 rounded bg-black/5" />
            </div>
            <div className="h-4 w-14 shrink-0 rounded bg-black/10" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading invoice…</span>
    </div>
  );
}
