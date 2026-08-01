/**
 * Instant fallback while the invoice streams in — shaped like the document
 * (header with address block and totals column, lines, footer) so the card
 * doesn't reflow when the real thing lands. Announced in both languages: the
 * invoice's language isn't known until the row loads.
 */
export default function PublicInvoiceLoading() {
  return (
    <main className="min-h-dvh bg-[#f6f8fb]">
      <div className="mx-auto max-w-3xl animate-pulse px-4 py-8 sm:py-12" aria-hidden>
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          <div className="border-b border-black/5 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="h-11 w-32 rounded bg-black/10" />
                <div className="mt-3 space-y-1.5">
                  <div className="h-3 w-40 rounded bg-black/5" />
                  <div className="h-3 w-32 rounded bg-black/5" />
                  <div className="h-3 w-36 rounded bg-black/5" />
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="h-7 w-28 rounded bg-black/10" />
                <div className="mt-2 h-4 w-16 rounded bg-black/5" />
                <div className="mt-3 h-3 w-32 rounded bg-black/5" />
              </div>
            </div>
            <div className="mt-6 grid gap-4 border-t border-black/5 pt-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="h-3 w-20 rounded bg-black/5" />
                <div className="h-4 w-36 rounded bg-black/10" />
                <div className="h-3 w-44 rounded bg-black/5" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-24 rounded bg-black/5" />
                <div className="h-3 w-40 rounded bg-black/5" />
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="divide-y divide-black/5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-4 w-48 rounded bg-black/10" />
                    <div className="h-3 w-64 max-w-full rounded bg-black/5" />
                  </div>
                  <div className="h-4 w-16 shrink-0 rounded bg-black/10" />
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2 border-t border-black/10 pt-4">
              <div className="flex justify-between">
                <div className="h-3 w-20 rounded bg-black/5" />
                <div className="h-3 w-16 rounded bg-black/5" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-12 rounded bg-black/5" />
                <div className="h-3 w-14 rounded bg-black/5" />
              </div>
              <div className="flex justify-between border-t border-black/10 pt-2">
                <div className="h-5 w-14 rounded bg-black/10" />
                <div className="h-6 w-24 rounded bg-black/10" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">Chargement de la facture… Loading the invoice…</span>
    </main>
  );
}
