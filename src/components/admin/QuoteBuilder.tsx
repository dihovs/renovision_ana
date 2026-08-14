"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { inputClass, labelClass } from "./AddressFields";
import type { QuoteFormState } from "@/app/(internal)/admin/quotes/actions";
import {
  calculateQuoteTotals,
  formatMoney,
  formatQuantity,
  lineTotalCents,
  parseMoneyToCents,
  parseQuantityToMilli,
  PERCENT_SCALE,
  QUANTITY_SCALE,
  type Discount,
} from "@/lib/crm/money";
import { blankLine, type EditableLine } from "@/lib/crm/quoteLines";
import type { CompanySetting, TaxRate, TaxRatesSetting } from "@/lib/crm/settings";
import type { DiscountKind, PriceBookItem, QuoteTier } from "@/lib/crm/quoteTypes";

/**
 * The estimate builder.
 *
 * Totals are computed in the browser by the SAME function the server uses —
 * imported from money.ts, not reimplemented. Two implementations of the tax
 * order would drift, and the customer would be shown one number while the
 * database stored another.
 *
 * Every money field is parsed with parseMoneyToCents on the way in, so a
 * French keyboard's "1 234,56" is read correctly rather than becoming NaN or,
 * worse, 123456 dollars.
 */

export type QuoteFormValues = {
  clientId: string;
  propertyId: string;
  projectId: string;
  leadId: string;
  title: string;
  taxRateId: string;
  discountKind: DiscountKind;
  discountValue: string;
  depositKind: DiscountKind;
  depositValue: string;
  clientMessage: string;
  contractTerms: string;
  internalNotes: string;
  showQuantities: boolean;
  showUnitPrices: boolean;
  showLineTotals: boolean;
  showTotalsFooter: boolean;
  requireSignature: boolean;
  validUntil: string;
  language: "fr" | "en";
  isItinerant: boolean;
  lines: EditableLine[];
};

export type ClientOption = {
  id: string;
  name: string;
  taxRateId: string | null;
  properties: { id: string; label: string; taxRateId: string | null }[];
  projects: { id: string; name: string }[];
};

export default function QuoteBuilder({
  action,
  initial,
  clients,
  taxRates,
  company,
  submitLabel,
  cancelHref,
}: {
  action: (prev: QuoteFormState, formData: FormData) => Promise<QuoteFormState>;
  initial: QuoteFormValues;
  clients: ClientOption[];
  taxRates: TaxRatesSetting;
  company: CompanySetting;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as QuoteFormState);
  const id = useId();

  const [clientId, setClientId] = useState(initial.clientId);
  const [propertyId, setPropertyId] = useState(initial.propertyId);
  const [projectId, setProjectId] = useState(initial.projectId);
  const [taxRateId, setTaxRateId] = useState(initial.taxRateId);
  const [lines, setLines] = useState<EditableLine[]>(
    initial.lines.length ? initial.lines : [blankLine()],
  );
  const [discountKind, setDiscountKind] = useState<DiscountKind>(initial.discountKind);
  const [discountValue, setDiscountValue] = useState(initial.discountValue);
  const [depositKind, setDepositKind] = useState<DiscountKind>(initial.depositKind);
  const [depositValue, setDepositValue] = useState(initial.depositValue);
  const [language, setLanguage] = useState(initial.language);
  const [isItinerant, setIsItinerant] = useState(initial.isItinerant);

  const client = clients.find((c) => c.id === clientId);
  const property = client?.properties.find((p) => p.id === propertyId);

  // Selecting a client whose properties don't include the current one must
  // clear it, or the quote would carry an address belonging to someone else.
  //
  // Corrected during render rather than from an effect, and that matters here
  // beyond satisfying the linter: from an effect there is one committed render
  // in which propertyId still names the previous client's address, and the tax
  // chain (property → client → default) is resolved against it a few lines
  // below. React re-runs this render before anything is painted or submitted,
  // so the mismatch never reaches the totals or the form. The condition is
  // false immediately after the assignment, so it settles in one pass.
  if (propertyId && client && !client.properties.some((p) => p.id === propertyId)) {
    setPropertyId(client.properties[0]?.id ?? "");
  }

  // The rate the totals below are computed with: quote → property → client →
  // account default, and nothing at all if the company isn't registered to
  // collect tax.
  const effectiveRate: TaxRate = useMemo(() => {
    const registered = company.taxRegistered && company.gstNumber && company.qstNumber;
    if (!registered) return { id: "unregistered", label: "Not registered", components: [] };
    const chain = [taxRateId, property?.taxRateId, client?.taxRateId];
    for (const candidate of chain) {
      if (!candidate) continue;
      const match = taxRates.rates.find((r) => r.id === candidate);
      if (match) return match;
    }
    return (
      taxRates.rates.find((r) => r.id === taxRates.default) ??
      taxRates.rates[0] ?? { id: "exempt", label: "No tax", components: [] }
    );
  }, [taxRateId, property, client, taxRates, company]);

  const discount: Discount = {
    kind: discountKind,
    value:
      discountKind === "percent"
        ? Math.round((Number(discountValue.replace(",", ".")) || 0) * PERCENT_SCALE)
        : (parseMoneyToCents(discountValue) ?? 0),
  };
  const deposit: Discount = {
    kind: depositKind,
    value:
      depositKind === "percent"
        ? Math.round((Number(depositValue.replace(",", ".")) || 0) * PERCENT_SCALE)
        : (parseMoneyToCents(depositValue) ?? 0),
  };

  const totals = useMemo(
    () =>
      calculateQuoteTotals(
        lines
          .filter((line) => line.kind === "item")
          .map((line) => ({
            quantityMilli: parseQuantityToMilli(line.quantity) ?? 0,
            unitPriceCents: parseMoneyToCents(line.unitPrice) ?? 0,
            taxable: line.taxable,
            optional: line.optional,
            selected: line.selected,
          })),
        effectiveRate,
        discount,
        deposit,
      ),
    // Depends on discount/deposit's FIELDS, not the objects. Both are object
    // literals rebuilt on every render just above, so listing them directly
    // would give a new identity each time and memoise nothing. exhaustive-deps
    // can't see that {kind, value} is the whole shape and warns anyway — the
    // warning is wrong here, and "fixing" it would silently undo the memo.
    [lines, effectiveRate, discount.kind, discount.value, deposit.kind, deposit.value],
  );

  // Serialised for the server, which re-validates everything anyway.
  const serialisedLines = lines.map((line) => ({
    kind: line.kind,
    name: line.name,
    description: line.description,
    quantityMilli: parseQuantityToMilli(line.quantity) ?? 0,
    unit: line.unit,
    unitPriceCents: parseMoneyToCents(line.unitPrice) ?? 0,
    unitCostCents: line.unitCost.trim() ? parseMoneyToCents(line.unitCost) : null,
    taxable: line.taxable,
    optional: line.optional,
    selected: line.selected,
    laborHours: line.laborHours,
    priceBookItemId: line.priceBookItemId,
    tier: line.tier,
  }));

  function update(key: string, patch: Partial<EditableLine>) {
    setLines((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function move(index: number, delta: number) {
    setLines((rows) => {
      const next = [...rows];
      const target = index + delta;
      if (target < 0 || target >= next.length) return rows;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const missingRbq = !company.rbqLicence.trim();

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

      {missingRbq && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong className="font-bold">RBQ licence number missing.</strong> Quebec&apos;s Building
          Act requires it on every quote and contract, so this one can be saved as a draft but not
          sent.{" "}
          <Link href="/admin/settings" className="font-semibold underline">
            Add it in Settings
          </Link>
          .
        </p>
      )}

      <Card title="Client">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-client`} className={labelClass}>
              Client <span className="text-red-500">*</span>
            </label>
            <select
              id={`${id}-client`}
              name="clientId"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              className={inputClass}
            >
              <option value="">Choose a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${id}-property`} className={labelClass}>
              Property
            </label>
            <select
              id={`${id}-property`}
              name="propertyId"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className={inputClass}
              disabled={!client}
            >
              <option value="">
                {client?.properties.length ? "Choose a property…" : "No properties on file"}
              </option>
              {client?.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Optional and secondary to Client/Property, so it gets its own row
            rather than crowding into the same grid — most quotes belong to
            no project at all, and the field should read that way. */}
        <div>
          <label htmlFor={`${id}-project`} className={labelClass}>
            Project <span className="font-normal text-charcoal/40">optional</span>
          </label>
          <select
            id={`${id}-project`}
            name="projectId"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className={inputClass}
            disabled={!client}
          >
            <option value="">
              {client?.projects.length ? "Not part of a project" : "No projects on file"}
            </option>
            {client?.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] leading-snug text-charcoal/45">
            Converting this quote to a job will attach that job to the project too.
          </p>
        </div>

        <Text name="title" label="Title" defaultValue={initial.title} hint="What this job is, in a few words. Appears at the top of the quote." />
      </Card>

      <LineEditor
        lines={lines}
        setLines={setLines}
        update={update}
        move={move}
        showCost
      />

      <Card title="Totals">
        <div className="grid gap-3 sm:grid-cols-2">
          <AmountPicker
            label="Discount"
            kind={discountKind}
            value={discountValue}
            onKind={setDiscountKind}
            onValue={setDiscountValue}
            nameKind="discountKind"
            nameValue="discountValue"
            hiddenValue={discount.value}
          />
          <AmountPicker
            label="Deposit requested"
            kind={depositKind}
            value={depositValue}
            onKind={setDepositKind}
            onValue={setDepositValue}
            nameKind="depositKind"
            nameValue="depositValue"
            hiddenValue={deposit.value}
          />
        </div>

        <div>
          <label htmlFor={`${id}-tax`} className={labelClass}>
            Tax rate
          </label>
          <select
            id={`${id}-tax`}
            name="taxRateId"
            value={taxRateId}
            onChange={(e) => setTaxRateId(e.target.value)}
            className={inputClass}
          >
            <option value="">
              Follow the client and property ({effectiveRate.label})
            </option>
            {taxRates.rates.map((rate) => (
              <option key={rate.id} value={rate.id}>
                {rate.label}
              </option>
            ))}
          </select>
          {!company.taxRegistered && (
            <p className="mt-1 text-[11px] leading-snug text-amber-800">
              No tax will be charged — the company is not marked as GST/QST registered in Settings.
              Registration is only required once taxable supplies pass $30,000 in a quarter or the
              four before it.
            </p>
          )}
        </div>

        <TotalsPanel totals={totals} rate={effectiveRate} />
      </Card>

      <Card title="What the customer sees">
        <div className="grid gap-2 sm:grid-cols-2">
          <Check name="showQuantities" label="Show quantities" defaultChecked={initial.showQuantities} />
          <Check name="showUnitPrices" label="Show unit prices" defaultChecked={initial.showUnitPrices} />
          <Check name="showLineTotals" label="Show line totals" defaultChecked={initial.showLineTotals} />
          <Check name="showTotalsFooter" label="Show the totals footer" defaultChecked={initial.showTotalsFooter} />
          <Check name="requireSignature" label="Ask for a signature" defaultChecked={initial.requireSignature} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-lang`} className={labelClass}>
              Document language
            </label>
            <select
              id={`${id}-lang`}
              name="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as "fr" | "en")}
              className={inputClass}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
            {language === "en" && (
              <p className="mt-1 text-[11px] leading-snug text-amber-800">
                Quebec law expects the French version first. Send the French quote, and use English
                only if the customer expressly asks for it after receiving it.
              </p>
            )}
          </div>

          <Text
            name="validUntil"
            label="Valid until"
            type="date"
            defaultValue={initial.validUntil}
          />
        </div>

        <div>
          <label htmlFor={`${id}-message`} className={labelClass}>
            Message to the client
          </label>
          <textarea
            id={`${id}-message`}
            name="clientMessage"
            defaultValue={initial.clientMessage}
            rows={3}
            className={`${inputClass} resize-y`}
          />
        </div>

        <div>
          <label htmlFor={`${id}-terms`} className={labelClass}>
            Terms and conditions
          </label>
          <textarea
            id={`${id}-terms`}
            name="contractTerms"
            defaultValue={initial.contractTerms}
            rows={4}
            className={`${inputClass} resize-y`}
          />
        </div>
      </Card>

      <Card title="Internal" subtitle="Never shown to the customer.">
        <textarea
          name="internalNotes"
          defaultValue={initial.internalNotes}
          rows={3}
          className={`${inputClass} resize-y`}
        />

        <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-black/[0.02] p-3 text-sm">
          <input
            type="checkbox"
            name="isItinerant"
            checked={isItinerant}
            onChange={(e) => setIsItinerant(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-blue"
          />
          <span>
            <span className="font-semibold text-charcoal">
              Itinerant contract (signed away from our office)
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-charcoal/60">
              Tick this if you approached the customer rather than the other way round, or if the
              work is doors, windows, insulation, roofing or exterior cladding — those count even
              when the customer called you. It triggers a 10-day cancellation right, blocks any
              deposit or work before that period ends, and requires extra clauses on the contract.
            </span>
          </span>
        </label>

        {isItinerant && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            <strong className="font-bold">Careful:</strong> an itinerant merchant may not sell
            decontamination work at all, and needs an OPC permit. If this is a mould or
            water-damage job the customer called you about, it is almost certainly{" "}
            <em>not</em> itinerant — leave the box unticked.
          </p>
        )}
      </Card>

      <input type="hidden" name="leadId" value={initial.leadId} />
      <input type="hidden" name="lines" value={JSON.stringify(serialisedLines)} />

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

// ---------------------------------------------------------------------------
// Line items
// ---------------------------------------------------------------------------

function LineEditor({
  lines,
  setLines,
  update,
  move,
  showCost,
}: {
  lines: EditableLine[];
  setLines: React.Dispatch<React.SetStateAction<EditableLine[]>>;
  update: (key: string, patch: Partial<EditableLine>) => void;
  move: (index: number, delta: number) => void;
  showCost: boolean;
}) {
  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-bold text-charcoal">Line items</h2>
        <span className="text-xs text-charcoal/40">{lines.length}/100</span>
      </div>

      <div className="mt-3 space-y-2">
        {lines.map((line, index) => (
          <LineRow
            key={line.key}
            line={line}
            index={index}
            isFirst={index === 0}
            isLast={index === lines.length - 1}
            showCost={showCost}
            onChange={(patch) => update(line.key, patch)}
            onRemove={() => setLines((rows) => rows.filter((r) => r.key !== line.key))}
            onMove={(delta) => move(index, delta)}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setLines((rows) => [...rows, blankLine("item")])}
          disabled={lines.length >= 100}
          className="cursor-pointer rounded-lg border border-black/10 px-3 py-1.5 text-xs font-bold text-charcoal transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Line item
        </button>
        <button
          type="button"
          onClick={() => setLines((rows) => [...rows, blankLine("text")])}
          disabled={lines.length >= 100}
          className="cursor-pointer rounded-lg border border-black/10 px-3 py-1.5 text-xs font-bold text-charcoal transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
          title="A heading, a note, or scope wording — no price"
        >
          + Text
        </button>
        <button
          type="button"
          onClick={() =>
            setLines((rows) => [
              ...rows,
              // A discount is an ordinary line with a negative price, carrying
              // the same taxable flag as the work it reduces — not a separate
              // concept the totals have to know about.
              { ...blankLine("item"), name: "Discount", unitPrice: "-0.00" },
            ])
          }
          disabled={lines.length >= 100}
          className="cursor-pointer rounded-lg border border-black/10 px-3 py-1.5 text-xs font-bold text-charcoal transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Discount line
        </button>
      </div>
    </section>
  );
}

function LineRow({
  line,
  index,
  isFirst,
  isLast,
  showCost,
  onChange,
  onRemove,
  onMove,
}: {
  line: EditableLine;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  showCost: boolean;
  onChange: (patch: Partial<EditableLine>) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  const isText = line.kind === "text";
  const total = isText
    ? 0
    : lineTotalCents({
        quantityMilli: parseQuantityToMilli(line.quantity) ?? 0,
        unitPriceCents: parseMoneyToCents(line.unitPrice) ?? 0,
      });

  return (
    <div
      className={`rounded-lg border p-3 ${
        isText ? "border-dashed border-black/15 bg-black/[0.015]" : "border-black/10"
      }`}
    >
      <div className="flex gap-2">
        <div className="flex shrink-0 flex-col justify-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            aria-label="Move up"
            className="cursor-pointer rounded px-1 text-charcoal/30 transition-colors hover:bg-black/[0.05] hover:text-charcoal disabled:cursor-not-allowed disabled:opacity-25"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M6 15l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            aria-label="Move down"
            className="cursor-pointer rounded px-1 text-charcoal/30 transition-colors hover:bg-black/[0.05] hover:text-charcoal disabled:cursor-not-allowed disabled:opacity-25"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex gap-2">
            <PriceBookPicker
              value={line.name}
              onText={(name) => onChange({ name })}
              onPick={(item) =>
                onChange({
                  name: item.name,
                  description: item.exclusions ?? item.description ?? "",
                  unit: item.unit ?? "",
                  unitPrice: (item.unit_price_cents / 100).toFixed(2),
                  unitCost:
                    item.unit_cost_cents === null ? "" : (item.unit_cost_cents / 100).toFixed(2),
                  taxable: item.taxable,
                  laborHours: item.labor_hours_per_unit,
                  priceBookItemId: item.id,
                })
              }
              placeholder={isText ? "Heading or note" : "Item name, or search the price book"}
            />
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove line ${index + 1}`}
              className="shrink-0 cursor-pointer rounded-lg px-2 text-charcoal/35 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <textarea
            value={line.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={isText ? 3 : 1}
            placeholder={isText ? "The wording the customer reads" : "Description (optional)"}
            className={`${inputClass} resize-y text-xs`}
          />

          {!isText && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <NumField
                  label="Qty"
                  value={line.quantity}
                  onChange={(quantity) => onChange({ quantity })}
                />
                <NumField
                  label="Unit"
                  value={line.unit}
                  onChange={(unit) => onChange({ unit })}
                  text
                />
                <NumField
                  label="Price"
                  value={line.unitPrice}
                  onChange={(unitPrice) => onChange({ unitPrice })}
                />
                {showCost && (
                  <NumField
                    label="Cost"
                    value={line.unitCost}
                    onChange={(unitCost) => onChange({ unitCost })}
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <MiniCheck
                    label="Taxable"
                    checked={line.taxable}
                    onChange={(taxable) => onChange({ taxable })}
                  />
                  <MiniCheck
                    label="Optional"
                    checked={line.optional}
                    onChange={(optional) =>
                      onChange({ optional, selected: optional ? line.selected : false })
                    }
                  />
                  {line.optional && (
                    <>
                      {/* A tiered line's selected state is decided by which
                          tier the customer picks on the public page, not by
                          a pre-tick here — so the two controls are mutually
                          exclusive rather than shown together. */}
                      <TierSelect
                        value={line.tier}
                        onChange={(tier) =>
                          onChange({ tier, selected: tier ? false : line.selected })
                        }
                      />
                      {!line.tier && (
                        <MiniCheck
                          label="Pre-ticked"
                          checked={line.selected}
                          onChange={(selected) => onChange({ selected })}
                        />
                      )}
                    </>
                  )}
                </div>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    total < 0 ? "text-green-700" : "text-charcoal"
                  }`}
                >
                  {formatMoney(total)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Item name field that searches the price book as you type.
 *
 * Picking an item COPIES its values onto the line. Editing them afterwards
 * changes only this quote — the price book is a starting point, not a link.
 */
function PriceBookPicker({
  value,
  onText,
  onPick,
  placeholder,
}: {
  value: string;
  onText: (value: string) => void;
  onPick: (item: PriceBookItem) => void;
  placeholder: string;
}) {
  const [results, setResults] = useState<PriceBookItem[]>([]);
  const [open, setOpen] = useState(false);
  const skipNext = useRef(false);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const term = value.trim();
    // Nothing to search for. `visible` below derives the empty list from the
    // term length, so there is no state to clear from in here.
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/price-book?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const body = (await res.json()) as { items?: PriceBookItem[] };
        setResults(body.items ?? []);
        setOpen((body.items ?? []).length > 0);
      } catch {
        // Aborted or offline — typing the name by hand still works.
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [value]);

  // Below the search threshold there are no matches by definition, whether the
  // last fetch left some behind or not.
  const visible = value.trim().length < 2 ? [] : results;

  return (
    <div className="relative min-w-0 flex-1">
      <input
        value={value}
        onChange={(e) => onText(e.target.value)}
        onFocus={() => visible.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        className={`${inputClass} font-medium`}
      />
      {open && visible.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-black/10 bg-white shadow-lg">
          {visible.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  skipNext.current = true;
                  setOpen(false);
                  onPick(item);
                }}
                className="block w-full cursor-pointer px-3 py-2 text-left transition-colors hover:bg-black/[0.04]"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-charcoal">{item.name}</span>
                  <span className="shrink-0 text-xs font-semibold text-charcoal/60">
                    {formatMoney(item.unit_price_cents)}
                    {item.unit ? `/${item.unit}` : ""}
                  </span>
                </span>
                {item.category && (
                  <span className="block truncate text-[11px] text-charcoal/40">
                    {item.category}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

function TotalsPanel({
  totals,
  rate,
}: {
  totals: ReturnType<typeof calculateQuoteTotals>;
  rate: TaxRate;
}) {
  return (
    <div className="rounded-lg bg-black/[0.03] p-3">
      <dl className="space-y-1 text-sm">
        <Row label="Subtotal" value={formatMoney(totals.subtotalCents)} />
        {totals.discountCents > 0 && (
          <Row label="Discount" value={`-${formatMoney(totals.discountCents)}`} muted />
        )}
        {totals.taxes.map((tax) => (
          <Row key={tax.name} label={tax.name} value={formatMoney(tax.cents)} muted />
        ))}
        {rate.components.length === 0 && (
          <Row label="Tax" value="Not charged" muted />
        )}
        <div className="border-t border-black/10 pt-1">
          <Row label="Total" value={formatMoney(totals.totalCents)} bold />
        </div>
        {totals.depositCents !== null && totals.depositCents > 0 && (
          <>
            <Row label="Deposit requested" value={formatMoney(totals.depositCents)} muted />
            <Row label="Balance on completion" value={formatMoney(totals.balanceCents ?? 0)} muted />
          </>
        )}
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={bold ? "font-bold text-charcoal" : muted ? "text-charcoal/55" : "text-charcoal/75"}>
        {label}
      </dt>
      <dd
        className={`tabular-nums ${
          bold ? "font-heading text-lg font-bold text-charcoal" : muted ? "text-charcoal/70" : "text-charcoal"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function AmountPicker({
  label,
  kind,
  value,
  onKind,
  onValue,
  nameKind,
  nameValue,
  hiddenValue,
}: {
  label: string;
  kind: DiscountKind;
  value: string;
  onKind: (kind: DiscountKind) => void;
  onValue: (value: string) => void;
  nameKind: string;
  nameValue: string;
  hiddenValue: number;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-2">
        <select
          value={kind}
          onChange={(e) => onKind(e.target.value as DiscountKind)}
          className={`${inputClass} w-28 shrink-0`}
          aria-label={`${label} type`}
        >
          <option value="none">None</option>
          <option value="amount">$</option>
          <option value="percent">%</option>
        </select>
        <input
          value={value}
          onChange={(e) => onValue(e.target.value)}
          disabled={kind === "none"}
          inputMode="decimal"
          className={`${inputClass} flex-1 disabled:bg-black/[0.03] disabled:text-charcoal/30`}
          aria-label={`${label} value`}
        />
      </div>
      {/* The parsed integer goes to the server, not the raw text — so "1 234,56"
          arrives as 123456 cents rather than being re-parsed with different rules. */}
      <input type="hidden" name={nameKind} value={kind} />
      <input type="hidden" name={nameValue} value={hiddenValue} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

function NumField({
  label,
  value,
  onChange,
  text,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  text?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-charcoal/40">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={text ? "text" : "decimal"}
        className={`${inputClass} px-2 py-1.5 text-sm ${text ? "" : "tabular-nums"}`}
      />
    </label>
  );
}

function MiniCheck({
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

/** Good/Better/Best, per line. "None" is the default — a quote with no tiers
    assigned to any line behaves exactly like before this feature existed. */
function TierSelect({
  value,
  onChange,
}: {
  value: QuoteTier | null;
  onChange: (value: QuoteTier | null) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-charcoal/70">
      Tier
      <select
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || null) as QuoteTier | null)}
        className="cursor-pointer rounded-md border border-black/10 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-brand-blue"
      >
        <option value="">None</option>
        <option value="good">Good</option>
        <option value="better">Better</option>
        <option value="best">Best</option>
      </select>
    </label>
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

function Text({
  name,
  label,
  defaultValue,
  hint,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
  type?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input id={id} name={name} type={type} defaultValue={defaultValue} className={inputClass} />
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
      {subtitle && <p className="mt-0.5 text-xs text-charcoal/50">{subtitle}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export { QUANTITY_SCALE, formatQuantity };
