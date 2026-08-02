"use client";

import Image from "next/image";
import { useActionState, useMemo, useState } from "react";
import type { ApprovalState } from "@/app/(internal)/q/[token]/actions";
import { calculateQuoteTotals, formatMoney, formatQuantity, lineTotalCents } from "@/lib/crm/money";
import { copyFor, type QuoteLocale } from "@/lib/crm/quoteCopy";
import type { QuoteLineItem, QuoteWithLines } from "@/lib/crm/quoteTypes";
import type { CompanySetting, TaxRate } from "@/lib/crm/settings";

/**
 * The quote as the customer sees it.
 *
 * Optional lines recompute the total in the browser using the SAME function
 * the server uses, so the figure they tick their way to is the figure that
 * gets stored. A separate front-end total would eventually disagree with the
 * back-end one, and the customer's screen is the version they'd rely on.
 */

export default function PublicQuote({
  quote,
  company,
  taxRate,
  approveAction,
  requestChangesAction,
}: {
  quote: QuoteWithLines;
  company: CompanySetting;
  taxRate: TaxRate;
  approveAction: (prev: ApprovalState, formData: FormData) => Promise<ApprovalState>;
  requestChangesAction: (prev: ApprovalState, formData: FormData) => Promise<ApprovalState>;
}) {
  const locale = quote.language as QuoteLocale;
  const t = copyFor(locale);

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(quote.lines.filter((l) => l.optional && l.selected).map((l) => l.id)),
  );
  const [showChanges, setShowChanges] = useState(false);

  const [approveState, runApprove, approving] = useActionState(
    approveAction,
    {} as ApprovalState,
  );
  const [changeState, runChanges, sendingChanges] = useActionState(
    requestChangesAction,
    {} as ApprovalState,
  );

  const totals = useMemo(
    () =>
      calculateQuoteTotals(
        quote.lines
          .filter((l) => l.kind === "item")
          .map((l) => ({
            quantityMilli: l.quantity_milli ?? 0,
            unitPriceCents: l.unit_price_cents ?? 0,
            taxable: l.taxable,
            optional: l.optional,
            selected: l.optional ? selected.has(l.id) : false,
          })),
        taxRate,
        { kind: quote.discount_kind, value: quote.discount_value },
        { kind: quote.deposit_kind, value: quote.deposit_value },
      ),
    [quote, taxRate, selected],
  );

  const isOpen = quote.status === "sent" || quote.status === "viewed";
  const expired =
    Boolean(quote.valid_until) && quote.valid_until! < new Date().toISOString().slice(0, 10);
  const hasOptional = quote.lines.some((l) => l.optional);

  const dateFmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "—";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <article className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
        {/* Header ------------------------------------------------------- */}
        <header className="border-b border-black/5 p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Image
                src="/renovision-logo.png"
                alt={company.tradeName}
                width={132}
                height={44}
                className="h-11 w-auto object-contain"
              />
              <address className="mt-3 text-xs not-italic leading-relaxed text-charcoal/55">
                {company.legalName && <span className="block">{company.legalName}</span>}
                {company.street1 && <span className="block">{company.street1}</span>}
                {(company.city || company.postalCode) && (
                  <span className="block">
                    {[company.city, company.province, company.postalCode].filter(Boolean).join(" ")}
                  </span>
                )}
                {company.phone && <span className="block">{company.phone}</span>}
                {company.email && <span className="block">{company.email}</span>}
                {/* Building Act s. 57.1 — the licence number must appear on
                    every estimate, quote, contract and statement of account. */}
                {company.rbqLicence && (
                  <span className="mt-1 block font-semibold text-charcoal/70">
                    {t.rbq} {company.rbqLicence}
                  </span>
                )}
              </address>
            </div>

            <div className="text-right">
              <h1 className="font-heading text-2xl font-bold text-brand-blue">{t.quote}</h1>
              <p className="font-mono text-sm text-charcoal/50">#{quote.quote_number}</p>
              <dl className="mt-3 space-y-0.5 text-xs text-charcoal/60">
                <div>
                  <dt className="inline font-semibold">{t.date}: </dt>
                  <dd className="inline">{dateFmt(quote.sent_at ?? quote.created_at)}</dd>
                </div>
                {quote.valid_until && (
                  <div>
                    <dt className="inline font-semibold">{t.validUntil}: </dt>
                    <dd className="inline">{dateFmt(quote.valid_until)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          <div className="mt-6 grid gap-4 border-t border-black/5 pt-5 sm:grid-cols-2">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-charcoal/40">
                {t.preparedFor}
              </h2>
              <p className="mt-1 text-sm font-semibold text-charcoal">
                {quote.client_snapshot?.displayName ?? "—"}
              </p>
              {quote.client_snapshot?.personName && (
                <p className="text-sm text-charcoal/60">{quote.client_snapshot.personName}</p>
              )}
              <p className="mt-0.5 text-xs leading-relaxed text-charcoal/55">
                {[
                  quote.client_snapshot?.street1,
                  quote.client_snapshot?.city,
                  quote.client_snapshot?.postalCode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>

            {quote.property_snapshot && (
              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-wide text-charcoal/40">
                  {t.workAddress}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-charcoal/75">
                  {[
                    quote.property_snapshot.street1,
                    quote.property_snapshot.street2,
                    quote.property_snapshot.city,
                    quote.property_snapshot.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            )}
          </div>

          {quote.title && (
            <h2 className="mt-6 font-heading text-lg font-bold text-charcoal">{quote.title}</h2>
          )}
          {quote.client_message && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-charcoal/70">
              {quote.client_message}
            </p>
          )}
        </header>

        {/* Status banners ---------------------------------------------- */}
        {approveState.approved || quote.status === "approved" ? (
          <div className="border-b border-green-200 bg-green-50 p-6 text-center sm:p-8">
            <h2 className="font-heading text-lg font-bold text-green-900">{t.approvedHeading}</h2>
            <p className="mt-1 text-sm text-green-900/75">{t.approvedBody}</p>
          </div>
        ) : quote.status === "declined" ? (
          <div className="border-b border-black/5 bg-black/[0.02] p-6 text-center text-sm text-charcoal/60">
            {t.declined}
          </div>
        ) : expired ? (
          <div className="border-b border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
            {t.expired}
          </div>
        ) : null}

        {/* Line items --------------------------------------------------- */}
        <div className="p-6 sm:p-8">
          {hasOptional && isOpen && !expired && (
            <p className="mb-4 rounded-lg bg-brand-blue/[0.05] px-3 py-2 text-xs font-medium text-brand-blue">
              {t.optionalHelp}
            </p>
          )}

          <ul className="divide-y divide-black/5">
            {quote.lines.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                locale={locale}
                showQuantity={quote.show_quantities}
                showUnitPrice={quote.show_unit_prices}
                showLineTotal={quote.show_line_totals}
                interactive={isOpen && !expired}
                checked={selected.has(line.id)}
                onToggle={(on) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (on) next.add(line.id);
                    else next.delete(line.id);
                    return next;
                  })
                }
              />
            ))}
          </ul>

          {quote.show_totals_footer && (
            <dl className="mt-5 space-y-1 border-t border-black/10 pt-4 text-sm">
              <Row label={t.subtotal} value={formatMoney(totals.subtotalCents, locale)} />
              {totals.discountCents > 0 && (
                <Row
                  label={t.discount}
                  value={`-${formatMoney(totals.discountCents, locale)}`}
                  muted
                />
              )}
              {totals.taxes.map((tax) => (
                <Row
                  key={tax.name}
                  label={tax.name}
                  value={formatMoney(tax.cents, locale)}
                  muted
                />
              ))}
              <div className="border-t border-black/10 pt-2">
                <Row label={t.total} value={formatMoney(totals.totalCents, locale)} bold />
              </div>
              {totals.depositCents !== null && totals.depositCents > 0 && (
                <>
                  <Row label={t.deposit} value={formatMoney(totals.depositCents, locale)} muted />
                  <Row
                    label={t.balance}
                    value={formatMoney(totals.balanceCents ?? 0, locale)}
                    muted
                  />
                </>
              )}
            </dl>
          )}

          {/* Revenu Québec requires both registration numbers on an invoice of
              $100 or more. A quote is not an invoice, but showing them here is
              harmless and saves a question. Suppressed entirely when the
              company is not registered — a number that isn't real must not
              appear on a document. */}
          {company.taxRegistered && company.gstNumber && company.qstNumber && (
            <p className="mt-4 text-[11px] text-charcoal/40">
              {t.gst} {company.gstNumber} · {t.qst} {company.qstNumber}
            </p>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-charcoal/45">{t.notATaxInvoice}</p>
        </div>

        {/* Terms -------------------------------------------------------- */}
        {(quote.contract_terms || quote.is_itinerant) && (
          <section className="border-t border-black/5 bg-black/[0.015] p-6 sm:p-8">
            <h2 className="font-heading text-sm font-bold text-charcoal">{t.terms}</h2>
            {quote.contract_terms && (
              <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-charcoal/65">
                {quote.contract_terms}
              </p>
            )}
            {quote.is_itinerant && (
              <>
                <h3 className="mt-4 text-xs font-bold text-charcoal">{t.cancellationTitle}</h3>
                <p className="mt-1 text-xs leading-relaxed text-charcoal/65">
                  {t.cancellationBody}
                </p>
              </>
            )}
          </section>
        )}

        {/* Approve ------------------------------------------------------ */}
        {isOpen && !expired && !approveState.approved && (
          <section className="border-t border-black/5 p-6 sm:p-8">
            {changeState.sent ? (
              <div className="text-center">
                <h2 className="font-heading text-base font-bold text-charcoal">
                  {t.changesSentHeading}
                </h2>
                <p className="mt-1 text-sm text-charcoal/60">{t.changesSentBody}</p>
              </div>
            ) : showChanges ? (
              <form action={runChanges} className="space-y-3">
                <h2 className="font-heading text-base font-bold text-charcoal">
                  {t.requestChanges}
                </h2>
                {changeState.error && (
                  <p role="alert" className="text-sm font-medium text-red-700">
                    {changeState.error}
                  </p>
                )}
                <textarea
                  name="message"
                  rows={4}
                  required
                  placeholder={t.requestChangesPlaceholder}
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
                />
                <input type="hidden" name="locale" value={locale} />
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={sendingChanges}
                    className="cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-wait disabled:opacity-60"
                  >
                    {sendingChanges ? "…" : t.sendRequest}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowChanges(false)}
                    aria-label={t.cancel}
                    className="cursor-pointer text-sm font-semibold text-charcoal/50 hover:text-charcoal"
                  >
                    ✕
                  </button>
                </div>
              </form>
            ) : (
              <form action={runApprove} className="space-y-4">
                <h2 className="font-heading text-base font-bold text-charcoal">
                  {t.approveHeading}
                </h2>

                {approveState.error && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                  >
                    {approveState.error}
                  </p>
                )}

                {/* The ticked options travel with the approval, because which
                    options were chosen is part of what was agreed. */}
                {quote.lines
                  .filter((l) => l.optional && selected.has(l.id))
                  .map((l) => (
                    <input key={l.id} type="hidden" name={`line-${l.id}`} value="1" />
                  ))}
                <input type="hidden" name="locale" value={locale} />

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-charcoal/70">
                      {t.yourName}
                    </span>
                    <input
                      name="name"
                      required
                      className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
                    />
                  </label>
                  {quote.require_signature && (
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-charcoal/70">
                        {t.signature}
                      </span>
                      <input
                        name="signature"
                        required
                        className="w-full rounded-lg border border-black/10 px-3 py-2 font-heading text-lg italic outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
                      />
                    </label>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={approving}
                    className="cursor-pointer rounded-full bg-brand-green px-6 py-3 text-sm font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-brand-green-dark disabled:cursor-wait disabled:opacity-60"
                  >
                    {approving ? "…" : t.approveButton}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowChanges(true)}
                    className="cursor-pointer text-sm font-semibold text-charcoal/55 underline-offset-2 transition-colors hover:text-charcoal hover:underline"
                  >
                    {t.requestChanges}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}
      </article>
    </div>
  );
}

function LineRow({
  line,
  locale,
  showQuantity,
  showUnitPrice,
  showLineTotal,
  interactive,
  checked,
  onToggle,
}: {
  line: QuoteLineItem;
  locale: QuoteLocale;
  showQuantity: boolean;
  showUnitPrice: boolean;
  showLineTotal: boolean;
  interactive: boolean;
  checked: boolean;
  onToggle: (on: boolean) => void;
}) {
  const t = copyFor(locale);

  if (line.kind === "text") {
    return (
      <li className="py-3">
        <p className="text-sm font-semibold text-charcoal/80">{line.name}</p>
        {line.description && (
          <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-charcoal/55">
            {line.description}
          </p>
        )}
      </li>
    );
  }

  const total = lineTotalCents({
    quantityMilli: line.quantity_milli ?? 0,
    unitPriceCents: line.unit_price_cents ?? 0,
  });

  const dimmed = line.optional && !checked;

  return (
    <li className={`flex items-start gap-3 py-3 ${dimmed ? "opacity-55" : ""}`}>
      {line.optional && (
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={!interactive}
          aria-label={`${t.optional}: ${line.name}`}
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-brand-green disabled:cursor-default"
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold text-charcoal">{line.name}</span>
          {line.optional && (
            <span className="rounded-full bg-brand-blue/[0.08] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-blue">
              {t.optional}
            </span>
          )}
        </div>
        {line.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-charcoal/55">{line.description}</p>
        )}
        {(showQuantity || showUnitPrice) && (
          <p className="mt-0.5 text-xs tabular-nums text-charcoal/45">
            {showQuantity && (
              <>
                {formatQuantity(line.quantity_milli ?? 0)}
                {line.unit ? ` ${line.unit}` : ""}
              </>
            )}
            {showQuantity && showUnitPrice && " × "}
            {showUnitPrice && formatMoney(line.unit_price_cents ?? 0, locale)}
          </p>
        )}
      </div>

      {showLineTotal && (
        <span
          className={`shrink-0 text-sm font-bold tabular-nums ${
            total < 0 ? "text-green-700" : "text-charcoal"
          }`}
        >
          {formatMoney(total, locale)}
        </span>
      )}
    </li>
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
          bold
            ? "font-heading text-xl font-bold text-brand-blue"
            : muted
              ? "text-charcoal/70"
              : "text-charcoal"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
