import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addVisitAction,
  archiveJobAction,
  completeVisitAction,
  removeVisitAction,
  setJobStatusAction,
} from "../actions";
import { createFromJobAction } from "../../invoices/actions";
import AdminNotice from "@/components/admin/AdminNotice";
import AskClaude from "@/components/admin/AskClaude";
import JobDetail from "@/components/admin/JobDetail";
import { db, MigrationPendingError } from "@/lib/crm/db";
import { getJob } from "@/lib/crm/jobs";
import { calculateQuoteTotals } from "@/lib/crm/money";
import { JOB_STATUS_LABEL, lineForTotals, priced, type JobWithLines } from "@/lib/crm/opsTypes";
import { canChargeTax, getCompany } from "@/lib/crm/settings";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let job: JobWithLines | null;
  try {
    job = await getJob(id);
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

  if (!job) notFound();

  const company = await getCompany();
  const rate =
    canChargeTax(company) && job.tax_snapshot
      ? job.tax_snapshot
      : { id: "none", label: "No tax", components: [] };

  const totals = calculateQuoteTotals(priced(job.lines).map(lineForTotals), rate);

  // Whether an invoice already exists, so the screen doesn't offer to bill the
  // same work twice.
  const client = db();
  const { count } = client
    ? await client
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("job_id", job.id)
        .is("archived_at", null)
    : { count: 0 };

  return (
    <div className="space-y-4">
      <Link
        href="/admin/jobs"
        className="inline-flex items-center gap-1 text-sm font-semibold text-charcoal/50 transition-colors hover:text-charcoal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Jobs
      </Link>

      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-charcoal/45">#{job.job_number}</span>
              <span className="rounded-full bg-brand-blue/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-blue">
                {JOB_STATUS_LABEL[job.status]}
              </span>
            </div>
            <h2 className="mt-1 font-heading text-lg font-bold text-charcoal">
              {job.title || "Untitled job"}
            </h2>
            <p className="text-sm text-charcoal/55">{job.client_snapshot?.displayName ?? "—"}</p>
            {job.property_snapshot && (
              <p className="mt-1 text-xs text-charcoal/50">
                {[job.property_snapshot.street1, job.property_snapshot.city]
                  .filter(Boolean)
                  .join(", ")}
                {job.property_snapshot.accessNotes && (
                  <span className="ml-1 text-charcoal/40">
                    · {job.property_snapshot.accessNotes}
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {job.quote_id && (
              <Link
                href={`/admin/quotes/${job.quote_id}`}
                className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
              >
                Quote
              </Link>
            )}
            <form action={archiveJobAction.bind(null, job.id, !job.archived_at)}>
              <button
                type="submit"
                className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold text-charcoal/45 transition-colors hover:bg-black/[0.03] hover:text-charcoal"
              >
                {job.archived_at ? "Restore" : "Archive"}
              </button>
            </form>
          </div>
        </div>

        {job.instructions && (
          <div className="mt-4 border-t border-black/5 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-charcoal/45">
              Instructions
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-charcoal/75">
              {job.instructions}
            </p>
          </div>
        )}
      </div>

      <AskClaude subject={{ kind: "job", id: job.id }} />

      <JobDetail
        jobId={job.id}
        status={job.status}
        visits={job.visits}
        lines={job.lines}
        totals={{
          subtotal: totals.subtotalCents,
          discount: totals.discountCents,
          taxes: totals.taxes,
          total: totals.totalCents,
        }}
        hasInvoice={(count ?? 0) > 0}
        statusAction={setJobStatusAction}
        addVisitAction={addVisitAction.bind(null, job.id)}
        completeVisitAction={completeVisitAction.bind(null, job.id)}
        removeVisitAction={removeVisitAction.bind(null, job.id)}
        invoiceAction={createFromJobAction.bind(null, job.id)}
      />
    </div>
  );
}
