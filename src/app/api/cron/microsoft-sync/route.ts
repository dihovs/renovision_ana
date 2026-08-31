import { NextResponse } from "next/server";
import { syncMailMessages } from "@/lib/microsoft/mail";
import { syncTeamsMessages } from "@/lib/microsoft/teams";

/**
 * Pull the owner's Microsoft data into the CRM, on a schedule. (ANA-05)
 *
 * Every 15 minutes via Vercel cron, same cadence as the outbound dialer. Teams
 * today; the mail sync (ANA-06) joins this route rather than getting its own —
 * one schedule, one report, one place to look when "why is Ana behind" comes up.
 *
 * Runs and reports even when Microsoft is not connected yet: "no Graph access"
 * is an ordinary state during setup, not an error, and the report saying so
 * beats a log line saying nothing.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel sends `Authorization: Bearer ${CRON_SECRET}` when the env var is
  // set. Refuse when it isn't: this endpoint reaches Microsoft as the owner.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[microsoft-sync] CRON_SECRET is not set — refusing to run");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Sequential, not parallel: both talk to the same tenant, and Graph
  // throttling is per-app — two syncs racing each other is how both get 429s.
  const teams = await syncTeamsMessages();
  if (teams.errors?.length) {
    console.error("[microsoft-sync] teams sync errors:", teams.errors.join(" | "));
  }
  const mail = await syncMailMessages();
  if (mail.errors?.length) {
    console.error("[microsoft-sync] mail sync errors:", mail.errors.join(" | "));
  }

  return NextResponse.json({ teams, mail });
}
