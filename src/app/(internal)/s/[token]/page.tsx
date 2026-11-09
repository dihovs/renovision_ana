import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReportDocument from "@/components/admin/ReportDocument";
import { getProject } from "@/lib/crm/projects";
import { projectForShareToken } from "@/lib/crm/shareLinks";
import { loadReportData } from "@/lib/report/loadReport";
import { reportLocale } from "@/lib/report/strings";
import "../../admin/projects/[id]/report/report.css";

/**
 * Get Shareable Link — the view-only report a link opens (migration 0059).
 *
 * The token is the credential; there is no session. What it shows was the
 * owner's call to delegate ("you decide", 9 Nov 2026), so it is the narrow
 * reading: the plans, measurements, damage and photos an adjuster or
 * another trade needs, and nothing that identifies or prices the job —
 * no client, no claim or policy numbers, no project name or description
 * (both are often the client's own name), no priced lines. The property
 * address stays: it is what the report is a report OF.
 *
 * Unknown, revoked and expired tokens are all the same 404.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SharedReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const projectId = await projectForShareToken(token);
  if (!projectId) notFound();
  const project = await getProject(projectId);
  if (!project) notFound();

  const { company, property, rooms, levels, equipment, floorWalls } = await loadReportData(project);
  const locale = reportLocale(query.lang);

  return (
    <div className="report-shell">
      <ReportDocument
        data={{
          company,
          project: {
            name: property ?? (locale === "fr" ? "Relevé de la propriété" : "Property survey"),
            description: null,
            started_on: project.started_on,
          },
          client: null,
          property,
          claimFields: [],
          claim: {},
          levels,
          floorWalls,
          rooms,
          equipment,
          generatedAt: new Date().toISOString(),
          onlyLockedDimensions: false,
          layout: "full" as const,
          locale,
        }}
      />
    </div>
  );
}
