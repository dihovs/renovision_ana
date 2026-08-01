"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/adminAuth";
import {
  addChecklistItem,
  createJobFromQuote,
  createVisit,
  deleteChecklistItem,
  deleteVisit,
  moveChecklistItem,
  saveRecurrence,
  setChecklistItemDone,
  setJobArchived,
  stopRecurrence,
  updateJob,
  updateVisit,
} from "@/lib/crm/jobs";
import {
  JOB_STATUSES,
  RECURRENCE_FREQUENCIES,
  type JobStatus,
  type RecurrenceFrequency,
} from "@/lib/crm/opsTypes";

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

// ---------------------------------------------------------------------------
// Recurrence
// ---------------------------------------------------------------------------

export async function setRecurrenceAction(
  jobId: string,
  _prev: JobState,
  formData: FormData,
): Promise<JobState> {
  await requireSession();

  const frequency = str(formData, "frequency");
  if (!RECURRENCE_FREQUENCIES.includes(frequency as RecurrenceFrequency)) {
    return { error: "Pick how often it repeats." };
  }

  const until = str(formData, "until");
  if (until) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) return { error: "That end date doesn't look right." };
    // "Today" on the business's clock, not the server's — a Montreal evening
    // is already tomorrow in UTC.
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
    if (until < today) return { error: "The end date has already passed." };
  }

  let generated = 0;
  try {
    ({ generated } = await saveRecurrence(jobId, {
      frequency: frequency as RecurrenceFrequency,
      untilDate: until || null,
    }));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the recurrence." };
  }

  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/schedule");
  return {
    ok:
      generated > 0
        ? `Added ${generated} visit${generated === 1 ? "" : "s"} to the schedule`
        : "Saved — nothing new to schedule",
  };
}

export async function stopRecurrenceAction(jobId: string): Promise<void> {
  await requireSession();
  await stopRecurrence(jobId);
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/schedule");
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export async function addChecklistItemAction(
  jobId: string,
  _prev: JobState,
  formData: FormData,
): Promise<JobState> {
  await requireSession();

  const label = str(formData, "label");
  if (!label) return { error: "Write the item first." };
  if (label.length > 300) return { error: "Keep it under 300 characters." };

  try {
    await addChecklistItem(jobId, label);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not add the item." };
  }

  revalidatePath(`/admin/jobs/${jobId}`);
  return { ok: "Added" };
}

export async function toggleChecklistItemAction(
  jobId: string,
  itemId: string,
  done: boolean,
): Promise<void> {
  await requireSession();
  await setChecklistItemDone(itemId, done);
  revalidatePath(`/admin/jobs/${jobId}`);
}

export async function removeChecklistItemAction(jobId: string, itemId: string): Promise<void> {
  await requireSession();
  await deleteChecklistItem(itemId);
  revalidatePath(`/admin/jobs/${jobId}`);
}

export async function moveChecklistItemAction(
  jobId: string,
  itemId: string,
  direction: string,
): Promise<void> {
  await requireSession();
  if (direction !== "up" && direction !== "down") throw new Error(`Unknown direction: ${direction}`);
  await moveChecklistItem(jobId, itemId, direction);
  revalidatePath(`/admin/jobs/${jobId}`);
}
