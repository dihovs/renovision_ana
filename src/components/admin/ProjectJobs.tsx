"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

/**
 * The jobs grouped under a project.
 *
 * Attach and detach only touch the link table — the job itself is a finished,
 * audited surface and this screen never edits it. Each row links through to
 * the job's own page, which is where anything about the job actually happens.
 */

export default function ProjectJobs({
  attached,
  attachable,
  attachAction,
  detachAction,
}: {
  attached: { id: string; jobNumber: number; title: string | null; statusLabel: string }[];
  attachable: { id: string; label: string }[];
  attachAction: (jobId: string) => Promise<void>;
  detachAction: (jobId: string) => Promise<void>;
}) {
  const [selectedJob, setSelectedJob] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="font-heading text-sm font-bold text-charcoal">Jobs</h2>
      <p className="mt-0.5 text-xs text-charcoal/50">
        The jobs that belong to this project. Attaching groups them here; the jobs themselves are
        managed on their own pages.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {attached.length === 0 ? (
        <p className="mt-3 text-sm text-charcoal/40">No jobs attached yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-black/5">
          {attached.map((job) => (
            <li key={job.id} className="flex items-center gap-3 py-2.5">
              <Link
                href={`/admin/jobs/${job.id}`}
                className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-blue hover:underline"
                title={job.title ?? undefined}
              >
                #{job.jobNumber}
                {job.title ? ` — ${job.title}` : ""}
              </Link>
              <span className="shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-charcoal/60">
                {job.statusLabel}
              </span>
              <button
                type="button"
                onClick={() => run(() => detachAction(job.id))}
                disabled={pending}
                className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs font-bold text-charcoal/35 transition-colors hover:bg-black/[0.04] hover:text-charcoal disabled:cursor-wait disabled:opacity-50"
              >
                Detach
              </button>
            </li>
          ))}
        </ul>
      )}

      {attachable.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/5 pt-3">
          <select
            value={selectedJob}
            onChange={(event) => setSelectedJob(event.target.value)}
            disabled={pending}
            aria-label="Job to attach"
            className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-charcoal outline-none transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
          >
            <option value="">Attach an existing job…</option>
            {attachable.map((job) => (
              <option key={job.id} value={job.id}>
                {job.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (!selectedJob) return;
              run(async () => {
                await attachAction(selectedJob);
                setSelectedJob("");
              });
            }}
            disabled={pending || !selectedJob}
            className="cursor-pointer rounded-lg border border-brand-blue/30 px-3 py-1.5 text-sm font-bold text-brand-blue transition-colors hover:bg-brand-blue/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Working…" : "Attach"}
          </button>
        </div>
      )}
    </section>
  );
}
