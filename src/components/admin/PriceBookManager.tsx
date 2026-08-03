"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { inputClass, labelClass } from "./AddressFields";
import type { PriceBookState } from "@/app/(internal)/admin/price-book/actions";
import { formatMoney } from "@/lib/crm/money";
import { marginHundredths, type PriceBookItem } from "@/lib/crm/quoteTypes";

/**
 * The price book: saved line items the quote builder draws from.
 *
 * Cost is shown next to price with the resulting margin, because the moment
 * that column is visible is the moment underpriced work becomes obvious. It
 * stays blank rather than showing 100% when cost is unknown — the seeded
 * catalog carries only sell rates, and a fabricated margin is worse than none.
 */

export default function PriceBookManager({
  items,
  categories,
  createAction,
  updateAction,
  archiveAction,
  seedAction,
  totalCount,
  search,
}: {
  items: PriceBookItem[];
  categories: string[];
  createAction: (prev: PriceBookState, formData: FormData) => Promise<PriceBookState>;
  updateAction: (
    id: string,
    prev: PriceBookState,
    formData: FormData,
  ) => Promise<PriceBookState>;
  archiveAction: (id: string, archived: boolean) => Promise<void>;
  seedAction: (prev: PriceBookState) => Promise<PriceBookState>;
  totalCount: number;
  /** Current `?q=` value, so the box shows what's actually being searched. */
  search: string;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [seedState, runSeed, seeding] = useActionState(seedAction, {} as PriceBookState);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form className="relative min-w-[200px] flex-1">
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search name, code or keyword"
            aria-label="Search the price book"
            className={inputClass}
          />
        </form>
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setEditingId(null);
          }}
          className="shrink-0 cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90"
        >
          New item
        </button>
      </div>

      {totalCount === 0 && (
        <form action={runSeed} className="rounded-xl border border-brand-blue/20 bg-brand-blue/[0.03] p-4">
          <h3 className="font-heading text-sm font-bold text-brand-blue">
            Import your estimator catalog
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-charcoal/70">
            The AI estimator already has 128 priced items — flooring, drywall, water damage, the
            lot. Import them here and they become pickable on every quote. Costs come in blank,
            because the catalog only ever carried sell rates; fill them in as you learn them and
            the margin column starts working.
          </p>
          <button
            type="submit"
            disabled={seeding}
            className="mt-3 cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-wait disabled:opacity-60"
          >
            {seeding ? "Importing…" : "Import catalog"}
          </button>
          {seedState.error && (
            <p role="alert" className="mt-2 text-sm font-medium text-red-700">
              {seedState.error}
            </p>
          )}
        </form>
      )}

      {seedState.ok && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
          {seedState.ok}
        </p>
      )}

      {adding && (
        <div className="rounded-xl border border-brand-blue/20 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-heading text-sm font-bold text-charcoal">New item</h3>
          <ItemForm
            action={createAction}
            categories={categories}
            onDone={() => setAdding(false)}
            submitLabel="Add item"
          />
        </div>
      )}

      {items.length === 0 && totalCount > 0 ? (
        // Items exist, but this search matched none of them — a plain "empty"
        // message here would read as "you have no price book", which isn't
        // true, so the CTA points at the actual fix (clear the search).
        <div className="rounded-xl border border-black/5 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-charcoal/50">
            {search ? (
              <>No items match &ldquo;{search}&rdquo;.</>
            ) : (
              <>No items match that search.</>
            )}
          </p>
          <Link
            href="/admin/price-book"
            className="mt-2 inline-block text-sm font-semibold text-brand-blue hover:underline"
          >
            Clear search
          </Link>
        </div>
      ) : items.length === 0 && !adding ? (
        // The catalog itself is empty. The import card above is the primary
        // CTA for that; this just points at the manual alternative.
        <p className="rounded-xl border border-black/5 bg-white p-6 text-center text-sm text-charcoal/50 shadow-sm">
          Or add items one at a time with{" "}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="cursor-pointer font-semibold text-brand-blue hover:underline"
          >
            New item
          </button>
          , above.
        </p>
      ) : items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          <ul className="divide-y divide-black/5">
            {items.map((item) => {
              const margin = marginHundredths(item);
              if (editingId === item.id) {
                return (
                  <li key={item.id} className="bg-brand-blue/[0.02] p-4">
                    <ItemForm
                      action={updateAction.bind(null, item.id)}
                      categories={categories}
                      initial={item}
                      onDone={() => setEditingId(null)}
                      submitLabel="Save"
                    />
                  </li>
                );
              }
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
                >
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-bold text-charcoal">{item.name}</span>
                      {item.item_code && (
                        <span className="shrink-0 font-mono text-[11px] text-charcoal/35">
                          {item.item_code}
                        </span>
                      )}
                    </div>
                    <span className="block truncate text-xs text-charcoal/50">
                      {[item.category, item.unit && `per ${item.unit}`]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                      {!item.taxable && " · non-taxable"}
                    </span>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="block text-sm font-bold text-charcoal">
                      {formatMoney(item.unit_price_cents)}
                    </span>
                    <span className="block text-[11px] text-charcoal/40">
                      {item.unit_cost_cents === null
                        ? "no cost set"
                        : `${formatMoney(item.unit_cost_cents)} cost${
                            margin === null ? "" : ` · ${(margin / 100).toFixed(0)}%`
                          }`}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setAdding(false);
                      }}
                      className="cursor-pointer rounded-md px-2 py-1 text-xs font-bold text-charcoal/50 transition-colors hover:bg-black/[0.04] hover:text-charcoal"
                    >
                      Edit
                    </button>
                    <form action={archiveAction.bind(null, item.id, true)}>
                      <button
                        type="submit"
                        className="cursor-pointer rounded-md px-2 py-1 text-xs font-bold text-charcoal/35 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        Archive
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ItemForm({
  action,
  categories,
  initial,
  onDone,
  submitLabel,
}: {
  action: (prev: PriceBookState, formData: FormData) => Promise<PriceBookState>;
  categories: string[];
  initial?: PriceBookItem;
  onDone: () => void;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as PriceBookState);
  const categoryId = useId();

  const money = (cents: number | null | undefined) =>
    cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);

  return (
    <form
      action={formAction}
      onSubmit={() => setTimeout(onDone, 400)}
      className="space-y-3"
    >
      {state.error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <Field name="name" label="Name" defaultValue={initial?.name} required />
        <Field name="itemCode" label="Code" defaultValue={initial?.item_code ?? ""} mono />
      </div>

      <Field
        name="description"
        label="Description"
        defaultValue={initial?.description ?? ""}
        hint="Printed on the quote under the item name."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={categoryId} className={labelClass}>
            Category
          </label>
          <input
            id={categoryId}
            name="category"
            defaultValue={initial?.category ?? ""}
            list="price-book-categories"
            className={inputClass}
          />
          <datalist id="price-book-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <Field name="subcategory" label="Subcategory" defaultValue={initial?.subcategory ?? ""} />
        <Field
          name="unit"
          label="Unit"
          defaultValue={initial?.unit ?? ""}
          hint="sq ft, linear ft, each, hour"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          name="unitPrice"
          label="Price per unit"
          defaultValue={money(initial?.unit_price_cents)}
          required
        />
        <Field
          name="unitCost"
          label="Cost per unit"
          defaultValue={money(initial?.unit_cost_cents)}
          hint="Leave blank if unknown."
        />
        <Field
          name="laborHours"
          label="Labour hours / unit"
          defaultValue={initial?.labor_hours_per_unit?.toString() ?? ""}
        />
      </div>

      <Field
        name="keywords"
        label="Search keywords"
        defaultValue={initial?.keywords ?? ""}
        hint="Only used to find the item. Never printed."
      />

      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-charcoal">
        <input
          type="checkbox"
          name="taxable"
          defaultChecked={initial?.taxable ?? true}
          className="h-4 w-4 cursor-pointer accent-brand-blue"
        />
        Taxable by default
      </label>

      <input type="hidden" name="laborClass" value={initial?.labor_class ?? ""} />
      <input type="hidden" name="exclusions" value={initial?.exclusions ?? ""} />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
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

function Field({
  name,
  label,
  defaultValue,
  hint,
  required,
  mono,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
  required?: boolean;
  mono?: boolean;
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
        defaultValue={defaultValue}
        required={required}
        className={`${inputClass} ${mono ? "font-mono text-xs" : ""}`}
      />
      {hint && <p className="mt-1 text-[11px] leading-snug text-charcoal/45">{hint}</p>}
    </div>
  );
}
