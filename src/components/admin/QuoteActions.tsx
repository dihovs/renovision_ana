"use client";

import { useState, useTransition } from "react";
import { QUOTE_TRANSITIONS, QUOTE_STATUS_LABEL, type QuoteStatus } from "@/lib/crm/quoteTypes";

/**
 * Send the quote, share the link, and record what the customer said.
 *
 * Only the transitions the state machine actually allows are offered. A
 * dropdown of every status would let the owner move an approved quote back to
 * draft with one mis-tap, silently discarding the approval evidence.
 */
export default function QuoteActions({
  quoteId,
  status,
  publicUrl,
  canSend,
  missingRbq,
  sendAction,
  statusAction,
}: {
  quoteId: string;
  status: QuoteStatus;
  publicUrl: string | null;
  canSend: boolean;
  missingRbq: boolean;
  sendAction: (id: string) => Promise<void>;
  statusAction: (id: string, status: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 'sent' is the send button's job, not a status the owner picks by hand.
  const manualTransitions = (QUOTE_TRANSITIONS[status] ?? []).filter((s) => s !== "sent");

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

  async function copyLink() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the link is visible on screen to copy by hand.
    }
  }

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canSend && (
          <button
            type="button"
            onClick={() => run(() => sendAction(quoteId))}
            disabled={pending || missingRbq}
            title={
              missingRbq
                ? "Add your RBQ licence number in Settings first — Quebec law requires it on every quote"
                : undefined
            }
            className="cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Working…" : status === "changes_requested" ? "Resend quote" : "Send quote"}
          </button>
        )}

        {publicUrl && (
          <>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-black/10 px-3 py-2 text-sm font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
            >
              Preview
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="cursor-pointer rounded-lg border border-black/10 px-3 py-2 text-sm font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </>
        )}

        {manualTransitions.map((next) => (
          <button
            key={next}
            type="button"
            onClick={() => run(() => statusAction(quoteId, next))}
            disabled={pending}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-charcoal/55 transition-colors hover:bg-black/[0.03] hover:text-charcoal disabled:opacity-50"
          >
            Mark {QUOTE_STATUS_LABEL[next].toLowerCase()}
          </button>
        ))}
      </div>

      {publicUrl && (
        <p className="mt-3 break-all rounded-lg bg-black/[0.03] px-3 py-2 font-mono text-[11px] text-charcoal/50">
          {publicUrl}
        </p>
      )}

      {!publicUrl && canSend && (
        <p className="mt-3 text-xs leading-relaxed text-charcoal/45">
          Sending freezes the tax rate, the client&apos;s name and address, and the service address
          onto this quote, then creates a private link the customer can open and approve.
        </p>
      )}
    </section>
  );
}
