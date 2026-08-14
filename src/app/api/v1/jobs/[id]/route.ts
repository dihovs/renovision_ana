import { NextResponse } from "next/server";
import { guarded } from "../../guard";
import { getJob, getJobExtras, setChecklistItemDone, updateJob } from "@/lib/crm/jobs";
import { withdrawJobCalls } from "@/lib/crm/jobCalls";
import { JOB_STATUSES, type JobStatus } from "@/lib/crm/opsTypes";

/** One job, with its lines, visits, checklist and recurrence — everything
    the native job screen renders, in one round trip rather than four. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(async () => {
    const job = await getJob(id);
    if (!job) return { error: "That job no longer exists." };
    // Extras degrade on their own (migration 0014 may not have run) exactly
    // as they do on the web job page, rather than failing the whole read.
    const extras = await getJobExtras(id).catch(() => null);
    return { job, extras };
  });
}

/**
 * The two writes the native job screen needs: move the job along, and tick
 * a checklist item off on site.
 *
 * Deliberately not a general-purpose update endpoint — every field this
 * doesn't accept is a field the native app cannot corrupt. It mirrors
 * `setJobStatusAction` and `toggleChecklistItemAction` minus their
 * `revalidatePath` calls, which are a Next.js cache concern with no meaning
 * for a native client.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { status?: unknown; checklistItemId?: unknown; done?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (body.status !== undefined) {
    if (!JOB_STATUSES.includes(body.status as JobStatus)) {
      return NextResponse.json({ error: `Unknown status: ${String(body.status)}` }, { status: 400 });
    }
    return guarded(async () => {
      await updateJob(id, { status: body.status as JobStatus });
      // Same as the web action: a job called off has to take its queued
      // customer calls with it, or the dialer rings people tonight about
      // an appointment that is no longer happening.
      if (body.status === "cancelled") await withdrawJobCalls(id, "cancelled");
      return { ok: true };
    });
  }

  if (typeof body.checklistItemId === "string" && typeof body.done === "boolean") {
    return guarded(async () => {
      await setChecklistItemDone(body.checklistItemId as string, body.done as boolean);
      return { ok: true };
    });
  }

  return NextResponse.json(
    { error: "Send either {status} or {checklistItemId, done}." },
    { status: 400 },
  );
}
