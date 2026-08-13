"use client";

import { useState } from "react";
import CustomFieldList from "./CustomFieldList";
import { tapFeedback } from "@/lib/haptics";
import { visibleFields, type CustomFieldDef } from "@/lib/crm/settings";

/**
 * The claim this job is being done under.
 *
 * On direct insurance work these are the fields the whole file hangs off:
 * the claim number an adjuster searches by, the carrier being billed, the
 * category of water that decides whether drywall gets dried or removed.
 * They describe the JOB, not the customer — a client with two losses would
 * otherwise overwrite their own claim.
 *
 * Collapsed by default once filled, because it is reference data: entered
 * once at the start and read afterwards. Open when empty, because an unfilled
 * claim number on an insurance job is the thing most worth noticing.
 */
export default function ClaimDetails({
  fields,
  initial,
  action,
}: {
  fields: CustomFieldDef[];
  initial: Record<string, string>;
  action: (formData: FormData) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const filled = Object.values(initial).filter((v) => v.trim()).length;
  const [open, setOpen] = useState(filled === 0);
  const [saving, setSaving] = useState(false);

  const shown = visibleFields(fields, values);
  const required = shown.filter((f) => f.required && !values[f.id]?.trim());

  // The two an adjuster asks for first, shown on the collapsed header so the
  // common case needs no taps at all.
  const summary = [initial.claim_number, initial.carrier_name].filter((v) => v?.trim());

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
      >
        <span className="min-w-0">
          <span className="block font-heading text-sm font-bold text-charcoal">
            Claim details
          </span>
          <span className="mt-0.5 block truncate text-xs text-charcoal/45">
            {summary.length > 0
              ? summary.join(" · ")
              : filled > 0
                ? `${filled} field${filled === 1 ? "" : "s"} filled`
                : "Not started — claim number, carrier, adjuster"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {required.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              {required.length} missing
            </span>
          )}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
            className={`text-charcoal/30 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <form
          action={async (formData) => {
            setSaving(true);
            try {
              await action(formData);
            } finally {
              setSaving(false);
            }
          }}
          className="mt-4 border-t border-black/5 pt-4"
        >
          <CustomFieldList fields={fields} values={values} onChange={setValues} />

          <button
            type="submit"
            disabled={saving}
            className="mt-4 h-11 w-full cursor-pointer rounded-xl bg-brand-blue text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50 sm:w-auto sm:px-6"
          >
            {saving ? "Saving…" : "Save claim details"}
          </button>
        </form>
      )}
    </section>
  );
}
