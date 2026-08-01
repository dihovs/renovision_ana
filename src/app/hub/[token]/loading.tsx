/**
 * Instant fallback while the hub streams in — shaped like the real page
 * (header, balance card, three document lists) so nothing jumps when the data
 * lands. Announced in both languages: at this point nobody knows which one
 * the customer reads.
 */
export default function ClientHubLoading() {
  return (
    <main className="min-h-dvh bg-[#f6f8fb]">
      <div className="mx-auto max-w-3xl animate-pulse px-4 py-8 sm:py-12" aria-hidden>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="h-11 w-32 rounded bg-black/10" />
            <div className="mt-3 h-5 w-40 rounded bg-black/10" />
            <div className="mt-1.5 h-4 w-28 rounded bg-black/5" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="h-7 w-24 rounded-full bg-black/5" />
            <div className="h-10 w-36 rounded-full bg-black/5" />
          </div>
        </div>

        <div className="mb-6 h-24 rounded-2xl border border-black/5 bg-white shadow-sm" />

        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, section) => (
            <div key={section}>
              <div className="mb-2 h-3 w-24 rounded bg-black/10" />
              <div className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
                {Array.from({ length: 2 }).map((_, row) => (
                  <div key={row} className="flex items-center gap-3 px-4 py-3">
                    <div className="hidden h-3 w-10 rounded bg-black/5 sm:block" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="h-4 w-40 rounded bg-black/10" />
                      <div className="h-3 w-28 rounded bg-black/5" />
                    </div>
                    <div className="h-5 w-16 shrink-0 rounded-full bg-black/5" />
                    <div className="h-4 w-20 shrink-0 rounded bg-black/10" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">
        Chargement de votre espace client… Loading your client hub…
      </span>
    </main>
  );
}
