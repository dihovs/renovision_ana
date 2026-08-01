import { NextResponse } from "next/server";
import { db } from "@/lib/crm/db";
import { runQuoteFollowups, runInvoiceReminders } from "@/lib/crm/followups";

/**
 * Automated follow-ups, on a schedule.
 *
 * Daily via Vercel cron (see vercel.json), a few hours after the retention
 * run so the two never contend — and at 13:00 UTC, which is morning in
 * Toronto: a payment reminder that lands at 3 a.m. reads very differently
 * from one that lands with the first coffee.
 *
 * The rules and the idempotency story live in src/lib/crm/followups.ts; the
 * schema that enforces exactly-once is migration 0013. This route is only the
 * gate and the report.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel sends `Authorization: Bearer ${CRON_SECRET}` when the env var is
  // set. Refuse when it isn't: an open endpoint that emails customers is a
  // spam cannon for whoever finds the URL.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[followups] CRON_SECRET is not set — refusing to run");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = db();
  if (!client) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  // Each category reported independently, same convention as the retention
  // cron: a failure sweeping quotes must not stop overdue invoices from being
  // chased, and vice versa. Each summary carries its own "skipped: migration
  // 0013 not run" when the followup_log table is missing.
  const results: Record<string, unknown> = {};

  for (const [name, run] of [
    ["quote_followups", runQuoteFollowups],
    ["invoice_reminders", runInvoiceReminders],
  ] as const) {
    try {
      results[name] = await run();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results[name] = `failed: ${message}`;
      console.error(`[followups] ${name} failed:`, message);
    }
  }

  return NextResponse.json({ ok: true, results, ranAt: new Date().toISOString() });
}
