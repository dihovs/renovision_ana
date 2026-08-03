"use client";

import { useState, useTransition } from "react";

/**
 * Archive/restore toggle with its own pending state.
 *
 * Split out from the (server) invoice page because a plain `<form>` submit
 * gives no feedback while the request is in flight — on a slow connection a
 * second click fires a second archive/restore before the first has landed.
 */
export default function ArchiveButton({
  archived,
  action,
}: {
  archived: boolean;
  action: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await action();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not update.");
            }
          });
        }}
        disabled={pending}
        className="mt-1 cursor-pointer text-xs font-semibold text-charcoal/40 transition-colors hover:text-charcoal disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (archived ? "Restoring…" : "Archiving…") : archived ? "Restore" : "Archive"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
