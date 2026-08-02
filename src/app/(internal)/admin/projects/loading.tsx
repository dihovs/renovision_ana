/**
 * Instant fallback while the project list streams in.
 *
 * Shaped like the real thing (filter chips + card grid) rather than a
 * spinner, so the layout doesn't jump the moment data lands.
 */
export default function ProjectsLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 flex-wrap gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 w-16 rounded-full bg-black/5" />
          ))}
        </div>
        <div className="h-9 w-28 shrink-0 rounded-lg bg-black/10" />
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
            <div className="h-3.5 w-36 rounded bg-black/10" />
            <div className="mt-2 h-3 w-24 rounded bg-black/5" />
            <div className="mt-4 h-3 w-32 rounded bg-black/5" />
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading projects…</span>
    </div>
  );
}
