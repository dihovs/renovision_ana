/** Instant fallback while a project's detail streams in. */
export default function ProjectDetailLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="h-5 w-20 rounded bg-black/5" />

      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="h-5 w-52 rounded bg-black/10" />
        <div className="mt-2 h-3.5 w-32 rounded bg-black/5" />
        <div className="mt-4 grid gap-3 border-t border-black/5 pt-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-14 rounded bg-black/5" />
              <div className="h-3.5 w-20 rounded bg-black/10" />
            </div>
          ))}
        </div>
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
          <div className="h-4 w-24 rounded bg-black/10" />
          <div className="mt-3 h-9 rounded-lg bg-black/5" />
        </div>
      ))}
      <span className="sr-only">Loading project…</span>
    </div>
  );
}
