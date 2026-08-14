/**
 * Instant fallback while Home's data streams in — shaped like the two
 * heroes and the Today list rather than a spinner, so nothing jumps once
 * the real content lands.
 */
export default function HomeLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-6 pb-4">
      <div className="h-8 w-48 rounded bg-black/10" />

      <div className="space-y-3">
        <div className="h-[104px] rounded-3xl bg-black/10" />
        <div className="h-[104px] rounded-3xl bg-black/10" />
      </div>

      <div className="space-y-2">
        <div className="h-3 w-16 rounded bg-black/10" />
        <div className="h-[72px] rounded-2xl bg-black/5" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-black/5" />
        <div className="h-24 rounded-2xl bg-black/5" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
