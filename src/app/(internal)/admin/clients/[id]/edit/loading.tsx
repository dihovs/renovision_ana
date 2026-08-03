/**
 * Instant fallback while the edit form's settings data (tax rates, lead
 * sources, custom fields) loads.
 */
export default function EditClientLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="h-4 w-32 rounded bg-black/5" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
          <div className="h-3.5 w-24 rounded bg-black/10" />
          <div className="mt-4 space-y-3">
            <div className="h-9 rounded-lg bg-black/5" />
            <div className="h-9 rounded-lg bg-black/5" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
