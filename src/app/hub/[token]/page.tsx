import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHubData } from "@/lib/crm/hub";
import { formatMoney } from "@/lib/crm/money";
import { INVOICE_STATUS_LABEL, JOB_STATUS_LABEL } from "@/lib/crm/opsTypes";
import { QUOTE_STATUS_LABEL } from "@/lib/crm/quoteTypes";
import { getCompany } from "@/lib/crm/settings";
import { SITE_PHONE } from "@/lib/constants";

/**
 * The client hub: one link where a customer sees their quotes, work and
 * invoices together.
 *
 * Never indexed, and no session — the token is the credential. Every list is
 * filtered by the client the token resolves to, so there is no request
 * parameter that could be edited to see somebody else's numbers.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ClientHubPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [data, company] = await Promise.all([getHubData(token), getCompany()]);
  if (!data) notFound();

  const outstanding = data.invoices.reduce(
    (sum, invoice) => sum + Math.max(0, invoice.total_cents - invoice.amount_paid_cents),
    0,
  );

  return (
    <main className="min-h-dvh bg-[#f6f8fb]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Image
              src="/renovision-logo.png"
              alt={company.tradeName}
              width={140}
              height={46}
              className="h-11 w-auto object-contain"
            />
            <p className="mt-2 text-sm text-charcoal/55">
              {data.clientName}
            </p>
          </div>
          {company.phone && (
            <a
              href={`tel:${company.phone.replace(/[^\d+]/g, "")}`}
              className="rounded-full border-2 border-brand-blue px-4 py-2 text-sm font-bold text-brand-blue transition-colors hover:bg-brand-blue hover:text-white"
            >
              {company.phone || SITE_PHONE}
            </a>
          )}
        </header>

        {outstanding > 0 && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800/70">
              Outstanding balance
            </p>
            <p className="mt-1 font-heading text-3xl font-bold text-amber-900">
              {formatMoney(outstanding)}
            </p>
          </div>
        )}

        <div className="space-y-6">
          <Section title="Quotes" empty="No quotes yet.">
            {data.quotes.map((quote) => (
              <Row
                key={quote.id}
                href={quote.public_token ? `/q/${quote.public_token}` : undefined}
                number={`#${quote.quote_number}`}
                title={quote.title || "Quote"}
                subtitle={
                  quote.valid_until && quote.status !== "converted"
                    ? `Valid until ${quote.valid_until}`
                    : undefined
                }
                status={QUOTE_STATUS_LABEL[quote.status]}
                highlight={quote.status === "sent" || quote.status === "viewed"}
                amount={formatMoney(quote.total_cents)}
              />
            ))}
          </Section>

          <Section title="Work" empty="No work scheduled yet.">
            {data.jobs.map((job) => (
              <Row
                key={job.id}
                number={`#${job.job_number}`}
                title={job.title || "Job"}
                subtitle={job.starts_on ? `Starting ${job.starts_on}` : undefined}
                status={JOB_STATUS_LABEL[job.status]}
                amount={formatMoney(job.total_cents)}
              />
            ))}
          </Section>

          <Section title="Invoices" empty="No invoices yet.">
            {data.invoices.map((invoice) => {
              const balance = invoice.total_cents - invoice.amount_paid_cents;
              return (
                <Row
                  key={invoice.id}
                  href={invoice.public_token ? `/i/${invoice.public_token}` : undefined}
                  number={`#${invoice.invoice_number}`}
                  title={invoice.title || "Invoice"}
                  subtitle={
                    balance > 0 && invoice.due_date
                      ? `Due ${invoice.due_date}`
                      : balance <= 0
                        ? "Paid"
                        : undefined
                  }
                  status={INVOICE_STATUS_LABEL[invoice.status]}
                  highlight={balance > 0}
                  amount={formatMoney(invoice.total_cents)}
                />
              );
            })}
          </Section>
        </div>

        <footer className="mt-8 text-center text-xs leading-relaxed text-charcoal/40">
          {company.tradeName}
          {company.rbqLicence && <> · RBQ {company.rbqLicence}</>}
          {company.email && (
            <>
              {" · "}
              <a href={`mailto:${company.email}`} className="underline-offset-2 hover:underline">
                {company.email}
              </a>
            </>
          )}
        </footer>
      </div>
    </main>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  const items = children.filter(Boolean);
  return (
    <section>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-charcoal/45">{title}</h2>
      {items.length === 0 ? (
        <p className="rounded-xl border border-black/5 bg-white p-4 text-sm text-charcoal/40 shadow-sm">
          {empty}
        </p>
      ) : (
        <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          {items}
        </ul>
      )}
    </section>
  );
}

function Row({
  href,
  number,
  title,
  subtitle,
  status,
  amount,
  highlight,
}: {
  href?: string;
  number: string;
  title: string;
  subtitle?: string;
  status: string;
  amount: string;
  highlight?: boolean;
}) {
  const inner = (
    <>
      <span className="w-12 shrink-0 font-mono text-[11px] font-bold text-charcoal/40">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-charcoal">{title}</span>
        <span className="block truncate text-xs text-charcoal/50">{subtitle ?? status}</span>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
          highlight ? "bg-brand-blue/[0.08] text-brand-blue" : "bg-black/[0.05] text-charcoal/50"
        }`}
      >
        {status}
      </span>
      <span className="w-24 shrink-0 text-right text-sm font-bold tabular-nums text-charcoal">
        {amount}
      </span>
    </>
  );

  return (
    <li>
      {href ? (
        <Link
          href={href}
          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02]"
        >
          {inner}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
      )}
    </li>
  );
}
