"use client";

import { useActionState, useId, useState } from "react";
import { inputClass, labelClass } from "./AddressFields";
import type { SettingsState } from "@/app/admin/settings/actions";
import type { CompanySetting, QuoteDefaultsSetting } from "@/lib/crm/settings";

/**
 * Settings — the legal header on every document, and the defaults every quote
 * starts from.
 *
 * The compliance fields carry their statutory reason inline. A field labelled
 * only "RBQ licence" gets filled in eventually; one that says omitting it is a
 * penal offence gets filled in today.
 */

export function CompanyForm({
  initial,
  action,
}: {
  initial: CompanySetting;
  action: (prev: SettingsState, formData: FormData) => Promise<SettingsState>;
}) {
  const [state, formAction, pending] = useActionState(action, {} as SettingsState);
  const [taxRegistered, setTaxRegistered] = useState(initial.taxRegistered);

  return (
    <form action={formAction} className="space-y-4">
      <Card title="Business details" subtitle="Printed at the top of every quote and invoice.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="tradeName" label="Trading name" defaultValue={initial.tradeName} />
          <Field
            name="legalName"
            label="Legal name"
            defaultValue={initial.legalName}
            hint="The registered company name, if different."
          />
        </div>

        <Field name="street1" label="Address" defaultValue={initial.street1} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field name="city" label="City" defaultValue={initial.city} />
          <Field name="province" label="Province" defaultValue={initial.province} />
          <Field name="postalCode" label="Postal code" defaultValue={initial.postalCode} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field name="phone" label="Phone" defaultValue={initial.phone} />
          <Field name="email" label="Email" defaultValue={initial.email} />
          <Field name="website" label="Website" defaultValue={initial.website} />
        </div>
        <input type="hidden" name="country" value={initial.country || "Canada"} />
      </Card>

      <Card title="Licences and registration">
        <Field
          name="rbqLicence"
          label="RBQ licence number"
          defaultValue={initial.rbqLicence}
          required
          hint="Quebec's Building Act (s. 57.1) requires this on all advertising, estimates, quotes, contracts and statements of account. Quotes cannot be sent without it."
        />

        <Field
          name="neq"
          label="NEQ"
          defaultValue={initial.neq}
          hint="Quebec enterprise number. Not legally required on documents, but customers and insurers ask for it."
        />

        <div className="rounded-lg border border-black/10 p-3">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="taxRegistered"
              checked={taxRegistered}
              onChange={(e) => setTaxRegistered(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-blue"
            />
            <span>
              <span className="font-semibold text-charcoal">Registered for GST and QST</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-charcoal/60">
                Registration is mandatory once taxable supplies pass $30,000 in a calendar quarter
                or the four before it. Below that you are a small supplier and must{" "}
                <strong>not</strong> charge the taxes. While this is unticked, no quote or invoice
                will show tax.
              </span>
            </span>
          </label>

          {taxRegistered && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TaxNumberField
                name="gstNumber"
                label="GST number"
                defaultValue={initial.gstNumber}
                required
                pattern={GST_PATTERN}
                example="123456789RT0001"
              />
              <TaxNumberField
                name="qstNumber"
                label="QST number"
                defaultValue={initial.qstNumber}
                required
                pattern={QST_PATTERN}
                example="1234567890TQ0001"
              />
            </div>
          )}
        </div>

        <Field
          name="opcPermit"
          label="OPC itinerant merchant permit"
          defaultValue={initial.opcPermit}
          hint="Only needed if you ever sign contracts away from your office after approaching the customer yourself. Leave blank if customers always contact you first."
        />
      </Card>

      <SaveBar state={state} pending={pending} />
    </form>
  );
}

export function QuoteDefaultsForm({
  initial,
  action,
}: {
  initial: QuoteDefaultsSetting;
  action: (prev: SettingsState, formData: FormData) => Promise<SettingsState>;
}) {
  const [state, formAction, pending] = useActionState(action, {} as SettingsState);
  const [depositKind, setDepositKind] = useState(initial.depositKind);

  return (
    <form action={formAction} className="space-y-4">
      <Card title="Quote defaults" subtitle="What every new quote starts with.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            name="validDays"
            label="Valid for (days)"
            defaultValue={String(initial.validDays)}
            type="number"
          />
          <div>
            <label className={labelClass}>Deposit</label>
            <select
              name="depositKind"
              value={depositKind}
              onChange={(e) => setDepositKind(e.target.value as typeof depositKind)}
              className={inputClass}
            >
              <option value="none">None</option>
              <option value="percent">Percent</option>
              <option value="amount">Fixed amount</option>
            </select>
          </div>
          <Field
            name="depositValue"
            label={depositKind === "percent" ? "Percent (×10 000)" : "Amount (cents)"}
            defaultValue={String(initial.depositValue)}
            type="number"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Check name="showQuantities" label="Show quantities" defaultChecked={initial.showQuantities} />
          <Check name="showUnitPrices" label="Show unit prices" defaultChecked={initial.showUnitPrices} />
          <Check name="showLineTotals" label="Show line totals" defaultChecked={initial.showLineTotals} />
          <Check name="showTotalsFooter" label="Show the totals footer" defaultChecked={initial.showTotalsFooter} />
          <Check name="requireSignature" label="Ask for a signature" defaultChecked={initial.requireSignature} />
        </div>
      </Card>

      <Card
        title="Standard wording"
        subtitle="French is the version that counts — where the two differ, Quebec law reads the one most favourable to the customer. Write the French first and translate from it."
      >
        <Area
          name="clientMessageFr"
          label="Message to the client — Français"
          defaultValue={initial.clientMessageFr}
        />
        <Area
          name="clientMessageEn"
          label="Message to the client — English"
          defaultValue={initial.clientMessageEn}
        />
        <Area
          name="contractTermsFr"
          label="Terms and conditions — Français"
          defaultValue={initial.contractTermsFr}
          rows={6}
        />
        <Area
          name="contractTermsEn"
          label="Terms and conditions — English"
          defaultValue={initial.contractTermsEn}
          rows={6}
        />
      </Card>

      <SaveBar state={state} pending={pending} />
    </form>
  );
}

function SaveBar({ state, pending }: { state: SettingsState; pending: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error && (
        <p
          role="alert"
          className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden className="shrink-0">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
          </svg>
          {state.error}
        </p>
      )}
      {state.ok && (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-700"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden className="shrink-0">
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Saved
        </p>
      )}
    </div>
  );
}

/** BN (9 digits) + RT + a 4-digit reference number, e.g. 123456789RT0001. */
const GST_PATTERN = /^\d{9}\s?RT\s?\d{4}$/i;
/** Quebec enterprise number (10 digits) + TQ + a 4-digit reference, e.g. 1234567890TQ0001. */
const QST_PATTERN = /^\d{10}\s?TQ\s?\d{4}$/i;

/**
 * A tax registration number field with a soft format check.
 *
 * The note is informational only — it never blocks the save. Revenu Québec's
 * format is the common case, not a guarantee, and refusing a real number the
 * owner typed correctly would be a worse failure than a missed typo.
 */
function TaxNumberField({
  name,
  label,
  defaultValue,
  required,
  pattern,
  example,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  pattern: RegExp;
  example: string;
}) {
  const id = useId();
  const [value, setValue] = useState(defaultValue ?? "");
  const trimmed = value.trim();
  const looksOff = trimmed !== "" && !pattern.test(trimmed);

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required={required}
        aria-describedby={`${id}-hint`}
        className={inputClass}
      />
      <p
        id={`${id}-hint`}
        className={`mt-1 text-[11px] leading-snug ${looksOff ? "text-amber-700" : "text-charcoal/50"}`}
      >
        {looksOff
          ? `Doesn't look like the usual format — expected something like ${example}`
          : `Format: ${example}`}
      </p>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  hint,
  required,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
  required?: boolean;
  type?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={inputClass}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[11px] leading-snug text-charcoal/50">
          {hint}
        </p>
      )}
    </div>
  );
}

function Area({
  name,
  label,
  defaultValue,
  rows = 3,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  rows?: number;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        className={`${inputClass} resize-y`}
      />
    </div>
  );
}

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-charcoal">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 cursor-pointer accent-brand-blue"
      />
      {label}
    </label>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="font-heading text-sm font-bold text-charcoal">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-charcoal/50">{subtitle}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
