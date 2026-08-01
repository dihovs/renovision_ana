/**
 * Skeleton for the quote builder, shared by the "new quote" and "edit quote"
 * loading states since both render the same QuoteBuilder card stack.
 */
export default function QuoteBuilderLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="h-4 w-24 rounded bg-black/5" />

      <CardSkeleton lines={2} />

      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-24 rounded bg-black/10" />
          <div className="h-3 w-10 rounded bg-black/5" />
        </div>
        <div className="mt-3 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-black/10 p-3">
              <div className="h-8 w-full rounded-lg bg-black/5" />
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-8 rounded-lg bg-black/5" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <CardSkeleton lines={3} />
      <CardSkeleton lines={2} />

      <div className="flex items-center gap-3">
        <div className="h-9 w-32 rounded-lg bg-black/10" />
        <div className="h-4 w-16 rounded bg-black/5" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function CardSkeleton({ lines }: { lines: number }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="h-3.5 w-28 rounded bg-black/10" />
      <div className="mt-3 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-9 w-full rounded-lg bg-black/5" />
        ))}
      </div>
    </div>
  );
}
