import { onVisitCancelled } from "./callScheduler";
import { listJobVisitIds } from "./jobs";

/**
 * Withdrawing the dialer's queued calls when work stops happening.
 *
 * Extracted out of the admin's own job actions so the native API can call
 * exactly the same code: cancelling a job from a phone has to withdraw the
 * queued calls too, and a second implementation of that is a second place
 * for a customer to get an automated call about a job that isn't happening.
 *
 * A leaf module on purpose — it imports from both `jobs` and
 * `callScheduler`, and `callScheduler` already imports from `jobs`, so this
 * could not live in either one without a cycle.
 *
 * Neither function throws. The queue is best-effort by design: it is a
 * courtesy call, and a database that hasn't run migration 0018 must not turn
 * a cancelled job into a failed request.
 */

/**
 * Withdraw whatever the dialer still has queued about one visit.
 *
 * `unconfigured` and `migration_pending` are the two expected states of a
 * database that has not run 0018 and say nothing about this visit; any other
 * refusal means the withdrawal was genuinely attempted and did not happen —
 * a live call about a dead appointment, which belongs in the log with the
 * visit id on it.
 */
export async function withdrawQueuedCalls(visitId: string, because: string): Promise<void> {
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
export async function withdrawJobCalls(jobId: string, because: string): Promise<void> {
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
