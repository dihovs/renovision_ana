import Link from "next/link";
import AdminNotice from "@/components/admin/AdminNotice";
import ProjectStatusPill from "@/components/admin/ProjectStatusPill";
import { isConfigured, MigrationPendingError } from "@/lib/crm/db";
import {
  listProjects,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUSES,
  type ProjectListItem,
  type ProjectStatus,
} from "@/lib/crm/projects";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  });
}

export default async function ProjectsPage({
  searchParams,
}: {
  // Async in this version of Next — awaiting is required, not optional.
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = PROJECT_STATUSES.includes(status as ProjectStatus)
    ? (status as ProjectStatus)
    : "";

  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set <code className="font-mono text-brand-blue">SUPABASE_URL</code> and{" "}
        <code className="font-mono text-brand-blue">SUPABASE_SERVICE_ROLE_KEY</code> to turn this
        on.
      </AdminNotice>
    );
  }

  let projects: ProjectListItem[] = [];
  try {
    projects = await listProjects({ status: filter || undefined });
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration left to run">
          Open the Supabase SQL editor and run{" "}
          <code className="font-mono text-brand-blue">
            supabase/migrations/0015_projects.sql
          </code>
          . This screen fills itself in as soon as the tables exist — nothing else needs
          deploying.
        </AdminNotice>
      );
    }
    return (
      <AdminNotice title="Could not reach the database">
        {err instanceof Error ? err.message : "Unknown error"}. If the project has been idle for
        over a week it may be paused — open the Supabase dashboard to resume it.
      </AdminNotice>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 flex-wrap gap-1.5">
          <Chip href="/admin/projects" label="All" active={!filter} />
          {PROJECT_STATUSES.map((s) => (
            <Chip
              key={s}
              href={`/admin/projects?status=${s}`}
              label={PROJECT_STATUS_LABEL[s]}
              active={filter === s}
            />
          ))}
        </div>

        <Link
          href="/admin/projects/new"
          className="shrink-0 rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90"
        >
          New project
        </Link>
      </div>

      {projects.length === 0 ? (
        <AdminNotice title={filter ? "Nothing in this state" : "No projects yet"}>
          {filter ? (
            <>
              No {PROJECT_STATUS_LABEL[filter as ProjectStatus].toLowerCase()} projects.{" "}
              <Link href="/admin/projects" className="font-semibold text-brand-blue">
                See all projects
              </Link>
              .
            </>
          ) : (
            <>
              A project is the folder above jobs — &ldquo;Dubois basement renovation&rdquo; with
              its photos, permits, contracts and receipts all in one place. Create the first one
              from the button above.
            </>
          )}
        </AdminNotice>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/admin/projects/${project.id}`}
                className="block h-full rounded-xl border border-black/5 bg-white p-4 shadow-sm transition-colors hover:border-brand-blue/25"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="min-w-0 truncate text-sm font-bold text-charcoal"
                    title={project.name}
                  >
                    {project.name}
                  </span>
                  <ProjectStatusPill status={project.status} />
                </div>
                <span className="mt-0.5 block truncate text-xs text-charcoal/55">
                  {project.client_name ?? "No client"}
                </span>
                <span className="mt-3 block text-xs text-charcoal/45">
                  {project.file_count} file{project.file_count === 1 ? "" : "s"} · updated{" "}
                  {formatDate(project.last_activity)}
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
