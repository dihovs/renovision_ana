import Link from "next/link";
import AdminNotice from "@/components/admin/AdminNotice";
import { MigrationPendingError, isConfigured } from "@/lib/crm/db";
import { listJobs, type JobListItem } from "@/lib/crm/jobs";
import { formatMoney } from "@/lib/crm/money";
import { JOB_STATUS_LABEL, type JobStatus } from "@/lib/crm/opsTypes";

export const dynamic = "force-dynamic";

/**
 * Jobs, as cards, natively — the same data `/admin/jobs` shows as a dense
 * table, reshaped for a screen held in one hand rather than a desk.
 *
 * Each card is everything the phase brief asked a job to hold in one place —
 * client, address, estimate, and a signal for photos and message activity —
 * without the counts pretending to be the thread itself. Tap through to
 * `/admin/jobs/[id]` for the real thing: the WhatsApp history, the estimate
 * breakdown, and — now — Call and Text right there in the header.
 */

const STATUS_STYLE: Record<JobStatus, string> = {
  unscheduled: "bg-amber-100 text-amber-800",
  scheduled: "bg-brand-blue/[0.08] text-brand-blue",
  in_progress: "bg-violet-100 text-violet-800",
  complete: "bg-green-100 text-green-800",
  cancelled: "bg-black/[0.05] text-charcoal/50",
};

export default async function JobCardsPage({
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
    <div className="space-y-4 pb-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <Chip href="/admin/jobs/cards" label="All" active={!filter} />
        {(Object.keys(JOB_STATUS_LABEL) as JobStatus[]).map((s) => (
          <Chip
            key={s}
            href={`/admin/jobs/cards?status=${s}`}
            label={JOB_STATUS_LABEL[s]}
            active={filter === s}
          />
        ))}
      </div>

      {jobs.length === 0 ? (
        <AdminNotice title="No jobs yet">
          Jobs are created from approved quotes.
        </AdminNotice>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </ul>
      )}
    </div>
  );
}

function JobCard({ job }: { job: JobListItem }) {
  const address = job.property_snapshot
    ? [job.property_snapshot.street1, job.property_snapshot.city].filter(Boolean).join(", ")
    : null;

  return (
    <li>
      <Link
        href={`/admin/jobs/${job.id}`}
        className="block rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition-transform active:scale-[0.98]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-bold text-charcoal/40">#{job.job_number}</span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[job.status]}`}
          >
            {JOB_STATUS_LABEL[job.status]}
          </span>
        </div>

        <p className="mt-1.5 truncate text-base font-bold text-charcoal" title={job.title || job.client_name}>
          {job.title || job.client_name}
        </p>
        <p className="truncate text-sm text-charcoal/55" title={job.client_name}>
          {job.client_name}
        </p>
        {address && (
          <p className="mt-0.5 truncate text-sm text-charcoal/45" title={address}>
            {address}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3">
          <span className="font-heading text-lg font-bold text-charcoal">
            {formatMoney(job.total_cents)}
          </span>
          <div className="flex items-center gap-3 text-xs font-semibold text-charcoal/45">
            {job.visit_count > 0 && <CountBadge icon={<CalendarIcon />} count={job.visit_count} />}
            {job.photo_count > 0 && <CountBadge icon={<PhotoIcon />} count={job.photo_count} />}
            {job.message_count > 0 && <CountBadge icon={<ChatIcon />} count={job.message_count} />}
          </div>
        </div>
      </Link>
    </li>
  );
}

function CountBadge({ icon, count }: { icon: React.ReactNode; count: number }) {
  return (
    <span className="flex items-center gap-1">
      {icon}
      {count}
    </span>
  );
}

function Chip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
        active ? "bg-brand-blue text-white" : "bg-white text-charcoal/60 shadow-sm hover:text-charcoal"
      }`}
    >
      {label}
    </Link>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 16l-5-5-4 4-2-2-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 11.5a8.4 8.4 0 0 1-1.3 4.5L21 20l-4.2-1.3a8.4 8.4 0 1 1 4.2-7.2Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
