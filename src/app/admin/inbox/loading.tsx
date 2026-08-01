/**
 * Instant fallback while the unfiled WhatsApp queue streams in.
 */
export default function InboxLoading() {
  return (
    <div aria-hidden className="animate-pulse space-y-3">
      <div className="h-4 w-72 max-w-full rounded bg-black/5" />
      <ul className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <div className="h-4 w-32 rounded bg-black/10" />
              <div className="h-3 w-20 shrink-0 rounded bg-black/5" />
            </div>
            <div className="mt-2 h-3 w-full max-w-md rounded bg-black/5" />
            <div className="mt-3 h-9 w-full rounded-lg bg-black/5" />
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading inbox…</span>
    </div>
  );
}
