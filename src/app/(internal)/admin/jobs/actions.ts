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
  listJobVisitIds,
  moveChecklistItem,
  saveRecurrence,
  scheduleJobVisit,
  setChecklistItemDone,
  setJobArchived,
  stopRecurrence,
  updateJob,
  updateVisit,
} from "@/lib/crm/jobs";
import { onVisitCancelled } from "@/lib/crm/callScheduler";
import {
  conversionError,
  type ConversionResult,
  type ConversionState,
} from "@/lib/crm/conversions";
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

// ---------------------------------------------------------------------------
// Keeping the dialer honest
// ---------------------------------------------------------------------------
//
// The outbound queue is written a day ahead by the nightly sweep, so between
// the moment a call is queued and the moment it is placed the thing it is about
// can stop being true. The sweep only decides what to queue *next*; it cannot
// reach back and withdraw what is already sitting there. That is what these
// hooks are for, and the failure they exist to prevent is concrete: a visit
// ticked off this morning and the customer telephoned tonight to confirm an
// appointment that already happened.
//
// The wiring lives here, in the action layer, rather than inside `updateJob`
// and `updateVisit`. `callScheduler` imports `listVisitsBetween` from
// `crm/jobs`, so having `crm/jobs` import `callScheduler` back would close an
// import cycle — and every write that must trigger a withdrawal goes through an
// action on this screen anyway.
//
// Every one of them is best-effort. Marking a visit done, or calling a job off,
// is the operator's action and it has already succeeded by the time any of this
// runs; an unreachable call queue, or a database that has not had migration
// 0018 applied yet, must not turn that into a failed click.

/**
 * Withdraw whatever the dialer still has queued about one visit.
 *
 * Never throws. It does not swallow quietly either: `unconfigured` and
 * `migration_pending` are the two expected states of a database that has not
 * run 0018 and say nothing about this visit, but any other refusal means the
 * withdrawal was genuinely attempted and did not happen — which is a live call
 * about a dead appointment, and belongs in the log with the visit id on it.
 */
async function withdrawQueuedCalls(visitId: string, because: string): Promise<void> {
  try {
    const result = await onVisitCancelled(visitId);
    if (result.reason && result.reason !== "unconfigured" && result.reason !== "migration_pending") {
      console.error(
        `[jobs] ${because}: could not withdraw the queued calls for visit ${visitId} — ` +
          `${result.reason}${result.detail ? `: ${result.detail}` : ""}`,
      );
    }
  } catch (err) {
    console.error(`[jobs] ${because}: withdrawing the queued calls for visit ${visitId} threw:`, err);
  }
}

/**
 * The job is off, so every call still queued about any of its visits is off.
 *
 * The nightly sweep already refuses to queue anything new for a cancelled job
 * (`jobActive` in `callScheduler`), but that is only true going forward —
 * tomorrow's confirmations were written last night and are still live. A job
 * can have several visits, so this walks all of them.
 */
async function withdrawJobCalls(jobId: string, because: string): Promise<void> {
  let visitIds: string[];
  try {
    visitIds = await listJobVisitIds(jobId);
  } catch (err) {
    console.error(`[jobs] could not read the visits of job ${jobId} (${because}):`, err);
    return;
  }
  for (const visitId of visitIds) {
    await withdrawQueuedCalls(visitId, `job ${jobId} ${because}`);
  }
}

/**
 * Convert an approved quote. Idempotent, so a double tap is harmless.
 *
 * The refusal comes back as data rather than thrown: Next replaces the message
 * of an error thrown out of a server action with a generic digest in
 * production, and "only an approved quote can become a job" is exactly the
 * sentence the owner needs to see.
 */
export async function convertQuoteAction(quoteId: string): Promise<ConversionState> {
  await requireSession();

  let job: ConversionResult;
  try {
    job = await createJobFromQuote(quoteId);
  } catch (err) {
    return conversionError(err, "Could not convert the quote.");
  }

  revalidatePath("/admin/quotes");
  revalidatePath("/admin/jobs");
  // Outside the try: redirect signals by throwing, and catching it above would
  // turn a successful conversion into an error message.
  redirect(`/admin/jobs/${job.id}`);
}

export async function setJobStatusAction(id: string, status: string): Promise<void> {
  await requireSession();
  if (!JOB_STATUSES.includes(status as JobStatus)) throw new Error(`Unknown status: ${status}`);
  await updateJob(id, { status: status as JobStatus });
  if (status === "cancelled") await withdrawJobCalls(id, "cancelled");
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${id}`);
}

export async function archiveJobAction(id: string, archived: boolean): Promise<void> {
  await requireSession();
  await setJobArchived(id, archived);

  // Same reasoning as cancelling. The nightly sweep skips archived jobs from
  // here on, but anything queued before the archive is still live and would
  // ring a customer about a job the business has filed away. Only on the way
  // in: un-archiving cannot restore a withdrawn confirmation, because the
  // unique index has already consumed that visit's slot.
  if (archived) await withdrawJobCalls(id, "archived");

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

/**
 * Put the job on the calendar in one press.
 *
 * Next working day, 08:00–12:00, which the owner then drags or edits. The point
 * is that the answer to "when?" is almost always "tomorrow morning", and making
 * that cost three form fields is why jobs sit unscheduled for a week.
 *
 * Says which of the two things happened. A job that was already booked gets its
 * existing visit back rather than a second one, and the owner is told so —
 * otherwise the button appears to have done nothing.
 */
export async function scheduleNextVisitAction(jobId: string): Promise<ConversionState> {
  await requireSession();

  let visit: ConversionResult;
  try {
    visit = await scheduleJobVisit(jobId);
  } catch (err) {
    return conversionError(err, "Could not put the job on the calendar.");
  }

  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/jobs");
  revalidatePath("/admin/schedule");
  return visit.created
    ? { ok: "Booked for the next working day, 8am to noon" }
    : { ok: "Already on the calendar — see the visit below" };
}

export async function completeVisitAction(
  jobId: string,
  visitId: string,
  completed: boolean,
): Promise<void> {
  await requireSession();
  await updateVisit(visitId, { completed });

  // The work is done; there is nothing left to confirm. Only on the way in —
  // un-ticking a visit cannot bring the confirmation back either way, because
  // `call_tasks_one_confirm_per_visit` is unique on `(visit_id, kind)`
  // regardless of status and the cancelled row has already consumed it.
  if (completed) await withdrawQueuedCalls(visitId, "visit completed");

  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/schedule");
}

/**
 * Delete a visit.
 *
 * No call-queue hook, and that is not an omission: `call_tasks.visit_id` is
 * `on delete cascade` in migration 0018, so the queued calls are gone with the
 * row before anything could be asked to cancel them.
 */
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
