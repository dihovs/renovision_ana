import { notFound } from "next/navigation";
import AdminNotice from "@/components/admin/AdminNotice";
import ReportDocument, { type ReportRoom } from "@/components/admin/ReportDocument";
import PrintButton from "@/components/admin/PrintButton";
import { isConfigured } from "@/lib/crm/db";
import { getProject, listRoomFiles, signProjectFileUrls } from "@/lib/crm/projects";
import { listRoomScans } from "@/lib/crm/roomScans";
import { listAffectedAreas } from "@/lib/crm/affectedAreas";
import { listEquipment, listMoistureReadings } from "@/lib/crm/dryingLog";
import { CLAIM_FIELD_TEMPLATE, getCompany, getCustomFields } from "@/lib/crm/settings";
import type { RoomScanResult } from "@/lib/roomScan";
import "./report.css";

export const dynamic = "force-dynamic";

/**
 * The restoration report for one project.
 *
 * A page rather than a generated file: it prints to PDF through the browser,
 * which is how the report it is meant to beat is made, and unlike a PDF it
 * can be opened on a phone at the kitchen table.
 *
 * Every section degrades on its own. A project with no scans still produces a
 * cover and a claim summary; a project with no equipment simply has no
 * equipment page. Nothing here refuses to render because one part of the file
 * is missing, because a half-documented job is exactly when a report is
 * needed most.
 */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set the Supabase environment variables to turn this on.
      </AdminNotice>
    );
  }

  const project = await getProject(id);
  if (!project) notFound();

  const company = await getCompany();

  let claimFields = CLAIM_FIELD_TEMPLATE;
  try {
    const configured = (await getCustomFields()).project;
    if (configured.length > 0) claimFields = configured;
  } catch {
    // The template is a fine default; a settings failure is not a reason to
    // withhold the report.
  }

  // Each of these can be absent — a migration not yet run, a job with no
  // drying — and each failure narrows the report rather than breaking it.
  const scans = await listRoomScans(project.id).catch(() => []);
  const equipment = await listEquipment(project.id).catch(() => []);

  const rooms: ReportRoom[] = await Promise.all(
    scans.map(async (scan) => {
      const [areas, readings, files] = await Promise.all([
        listAffectedAreas(scan.id).catch(() => []),
        listMoistureReadings(scan.id).catch(() => []),
        listRoomFiles(scan.id).catch(() => []),
      ]);
      const urls = await signProjectFileUrls(files.map((file) => file.storage_path)).catch(
        () => ({}) as Record<string, string>,
      );

      return {
        id: scan.id,
        name: scan.name,
        level: scan.level,
        floorAreaSqm: Number(scan.floor_area_sqm),
        wallLengthM: Number(scan.wall_length_m),
        ceilingHeightM: Number(scan.ceiling_height_m),
        stairCount: scan.stair_count,
        notes: scan.notes,
        geometry: scan.geometry as unknown as RoomScanResult,
        areas,
        // Oldest first here, unlike the phone: a drying log reads as a
        // sequence, and a curve printed backwards has to be read backwards.
        readings: [...readings].reverse(),
        photos: files.slice(0, 6).map((file) => ({
          id: file.id,
          url: urls[file.storage_path] ?? null,
          note: file.note,
        })),
      };
    }),
  );

  const levels: string[] = [];
  for (const room of rooms) if (!levels.includes(room.level)) levels.push(room.level);

  // The address of the loss, which is a claim field rather than a project
  // column — a landlord's claim is for a property they do not live at.
  const claim = (project.custom ?? {}) as Record<string, string>;
  const property = claim.loss_address?.trim() || null;

  return (
    <div className="report-shell">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-lg font-bold text-charcoal">Report</h1>
          <p className="text-sm text-charcoal/50">
            {rooms.length} room{rooms.length === 1 ? "" : "s"} · {levels.length} floor
            {levels.length === 1 ? "" : "s"}
            {equipment.length > 0 && ` · ${equipment.length} equipment record${equipment.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <PrintButton />
      </div>

      <ReportDocument
        data={{
          company,
          project: {
            name: project.name,
            description: project.description,
            started_on: project.started_on,
          },
          client: project.client ? { name: project.client.name } : null,
          property,
          claimFields,
          claim,
          levels,
          rooms,
          equipment,
          generatedAt: new Date().toISOString(),
        }}
      />
    </div>
  );
}
