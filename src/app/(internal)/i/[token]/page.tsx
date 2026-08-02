import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getInvoiceByToken, invoiceTaxRate, recordInvoiceView } from "@/lib/crm/invoices";
import { formatMoney, formatQuantity, lineTotalCents } from "@/lib/crm/money";
import {
  invoiceBalanceCents,
  isOverdue,
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
} from "@/lib/crm/opsTypes";
import { copyFor } from "@/lib/crm/quoteCopy";
import { getCompany } from "@/lib/crm/settings";

/**
 * The customer's copy of an invoice.
 *
 * Renders the Revenu Québec required set: supplier name and address, the date,
 * a description of each item, the GST and QST amounts as separate labelled
 * lines, both registration numbers, the customer's name and the payment terms.
 * The numbers come from the FROZEN snapshot, so reprinting an old invoice
 * reproduces the document that was actually issued rather than today's version
 * of it.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The shared PAYMENT_METHOD_LABEL is the admin's English wording; this is the
 * customer's French. Local to this page because the public invoice is the one
 * place a customer reads a payment method.
 */
const PAYMENT_METHOD_FR: Record<PaymentMethod, string> = {
  cash: "Comptant",
  cheque: "Chèque",
  e_transfer: "Virement Interac",
  card: "Carte",
  bank_transfer: "Virement bancaire",
  other: "Autre",
};

/** Date-only strings ("2026-08-15") formatted as a date, not an instant. */
function formatDate(iso: string, locale: "fr" | "en"): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(
    locale === "fr" ? "fr-CA" : "en-CA",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
  );
}

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invoice = await getInvoiceByToken(token);
  if (!invoice || invoice.status === "draft") notFound();

  void recordInvoiceView(token).catch(() => {});

  const [company, rate] = await Promise.all([getCompany(), invoiceTaxRate(invoice)]);
  const locale = invoice.language;
  const t = copyFor(locale);
  const balance = invoiceBalanceCents(invoice);
  const overdue = isOverdue(invoice);

  const taxable = invoice.subtotal_cents - invoice.discount_cents;
  const label = locale === "fr" ? "Facture" : "Invoice";

  return (
    <main lang={locale === "fr" ? "fr-CA" : "en-CA"} className="min-h-dvh bg-[#f6f8fb]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <article className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
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
                      {[company.city, company.province, company.postalCode]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  )}
                  {company.phone && <span className="block">{company.phone}</span>}
                  {/* Building Act s. 57.1 — a statement of account is one of
                      the documents that must carry the licence number. */}
                  {company.rbqLicence && (
                    <span className="mt-1 block font-semibold text-charcoal/70">
                      {t.rbq} {company.rbqLicence}
                    </span>
                  )}
                </address>
              </div>

              <div className="text-right">
                <h1 className="font-heading text-2xl font-bold text-brand-blue">{label}</h1>
                <p className="font-mono text-sm text-charcoal/50">#{invoice.invoice_number}</p>
                <dl className="mt-3 space-y-0.5 text-xs text-charcoal/60">
                  <div>
                    <dt className="inline font-semibold">{t.date}: </dt>
                    <dd className="inline">{formatDate(invoice.issue_date, locale)}</dd>
                  </div>
                  {invoice.due_date && (
                    <div>
                      <dt className="inline font-semibold">
                        {locale === "fr" ? "Échéance" : "Due"}:{" "}
                      </dt>
                      <dd className={`inline ${overdue ? "font-bold text-red-700" : ""}`}>
                        {formatDate(invoice.due_date, locale)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            <div className="mt-6 grid gap-4 border-t border-black/5 pt-5 sm:grid-cols-2">
              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-wide text-charcoal/40">
                  {locale === "fr" ? "Facturé à" : "Billed to"}
                </h2>
                <p className="mt-1 text-sm font-semibold text-charcoal">
                  {invoice.client_snapshot?.displayName ?? "—"}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-charcoal/55">
                  {[
                    invoice.client_snapshot?.street1,
                    invoice.client_snapshot?.city,
                    invoice.client_snapshot?.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>

              {invoice.property_snapshot && (
                <div>
                  <h2 className="text-[11px] font-bold uppercase tracking-wide text-charcoal/40">
                    {t.workAddress}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-charcoal/70">
                    {[
                      invoice.property_snapshot.street1,
                      invoice.property_snapshot.city,
                      invoice.property_snapshot.postalCode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              )}
            </div>

            {invoice.client_message && (
              <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-charcoal/70">
                {invoice.client_message}
              </p>
            )}
          </header>

          {balance <= 0 ? (
            <div className="border-b border-green-200 bg-green-50 p-4 text-center text-sm font-bold text-green-900">
              {locale === "fr" ? "Payée — merci" : "Paid in full — thank you"}
            </div>
          ) : overdue ? (
            <div className="border-b border-amber-200 bg-amber-50 p-4 text-center text-sm font-bold text-amber-900">
              {locale === "fr"
                ? `Échue — solde dû : ${formatMoney(balance, locale)}`
                : `Overdue — balance due: ${formatMoney(balance, locale)}`}
            </div>
          ) : null}

          <div className="p-6 sm:p-8">
            <ul className="divide-y divide-black/5">
              {invoice.lines.map((line) =>
                line.kind === "text" ? (
                  <li key={line.id} className="py-3">
                    <p className="text-sm font-semibold text-charcoal/80">{line.name}</p>
                    {line.description && (
                      <p className="mt-0.5 text-xs leading-relaxed text-charcoal/55">
                        {line.description}
                      </p>
                    )}
                  </li>
                ) : (
                  <li key={line.id} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold text-charcoal">{line.name}</span>
                      {line.description && (
                        <p className="mt-0.5 text-xs leading-relaxed text-charcoal/55">
                          {line.description}
                        </p>
                      )}
                      {invoice.show_quantities && (
                        <p className="mt-0.5 text-xs tabular-nums text-charcoal/45">
                          {formatQuantity(line.quantity_milli ?? 0)}
                          {line.unit ? ` ${line.unit}` : ""}
                          {invoice.show_unit_prices &&
                            ` × ${formatMoney(line.unit_price_cents ?? 0, locale)}`}
                        </p>
                      )}
                    </div>
                    {invoice.show_line_totals && (
                      <span className="shrink-0 text-sm font-bold tabular-nums text-charcoal">
                        {formatMoney(
                          lineTotalCents({
                            quantityMilli: line.quantity_milli ?? 0,
                            unitPriceCents: line.unit_price_cents ?? 0,
                          }),
                          locale,
                        )}
                      </span>
                    )}
                  </li>
                ),
              )}
            </ul>

            <dl className="mt-5 space-y-1 border-t border-black/10 pt-4 text-sm">
              <Row label={t.subtotal} value={formatMoney(invoice.subtotal_cents, locale)} />
              {invoice.discount_cents > 0 && (
                <Row
                  label={t.discount}
                  value={`-${formatMoney(invoice.discount_cents, locale)}`}
                  muted
                />
              )}
              {/* Each tax shown as its own labelled line. A single combined
                  14.975% figure is not a compliant document. */}
              {(invoice.tax_snapshot?.components ?? []).map((component) => (
                <Row
                  key={component.name}
                  label={component.name}
                  value={formatMoney(Math.round((taxable * component.rate) / 1_000_000), locale)}
                  muted
                />
              ))}
              <div className="border-t border-black/10 pt-2">
                <Row label={t.total} value={formatMoney(invoice.total_cents, locale)} bold />
              </div>
              {invoice.amount_paid_cents !== 0 && (
                <>
                  <Row
                    label={locale === "fr" ? "Payé" : "Paid"}
                    value={`-${formatMoney(invoice.amount_paid_cents, locale)}`}
                    muted
                  />
                  <Row
                    label={locale === "fr" ? "Solde dû" : "Balance due"}
                    value={formatMoney(balance, locale)}
                    bold
                  />
                </>
              )}
            </dl>

            {/* Revenu Québec: both registration numbers are required on an
                invoice of $100 or more. Printed unconditionally when
                registered, since a renovation invoice under $100 is rare and
                showing them is always compliant. */}
            {rate.components.length > 0 && company.gstNumber && company.qstNumber && (
              <p className="mt-4 text-[11px] text-charcoal/50">
                {t.gst} {company.gstNumber} · {t.qst} {company.qstNumber}
              </p>
            )}

            {invoice.payments.length > 0 && (
              <div className="mt-5 border-t border-black/5 pt-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-charcoal/40">
                  {locale === "fr" ? "Paiements reçus" : "Payments received"}
                </h3>
                <ul className="mt-1 space-y-0.5">
                  {invoice.payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex justify-between text-xs tabular-nums text-charcoal/60"
                    >
                      <span>
                        {formatDate(payment.received_on, locale)} ·{" "}
                        {locale === "fr"
                          ? PAYMENT_METHOD_FR[payment.method]
                          : PAYMENT_METHOD_LABEL[payment.method]}
                      </span>
                      <span>{formatMoney(payment.amount_cents, locale)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Payment terms — required on an invoice of $500 or more. */}
          {invoice.payment_terms && (
            <section className="border-t border-black/5 bg-black/[0.015] p-6 sm:p-8">
              <h2 className="font-heading text-sm font-bold text-charcoal">
                {locale === "fr" ? "Modalités de paiement" : "Payment terms"}
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-charcoal/65">
                {invoice.payment_terms}
              </p>
            </section>
          )}
        </article>
      </div>
    </main>
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
