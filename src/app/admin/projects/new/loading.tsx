/** Instant fallback while the new-project form loads its client list. */
export default function NewProjectLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="h-5 w-20 rounded bg-black/5" />
      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="h-4 w-28 rounded bg-black/10" />
        <div className="mt-4 space-y-3">
          <div className="h-9 rounded-lg bg-black/5" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-9 rounded-lg bg-black/5" />
            <div className="h-9 rounded-lg bg-black/5" />
          </div>
          <div className="h-20 rounded-lg bg-black/5" />
        </div>
        <div className="mt-4 h-9 w-32 rounded-lg bg-black/10" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
