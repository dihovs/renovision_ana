import Link from "next/link";
import AdminNotice from "@/components/admin/AdminNotice";
import { MigrationPendingError, isConfigured } from "@/lib/crm/db";
import { listInvoices, receivablesSummary, type InvoiceListItem } from "@/lib/crm/invoices";
import { formatMoney } from "@/lib/crm/money";
import { INVOICE_STATUS_LABEL, invoiceBalanceCents, isOverdue, type InvoiceStatus } from "@/lib/crm/opsTypes";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  draft: "bg-black/[0.05] text-charcoal/60",
  sent: "bg-brand-blue/[0.08] text-brand-blue",
  viewed: "bg-violet-100 text-violet-800",
  part_paid: "bg-amber-100 text-amber-800",
  paid: "bg-green-100 text-green-800",
  bad_debt: "bg-red-100 text-red-800",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = (status ?? "") as InvoiceStatus | "";

  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set the Supabase environment variables to turn this on.
      </AdminNotice>
    );
  }

  let invoices: InvoiceListItem[] = [];
  let summary = { outstandingCents: 0, overdueCents: 0, count: 0 };
  try {
    [invoices, summary] = await Promise.all([
      listInvoices({ status: filter || undefined }),
      receivablesSummary(),
    ]);
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
    return (
      <AdminNotice title="Could not reach the database">
        {err instanceof Error ? err.message : "Unknown error"}.
      </AdminNotice>
    );
  }

  return (
    <div className="space-y-4">
      {summary.count > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Outstanding" value={formatMoney(summary.outstandingCents)} />
          <Stat
            label="Overdue"
            value={formatMoney(summary.overdueCents)}
            alarm={summary.overdueCents > 0}
          />
          <Stat label="Unpaid invoices" value={String(summary.count)} />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Chip href="/admin/invoices" label="All" active={!filter} />
        {(Object.keys(INVOICE_STATUS_LABEL) as InvoiceStatus[]).map((s) => (
          <Chip
            key={s}
            href={`/admin/invoices?status=${s}`}
            label={INVOICE_STATUS_LABEL[s]}
            active={filter === s}
          />
        ))}
      </div>

      {invoices.length === 0 ? (
        <AdminNotice title="No invoices yet">
          Invoices are created from a job. Open a{" "}
          <Link href="/admin/jobs" className="font-semibold text-brand-blue">
            job
          </Link>{" "}
          and bill it — either the whole thing, or a deposit up front.
        </AdminNotice>
      ) : (
        <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          {invoices.map((invoice) => {
            const balance = invoiceBalanceCents(invoice);
            const overdue = isOverdue(invoice);
            return (
              <li key={invoice.id}>
                <Link
                  href={`/admin/invoices/${invoice.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02]"
                >
                  <span className="w-14 shrink-0 font-mono text-xs font-bold text-charcoal/45">
                    #{invoice.invoice_number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-charcoal">
                      {invoice.client_name}
                      {invoice.is_deposit && (
                        <span className="ml-1.5 text-[11px] font-semibold text-charcoal/45">
                          deposit
                        </span>
                      )}
                    </span>
                    <span
                      className={`block truncate text-xs ${
                        overdue ? "font-semibold text-red-700" : "text-charcoal/55"
                      }`}
                    >
                      {invoice.due_date
                        ? overdue
                          ? `Overdue since ${invoice.due_date}`
                          : `Due ${invoice.due_date}`
                        : invoice.title || "—"}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[invoice.status]}`}
                  >
                    {INVOICE_STATUS_LABEL[invoice.status]}
                  </span>
                  <div className="w-28 shrink-0 text-right">
                    <span className="block text-sm font-bold tabular-nums text-charcoal">
                      {formatMoney(invoice.total_cents)}
                    </span>
                    {balance > 0 && balance !== invoice.total_cents && (
                      <span className="block text-[11px] tabular-nums text-charcoal/45">
                        {formatMoney(balance)} owing
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, alarm }: { label: string; value: string; alarm?: boolean }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
      <span className="text-xs font-bold uppercase tracking-wide text-charcoal/45">{label}</span>
      <p
        className={`mt-1 font-heading text-2xl font-bold ${alarm ? "text-red-700" : "text-charcoal"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Chip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
        active ? "bg-brand-blue text-white" : "bg-white text-charcoal/60 shadow-sm hover:text-charcoal"
      }`}
    >
      {label}
    </Link>
  );
}
