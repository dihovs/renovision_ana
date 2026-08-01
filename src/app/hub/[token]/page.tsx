import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHubData } from "@/lib/crm/hub";
import { formatMoney } from "@/lib/crm/money";
import { getCompany } from "@/lib/crm/settings";
import { SITE_PHONE } from "@/lib/constants";

/**
 * The client hub: one link where a customer sees their quotes, work and
 * invoices together.
 *
 * Never indexed, and no session — the token is the credential. Every list is
 * filtered by the client the token resolves to, so there is no request
 * parameter that could be edited to see somebody else's numbers.
 *
 * Customer-facing, so bilingual and French-first, same as the public quote
 * page. The hub has no document of its own to carry a language, so it borrows
 * the language of the client's most recent quote or invoice — the language we
 * last did business in — defaulting to French, with an explicit FR/EN toggle
 * for the household where two people share one link.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type HubLocale = "fr" | "en";

const HUB_COPY = {
  fr: {
    portal: "Votre espace client",
    callUs: "Appelez-nous",
    language: "Langue",
    outstanding: "Solde à payer",
    quotes: "Soumissions",
    work: "Travaux",
    invoices: "Factures",
    noQuotes: "Aucune soumission pour le moment.",
    noWork: "Aucuns travaux planifiés pour le moment.",
    noInvoices: "Aucune facture pour le moment.",
    validUntil: "Valide jusqu'au",
    starting: "Début le",
    due: "Échéance le",
    paid: "Payée",
  },
  en: {
    portal: "Your client hub",
    callUs: "Call us",
    language: "Language",
    outstanding: "Balance due",
    quotes: "Quotes",
    work: "Work",
    invoices: "Invoices",
    noQuotes: "No quotes yet.",
    noWork: "No work scheduled yet.",
    noInvoices: "No invoices yet.",
    validUntil: "Valid until",
    starting: "Starting",
    due: "Due",
    paid: "Paid",
  },
} as const;

/**
 * Customer-facing status wording, kept local to the hub on purpose: the admin
 * labels ("Converted", "Written off") are internal pipeline jargon, and this
 * page is the one place a customer reads them.
 */
const QUOTE_STATUS: Record<string, { fr: string; en: string }> = {
  sent: { fr: "Envoyée", en: "Sent" },
  viewed: { fr: "Consultée", en: "Viewed" },
  approved: { fr: "Approuvée", en: "Approved" },
  changes_requested: { fr: "Modification demandée", en: "Changes requested" },
  declined: { fr: "Refusée", en: "Declined" },
  converted: { fr: "Acceptée", en: "Accepted" },
};

const JOB_STATUS: Record<string, { fr: string; en: string }> = {
  unscheduled: { fr: "À planifier", en: "To schedule" },
  scheduled: { fr: "Planifiés", en: "Scheduled" },
  in_progress: { fr: "En cours", en: "In progress" },
  complete: { fr: "Terminés", en: "Complete" },
  cancelled: { fr: "Annulés", en: "Cancelled" },
};

const INVOICE_STATUS: Record<string, { fr: string; en: string }> = {
  sent: { fr: "Envoyée", en: "Sent" },
  viewed: { fr: "Consultée", en: "Viewed" },
  part_paid: { fr: "Partiellement payée", en: "Part paid" },
  paid: { fr: "Payée", en: "Paid" },
  bad_debt: { fr: "Radiée", en: "Written off" },
};

function statusLabel(
  map: Record<string, { fr: string; en: string }>,
  status: string,
  locale: HubLocale,
): string {
  return map[status]?.[locale] ?? status;
}

/** Date-only strings ("2026-08-15") formatted as a date, not an instant. */
function formatDate(iso: string, locale: HubLocale): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(
    locale === "fr" ? "fr-CA" : "en-CA",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
  );
}

export default async function ClientHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const [{ token }, { lang }] = await Promise.all([params, searchParams]);

  const [data, company] = await Promise.all([getHubData(token), getCompany()]);
  if (!data) notFound();

  const requested: HubLocale | null = lang === "en" ? "en" : lang === "fr" ? "fr" : null;
  const inferred: HubLocale = data.quotes[0]?.language ?? data.invoices[0]?.language ?? "fr";
  const locale = requested ?? inferred;
  const t = HUB_COPY[locale];

  const outstanding = data.invoices.reduce(
    (sum, invoice) => sum + Math.max(0, invoice.total_cents - invoice.amount_paid_cents),
    0,
  );

  return (
    <main lang={locale === "fr" ? "fr-CA" : "en-CA"} className="min-h-dvh bg-[#f6f8fb]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Image
              src="/renovision-logo.png"
              alt={company.tradeName}
              width={140}
              height={46}
              className="h-11 w-auto object-contain"
            />
            <h1 className="mt-3 font-heading text-lg font-bold text-charcoal">
              {data.clientName}
            </h1>
            <p className="text-sm text-charcoal/55">{t.portal}</p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <nav aria-label={t.language} className="flex rounded-full border border-black/10 p-0.5">
              <LangLink token={token} locale="fr" current={locale} />
              <LangLink token={token} locale="en" current={locale} />
            </nav>
            {company.phone && (
              <a
                href={`tel:${company.phone.replace(/[^\d+]/g, "")}`}
                aria-label={`${t.callUs} : ${company.phone || SITE_PHONE}`}
                className="rounded-full border-2 border-brand-blue px-4 py-2 text-sm font-bold text-brand-blue transition-colors hover:bg-brand-blue hover:text-white"
              >
                {company.phone || SITE_PHONE}
              </a>
            )}
          </div>
        </header>

        {outstanding > 0 && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800/70">
              {t.outstanding}
            </p>
            <p className="mt-1 font-heading text-3xl font-bold text-amber-900">
              {formatMoney(outstanding, locale)}
            </p>
          </div>
        )}

        <div className="space-y-6">
          <Section title={t.quotes} empty={t.noQuotes}>
            {data.quotes.map((quote) => (
              <Row
                key={quote.id}
                href={
                  quote.public_token
                    ? `/q/${quote.public_token}`
                    : undefined
                }
                number={`#${quote.quote_number}`}
                title={quote.title || t.quotes.replace(/s$/, "")}
                subtitle={
                  quote.valid_until && quote.status !== "converted"
                    ? `${t.validUntil} ${formatDate(quote.valid_until, locale)}`
                    : undefined
                }
                status={statusLabel(QUOTE_STATUS, quote.status, locale)}
                highlight={quote.status === "sent" || quote.status === "viewed"}
                amount={formatMoney(quote.total_cents, locale)}
              />
            ))}
          </Section>

          <Section title={t.work} empty={t.noWork}>
            {data.jobs.map((job) => (
              <Row
                key={job.id}
                number={`#${job.job_number}`}
                title={job.title || t.work}
                subtitle={job.starts_on ? `${t.starting} ${formatDate(job.starts_on, locale)}` : undefined}
                status={statusLabel(JOB_STATUS, job.status, locale)}
                amount={formatMoney(job.total_cents, locale)}
              />
            ))}
          </Section>

          <Section title={t.invoices} empty={t.noInvoices}>
            {data.invoices.map((invoice) => {
              const balance = invoice.total_cents - invoice.amount_paid_cents;
              return (
                <Row
                  key={invoice.id}
                  href={invoice.public_token ? `/i/${invoice.public_token}` : undefined}
                  number={`#${invoice.invoice_number}`}
                  title={invoice.title || t.invoices.replace(/s$/, "")}
                  subtitle={
                    balance > 0 && invoice.due_date
                      ? `${t.due} ${formatDate(invoice.due_date, locale)}`
                      : balance <= 0
                        ? t.paid
                        : undefined
                  }
                  status={statusLabel(INVOICE_STATUS, invoice.status, locale)}
                  highlight={balance > 0}
                  amount={formatMoney(invoice.total_cents, locale)}
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

function LangLink({
  token,
  locale,
  current,
}: {
  token: string;
  locale: HubLocale;
  current: HubLocale;
}) {
  const active = locale === current;
  return (
    <Link
      href={`/hub/${token}?lang=${locale}`}
      aria-current={active ? "true" : undefined}
      className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase transition-colors ${
        active ? "bg-brand-blue text-white" : "text-charcoal/50 hover:text-charcoal"
      }`}
    >
      {locale === "fr" ? "FR" : "EN"}
    </Link>
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
      {/* The document number earns its column on a desktop and steals it from
          the title on a phone. */}
      <span className="hidden w-12 shrink-0 font-mono text-[11px] font-bold text-charcoal/40 sm:block">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <span
          title={title}
          className={`block truncate text-sm font-bold text-charcoal ${
            href ? "group-hover:underline group-hover:underline-offset-2" : ""
          }`}
        >
          {title}
        </span>
        <span className="block truncate text-xs text-charcoal/50" title={subtitle ?? status}>
          {subtitle ?? status}
        </span>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
          highlight ? "bg-brand-blue/[0.08] text-brand-blue" : "bg-black/[0.05] text-charcoal/50"
        }`}
      >
        {status}
      </span>
      <span className="shrink-0 text-right text-sm font-bold tabular-nums text-charcoal sm:w-24">
        {amount}
      </span>
    </>
  );

  return (
    <li>
      {href ? (
        <Link
          href={href}
          className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02]"
        >
          {inner}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
      )}
    </li>
  );
}
