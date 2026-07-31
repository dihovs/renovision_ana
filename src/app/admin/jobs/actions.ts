"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/adminAuth";
import {
  createJobFromQuote,
  createVisit,
  deleteVisit,
  setJobArchived,
  updateJob,
  updateVisit,
} from "@/lib/crm/jobs";
import { JOB_STATUSES, type JobStatus } from "@/lib/crm/opsTypes";

export type JobState = { error?: string; ok?: string };

async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) throw new Error("Not authorised");
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Convert an approved quote. Idempotent, so a double tap is harmless. */
export async function convertQuoteAction(quoteId: string): Promise<void> {
  await requireSession();
  const jobId = await createJobFromQuote(quoteId);
  revalidatePath("/admin/quotes");
  revalidatePath("/admin/jobs");
  redirect(`/admin/jobs/${jobId}`);
}

export async function updateJobAction(
  id: string,
  _prev: JobState,
  formData: FormData,
): Promise<JobState> {
  await requireSession();
  try {
    await updateJob(id, {
      title: str(formData, "title"),
      instructions: str(formData, "instructions"),
      internalNotes: str(formData, "internalNotes"),
      startsOn: str(formData, "startsOn") || null,
      endsOn: str(formData, "endsOn") || null,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save." };
  }
  revalidatePath(`/admin/jobs/${id}`);
  return { ok: "Saved" };
}

export async function setJobStatusAction(id: string, status: string): Promise<void> {
  await requireSession();
  if (!JOB_STATUSES.includes(status as JobStatus)) throw new Error(`Unknown status: ${status}`);
  await updateJob(id, { status: status as JobStatus });
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${id}`);
}

export async function archiveJobAction(id: string, archived: boolean): Promise<void> {
  await requireSession();
  await setJobArchived(id, archived);
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${id}`);
}

export async function addVisitAction(
  jobId: string,
  _prev: JobState,
  formData: FormData,
): Promise<JobState> {
  await requireSession();

  const date = str(formData, "date");
  if (!date) return { error: "Pick a date." };
  const time = str(formData, "time");
  const allDay = !time;

  // Built from the operator's local date and time. A date with no time means
  // all-day rather than midnight, which on a schedule would read as a 12am
  // start and get somebody out of bed.
  const startsAt = new Date(`${date}T${time || "08:00"}:00`).toISOString();
  const endTime = str(formData, "endTime");
  const endsAt = endTime ? new Date(`${date}T${endTime}:00`).toISOString() : null;

  try {
    await createVisit(jobId, {
      title: str(formData, "title"),
      startsAt,
      endsAt,
      allDay,
      notes: str(formData, "notes"),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not schedule the visit." };
  }

  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/schedule");
  return { ok: "Scheduled" };
}

export async function completeVisitAction(
  jobId: string,
  visitId: string,
  completed: boolean,
): Promise<void> {
  await requireSession();
  await updateVisit(visitId, { completed });
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/schedule");
}

export async function removeVisitAction(jobId: string, visitId: string): Promise<void> {
  await requireSession();
  await deleteVisit(visitId);
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/schedule");
}
