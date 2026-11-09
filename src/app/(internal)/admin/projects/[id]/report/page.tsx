import Link from "next/link";
import { notFound } from "next/navigation";
import AdminNotice from "@/components/admin/AdminNotice";
import ReportDocument from "@/components/admin/ReportDocument";
import { isConfigured } from "@/lib/crm/db";
import { getProject } from "@/lib/crm/projects";
import { loadReportData } from "@/lib/report/loadReport";
import { reportLocale } from "@/lib/report/strings";
import "./report.css";

export const dynamic = "force-dynamic";

/**
 * The report's own query string, built rather than concatenated.
 *
 * The links below used to glue `?` and `&` on by hand with a ternary per
 * option — readable with two options, wrong with three, and the kind of
 * wrong that produces a URL the page silently ignores. One place decides
 * where the `?` goes.
 */
function reportQuery(options: {
  dimensions: boolean;
  /** `floors`, `noplans`, or nothing for the full document. */
  layout: string | null;
}): string {
  const parts: string[] = [];
  if (options.dimensions) parts.push("dimensions=locked");
  if (options.layout) parts.push(`layout=${options.layout}`);
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}

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
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  // A search param rather than client state: the whole page is server
  // rendered for print, and a URL that says what the document shows is a
  // URL that can be shared showing the same thing.
  // `params` is already taken by the route's own id, so the query gets its
  // own name rather than shadowing it.
  const query = await searchParams;
  const onlyLockedDimensions = query.dimensions === "locked";
  // The reference's third export layout, which had never been generated.
  const floorsOnly = query.layout === "floors";
  // Its mirror image: every drawing removed, everything else kept. See the
  // `layout` doc on `ReportData` for why a report sometimes has to carry
  // only the photographs and the priced lines.
  const noPlans = query.layout === "noplans";
  // The document alone, no app chrome — so any way of turning this into a
  // PDF produces the same clean pages.
  const bare = query.bare === "1";
  // **The language of the document, not of the app.** He runs the app in
  // English and his clients read French, so this is a property of the export
  // rather than a setting — chosen in the export sheet, carried in the URL,
  // and defaulting to French because that is the version a Québec job needs
  // to have.
  const locale = reportLocale(query.lang);

  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set the Supabase environment variables to turn this on.
      </AdminNotice>
    );
  }

  const project = await getProject(id);
  if (!project) notFound();

  const { company, claimFields, claim, property, rooms, levels, equipment, floorWalls } =
    await loadReportData(project);

  return (
    <div className={bare ? "report-shell report-bare" : "report-shell"}>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-lg font-bold text-charcoal">Report</h1>
          <p className="text-sm text-charcoal/50">
            {rooms.length} room{rooms.length === 1 ? "" : "s"} · {levels.length} floor
            {levels.length === 1 ? "" : "s"}
            {equipment.length > 0 && ` · ${equipment.length} equipment record${equipment.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {/* THE button, not one of three. It hands back the same document
            every time, laid out by a real browser on the server — see
            lib/report/pdf.ts for why that had to stop depending on which
            export route the reader happened to use. */}
        <a
          href={`/admin/projects/${project.id}/report/pdf${reportQuery({
            dimensions: onlyLockedDimensions,
            layout: floorsOnly ? "floors" : noPlans ? "noplans" : null,
          })}`}
          className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90"
        >
          Download PDF
        </a>
      </div>

      {/* Report options. A link rather than client state: toggling reloads
          with the option in the URL, so what prints is what the URL says. */}
      <div className="no-print mb-4">
        <Link
          href={
            onlyLockedDimensions
              ? `/admin/projects/${project.id}/report`
              : `/admin/projects/${project.id}/report?dimensions=locked`
          }
          className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-charcoal transition-colors hover:border-brand-blue/40"
        >
          <span
            aria-hidden
            className={`flex h-4 w-4 items-center justify-center rounded border ${
              onlyLockedDimensions
                ? "border-brand-blue bg-brand-blue text-white"
                : "border-black/20 bg-white"
            }`}
          >
            {onlyLockedDimensions && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          Only dimensions that have been manually set
        </Link>
        {onlyLockedDimensions && (
          <p className="mt-1.5 text-xs leading-snug text-charcoal/50">
            Each plan shows just the padlocked, hand-set dimensions. Rooms
            where nothing was set by hand print without dimensions.
          </p>
        )}

        {/* Their third layout. Its own link rather than a mode switch on
            the first: the two options are independent, and an adjuster can
            want hand-set dimensions on a floors-only sheet. */}
        <div className="mt-2">
          <Link
            href={`/admin/projects/${project.id}/report${reportQuery({
              dimensions: onlyLockedDimensions,
              layout: floorsOnly ? null : "floors",
            })}`}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-charcoal transition-colors hover:border-brand-blue/40"
          >
            <span
              aria-hidden
              className={`flex h-4 w-4 items-center justify-center rounded border ${
                floorsOnly
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-black/20 bg-white"
              }`}
            >
              {floorsOnly && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            Only floors
          </Link>
          {floorsOnly && (
            <p className="mt-1.5 text-xs leading-snug text-charcoal/50">
              The cover, the storey plans and the signature. No room pages and
              no photographs — for an adjuster who asked for the drawings.
            </p>
          )}
        </div>

        {/* The opposite trim, and the two are mutually exclusive by
            construction — one `layout`, three values — because a report
            cannot be both all drawings and none. */}
        <div className="mt-2">
          <Link
            href={`/admin/projects/${project.id}/report${reportQuery({
              dimensions: onlyLockedDimensions,
              layout: noPlans ? null : "noplans",
            })}`}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-charcoal transition-colors hover:border-brand-blue/40"
          >
            <span
              aria-hidden
              className={`flex h-4 w-4 items-center justify-center rounded border ${
                noPlans
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-black/20 bg-white"
              }`}
            >
              {noPlans && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            No floor plans
          </Link>
          {noPlans && (
            <p className="mt-1.5 text-xs leading-snug text-charcoal/50">
              Photographs, figures and the priced lines. No storey plans, no
              room drawings, no wall elevations — for a file where every
              figure has to be one somebody measured rather than traced.
            </p>
          )}
        </div>
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
          // Every storey's wall widths, stated or default (migration 0058).
          floorWalls,
          rooms,
          equipment,
          generatedAt: new Date().toISOString(),
          onlyLockedDimensions,
          layout: floorsOnly
            ? ("onlyFloors" as const)
            : noPlans
              ? ("noPlans" as const)
              : ("full" as const),
          locale,
        }}
      />
    </div>
  );
}
