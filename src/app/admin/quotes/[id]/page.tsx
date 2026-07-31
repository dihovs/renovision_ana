import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveQuoteAction, sendQuoteAction, setStatusAction } from "../actions";
import AdminNotice from "@/components/admin/AdminNotice";
import QuoteActions from "@/components/admin/QuoteActions";
import { MigrationPendingError } from "@/lib/crm/db";
import { formatMoney, formatQuantity, lineTotalCents } from "@/lib/crm/money";
import { getQuote, resolveQuoteTaxRateForQuote, totalsFor } from "@/lib/crm/quotes";
import {
  QUOTE_STATUS_LABEL,
  isEditable,
  type QuoteLineItem,
  type QuoteStatus,
  type QuoteWithLines,
} from "@/lib/crm/quoteTypes";
import { getCompany } from "@/lib/crm/settings";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<QuoteStatus, string> = {
  draft: "bg-black/[0.05] text-charcoal/60",
  sent: "bg-brand-blue/[0.08] text-brand-blue",
  viewed: "bg-violet-100 text-violet-800",
  approved: "bg-green-100 text-green-800",
  changes_requested: "bg-amber-100 text-amber-800",
  declined: "bg-red-100 text-red-800",
  converted: "bg-charcoal/[0.08] text-charcoal",
};

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let quote: QuoteWithLines | null;
  try {
    quote = await getQuote(id);
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration left to run">
          Run <code className="font-mono text-brand-blue">supabase/migrations/0006_quoting.sql</code>{" "}
          in the Supabase SQL editor.
        </AdminNotice>
      );
    }
    throw err;
  }

  if (!quote) notFound();

  const [rate, company] = await Promise.all([resolveQuoteTaxRateForQuote(quote), getCompany()]);
  const totals = totalsFor(quote, rate);
  const editable = isEditable(quote.status);
  const publicUrl = quote.public_token ? `${SITE_URL}/q/${quote.public_token}` : null;

  return (
    <div className="space-y-4">
      <Link
        href="/admin/quotes"
        className="inline-flex items-center gap-1 text-sm font-semibold text-charcoal/50 transition-colors hover:text-charcoal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Quotes
      </Link>

      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-charcoal/45">
                #{quote.quote_number}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[quote.status]}`}
              >
                {QUOTE_STATUS_LABEL[quote.status]}
              </span>
              {quote.language === "fr" && (
                <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-charcoal/50">
                  Français
                </span>
              )}
            </div>
            <h2 className="mt-1 font-heading text-lg font-bold text-charcoal">
              {quote.title || "Untitled quote"}
            </h2>
            <p className="text-sm text-charcoal/55">
              {quote.client_snapshot?.displayName ?? (
                <Link href={`/admin/clients/${quote.client_id}`} className="hover:underline">
                  View client
                </Link>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {editable && (
              <Link
                href={`/admin/quotes/${quote.id}/edit`}
                className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
              >
                Edit
              </Link>
            )}
            <form action={archiveQuoteAction.bind(null, quote.id, !quote.archived_at)}>
              <button
                type="submit"
                className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold text-charcoal/45 transition-colors hover:bg-black/[0.03] hover:text-charcoal"
              >
                {quote.archived_at ? "Restore" : "Archive"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <QuoteActions
        quoteId={quote.id}
        status={quote.status}
        publicUrl={publicUrl}
        canSend={editable}
        missingRbq={!company.rbqLicence.trim()}
        sendAction={sendQuoteAction}
        statusAction={setStatusAction}
      />

      {quote.status === "approved" && quote.approved_by_name && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <h3 className="font-heading text-sm font-bold text-green-900">Approved</h3>
          <p className="mt-1 text-sm text-green-900/80">
            {quote.approved_by_name} accepted this quote
            {quote.approved_at
              ? ` on ${new Date(quote.approved_at).toLocaleDateString("en-CA", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`
              : ""}
            .
            {quote.approved_ip && (
              <span className="ml-1 text-green-900/50">From {quote.approved_ip}.</span>
            )}
          </p>
          {quote.approved_signature && (
            <p className="mt-2 font-heading text-xl italic text-green-900">
              {quote.approved_signature}
            </p>
          )}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <h3 className="border-b border-black/5 px-4 py-3 font-heading text-sm font-bold text-charcoal">
          Line items
        </h3>
        {quote.lines.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-charcoal/40">Nothing on this quote yet.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {quote.lines.map((line) => (
              <LineRow key={line.id} line={line} />
            ))}
          </ul>
        )}

        <dl className="space-y-1 border-t border-black/5 bg-black/[0.015] px-4 py-3 text-sm">
          <TotalRow label="Subtotal" value={formatMoney(totals.subtotalCents)} />
          {totals.discountCents > 0 && (
            <TotalRow label="Discount" value={`-${formatMoney(totals.discountCents)}`} muted />
          )}
          {totals.taxes.map((tax) => (
            <TotalRow key={tax.name} label={tax.name} value={formatMoney(tax.cents)} muted />
          ))}
          {rate.components.length === 0 && (
            <TotalRow
              label="Tax"
              value={company.taxRegistered ? "Exempt" : "Not registered"}
              muted
            />
          )}
          <div className="border-t border-black/10 pt-1">
            <TotalRow label="Total" value={formatMoney(totals.totalCents)} bold />
          </div>
          {totals.depositCents !== null && totals.depositCents > 0 && (
            <>
              <TotalRow label="Deposit requested" value={formatMoney(totals.depositCents)} muted />
              <TotalRow
                label="Balance on completion"
                value={formatMoney(totals.balanceCents ?? 0)}
                muted
              />
            </>
          )}
        </dl>
      </section>

      {(quote.client_message || quote.contract_terms) && (
        <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
          {quote.client_message && (
            <>
              <h3 className="font-heading text-sm font-bold text-charcoal">Message to the client</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-charcoal/75">
                {quote.client_message}
              </p>
            </>
          )}
          {quote.contract_terms && (
            <>
              <h3 className="mt-4 font-heading text-sm font-bold text-charcoal">Terms</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-charcoal/70">
                {quote.contract_terms}
              </p>
            </>
          )}
        </section>
      )}

      {quote.internal_notes && (
        <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="font-heading text-sm font-bold text-charcoal">
            Internal notes
            <span className="ml-2 text-xs font-normal text-charcoal/40">never shown to the client</span>
          </h3>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-charcoal/75">
            {quote.internal_notes}
          </p>
        </section>
      )}

      {quote.is_itinerant && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-heading text-sm font-bold text-amber-900">Itinerant contract</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm leading-relaxed text-amber-900/85">
            <li>The customer has 10 days to cancel from the day they receive their copy.</li>
            <li>No deposit may be taken and no work started before that period ends.</li>
            <li>
              Decontamination work cannot legally be sold this way at all — if this is a mould or
              water-damage job, check whether it really is itinerant.
            </li>
            {!company.opcPermit.trim() && (
              <li className="font-semibold">
                No OPC permit number is on file. An itinerant merchant needs one.
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

function LineRow({ line }: { line: QuoteLineItem }) {
  if (line.kind === "text") {
    return (
      <li className="bg-black/[0.015] px-4 py-3">
        <p className="text-sm font-semibold text-charcoal/70">{line.name}</p>
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

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold text-charcoal">{line.name}</span>
          {line.optional && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                line.selected ? "bg-green-100 text-green-800" : "bg-black/[0.05] text-charcoal/45"
              }`}
            >
              {line.selected ? "Optional · chosen" : "Optional"}
            </span>
          )}
          {!line.taxable && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-charcoal/35">
              no tax
            </span>
          )}
        </div>
        {line.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-charcoal/55">{line.description}</p>
        )}
        <p className="mt-0.5 text-xs tabular-nums text-charcoal/45">
          {formatQuantity(line.quantity_milli ?? 0)}
          {line.unit ? ` ${line.unit}` : ""} × {formatMoney(line.unit_price_cents ?? 0)}
        </p>
      </div>
      <span
        className={`shrink-0 text-sm font-bold tabular-nums ${
          total < 0 ? "text-green-700" : line.optional && !line.selected ? "text-charcoal/35" : "text-charcoal"
        }`}
      >
        {formatMoney(total)}
      </span>
    </li>
  );
}

function TotalRow({
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
