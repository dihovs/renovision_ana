import { NextResponse } from "next/server";
import { db } from "@/lib/crm/db";

/**
 * The retention policy, actually executed.
 *
 * Both purge functions have existed since their migrations — leads since 0001,
 * calls since 0009 — and both carry the same warning: an unscheduled policy
 * nobody executes is the same as no policy. The published privacy policy
 * promises that enquiries which never became work are deleted after 24 months.
 * A promise the system doesn't keep is worse than no promise, because it reads
 * as a decision rather than an oversight.
 *
 * Runs daily via Vercel cron (see vercel.json). Deleting nothing is the normal
 * outcome for the first two years — the point is that the day a row ages out,
 * something is actually there to remove it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel sends `Authorization: Bearer ${CRON_SECRET}` when the env var is
  // set. Refuse when it isn't: an open endpoint that deletes data — even data
  // the policy says to delete — should not be triggerable by whoever finds
  // the URL, if only because each hit costs a database round trip.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[retention] CRON_SECRET is not set — refusing to run");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = db();
  if (!client) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  // Each purge reported independently: the calls table may not exist yet if
  // migration 0009 hasn't run, and that must not stop the leads purge from
  // keeping its own promise.
  const results: Record<string, string> = {};

  for (const fn of ["purge_stale_leads", "purge_stale_calls"] as const) {
    const { data, error } = await client.rpc(fn);
    if (error) {
      results[fn] = `skipped: ${error.message}`;
      console.warn(`[retention] ${fn} failed:`, error.message);
    } else {
      results[fn] = `removed ${data ?? 0}`;
      if (Number(data) > 0) console.log(`[retention] ${fn} removed ${data} rows`);
    }
  }

  return NextResponse.json({ ok: true, results, ranAt: new Date().toISOString() });
}
