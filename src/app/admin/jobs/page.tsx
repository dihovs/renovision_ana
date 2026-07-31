import Link from "next/link";
import AdminNotice from "@/components/admin/AdminNotice";
import { MigrationPendingError, isConfigured } from "@/lib/crm/db";
import { listJobs, type JobListItem } from "@/lib/crm/jobs";
import { formatMoney } from "@/lib/crm/money";
import { JOB_STATUS_LABEL, type JobStatus } from "@/lib/crm/opsTypes";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<JobStatus, string> = {
  unscheduled: "bg-amber-100 text-amber-800",
  scheduled: "bg-brand-blue/[0.08] text-brand-blue",
  in_progress: "bg-violet-100 text-violet-800",
  complete: "bg-green-100 text-green-800",
  cancelled: "bg-black/[0.05] text-charcoal/50",
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = (status ?? "") as JobStatus | "";

  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set the Supabase environment variables to turn this on.
      </AdminNotice>
    );
  }

  let jobs: JobListItem[] = [];
  try {
    jobs = await listJobs({ status: filter || undefined });
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration left to run">
          Run{" "}
          <code className="font-mono text-brand-blue">
            supabase/migrations/0007_jobs_invoices.sql
          </code>{" "}
          in the Supabase SQL editor.
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
      <div className="flex flex-wrap gap-1.5">
        <Chip href="/admin/jobs" label="All" active={!filter} />
        {(Object.keys(JOB_STATUS_LABEL) as JobStatus[]).map((s) => (
          <Chip
            key={s}
            href={`/admin/jobs?status=${s}`}
            label={JOB_STATUS_LABEL[s]}
            active={filter === s}
          />
        ))}
      </div>

      {jobs.length === 0 ? (
        <AdminNotice title="No jobs yet">
          Jobs are created from approved quotes. Open an{" "}
          <Link href="/admin/quotes?status=approved" className="font-semibold text-brand-blue">
            approved quote
          </Link>{" "}
          and convert it — the line items, totals and addresses all come across.
        </AdminNotice>
      ) : (
        <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/admin/jobs/${job.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02]"
              >
                <span className="w-14 shrink-0 font-mono text-xs font-bold text-charcoal/45">
                  #{job.job_number}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-charcoal">
                    {job.title || job.client_name}
                  </span>
                  <span className="block truncate text-xs text-charcoal/55">
                    {job.title ? job.client_name : "—"}
                    {job.visit_count > 0 &&
                      ` · ${job.visit_count} visit${job.visit_count === 1 ? "" : "s"}`}
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[job.status]}`}
                >
                  {JOB_STATUS_LABEL[job.status]}
                </span>
                <span className="w-24 shrink-0 text-right text-sm font-bold tabular-nums text-charcoal">
                  {formatMoney(job.total_cents)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
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
