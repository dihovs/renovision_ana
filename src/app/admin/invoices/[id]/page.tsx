import Link from "next/link";
import { notFound } from "next/navigation";
import {
  archiveInvoiceAction,
  recordPaymentAction,
  removePaymentAction,
  sendInvoiceAction,
  setInvoiceStatusAction,
} from "../actions";
import AdminNotice from "@/components/admin/AdminNotice";
import InvoiceDetail from "@/components/admin/InvoiceDetail";
import { MigrationPendingError } from "@/lib/crm/db";
import { getInvoice, invoiceTaxRate } from "@/lib/crm/invoices";
import { formatMoney, formatQuantity, lineTotalCents } from "@/lib/crm/money";
import {
  INVOICE_STATUS_LABEL,
  invoiceBalanceCents,
  isOverdue,
  type InvoiceWithLines,
} from "@/lib/crm/opsTypes";
import { getCompany } from "@/lib/crm/settings";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let invoice: InvoiceWithLines | null;
  try {
    invoice = await getInvoice(id);
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration left to run">
          Run{" "}
          <code className="font-mono text-brand-blue">
            supabase/migrations/0007_jobs_invoices.sql
          </code>
          .
        </AdminNotice>
      );
    }
    throw err;
  }

  if (!invoice) notFound();

  const [company, rate] = await Promise.all([getCompany(), invoiceTaxRate(invoice)]);
  const balance = invoiceBalanceCents(invoice);
  const overdue = isOverdue(invoice);
  const publicUrl = invoice.public_token ? `${SITE_URL}/i/${invoice.public_token}` : null;

  return (
    <div className="space-y-4">
      <Link
        href="/admin/invoices"
        className="inline-flex items-center gap-1 text-sm font-semibold text-charcoal/50 transition-colors hover:text-charcoal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Invoices
      </Link>

      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-charcoal/45">
                #{invoice.invoice_number}
              </span>
              <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-charcoal/60">
                {INVOICE_STATUS_LABEL[invoice.status]}
              </span>
              {invoice.is_deposit && (
                <span className="rounded-full bg-brand-blue/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-blue">
                  Deposit
                </span>
              )}
              {overdue && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-800">
                  Overdue
                </span>
              )}
            </div>
            <h2 className="mt-1 font-heading text-lg font-bold text-charcoal">
              {invoice.client_snapshot?.displayName ?? invoice.title ?? "Invoice"}
            </h2>
            <p className="text-sm text-charcoal/55">
              Issued {invoice.issue_date}
              {invoice.due_date && ` · due ${invoice.due_date}`}
            </p>
          </div>

          <div className="text-right">
            <p className="font-heading text-2xl font-bold text-charcoal">
              {formatMoney(invoice.total_cents)}
            </p>
            {balance > 0 ? (
              <p className={`text-sm font-semibold ${overdue ? "text-red-700" : "text-charcoal/55"}`}>
                {formatMoney(balance)} outstanding
              </p>
            ) : (
              <p className="text-sm font-semibold text-green-700">Paid in full</p>
            )}
            <form action={archiveInvoiceAction.bind(null, invoice.id, !invoice.archived_at)}>
              <button
                type="submit"
                className="mt-1 cursor-pointer text-xs font-semibold text-charcoal/40 transition-colors hover:text-charcoal"
              >
                {invoice.archived_at ? "Restore" : "Archive"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <InvoiceDetail
        invoiceId={invoice.id}
        status={invoice.status}
        balanceCents={balance}
        payments={invoice.payments}
        publicUrl={publicUrl}
        missingRbq={!company.rbqLicence.trim()}
        sendAction={sendInvoiceAction}
        statusAction={setInvoiceStatusAction}
        paymentAction={recordPaymentAction.bind(null, invoice.id)}
        removePaymentAction={removePaymentAction.bind(null, invoice.id)}
      />

      <section className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <h3 className="border-b border-black/5 px-4 py-3 font-heading text-sm font-bold text-charcoal">
          Line items
        </h3>
        <ul className="divide-y divide-black/5">
          {invoice.lines.map((line) =>
            line.kind === "text" ? (
              <li key={line.id} className="bg-black/[0.015] px-4 py-3">
                <p className="text-sm font-semibold text-charcoal/70">{line.name}</p>
                {line.description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-charcoal/55">
                    {line.description}
                  </p>
                )}
              </li>
            ) : (
              <li key={line.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-charcoal">{line.name}</span>
                  {line.description && (
                    <p className="mt-0.5 text-xs leading-relaxed text-charcoal/55">
                      {line.description}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs tabular-nums text-charcoal/45">
                    {formatQuantity(line.quantity_milli ?? 0)}
                    {line.unit ? ` ${line.unit}` : ""} × {formatMoney(line.unit_price_cents ?? 0)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-charcoal">
                  {formatMoney(
                    lineTotalCents({
                      quantityMilli: line.quantity_milli ?? 0,
                      unitPriceCents: line.unit_price_cents ?? 0,
                    }),
                  )}
                </span>
              </li>
            ),
          )}
        </ul>

        <dl className="space-y-1 border-t border-black/5 bg-black/[0.015] px-4 py-3 text-sm">
          <Row label="Subtotal" value={formatMoney(invoice.subtotal_cents)} />
          {invoice.discount_cents > 0 && (
            <Row label="Discount" value={`-${formatMoney(invoice.discount_cents)}`} muted />
          )}
          {(invoice.tax_snapshot?.components ?? []).map((component) => (
            <Row
              key={component.name}
              label={component.name}
              value={formatMoney(
                Math.round(
                  ((invoice.subtotal_cents - invoice.discount_cents) * component.rate) / 1_000_000,
                ),
              )}
              muted
            />
          ))}
          {rate.components.length === 0 && <Row label="Tax" value="Not charged" muted />}
          <div className="border-t border-black/10 pt-1">
            <Row label="Total" value={formatMoney(invoice.total_cents)} bold />
          </div>
          {invoice.amount_paid_cents !== 0 && (
            <>
              <Row label="Paid" value={`-${formatMoney(invoice.amount_paid_cents)}`} muted />
              <Row label="Balance" value={formatMoney(balance)} bold />
            </>
          )}
        </dl>
      </section>
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
