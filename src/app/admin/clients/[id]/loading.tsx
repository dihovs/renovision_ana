/**
 * Instant fallback while a client's detail page streams in.
 */
export default function ClientDetailLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="h-4 w-20 rounded bg-black/5" />

      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="h-5 w-48 rounded bg-black/10" />
        <div className="mt-2 h-3 w-32 rounded bg-black/5" />
        <div className="mt-4 grid gap-x-6 gap-y-4 border-t border-black/5 pt-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-2.5 w-16 rounded bg-black/5" />
              <div className="h-3.5 w-40 rounded bg-black/10" />
            </div>
          ))}
        </div>
      </div>

      <div className="h-24 rounded-xl border border-black/5 bg-white shadow-sm" />
      <div className="h-24 rounded-xl border border-black/5 bg-white shadow-sm" />
      <span className="sr-only">Loading client…</span>
    </div>
  );
}
