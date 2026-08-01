import Link from "next/link";
import AdminNotice from "@/components/admin/AdminNotice";
import { db, isConfigured, isMissingTable } from "@/lib/crm/db";
import { formatHours } from "@/lib/crm/expenses";
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
  if (!client) {
    return (
      <AdminNotice title="Could not reach the database">
        The connection could not be established. Try reloading the page.
      </AdminNotice>
    );
  }

  const [quotesRes, invoicesRes, paymentsRes, expensesRes, timeRes, jobsRes] = await Promise.all([
    client.from("quotes").select("status, total_cents, created_at").is("archived_at", null),
    client
      .from("invoices")
      .select("status, total_cents, amount_paid_cents, issue_date, job_id")
      .is("archived_at", null),
    client.from("payments").select("amount_cents, received_on"),
    // The cost side. These three feed job costing only — an error here (most
    // likely migration 0012 not run yet) must never take down the reports
    // above, so they are deliberately excluded from the check below.
    client.from("expenses").select("job_id, amount_cents, incurred_on"),
    client.from("time_entries").select("job_id, minutes, worked_on"),
    client.from("jobs").select("id, job_number, title, client_snapshot").is("archived_at", null),
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
    job_id: string | null;
  }[];
  const payments = (paymentsRes.data ?? []) as { amount_cents: number; received_on: string }[];

  // Absent tables (migration 0012 pending) leave costing off; the reports
  // above render exactly as they always have.
  const costingReady = !expensesRes.error && !timeRes.error && !jobsRes.error;
  const costingPending = isMissingTable(expensesRes.error) || isMissingTable(timeRes.error);
  const expenseRows = (costingReady ? (expensesRes.data ?? []) : []) as {
    job_id: string | null;
    amount_cents: number;
    incurred_on: string;
  }[];
  const timeRows = (costingReady ? (timeRes.data ?? []) : []) as {
    job_id: string;
    minutes: number;
    worked_on: string;
  }[];
  const jobRows = (costingReady ? (jobsRes.data ?? []) : []) as {
    id: string;
    job_number: number;
    title: string | null;
    client_snapshot: { displayName?: string } | null;
  }[];

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

  // --- Job costing ---------------------------------------------------------
  // Revenue is INVOICED revenue per job, same rule as everything else on this
  // page. Expenses come in dollars; labour comes in hours rather than dollars,
  // because no wage lives in this system and a fabricated labour cost is worse
  // than none. Margin is therefore invoiced minus expenses, with the hours
  // beside it for the owner to price in their head.
  const thisYear = String(new Date().getFullYear());
  const spentYtd = expenseRows
    .filter((e) => e.incurred_on.startsWith(thisYear))
    .reduce((sum, e) => sum + e.amount_cents, 0);
  const minutesYtd = timeRows
    .filter((t) => t.worked_on.startsWith(thisYear))
    .reduce((sum, t) => sum + t.minutes, 0);
  const overheadSpend = expenseRows
    .filter((e) => e.job_id === null)
    .reduce((sum, e) => sum + e.amount_cents, 0);

  const costingByJob = new Map<
    string,
    { label: string; client: string; revenueCents: number; spentCents: number; minutes: number }
  >();
  for (const job of jobRows) {
    costingByJob.set(job.id, {
      label: `#${job.job_number} · ${job.title ?? "Untitled"}`,
      client: job.client_snapshot?.displayName ?? "",
      revenueCents: 0,
      spentCents: 0,
      minutes: 0,
    });
  }
  for (const invoice of invoices) {
    if (!invoice.job_id || invoice.status === "draft") continue;
    const row = costingByJob.get(invoice.job_id);
    if (row) row.revenueCents += invoice.total_cents;
  }
  for (const expense of expenseRows) {
    if (!expense.job_id) continue;
    const row = costingByJob.get(expense.job_id);
    if (row) row.spentCents += expense.amount_cents;
  }
  for (const entry of timeRows) {
    const row = costingByJob.get(entry.job_id);
    if (row) row.minutes += entry.minutes;
  }
  // Only jobs with any financial activity — a table of untouched jobs full of
  // zeros would bury the handful of rows that mean something.
  const costedJobs = [...costingByJob.entries()]
    .map(([id, row]) => ({ id, ...row }))
    .filter((row) => row.revenueCents !== 0 || row.spentCents !== 0 || row.minutes > 0)
    .sort((a, b) => b.revenueCents - a.revenueCents || b.spentCents - a.spentCents);
  const hasCosts = expenseRows.length > 0 || timeRows.length > 0;

  if (
    quotes.length === 0 &&
    invoices.length === 0 &&
    payments.length === 0 &&
    expenseRows.length === 0 &&
    timeRows.length === 0
  ) {
    return (
      <AdminNotice title="Nothing to report yet">
        These numbers fill in once quotes go out and invoices get paid.{" "}
        <Link href="/admin/quotes/new" className="font-semibold text-brand-blue">
          Create a quote
        </Link>{" "}
        to get started.
      </AdminNotice>
    );
  }

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

      {costingReady && hasCosts && (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-charcoal/45">
            Money out
          </h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Spent this year" value={formatMoney(spentYtd)} note="expenses recorded" />
            <Stat label="Hours this year" value={formatHours(minutesYtd)} note="labour logged" />
            <Stat
              label="Overhead"
              value={formatMoney(overheadSpend)}
              note="expenses tied to no job"
            />
            <Stat
              label="Jobs costed"
              value={String(costedJobs.length)}
              note="with money or hours against them"
            />
          </div>

          {costedJobs.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-black/5 bg-white shadow-sm">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-left text-[11px] font-bold uppercase tracking-wide text-charcoal/45">
                    <th className="px-4 py-2.5 font-bold">Job</th>
                    <th className="px-4 py-2.5 text-right font-bold">Invoiced</th>
                    <th className="px-4 py-2.5 text-right font-bold">Spent</th>
                    <th className="px-4 py-2.5 text-right font-bold">Hours</th>
                    <th className="px-4 py-2.5 text-right font-bold">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {costedJobs.map((row) => {
                    const margin = row.revenueCents - row.spentCents;
                    return (
                      <tr key={row.id}>
                        <td className="max-w-[220px] px-4 py-2.5">
                          <span className="block truncate font-semibold text-charcoal">
                            {row.label}
                          </span>
                          {row.client && (
                            <span className="block truncate text-xs text-charcoal/50">
                              {row.client}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-charcoal/70">
                          {row.revenueCents === 0 ? "—" : formatMoney(row.revenueCents)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-charcoal/70">
                          {row.spentCents === 0 ? "—" : formatMoney(row.spentCents)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-charcoal/70">
                          {row.minutes === 0 ? "—" : formatHours(row.minutes)}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-bold tabular-nums ${
                            margin < 0 ? "text-red-700" : "text-charcoal"
                          }`}
                        >
                          {formatMoney(margin)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-2 text-xs leading-relaxed text-charcoal/45">
            Margin is invoiced revenue minus recorded expenses. Labour shows as hours, not dollars
            — no wage lives in this system, and a made-up labour cost would be worse than none.{" "}
            <Link href="/admin/expenses" className="font-semibold text-brand-blue">
              Record expenses and hours
            </Link>{" "}
            to keep it honest.
          </p>
        </section>
      )}

      {costingReady && !hasCosts && (
        <p className="text-xs leading-relaxed text-charcoal/45">
          Job costing switches on once the first expense or hour is{" "}
          <Link href="/admin/expenses" className="font-semibold text-brand-blue">
            recorded
          </Link>
          — then every job here shows what it cost next to what it billed.
        </p>
      )}

      {costingPending && (
        <p className="text-xs leading-relaxed text-charcoal/45">
          One report is still waiting: run{" "}
          <code className="font-mono text-brand-blue">
            supabase/migrations/0012_expenses_time.sql
          </code>{" "}
          in the Supabase SQL editor to start tracking expenses and hours, and a job-costing view
          appears here.
        </p>
      )}

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
        className={`mt-2 font-heading text-2xl font-bold ${alarm ? "text-red-700" : "text-charcoal"}`}
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
