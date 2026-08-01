/**
 * Instant fallback for the dashboard — shaped like the real thing (greeting,
 * today list, funnel cards, stat grid, lead list) so the layout doesn't jump
 * when the numbers land. Child routes carry their own loading.tsx, so this
 * one only ever stands in for Home.
 */
export default function AdminHomeLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-6">
      <div>
        <div className="h-6 w-56 rounded bg-black/10" />
        <div className="mt-1.5 h-4 w-40 rounded bg-black/5" />
      </div>

      <section>
        <div className="mb-2 h-3 w-16 rounded bg-black/10" />
        <div className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-3 w-10 shrink-0 rounded bg-black/5" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-4 w-44 rounded bg-black/10" />
                <div className="h-3 w-56 max-w-full rounded bg-black/5" />
              </div>
              <div className="h-5 w-20 shrink-0 rounded-full bg-black/5" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 h-3 w-20 rounded bg-black/10" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="h-3 w-14 rounded bg-black/5" />
              <div className="mt-3 h-8 w-12 rounded bg-black/10" />
              <div className="mt-1.5 h-3 w-20 rounded bg-black/5" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 h-3 w-24 rounded bg-black/10" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="h-3 w-20 rounded bg-black/5" />
              <div className="mt-3 h-7 w-16 rounded bg-black/10" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 h-3 w-24 rounded bg-black/10" />
        <div className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-4 w-36 rounded bg-black/10" />
                <div className="h-3 w-52 max-w-full rounded bg-black/5" />
              </div>
              <div className="h-5 w-16 shrink-0 rounded-full bg-black/5" />
              <div className="h-3 w-12 shrink-0 rounded bg-black/5" />
            </div>
          ))}
        </div>
      </section>

      <span className="sr-only">Loading the dashboard…</span>
    </div>
  );
}
