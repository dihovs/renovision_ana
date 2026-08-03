import Link from "next/link";
import AdminNotice from "@/components/admin/AdminNotice";
import { MigrationPendingError, isConfigured } from "@/lib/crm/db";
import { formatMoney } from "@/lib/crm/money";
import { listQuotes, type QuoteListItem } from "@/lib/crm/quotes";
import { QUOTE_STATUS_LABEL, type QuoteStatus } from "@/lib/crm/quoteTypes";

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

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const search = q?.trim() ?? "";
  const filter = (status ?? "") as QuoteStatus | "";

  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set <code className="font-mono text-brand-blue">SUPABASE_URL</code> and{" "}
        <code className="font-mono text-brand-blue">SUPABASE_SERVICE_ROLE_KEY</code> to turn this
        on.
      </AdminNotice>
    );
  }

  let quotes: QuoteListItem[] = [];
  try {
    quotes = await listQuotes({ status: filter || undefined, search });
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration left to run">
          Open the Supabase SQL editor and run{" "}
          <code className="font-mono text-brand-blue">supabase/migrations/0006_quoting.sql</code>.
          Quotes, the price book and the settings they need all come from that one file.
        </AdminNotice>
      );
    }
    return (
      <AdminNotice title="Could not reach the database">
        {err instanceof Error ? err.message : "Unknown error"}.
      </AdminNotice>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form className="min-w-[200px] flex-1">
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search by number or title"
            aria-label="Search quotes"
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-charcoal outline-none transition-colors placeholder:text-charcoal/30 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
          />
        </form>
        <Link
          href="/admin/quotes/new"
          className="shrink-0 rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90"
        >
          New quote
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip href="/admin/quotes" label="All" active={!filter} />
        {(Object.keys(QUOTE_STATUS_LABEL) as QuoteStatus[]).map((s) => (
          <FilterChip
            key={s}
            href={`/admin/quotes?status=${s}`}
            label={QUOTE_STATUS_LABEL[s]}
            active={filter === s}
          />
        ))}
      </div>

      {quotes.length === 0 ? (
        <AdminNotice title={filter || search ? "No matches" : "No quotes yet"}>
          {filter || search ? (
            <>
              Nothing here.{" "}
              <Link href="/admin/quotes" className="font-semibold text-brand-blue">
                Clear the filter
              </Link>
              .
            </>
          ) : (
            <>
              Build one from the button above. Import your estimator catalog into the{" "}
              <Link href="/admin/price-book" className="font-semibold text-brand-blue">
                price book
              </Link>{" "}
              first and every line becomes a two-keystroke pick.
            </>
          )}
        </AdminNotice>
      ) : (
        <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          {quotes.map((quote) => (
            <li key={quote.id}>
              <Link
                href={`/admin/quotes/${quote.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02]"
              >
                <span className="w-14 shrink-0 font-mono text-xs font-bold text-charcoal/45">
                  #{quote.quote_number}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-charcoal">
                    {quote.title || quote.client_name}
                  </span>
                  <span className="block truncate text-xs text-charcoal/55">
                    {quote.title ? quote.client_name : "—"}
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[quote.status]}`}
                >
                  {QUOTE_STATUS_LABEL[quote.status]}
                </span>
                <span className="w-24 shrink-0 text-right text-sm font-bold tabular-nums text-charcoal">
                  {formatMoney(quote.total_cents)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
        active
          ? "bg-brand-blue text-white"
          : "bg-white text-charcoal/60 shadow-sm hover:text-charcoal"
      }`}
    >
      {label}
    </Link>
  );
}
