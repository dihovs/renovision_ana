"use client";

import { useActionState, useId, useState } from "react";
import { inputClass, labelClass } from "./AddressFields";
import type { ConversionState } from "@/lib/crm/conversions";

/**
 * Start a job for this client without writing a quote first.
 *
 * This is how most work actually arrives: the phone rings about a leak, the
 * price is agreed out loud, the crew goes out that afternoon. Routing that
 * through the quote screens would mean recording an estimate nobody wrote and
 * an approval nobody gave — four fictions filed as facts, just to reach a job.
 *
 * Collapsed until asked for, because the common reason to open a client is to
 * look something up, not to book work.
 */
export default function StartJobCard({
  properties,
  action,
}: {
  properties: { id: string; label: string }[];
  action: (prev: ConversionState, formData: FormData) => Promise<ConversionState>;
}) {
  const [open, setOpen] = useState(false);
  const [state, run, pending] = useActionState(action, {} as ConversionState);
  const formId = useId();

  if (!open) {
    return (
      <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-heading text-sm font-bold text-charcoal">Work by phone</h2>
            <p className="mt-0.5 text-sm text-charcoal/55">
              Agreed on the phone? Start the job now and do the paperwork after.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="cursor-pointer rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-green-dark"
          >
            Start a job
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-brand-green/25 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="font-heading text-sm font-bold text-charcoal">Start a job</h2>

      <form action={run} className="mt-3 space-y-3">
        {state.error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
          >
            {state.error}
          </p>
        )}

        <div>
          <label htmlFor={`${formId}-title`} className={labelClass}>
            What the job is
          </label>
          <input
            id={`${formId}-title`}
            name="title"
            required
            maxLength={200}
            placeholder="Repair the bathroom ceiling"
            className={inputClass}
          />
        </div>

        {properties.length > 0 && (
          <div>
            <label htmlFor={`${formId}-property`} className={labelClass}>
              Where
            </label>
            <select id={`${formId}-property`} name="propertyId" className={inputClass}>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor={`${formId}-amount`} className={labelClass}>
            Price agreed (optional)
          </label>
          <input
            id={`${formId}-amount`}
            name="amount"
            inputMode="decimal"
            placeholder="850.00"
            className={inputClass}
          />
          {/* Left blank the job is still created — it simply cannot be
              invoiced until it is worth something, which the invoice button
              says in as many words. */}
          <p className="mt-1 text-xs text-charcoal/45">
            Before tax. Leave it blank and price it later — a job with no price cannot be
            invoiced.
          </p>
        </div>

        <div>
          <label htmlFor={`${formId}-instructions`} className={labelClass}>
            Notes for the crew (optional)
          </label>
          <textarea
            id={`${formId}-instructions`}
            name="instructions"
            rows={2}
            maxLength={5000}
            className={inputClass}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-green-dark disabled:opacity-50"
          >
            {pending ? "Starting…" : "Start the job"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="cursor-pointer rounded-lg border border-black/10 px-4 py-2 text-sm font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
