import Link from "next/link";
import { notFound } from "next/navigation";
import AdminNotice from "@/components/admin/AdminNotice";
import FloorWorkspace from "@/components/admin/FloorWorkspace";
import { isConfigured } from "@/lib/crm/db";
import { getProject } from "@/lib/crm/projects";

export const dynamic = "force-dynamic";

/**
 * One storey of one project.
 *
 * The level is a path segment rather than a row: a floor carries no data of
 * its own beyond its name, and `room_scans.level` already records which
 * storey a room is on. So a floor exists exactly when a room says it does —
 * and this page works before that, which is what makes "add a floor plan,
 * then measure the first room" possible without a table for empty floors.
 */
export default async function FloorPage({
  params,
}: {
  params: Promise<{ id: string; level: string }>;
}) {
  const { id, level: rawLevel } = await params;
  const level = decodeURIComponent(rawLevel);

  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set the Supabase environment variables to turn this on.
      </AdminNotice>
    );
  }

  const project = await getProject(id);
  if (!project) notFound();

  return (
    <div className="space-y-3">
      <Link
        href={`/admin/projects/${project.id}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-charcoal/50 transition-colors hover:text-charcoal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {project.name}
      </Link>

      <FloorWorkspace projectId={project.id} projectName={project.name} level={level} />
    </div>
  );
}
