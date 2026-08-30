import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/adminAuth";
import { MigrationPendingError } from "@/lib/crm/db";
import { listInvoicesForExport } from "@/lib/crm/invoices";
import { invoicesToQuickBooksCsv } from "@/lib/crm/quickbooksCsv";

/**
 * Download issued invoices as a QuickBooks Online import file.
 *
 *   GET /api/v1/invoices/quickbooks?from=2026-01-01&to=2026-08-30
 *
 * Not wrapped in `guarded` because that helper answers JSON and this answers a
 * file — but it makes the same session check, for the same reason: a route
 * handler is a public endpoint and the admin layout protects pages only.
 *
 * Warnings are deliberately not returned here. A CSV body cannot carry them
 * without corrupting the import, and a header nobody reads is not a warning.
 * The /admin/invoices/export screen runs the same builder and shows them
 * before this file is ever downloaded.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return NextResponse.json(
      { error: "Give a from and to date, both as YYYY-MM-DD." },
      { status: 400 },
    );
  }
  if (from > to) {
    return NextResponse.json({ error: "The from date is after the to date." }, { status: 400 });
  }

  try {
    const { csv } = invoicesToQuickBooksCsv(await listInvoicesForExport({ from, to }));

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="renovision-invoices-${from}-to-${to}.csv"`,
        // An accounting export must never come off a CDN edge. Yesterday's
        // file with today's filename is the kind of thing that gets found in
        // a year, in a tax audit.
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return NextResponse.json({ error: err.message, migrationPending: true }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Something went wrong.";
    console.error("[api/v1] QuickBooks export failed:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
