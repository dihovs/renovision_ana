"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import AddressFields, {
  EMPTY_ADDRESS,
  inputClass,
  labelClass,
  type AddressValue,
} from "./AddressFields";
import type { ClientFormState } from "@/app/(internal)/admin/clients/actions";
import type { TaxRatesSetting } from "@/lib/crm/settings";
import { formatAddress, type Property } from "@/lib/crm/types";

/**
 * The list of a client's service addresses, with inline add and edit.
 *
 * Inline rather than a separate page because adding the second address to an
 * existing client is a ten-second job that shouldn't cost a navigation and a
 * lost scroll position.
 */

export default function PropertyEditor({
  properties,
  taxRates,
  addAction,
  updateAction,
  removeAction,
}: {
  properties: Property[];
  taxRates: TaxRatesSetting;
  // Already bound to the client id on the server; the property id is bound
  // here, because a server action can be re-bound from a client component but
  // cannot be *returned* by one.
  addAction: (prev: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  updateAction: (
    propertyId: string,
    prev: ClientFormState,
    formData: FormData,
  ) => Promise<ClientFormState>;
  removeAction: (propertyId: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-sm font-bold text-charcoal">Properties</h2>
          <p className="mt-0.5 text-xs text-charcoal/50">
            Where the work happens. One client can have many.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
            className="cursor-pointer text-xs font-bold text-brand-blue transition-colors hover:text-brand-blue/70"
          >
            + Add property
          </button>
        )}
      </div>

      {properties.length === 0 && !adding && (
        <p className="mt-3 text-sm text-charcoal/40">
          None yet. Quotes need an address to attach to.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {properties.map((property, index) => (
          <li key={property.id} className="rounded-lg border border-black/10">
            {editingId === property.id ? (
              <div className="p-3">
                <PropertyFields
                  taxRates={taxRates}
                  action={updateAction.bind(null, property.id)}
                  initial={{
                    street1: property.street1 ?? "",
                    street2: property.street2 ?? "",
                    city: property.city ?? "",
                    province: property.province ?? "QC",
                    postalCode: property.postal_code ?? "",
                    country: property.country ?? "Canada",
                    googlePlaceId: property.google_place_id ?? undefined,
                    latitude: property.latitude,
                    longitude: property.longitude,
                  }}
                  initialTaxRateId={property.tax_rate_id ?? ""}
                  initialAccessNotes={property.access_notes ?? ""}
                  submitLabel="Save"
                  onDone={() => setEditingId(null)}
                />
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue/[0.08] text-[11px] font-bold text-brand-blue">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-charcoal">
                    {formatAddress(property) || "No address entered"}
                  </span>
                  {property.access_notes && (
                    <span className="mt-0.5 block text-xs text-charcoal/55">
                      {property.access_notes}
                    </span>
                  )}
                  {property.tax_rate_id && (
                    <span className="mt-1 inline-block rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-semibold text-charcoal/60">
                      {taxRates.rates.find((r) => r.id === property.tax_rate_id)?.label ??
                        property.tax_rate_id}
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(property.id);
                      setAdding(false);
                    }}
                    className="cursor-pointer rounded-md px-2 py-1 text-xs font-bold text-charcoal/50 transition-colors hover:bg-black/[0.04] hover:text-charcoal"
                  >
                    Edit
                  </button>
                  <form action={removeAction.bind(null, property.id)}>
                    <RemoveButton />
                  </form>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {adding && (
        <div className="mt-3 rounded-lg border border-brand-blue/20 bg-brand-blue/[0.02] p-3">
          <PropertyFields
            taxRates={taxRates}
            action={addAction}
            initial={EMPTY_ADDRESS}
            initialTaxRateId=""
            initialAccessNotes=""
            submitLabel="Add property"
            onDone={() => setAdding(false)}
          />
        </div>
      )}
    </section>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="cursor-pointer rounded-md px-2 py-1 text-xs font-bold text-charcoal/35 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}

function PropertyFields({
  taxRates,
  action,
  initial,
  initialTaxRateId,
  initialAccessNotes,
  submitLabel,
  onDone,
}: {
  taxRates: TaxRatesSetting;
  action: (prev: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  initial: AddressValue;
  initialTaxRateId: string;
  initialAccessNotes: string;
  submitLabel: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ClientFormState);
  const [address, setAddress] = useState<AddressValue>(initial);
  const id = useId();

  // The action revalidates the page, so a successful save re-renders this list
  // from the server. Closing on the empty-object result avoids leaving the
  // form open over its own saved copy.
  const saved = !pending && state && !state.error && Object.keys(state).length === 0;

  return (
    <form
      action={formAction}
      onSubmit={() => {
        // Optimistic close on the next tick: the server result arrives after
        // the revalidation, by which point the list already shows the change.
        setTimeout(onDone, 400);
      }}
      className="space-y-3"
    >
      {state.error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}

      <AddressFields value={address} onChange={setAddress} namePrefix="property" />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-access-notes`} className={labelClass}>
            Access notes
          </label>
          <input
            id={`${id}-access-notes`}
            name="accessNotes"
            defaultValue={initialAccessNotes}
            placeholder="Gate code, parking, which door"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${id}-tax-rate`} className={labelClass}>
            Tax rate
          </label>
          <select
            id={`${id}-tax-rate`}
            name="propertyTaxRateId"
            defaultValue={initialTaxRateId}
            className={inputClass}
          >
            {/* Tax follows the place of supply, so a property outside Quebec
                overrides whatever the client is normally billed. */}
            <option value="">Same as client</option>
            {taxRates.rates.map((rate) => (
              <option key={rate.id} value={rate.id}>
                {rate.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Saving…" : saved ? "Saved" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="cursor-pointer text-sm font-semibold text-charcoal/50 transition-colors hover:text-charcoal"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
