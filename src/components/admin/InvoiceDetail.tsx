"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { inputClass, labelClass } from "./AddressFields";
import type { InvoiceState } from "@/app/admin/invoices/actions";
import { formatMoney } from "@/lib/crm/money";
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  type InvoiceStatus,
  type Payment,
} from "@/lib/crm/opsTypes";

/**
 * Send the invoice, and record what came in against it.
 *
 * The paid total and the status are maintained by a database trigger, so this
 * screen only ever writes payment rows. Recording a payment and separately
 * updating the invoice would be two writes that can disagree, and the failure
 * mode is chasing somebody for money they already sent.
 */
export default function InvoiceDetail({
  invoiceId,
  status,
  balanceCents,
  payments,
  publicUrl,
  missingRbq,
  sendAction,
  statusAction,
  paymentAction,
  removePaymentAction,
}: {
  invoiceId: string;
  status: InvoiceStatus;
  balanceCents: number;
  payments: Payment[];
  publicUrl: string | null;
  missingRbq: boolean;
  sendAction: (id: string) => Promise<void>;
  statusAction: (id: string, status: string) => Promise<void>;
  paymentAction: (prev: InvoiceState, formData: FormData) => Promise<InvoiceState>;
  removePaymentAction: (paymentId: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [recording, setRecording] = useState(false);
  const [payState, runPayment, paying] = useActionState(paymentAction, {} as InvoiceState);
  const amountId = useId();
  const methodId = useId();
  const receivedOnId = useId();
  const referenceId = useId();

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
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}

      <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {status === "draft" && (
            <button
              type="button"
              onClick={() => run(() => sendAction(invoiceId))}
              disabled={pending || missingRbq}
              title={missingRbq ? "Add your RBQ licence number in Settings first" : undefined}
              className="cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Working…" : "Send invoice"}
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
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(publicUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    // Clipboard blocked — the link is on screen to copy by hand.
                  }
                }}
                className="cursor-pointer rounded-lg border border-black/10 px-3 py-2 text-sm font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <span aria-live="polite" className="sr-only">
                {copied ? "Link copied to clipboard" : ""}
              </span>
            </>
          )}

          {balanceCents > 0 && status !== "draft" && !recording && (
            <button
              type="button"
              onClick={() => setRecording(true)}
              className="cursor-pointer rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-green-dark"
            >
              Record payment
            </button>
          )}

          {status !== "bad_debt" && status !== "paid" && status !== "draft" && (
            <button
              type="button"
              onClick={() => run(() => statusAction(invoiceId, "bad_debt"))}
              disabled={pending}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-charcoal/45 transition-colors hover:bg-black/[0.03] hover:text-charcoal disabled:opacity-50"
            >
              Write off
            </button>
          )}
        </div>

        {publicUrl && (
          <p className="mt-3 break-all rounded-lg bg-black/[0.03] px-3 py-2 font-mono text-[11px] text-charcoal/50">
            {publicUrl}
          </p>
        )}

        {recording && (
          <form
            action={runPayment}
            onSubmit={() => setTimeout(() => setRecording(false), 400)}
            className="mt-4 space-y-3 rounded-lg border border-brand-green/25 bg-brand-green/[0.03] p-3"
          >
            <h3 className="font-heading text-sm font-bold text-charcoal">Record a payment</h3>
            {payState.error && (
              <p role="alert" className="text-sm font-medium text-red-700">
                {payState.error}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor={amountId} className={labelClass}>
                  Amount
                </label>
                <input
                  id={amountId}
                  name="amount"
                  inputMode="decimal"
                  // Pre-filled with the balance: paying an invoice in full is
                  // the overwhelmingly common case, and it is still editable.
                  defaultValue={(balanceCents / 100).toFixed(2)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor={methodId} className={labelClass}>
                  Method
                </label>
                <select id={methodId} name="method" defaultValue="e_transfer" className={inputClass}>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {PAYMENT_METHOD_LABEL[method]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={receivedOnId} className={labelClass}>
                  Received on
                </label>
                <input
                  id={receivedOnId}
                  type="date"
                  name="receivedOn"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor={referenceId} className={labelClass}>
                Reference
              </label>
              <input
                id={referenceId}
                name="reference"
                placeholder="Cheque number, e-transfer confirmation"
                className={inputClass}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={paying}
                className="cursor-pointer rounded-lg bg-brand-green px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-brand-green-dark disabled:opacity-60"
              >
                {paying ? "Recording…" : "Record"}
              </button>
              <button
                type="button"
                onClick={() => setRecording(false)}
                className="cursor-pointer text-sm font-semibold text-charcoal/50 hover:text-charcoal"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {(status !== "draft" || payments.length > 0) && (
        <section className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          <h3 className="border-b border-black/5 px-4 py-3 font-heading text-sm font-bold text-charcoal">
            Payments
          </h3>
          {payments.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-charcoal/40">
              No payments recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-black/5">
              {payments.map((payment) => (
                <li key={payment.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-charcoal">
                      {PAYMENT_METHOD_LABEL[payment.method]}
                      {payment.reference && (
                        <span className="ml-1.5 font-normal text-charcoal/45">
                          {payment.reference}
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-charcoal/50">{payment.received_on}</span>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold tabular-nums ${
                      payment.amount_cents < 0 ? "text-red-700" : "text-green-700"
                    }`}
                  >
                    {formatMoney(payment.amount_cents)}
                  </span>
                  <button
                    type="button"
                    onClick={() => run(() => removePaymentAction(payment.id))}
                    aria-label={`Remove ${formatMoney(payment.amount_cents)} payment received ${payment.received_on}`}
                    className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs font-bold text-charcoal/30 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
