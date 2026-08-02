"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import AddressFields, {
  EMPTY_ADDRESS,
  inputClass,
  labelClass,
  type AddressValue,
} from "./AddressFields";
import type { ClientFormState } from "@/app/(internal)/admin/clients/actions";
import type { CustomFieldDef, TaxRatesSetting } from "@/lib/crm/settings";
import { CONTACT_TYPES, type EmailContact, type PhoneContact } from "@/lib/crm/types";

/**
 * Create/edit a client.
 *
 * Modelled on Jobber's client screen, with one deliberate difference: the
 * first property is entered here rather than in a second step. A residential
 * client with no address is useless — you cannot quote work at nowhere — and
 * "same as billing" covers most of them in one tick.
 */

export type ClientFormValues = {
  firstName: string;
  lastName: string;
  companyName: string;
  emails: EmailContact[];
  phones: PhoneContact[];
  billing: AddressValue;
  taxRateId: string;
  leadSource: string;
  tags: string;
  notes: string;
  custom: Record<string, string>;
};

export const BLANK_CLIENT: ClientFormValues = {
  firstName: "",
  lastName: "",
  companyName: "",
  emails: [],
  phones: [],
  billing: EMPTY_ADDRESS,
  taxRateId: "",
  leadSource: "",
  tags: "",
  notes: "",
  custom: {},
};

export default function ClientForm({
  action,
  initial = BLANK_CLIENT,
  taxRates,
  leadSources,
  customFields,
  submitLabel,
  cancelHref,
  /** Property capture belongs on create; editing one happens on the detail page. */
  withProperty = false,
}: {
  action: (prev: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  initial?: ClientFormValues;
  taxRates: TaxRatesSetting;
  leadSources: string[];
  customFields: CustomFieldDef[];
  submitLabel: string;
  cancelHref: string;
  withProperty?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ClientFormState);
  const id = useId();

  const [emails, setEmails] = useState<EmailContact[]>(initial.emails);
  const [phones, setPhones] = useState<PhoneContact[]>(initial.phones);
  const [billing, setBilling] = useState<AddressValue>(initial.billing);
  const [property, setProperty] = useState<AddressValue>(EMPTY_ADDRESS);
  const [sameAsBilling, setSameAsBilling] = useState(true);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
        >
          {state.error}
        </p>
      )}

      <Card title="Name">
        <div className="grid gap-3 sm:grid-cols-2">
          <Text name="firstName" label="First name" defaultValue={initial.firstName} autoFocus />
          <Text name="lastName" label="Last name" defaultValue={initial.lastName} />
        </div>
        <Text
          name="companyName"
          label="Company name"
          defaultValue={initial.companyName}
          hint="Leave blank for a homeowner. When set, this is the name that appears on job lists."
        />
      </Card>

      <Card title="Contact">
        <ContactList
          kind="email"
          rows={emails}
          onChange={setEmails}
          blank={{
            address: "",
            type: "main",
            primary: false,
            receivesQuotes: true,
            receivesInvoices: true,
          }}
        />
        <div className="mt-4 border-t border-black/5 pt-4">
          <ContactList
            kind="phone"
            rows={phones}
            onChange={setPhones}
            blank={{ number: "", type: "mobile", primary: false, smsAllowed: false }}
          />
        </div>
        {/* Posted as JSON: the rows are added and removed client-side, and
            reindexing emails[2][type] on every delete is a bug factory. */}
        <input type="hidden" name="emails" value={JSON.stringify(emails)} />
        <input type="hidden" name="phones" value={JSON.stringify(phones)} />
      </Card>

      <Card title="Billing address" subtitle="Where invoices are sent.">
        <AddressFields value={billing} onChange={setBilling} namePrefix="billing" />
      </Card>

      {withProperty && (
        <Card
          title="Property address"
          subtitle="Where the work happens. More can be added afterwards."
        >
          <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-charcoal">
            <input
              type="checkbox"
              checked={sameAsBilling}
              onChange={(e) => setSameAsBilling(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-brand-blue"
            />
            Same as billing address
          </label>

          {sameAsBilling ? (
            <>
              <p className="rounded-lg bg-black/[0.03] px-3 py-2 text-sm text-charcoal/60">
                {[billing.street1, billing.city, billing.postalCode].filter(Boolean).join(", ") ||
                  "Fill in the billing address above and it will be used here."}
              </p>
              {/* Mirrored into hidden inputs so the server receives one answer
                  and never has to re-derive the checkbox's meaning. */}
              <HiddenAddress prefix="property" value={billing} />
            </>
          ) : (
            <AddressFields value={property} onChange={setProperty} namePrefix="property" />
          )}

          <div className="mt-3">
            <Text
              name="accessNotes"
              label="Access notes"
              hint="Gate code, parking, which door, where the water shut-off is."
            />
          </div>
        </Card>
      )}

      <Card title="Details">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-source`} className={labelClass}>
              Lead source
            </label>
            <select
              id={`${id}-source`}
              name="leadSource"
              defaultValue={initial.leadSource}
              className={inputClass}
            >
              <option value="">—</option>
              {leadSources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${id}-tax`} className={labelClass}>
              Tax rate
            </label>
            <select
              id={`${id}-tax`}
              name="taxRateId"
              defaultValue={initial.taxRateId}
              className={inputClass}
            >
              {/* Empty means "follow the account default", which is not the
                  same as pinning today's default — it keeps following when
                  the default changes. */}
              <option value="">Account default</option>
              {taxRates.rates.map((rate) => (
                <option key={rate.id} value={rate.id}>
                  {rate.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Text
          name="tags"
          label="Tags"
          defaultValue={initial.tags}
          hint="Comma separated — insurance, property manager, VIP."
        />

        {customFields.map((field) => (
          <CustomField key={field.id} field={field} value={initial.custom[field.id] ?? ""} />
        ))}
      </Card>

      <Card title="Notes" subtitle="Internal only — never shown to the client.">
        <textarea
          name="notes"
          defaultValue={initial.notes}
          rows={4}
          className={`${inputClass} resize-y`}
        />
      </Card>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="text-sm font-semibold text-charcoal/50 transition-colors hover:text-charcoal"
        >
          Cancel
        </Link>
      </div>

    </form>
  );
}

function HiddenAddress({ prefix, value }: { prefix: string; value: AddressValue }) {
  return (
    <>
      <input type="hidden" name={`${prefix}Street1`} value={value.street1} />
      <input type="hidden" name={`${prefix}Street2`} value={value.street2} />
      <input type="hidden" name={`${prefix}City`} value={value.city} />
      <input type="hidden" name={`${prefix}Province`} value={value.province} />
      <input type="hidden" name={`${prefix}PostalCode`} value={value.postalCode} />
      <input type="hidden" name={`${prefix}Country`} value={value.country} />
      <input type="hidden" name={`${prefix}PlaceId`} value={value.googlePlaceId ?? ""} />
      <input type="hidden" name={`${prefix}Latitude`} value={value.latitude ?? ""} />
      <input type="hidden" name={`${prefix}Longitude`} value={value.longitude ?? ""} />
    </>
  );
}

/**
 * Emails and phones share every behaviour except the value field and the one
 * checkbox that differs, so they share a component. Two near-identical lists
 * drift the moment one gets a fix the other doesn't.
 */
function ContactList<T extends EmailContact | PhoneContact>({
  kind,
  rows,
  onChange,
  blank,
}: {
  kind: "email" | "phone";
  rows: T[];
  onChange: (next: T[]) => void;
  blank: T;
}) {
  const isEmail = kind === "email";

  // The patch is loosely typed and narrowed once, here, rather than cast at
  // each of the six call sites — the fields differ between the two kinds and
  // TypeScript cannot see which branch it is in from inside a generic.
  function update(index: number, patch: Record<string, unknown>) {
    onChange(rows.map((row, i) => (i === index ? ({ ...row, ...patch } as T) : row)));
  }

  function setPrimary(index: number) {
    // Radio semantics without a radio group: naming them would collide across
    // the two lists, and a form-level name is not what "primary" means here.
    onChange(rows.map((row, i) => ({ ...row, primary: i === index })) as T[]);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-charcoal/70">
          {isEmail ? "Email addresses" : "Phone numbers"}
        </span>
        <button
          type="button"
          onClick={() => onChange([...rows, { ...blank, primary: rows.length === 0 } as T])}
          className="cursor-pointer text-xs font-bold text-brand-blue transition-colors hover:text-brand-blue/70"
        >
          + Add {isEmail ? "email" : "phone"}
        </button>
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-charcoal/40">None yet.</p>
      )}

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="rounded-lg border border-black/10 p-2.5">
            <div className="flex gap-2">
              <input
                value={isEmail ? (row as EmailContact).address : (row as PhoneContact).number}
                onChange={(e) =>
                  update(index, (isEmail
                    ? { address: e.target.value }
                    : { number: e.target.value }))
                }
                type={isEmail ? "email" : "tel"}
                inputMode={isEmail ? "email" : "tel"}
                placeholder={isEmail ? "name@example.com" : "579 990 3077"}
                className={`${inputClass} flex-1`}
              />
              <select
                value={row.type}
                onChange={(e) => update(index, { type: e.target.value })}
                aria-label="Type"
                className={`${inputClass} w-28 shrink-0`}
              >
                {CONTACT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type[0].toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                aria-label="Remove"
                className="shrink-0 cursor-pointer rounded-lg px-2 text-charcoal/35 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <Check
                label="Primary"
                checked={row.primary}
                onChange={() => setPrimary(index)}
              />
              {isEmail ? (
                <>
                  <Check
                    label="Gets quotes"
                    checked={(row as EmailContact).receivesQuotes}
                    onChange={(v) => update(index, { receivesQuotes: v })}
                  />
                  <Check
                    label="Gets invoices"
                    checked={(row as EmailContact).receivesInvoices}
                    onChange={(v) => update(index, { receivesInvoices: v })}
                  />
                </>
              ) : (
                <Check
                  label="Texting allowed"
                  checked={(row as PhoneContact).smsAllowed}
                  onChange={(v) => update(index, { smsAllowed: v })}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-charcoal/70">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 cursor-pointer accent-brand-blue"
      />
      {label}
    </label>
  );
}

function CustomField({ field, value }: { field: CustomFieldDef; value: string }) {
  const name = `custom__${field.id}`;
  const id = useId();
  if (field.type === "select") {
    return (
      <div>
        <label htmlFor={id} className={labelClass}>
          {field.label}
        </label>
        <select id={id} name={name} defaultValue={value} className={inputClass}>
          <option value="">—</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (field.type === "checkbox") {
    return (
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-charcoal">
        <input
          type="checkbox"
          name={name}
          value="yes"
          defaultChecked={value === "yes"}
          className="h-4 w-4 cursor-pointer accent-brand-blue"
        />
        {field.label}
      </label>
    );
  }
  return (
    <Text
      name={name}
      label={field.label}
      defaultValue={value}
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
    />
  );
}

function Text({
  name,
  label,
  defaultValue,
  hint,
  type = "text",
  autoFocus,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
  type?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        className={inputClass}
      />
      {hint && <p className="mt-1 text-[11px] leading-snug text-charcoal/45">{hint}</p>}
    </div>
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
      {subtitle && <p className="mt-0.5 mb-3 text-xs text-charcoal/50">{subtitle}</p>}
      <div className={subtitle ? "space-y-3" : "mt-3 space-y-3"}>{children}</div>
    </section>
  );
}
