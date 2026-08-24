import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/adminAuth";
import { getProject } from "@/lib/crm/projects";
import { renderReportPdf } from "@/lib/report/pdf";

/**
 * `GET …/estimate/pdf` — the insurance estimate as a file, paginated by a
 * real browser, exactly the report's own mechanism: the SAME page the
 * operator previews, so the file and the screen cannot disagree.
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
  const target = new URL(`/admin/projects/${id}/estimate/print`, request.url);

  try {
    const project = await getProject(id).catch(() => null);
    const pdf = await renderReportPdf({
      url: target.toString(),
      cookieHeader: request.headers.get("cookie"),
    });

    const name = (project?.name ?? "estimate")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60);
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${name}-estimation-${stamp}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("[estimate] could not render the PDF:", error);
    return NextResponse.json(
      { error: `Could not build the PDF: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}
