import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/adminAuth";
import { getProject } from "@/lib/crm/projects";
import { renderReportPdf } from "@/lib/report/pdf";

/**
 * `GET …/report/pdf` — the report as a file, paginated by a real browser.
 *
 * **Node, and a long one.** Chromium cannot run on the Edge runtime, and a
 * property with a dozen rooms and their photos is a genuinely large page to
 * lay out — the default 10s would kill it halfway through.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const { id } = await params;
  const query = new URL(request.url).searchParams;

  // The SAME page a reader sees, in its bare form — no nav, no buttons, no
  // option checkboxes. Rendering a second, PDF-only version of the report is
  // how the printed one and the screen one start disagreeing.
  const target = new URL(`/admin/projects/${id}/report`, request.url);
  target.searchParams.set("bare", "1");
  for (const key of ["dimensions", "layout"]) {
    const value = query.get(key);
    if (value) target.searchParams.set(key, value);
  }

  try {
    const project = await getProject(id).catch(() => null);
    const pdf = await renderReportPdf({
      url: target.toString(),
      cookieHeader: request.headers.get("cookie"),
    });

    // Named for the job, because a claim file with three files called
    // `report.pdf` in it is a claim file nobody can navigate.
    const name = (project?.name ?? "report")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60);
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${name}-${stamp}.pdf"`,
        // Never cached: the report is generated from live measurements, and
        // a stale one is a document that disagrees with the job.
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("[report] could not render the PDF:", error);
    return NextResponse.json(
      { error: `Could not build the PDF: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}
