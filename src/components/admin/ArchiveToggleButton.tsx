"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button for the archive/restore form on a client or job detail page.
 *
 * Reads pending state from the parent `<form>` via useFormStatus rather than
 * a prop, same as LeadPipeline's ConvertButton — it must render inside the
 * form it reports on.
 */
export default function ArchiveToggleButton({ archived }: { archived: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold text-charcoal/45 transition-colors hover:bg-black/[0.03] hover:text-charcoal disabled:cursor-wait disabled:opacity-50"
    >
      {pending ? (archived ? "Restoring…" : "Archiving…") : archived ? "Restore" : "Archive"}
    </button>
  );
}
