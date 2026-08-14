import { NextResponse } from "next/server";
import { guarded } from "../guard";
import { db, isEmbedFailure } from "@/lib/crm/db";

/**
 * The schedule, as a flat window of visits.
 *
 * A phone schedule is "what is happening from now-ish onward", so the window
 * defaults to a week back (overdue work that never got marked done must not
 * vanish — it is the most important thing on the board) through three weeks
 * ahead.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const now = new Date();
  const from =
    params.get("from") ?? new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const to = params.get("to") ?? new Date(now.getTime() + 21 * 86_400_000).toISOString();

  return guarded(async () => {
    const client = db();
    if (!client) throw new Error("Database is not configured");

    const build = (select: string) =>
      client
        .from("visits")
        .select(select)
        .gte("starts_at", from)
        .lte("starts_at", to)
        .order("starts_at", { ascending: true });

    // The job embed carries the name on the door. If the relationship cannot
    // be resolved the visits themselves still matter — same fallback rule as
    // every other list here.
    let { data, error } = await build("*, jobs(title, job_number, client_snapshot)");
    if (error && isEmbedFailure(error)) {
      ({ data, error } = await build("*"));
    }
    if (error) throw new Error(`Could not load the schedule: ${error.message}`);

    type Row = {
      id: string;
      job_id: string;
      title: string | null;
      starts_at: string;
      ends_at: string | null;
      all_day: boolean;
      completed_at: string | null;
      notes: string | null;
      jobs?: {
        title: string | null;
        job_number: number;
        client_snapshot: { name?: string } | null;
      } | null;
    };

    return {
      visits: ((data ?? []) as unknown as Row[]).map((visit) => ({
        id: visit.id,
        jobId: visit.job_id,
        title: visit.title,
        jobTitle: visit.jobs?.title ?? null,
        jobNumber: visit.jobs?.job_number ?? null,
        clientName: visit.jobs?.client_snapshot?.name ?? null,
        startsAt: visit.starts_at,
        endsAt: visit.ends_at,
        allDay: visit.all_day,
        done: visit.completed_at !== null,
        notes: visit.notes,
      })),
    };
  });
}
