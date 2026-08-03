"use client";

import { useState, useTransition } from "react";
import type { ConversionState } from "@/lib/crm/conversions";

/**
 * The two things you can do with an approved quote.
 *
 * "Convert to a job" copies the agreed lines onto a job. "Invoice it" walks the
 * same hop and then bills the job it produced — the invoice always comes from
 * the job, never from the quote, because the job is what holds the frozen copy
 * of what was actually agreed to be built.
 *
 * Both are idempotent, so a double tap on a phone cannot produce two jobs or
 * two invoices. Both RETURN a refusal rather than throwing one: Next replaces
 * the message of an error thrown out of a server action with a generic digest
 * in production, and "this quote already became job #1042, which is archived"
 * is worth nothing if it arrives as "an error occurred".
 */
export default function QuoteConversion({
  convertAction,
  invoiceAction,
  depositInvoiceAction,
  hasDeposit,
}: {
  convertAction: () => Promise<ConversionState>;
  invoiceAction: () => Promise<ConversionState>;
  depositInvoiceAction: () => Promise<ConversionState>;
  /** Whether the quote itself asks for a deposit — offers the matching button. */
  hasDeposit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<ConversionState>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result?.error) setError(result.error);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="mt-3">
      {error && (
        <p
          role="alert"
          className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run(convertAction)}
          disabled={pending}
          className="cursor-pointer rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-green-dark disabled:opacity-50"
        >
          Convert to a job
        </button>

        {hasDeposit && (
          <button
            type="button"
            onClick={() => run(depositInvoiceAction)}
            disabled={pending}
            className="cursor-pointer rounded-lg border border-brand-blue/30 px-4 py-2 text-sm font-bold text-brand-blue transition-colors hover:bg-brand-blue/[0.04] disabled:opacity-50"
          >
            Deposit invoice
          </button>
        )}

        <button
          type="button"
          onClick={() => run(invoiceAction)}
          disabled={pending}
          className="cursor-pointer rounded-lg border border-black/10 px-4 py-2 text-sm font-bold text-charcoal transition-colors hover:bg-black/[0.03] disabled:opacity-50"
        >
          Invoice it
        </button>
      </div>
    </div>
  );
}
