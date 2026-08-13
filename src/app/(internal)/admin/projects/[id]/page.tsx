import Link from "next/link";
import { notFound } from "next/navigation";
import {
  attachJobAction,
  deleteProjectFileAction,
  detachJobAction,
  setProjectStatusAction,
} from "../actions";
import AdminNotice from "@/components/admin/AdminNotice";
import ProjectFiles from "@/components/admin/ProjectFiles";
import ProjectJobs from "@/components/admin/ProjectJobs";
import ProjectStatusButtons from "@/components/admin/ProjectStatusButtons";
import ProjectStatusPill from "@/components/admin/ProjectStatusPill";
import FloorPlanSection from "@/components/admin/FloorPlanSection";
import { squareMetersToSquareFeet } from "@/lib/roomScan";
import { isConfigured, MigrationPendingError } from "@/lib/crm/db";
import { formatMoney } from "@/lib/crm/money";
import { JOB_STATUS_LABEL, type JobStatus } from "@/lib/crm/opsTypes";
import { QUOTE_STATUS_LABEL, type QuoteStatus } from "@/lib/crm/quoteTypes";
import {
  getProject,
  getProjectSurvey,
  listAttachableJobs,
  MAX_PROJECT_FILE_BYTES,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUSES,
  signProjectFileUrls,
  type ProjectDetail,
  type ProjectSurvey,
} from "@/lib/crm/projects";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  // started_on is a bare date; rendering it through a timezone would shift it
  // to the previous evening. Timestamps get America/Toronto as usual.
  const bareDate = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return new Date(bareDate ? `${iso}T12:00:00` : iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(bareDate ? {} : { timeZone: "America/Toronto" }),
  });
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set the Supabase environment variables to turn this on.
      </AdminNotice>
    );
  }

  let project: ProjectDetail | null;
  try {
    project = await getProject(id);
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration left to run">
          Run{" "}
          <code className="font-mono text-brand-blue">
            supabase/migrations/0015_projects.sql
          </code>{" "}
          in the Supabase SQL editor.
        </AdminNotice>
      );
    }
    throw err;
  }

  if (!project) notFound();

  // Jobs the picker can offer. If the jobs tables are somehow absent the
  // section simply offers nothing — grouping is a convenience, not a wall.
  let attachable: { id: string; label: string }[] = [];
  try {
    attachable = await listAttachableJobs(project.jobs.map((job) => job.id));
  } catch {
    attachable = [];
  }

  // Null means the scans table isn't reachable yet (migration 0024), which
  // is different from a property nobody has measured — the first hides the
  // survey entirely, the second shows it empty with a prompt to scan.
  let survey: ProjectSurvey | null = null;
  try {
    survey = await getProjectSurvey(project.id);
  } catch {
    survey = null;
  }

  // Signed per request, same as lead photos — never persisted.
  const urls = await signProjectFileUrls(project.files.map((file) => file.storage_path));
  const files = project.files.map((file) => ({
    id: file.id,
    filename: file.filename,
    size_bytes: file.size_bytes,
    content_type: file.content_type,
    note: file.note,
    uploaded_at: file.uploaded_at,
    url: urls[file.storage_path] ?? null,
  }));

  const attached = project.jobs.map((job) => ({
    id: job.id,
    jobNumber: job.job_number,
    title: job.title,
    statusLabel: JOB_STATUS_LABEL[job.status as JobStatus] ?? job.status,
  }));

  return (
    <div className="space-y-4">
      <Link
        href="/admin/projects"
        className="inline-flex items-center gap-1 text-sm font-semibold text-charcoal/50 transition-colors hover:text-charcoal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Projects
      </Link>

      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-bold text-charcoal">{project.name}</h2>
            <p className="text-sm text-charcoal/55">
              {project.client ? (
                <Link
                  href={`/admin/clients/${project.client.id}`}
                  className="font-medium text-brand-blue hover:underline"
                >
                  {project.client.name}
                </Link>
              ) : (
                "No client"
              )}
            </p>
          </div>
          <ProjectStatusPill status={project.status} />
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-black/5 pt-4 sm:grid-cols-3">
          <Row label="Started">
            {project.started_on ? (
              formatDate(project.started_on)
            ) : (
              <span className="text-charcoal/35">—</span>
            )}
          </Row>
          <Row label="Created">{formatDate(project.created_at)}</Row>
          <Row label="Files">
            {files.length} file{files.length === 1 ? "" : "s"}
          </Row>
        </dl>

        {project.description && (
          <div className="mt-4 border-t border-black/5 pt-4">
            <span className="text-xs font-semibold text-charcoal/70">Description</span>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-charcoal/75">
              {project.description}
            </p>
          </div>
        )}
      </div>

      {/* Statistics, then floor plans — the survey comes before the
          paperwork, because on a restoration job the measurements are what
          every other number on the page is derived from. */}
      {survey && (
        <>
          <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-heading text-sm font-bold text-charcoal">Statistics</h2>
            {survey.rooms.length === 0 ? (
              <p className="mt-2 text-sm text-charcoal/45">
                Nothing measured yet. Add a floor plan below, then measure the
                rooms on it — the figures land here.
              </p>
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                <Stat
                  label="Floor area"
                  value={fmt(squareMetersToSquareFeet(survey.floorAreaSqm))}
                  unit="sq ft"
                />
                <Stat
                  label="Wall area"
                  value={fmt(squareMetersToSquareFeet(survey.wallAreaSqm))}
                  unit="sq ft"
                />
                <Stat label="Floors" value={String(survey.levels.length)} />
                <Stat label="Rooms" value={String(survey.rooms.length)} />
              </dl>
            )}
          </section>
        </>
      )}

      {/* Floor plans — the way IN to measuring the property, not a
          read-only summary. Client-side because a floor that has been
          created but not yet scanned lives on the device until a room
          makes it real. */}
      <FloorPlanSection
        projectId={project.id}
        measured={survey?.levels ?? []}
        rooms={survey?.rooms ?? []}
        migrationPending={survey === null}
      />

      <ProjectStatusButtons
        current={project.status}
        options={PROJECT_STATUSES.map((status) => ({
          value: status,
          label: PROJECT_STATUS_LABEL[status],
        }))}
        statusAction={setProjectStatusAction.bind(null, project.id)}
      />

      {/* The other half of "project → estimate → job → invoice" — jobs
          below already show which of these converted; this shows the
          estimates themselves, including ones still awaiting a decision. */}
      <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-bold text-charcoal">Estimates</h2>
          {project.client && (
            <Link
              href={`/admin/quotes/new?project=${project.id}&client=${project.client.id}`}
              className="cursor-pointer rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-brand-blue/90"
            >
              New estimate
            </Link>
          )}
        </div>

        {project.quotes.length === 0 ? (
          <p className="mt-3 text-sm text-charcoal/40">
            {project.client
              ? "Nothing yet — build the first estimate for this project."
              : "This project has no client, so an estimate can't be addressed to anybody yet."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-black/5">
            {project.quotes.map((quote) => (
              <li key={quote.id}>
                <Link
                  href={`/admin/quotes/${quote.id}`}
                  className="flex items-center gap-3 py-2.5 transition-colors hover:bg-black/[0.02]"
                >
                  <span className="w-14 shrink-0 font-mono text-xs font-bold text-charcoal/45">
                    #{quote.quote_number}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-charcoal">
                    {quote.title || "Untitled estimate"}
                  </span>
                  <span className="shrink-0 rounded-full bg-brand-blue/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-blue">
                    {QUOTE_STATUS_LABEL[quote.status as QuoteStatus] ?? quote.status}
                  </span>
                  <span className="w-24 shrink-0 text-right text-sm font-bold tabular-nums text-charcoal">
                    {formatMoney(quote.total_cents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProjectFiles
        projectId={project.id}
        files={files}
        maxBytes={MAX_PROJECT_FILE_BYTES}
        deleteAction={deleteProjectFileAction.bind(null, project.id)}
      />

      <ProjectJobs
        attached={attached}
        attachable={attachable}
        attachAction={attachJobAction.bind(null, project.id)}
        detachAction={detachJobAction.bind(null, project.id)}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-charcoal/70">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-charcoal/80">{children}</dd>
    </div>
  );
}

/** One figure in the statistics band. */
function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-charcoal/45">{label}</dt>
      <dd className="mt-0.5 font-heading text-xl font-bold tabular-nums text-charcoal">
        {value}
        {unit && <span className="ml-1 text-xs font-semibold text-charcoal/50">{unit}</span>}
      </dd>
    </div>
  );
}

/** Whole numbers: a square-foot figure with decimals reads as false precision
    on a measurement that is already accurate to a few centimetres. */
function fmt(value: number): string {
  return Math.round(value).toLocaleString("en-CA");
}
