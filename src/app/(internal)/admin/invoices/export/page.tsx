import Link from "next/link";
import AdminNotice from "@/components/admin/AdminNotice";
import { MigrationPendingError, isConfigured } from "@/lib/crm/db";
import { listInvoicesForExport } from "@/lib/crm/invoices";
import { invoicesToQuickBooksCsv } from "@/lib/crm/quickbooksCsv";

export const dynamic = "force-dynamic";

/**
 * Invoices → QuickBooks, as a file.
 *
 * This screen exists so the file is never downloaded blind. It runs the same
 * builder the download route runs and shows what came out — how many invoices,
 * how many rows, and anything that did not reconcile — before Artush imports
 * it. An accounting import is hard to unwind once it is in the books; a
 * warning after the fact is not much use.
 *
 * It is a CSV rather than a live sync because Intuit's App Partner Program
 * excludes Quebec and production API keys are gated behind it. See
 * `Docs/Automation-Blockers.md` §3.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function QuickBooksExportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;

  // Year to date is the range a bookkeeper asks for by default. Both ends are
  // validated rather than trusted: they arrive from the query string, and a
  // malformed date would otherwise reach the database as a filter that
  // silently matches nothing, which reads on screen as "no invoices".
  const from = ISO_DATE.test(params.from ?? "") ? params.from! : `${today().slice(0, 4)}-01-01`;
  const to = ISO_DATE.test(params.to ?? "") ? params.to! : today();
  const rangeIsBackwards = from > to;

  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set the Supabase environment variables to turn this on.
      </AdminNotice>
    );
  }

  let result: ReturnType<typeof invoicesToQuickBooksCsv> | null = null;
  let error: string | null = null;

  if (!rangeIsBackwards) {
    try {
      result = invoicesToQuickBooksCsv(await listInvoicesForExport({ from, to }));
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
      error = err instanceof Error ? err.message : "Unknown error";
    }
  }

  const nothingToExport = result !== null && result.rowCount === 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
        <h1 className="font-heading text-lg font-bold text-charcoal">Export to QuickBooks</h1>
        <p className="mt-1 text-sm leading-relaxed text-charcoal/60">
          Issued invoices as a QuickBooks Online import file — one row per line item. Drafts and
          archived invoices are left out. In QuickBooks: <b>Settings → Import data → Invoices</b>.
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-black/5 bg-white p-4 shadow-sm"
      >
        <Field label="From" name="from" value={from} />
        <Field label="To" name="to" value={to} />
        <button
          type="submit"
          className="rounded-lg bg-charcoal px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-charcoal/85"
        >
          Preview
        </button>
      </form>

      {rangeIsBackwards && (
        <AdminNotice title="That range runs backwards">
          The from date is after the to date, so there is nothing to look at.
        </AdminNotice>
      )}

      {error && <AdminNotice title="Could not reach the database">{error}.</AdminNotice>}

      {result && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Invoices" value={String(result.invoiceCount)} />
            <Stat label="Rows in the file" value={String(result.rowCount)} />
          </div>

          {result.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <h2 className="font-heading text-sm font-bold text-amber-900">
                {result.warnings.length === 1
                  ? "One invoice needs a look"
                  : `${result.warnings.length} invoices need a look`}
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-amber-900/85">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {nothingToExport ? (
            <AdminNotice title="No invoices in that range">
              Nothing has been issued between {from} and {to}. Widen the dates, or{" "}
              <Link href="/admin/invoices" className="font-semibold text-brand-blue">
                go back to the invoice list
              </Link>
              .
            </AdminNotice>
          ) : (
            <a
              href={`/api/v1/invoices/quickbooks?from=${from}&to=${to}`}
              className="inline-flex rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Download CSV
            </a>
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-charcoal/45">{label}</span>
      <input
        type="date"
        name={name}
        defaultValue={value}
        className="rounded-lg border border-black/10 px-3 py-2 text-sm text-charcoal"
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
      <span className="text-xs font-bold uppercase tracking-wide text-charcoal/45">{label}</span>
      <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-charcoal">{value}</p>
    </div>
  );
}
