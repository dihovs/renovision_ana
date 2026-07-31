import Link from "next/link";
import AdminNotice from "@/components/admin/AdminNotice";
import { db, isConfigured } from "@/lib/crm/db";
import { formatMoney } from "@/lib/crm/money";

export const dynamic = "force-dynamic";

/**
 * Reports.
 *
 * Deliberately few, and every one of them answers a question the owner
 * actually asks: am I winning work, is anyone paying me, and where did the
 * money come from. A dashboard full of charts nobody reads is worse than four
 * numbers that get checked.
 *
 * INVOICED revenue only. Quote and estimate totals are hopes; an invoice is a
 * demand, and a payment is money. Mixing them is how a business talks itself
 * into a good month it never had.
 */
export default async function ReportsPage() {
  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set the Supabase environment variables to turn this on.
      </AdminNotice>
    );
  }

  const client = db();
  if (!client) return null;

  const [quotesRes, invoicesRes, paymentsRes] = await Promise.all([
    client.from("quotes").select("status, total_cents, created_at").is("archived_at", null),
    client
      .from("invoices")
      .select("status, total_cents, amount_paid_cents, issue_date")
      .is("archived_at", null),
    client.from("payments").select("amount_cents, received_on"),
  ]);

  if (quotesRes.error || invoicesRes.error || paymentsRes.error) {
    return (
      <AdminNotice title="One migration left to run">
        Run the migrations in{" "}
        <code className="font-mono text-brand-blue">supabase/migrations</code> — reports need the
        quotes and invoices tables.
      </AdminNotice>
    );
  }

  const quotes = (quotesRes.data ?? []) as {
    status: string;
    total_cents: number;
    created_at: string;
  }[];
  const invoices = (invoicesRes.data ?? []) as {
    status: string;
    total_cents: number;
    amount_paid_cents: number;
    issue_date: string;
  }[];
  const payments = (paymentsRes.data ?? []) as { amount_cents: number; received_on: string }[];

  // --- Quote conversion --------------------------------------------------
  // Drafts are excluded: a quote never sent was never a chance to win, and
  // counting it drags the rate down for work that was never offered.
  const decided = quotes.filter((q) =>
    ["approved", "converted", "declined"].includes(q.status),
  );
  const won = decided.filter((q) => q.status === "approved" || q.status === "converted");
  const conversionRate = decided.length ? Math.round((won.length / decided.length) * 100) : null;
  const wonValue = won.reduce((sum, q) => sum + q.total_cents, 0);
  const outstandingQuotes = quotes.filter((q) => q.status === "sent" || q.status === "viewed");
  const outstandingQuoteValue = outstandingQuotes.reduce((sum, q) => sum + q.total_cents, 0);

  // --- Money in ----------------------------------------------------------
  const months = lastMonths(6);
  const byMonth = months.map((month) => ({
    label: month.label,
    invoiced: invoices
      .filter((i) => i.issue_date.startsWith(month.key) && i.status !== "draft")
      .reduce((sum, i) => sum + i.total_cents, 0),
    collected: payments
      .filter((p) => p.received_on.startsWith(month.key))
      .reduce((sum, p) => sum + p.amount_cents, 0),
  }));

  const peak = Math.max(1, ...byMonth.flatMap((m) => [m.invoiced, m.collected]));

  const collectedYtd = payments
    .filter((p) => p.received_on.startsWith(String(new Date().getFullYear())))
    .reduce((sum, p) => sum + p.amount_cents, 0);

  const outstanding = invoices
    .filter((i) => i.status !== "draft" && i.status !== "bad_debt")
    .reduce((sum, i) => sum + Math.max(0, i.total_cents - i.amount_paid_cents), 0);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-charcoal/45">
          Winning work
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Quote conversion"
            value={conversionRate === null ? "—" : `${conversionRate}%`}
            note={
              decided.length
                ? `${won.length} of ${decided.length} decided`
                : "no quotes decided yet"
            }
          />
          <Stat label="Value won" value={formatMoney(wonValue)} note="approved quotes" />
          <Stat
            label="Awaiting a decision"
            value={formatMoney(outstandingQuoteValue)}
            note={`${outstandingQuotes.length} quote${outstandingQuotes.length === 1 ? "" : "s"} out`}
          />
          <Stat
            label="Outstanding"
            value={formatMoney(outstanding)}
            note="invoiced, not yet paid"
            alarm={outstanding > 0}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-charcoal/45">
          Last six months
        </h3>
        <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center gap-4 text-[11px] font-semibold">
            <span className="flex items-center gap-1.5 text-charcoal/60">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-blue/30" /> Invoiced
            </span>
            <span className="flex items-center gap-1.5 text-charcoal/60">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-green" /> Collected
            </span>
          </div>

          <ul className="space-y-3">
            {byMonth.map((month) => (
              <li key={month.label}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="font-semibold text-charcoal/70">{month.label}</span>
                  <span className="tabular-nums text-charcoal/55">
                    {formatMoney(month.collected)}
                    <span className="text-charcoal/35"> of {formatMoney(month.invoiced)}</span>
                  </span>
                </div>
                {/* Bars scaled against the six-month peak, so a quiet month
                    reads as quiet rather than being stretched to look busy. */}
                <div className="relative h-5 overflow-hidden rounded bg-black/[0.03]">
                  <div
                    className="absolute inset-y-0 left-0 rounded bg-brand-blue/25"
                    style={{ width: `${(month.invoiced / peak) * 100}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded bg-brand-green"
                    style={{ width: `${(month.collected / peak) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-4 border-t border-black/5 pt-3 text-sm text-charcoal/60">
            Collected so far this year:{" "}
            <strong className="font-heading text-base font-bold text-charcoal">
              {formatMoney(collectedYtd)}
            </strong>
          </p>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-charcoal/45">
        These figures count invoices and payments only — never quote or estimate totals. A quote is
        a hope, an invoice is a demand, and a payment is money.{" "}
        <Link href="/admin/invoices" className="font-semibold text-brand-blue">
          See the invoices
        </Link>{" "}
        behind them.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  alarm,
}: {
  label: string;
  value: string;
  note?: string;
  alarm?: boolean;
}) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
      <span className="text-xs font-bold uppercase tracking-wide text-charcoal/45">{label}</span>
      <p
        className={`mt-2 font-heading text-2xl font-bold ${alarm ? "text-charcoal" : "text-charcoal"}`}
      >
        {value}
      </p>
      {note && <p className="mt-0.5 text-[11px] text-charcoal/40">{note}</p>}
    </div>
  );
}

/** The last six months, oldest first, keyed "YYYY-MM" to match a date column. */
function lastMonths(count: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-CA", { month: "short", year: "numeric" }),
    });
  }
  return out;
}
