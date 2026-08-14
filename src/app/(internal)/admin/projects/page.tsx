import Link from "next/link";
import AdminNotice from "@/components/admin/AdminNotice";
import FloorPlan from "@/components/admin/FloorPlan";
import ProjectStatusPill from "@/components/admin/ProjectStatusPill";
import { squareMetersToSquareFeet, type RoomScanResult } from "@/lib/roomScan";
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
      </div>

      {/* A grid of plans, not a list of names. A property is recognised by
          its shape long before its title — which is why every scanning app
          leads with the drawing and why this card is mostly thumbnail. The
          "New project" tile sits first in the grid rather than off in a
          toolbar, so starting one is the same gesture as opening one. */}
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <li>
          <Link
            href="/admin/projects/new"
            className="flex h-full min-h-[11rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/15 text-charcoal/45 transition-colors hover:border-brand-blue/40 hover:text-brand-blue"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-bold">New project</span>
          </Link>
        </li>

        {projects.map((project) => (
          <li key={project.id}>
            <Link
              href={`/admin/projects/${project.id}`}
              className="block h-full overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative flex h-32 items-center justify-center bg-[#f7f7f8] p-2">
                {project.largest_room ? (
                  <FloorPlan
                    result={project.largest_room.geometry as unknown as RoomScanResult}
                    name={project.largest_room.name}
                    variant="thumb"
                  />
                ) : (
                  <DocumentGlyph />
                )}
                <span className="absolute right-2 top-2">
                  <ProjectStatusPill status={project.status} />
                </span>
              </div>

              <div className="border-t border-black/5 p-3">
                <span
                  className="block truncate text-sm font-bold text-charcoal"
                  title={project.name}
                >
                  {project.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-charcoal/55">
                  {project.client_name ?? "No client"}
                </span>
                <span className="mt-1.5 block truncate text-[11px] text-charcoal/40">
                  {project.room_count > 0
                    ? `${Math.round(squareMetersToSquareFeet(project.floor_area_sqm)).toLocaleString("en-CA")} sq ft · ${project.room_count} room${project.room_count === 1 ? "" : "s"}`
                    : `${project.file_count} file${project.file_count === 1 ? "" : "s"}`}
                  {" · "}
                  {formatDate(project.last_activity)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {projects.length === 0 && (
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
              its scans, photos, permits, contracts and receipts all in one place.
            </>
          )}
        </AdminNotice>
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

/** Stands in for a plan on a project nobody has scanned yet — the same
    placeholder idea a scanning app uses, rather than an empty grey box. */
function DocumentGlyph() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c7c7cc" strokeWidth="1.5" aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
    </svg>
  );
}
