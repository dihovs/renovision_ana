"use client";

import { useState, useTransition } from "react";

/**
 * The client's own link into the hub.
 *
 * Minted on demand rather than at creation: a client who has never been given
 * a link has no token to leak. Revoking sets it back to null, so a link
 * forwarded somewhere it shouldn't have gone stops working immediately and the
 * next one issued is a different token.
 */
export default function HubLink({
  url,
  createAction,
  revokeAction,
}: {
  url: string | null;
  createAction: () => Promise<void>;
  revokeAction: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="font-heading text-sm font-bold text-charcoal">Client hub</h2>
      <p className="mt-0.5 text-xs leading-relaxed text-charcoal/55">
        One private link where this client sees their quotes, work and invoices together. No
        password — anyone with the link can see it, so share it the way you would a document.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {url ? (
        <>
          <p className="mt-3 break-all rounded-lg bg-black/[0.03] px-3 py-2 font-mono text-[11px] text-charcoal/50">
            {url}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  // Clipboard blocked — the link is on screen to copy by hand.
                }
              }}
              className="cursor-pointer rounded-lg border border-black/10 px-3 py-1.5 text-xs font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
            >
              Open
            </a>
            <button
              type="button"
              onClick={() => run(revokeAction)}
              disabled={pending}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold text-charcoal/40 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              Revoke
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => run(createAction)}
          disabled={pending}
          className="mt-3 cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create a hub link"}
        </button>
      )}
    </section>
  );
}
