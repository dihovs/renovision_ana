/**
 * Instant fallback while company details and quote defaults load. Shaped
 * like the real form (tabs + grouped cards) so the layout doesn't jump the
 * moment the settings land.
 */
export default function SettingsLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="flex gap-1.5">
        <div className="h-7 w-20 rounded-full bg-black/10" />
        <div className="h-7 w-20 rounded-full bg-black/5" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, section) => (
          <div key={section} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
            <div className="h-4 w-40 rounded bg-black/10" />
            <div className="mt-1 h-3 w-64 max-w-full rounded bg-black/5" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <div className="mb-1.5 h-3 w-20 rounded bg-black/5" />
                  <div className="h-9 rounded-lg bg-black/5" />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="h-9 w-24 rounded-lg bg-black/10" />
      </div>
      <span className="sr-only">Loading settings…</span>
    </div>
  );
}
