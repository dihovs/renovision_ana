import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/adminAuth";
import { listPriceBook } from "@/lib/crm/priceBook";

/**
 * Price book search, for the quote builder's item picker.
 *
 * Behind the admin session: this returns internal COST figures, which is
 * exactly the data that must never be reachable from the public site.
 */
export async function GET(request: Request) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ items: [] });

  try {
    const items = await listPriceBook({ search: query, limit: 12 });
    return NextResponse.json({ items });
  } catch {
    // The picker degrades to a plain text field, which still produces a valid
    // line — so a price book that isn't set up yet must not break quoting.
    return NextResponse.json({ items: [] });
  }
}
