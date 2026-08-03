import { NextResponse } from "next/server";
import { db } from "@/lib/crm/db";
import {
  canDialNow,
  cancelCallTask,
  claimDueCallTasks,
  countCallsDispatchedToday,
  countInFlightCallTasks,
  failCallTask,
  loadDialClients,
  nextDialWindowOpening,
  recordCallTaskDispatch,
  releaseCallTask,
  sweepStalledCallTasks,
  type CallTask,
} from "@/lib/crm/callTasks";
import { CONSENT_REFUSAL_MESSAGE, requiresExpressConsent } from "@/lib/crm/adadConsent";
import { consentVerdictFor } from "@/lib/crm/consentStore";
import { placeOutboundCall } from "@/lib/voice/outboundDialer";

/**
 * The dialer, on a schedule.
 *
 * Every fifteen minutes via Vercel cron (see vercel.json): sweep, budget,
 * claim, re-check, dial, record. Same gate and same reporting shape as
 * /api/cron/followups — the rules live in the library, this route is the lock
 * and the summary.
 *
 * THE RE-CHECK IS NOT REDUNDANT. Eligibility was true when the task was queued,
 * which may have been yesterday. Between then and now the customer may have
 * asked Ana never to call again, the clock may have crossed 20:00, or another
 * task may already have used the customer's one attempt for the day. Every
 * refusal is evaluated against the state that exists at the instant before the
 * POST, and a task refused after being claimed is handed straight back with
 * `not_before` pushed to the next opening — no attempt counted, no ring.
 *
 * Nothing in this route can lose a task. Every claimed row leaves the run in
 * exactly one of three states: dispatched, released back to `queued`, or
 * failed with a reason. The per-task try/catch is the backstop for the fourth
 * possibility, and it too ends in `failCallTask`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Two simultaneous outbound calls, of the plan's six.
 *
 * ElevenLabs Starter allows six concurrent conversations and that budget is
 * shared with inbound — the business line. A customer ringing the company must
 * never be the call that gets turned away because the robot was busy phoning
 * three other people, so outbound reserves two and leaves four.
 *
 * Enforced as a *claim budget* rather than an in-run semaphore, which is the
 * durable form of the same rule: a call claimed by the previous run is still
 * ringing when this one starts, so counting in-flight rows across runs is the
 * only version of "at most two" that is actually true.
 */
const MAX_CONCURRENT = 2;

/**
 * The most calls this system will place in one Toronto day, under any
 * circumstances. Real volume is a handful; this sits far above it so it never
 * throttles normal work, and far below the point where a runaway loop costs
 * real money. It is a circuit breaker, not a quota.
 */
const MAX_CALLS_PER_DAY = 40;

/**
 * A row that has been `dialing` this long lost its result. Thirty minutes is
 * comfortably longer than any real call plus the post-call webhook's own
 * delivery latency, and it lines up with two cron ticks.
 */
const STALLED_AFTER_MINUTES = 30;

type TaskReport = {
  id: string;
  kind: string;
  result: string;
};

export async function GET(request: Request) {
  // Vercel sends `Authorization: Bearer ${CRON_SECRET}`. Refuse when it is not
  // set: an open endpoint that telephones customers is worse than a spam
  // cannon for whoever finds the URL — it dials real people in the business's
  // name, and the business is the one the CRTC would talk to about it.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[outbound] CRON_SECRET is not set — refusing to run");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = db();
  if (!supabase) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const now = new Date();
  const notes: string[] = [];
  const tasks: TaskReport[] = [];

  // 1. Reclaim before dispatching. A stalled row holds a concurrency slot, and
  //    a stalled row nobody rescues is a call the owner is never told about.
  let swept = 0;
  try {
    const sweep = await sweepStalledCallTasks(STALLED_AFTER_MINUTES, now);
    if (sweep.ok) swept = sweep.swept;
    else notes.push(`sweep skipped: ${sweep.reason}`);
  } catch (err) {
    notes.push(`sweep failed: ${message(err)}`);
  }

  // 2. What is left of the concurrency budget. A null count means the table is
  //    unreachable; claiming would fail anyway, so stop here rather than
  //    guessing the budget is free.
  const inFlight = await countInFlightCallTasks();
  if (inFlight === null) {
    return NextResponse.json({
      ok: true,
      skipped: "call_tasks is unavailable — run supabase/migrations/0018_call_tasks.sql",
      swept,
      ranAt: now.toISOString(),
    });
  }
  const concurrencyBudget = Math.max(0, MAX_CONCURRENT - inFlight);
  if (concurrencyBudget === 0) {
    return NextResponse.json({
      ok: true,
      skipped: `${inFlight} call(s) already in flight (cap ${MAX_CONCURRENT})`,
      swept,
      ranAt: now.toISOString(),
    });
  }

  // 2b. The circuit breaker. Concurrency limits how many ring at once; this
  //     limits how many ring at all today, and it is the one that matters when
  //     something is actually wrong. Two calls at a time, every fifteen
  //     minutes, all day, is hundreds of calls and a drained account — a
  //     concurrency cap does nothing about that. A requeue loop or a clock bug
  //     that makes every visit look imminent both look exactly like this.
  //
  //     Sized well above real volume: a handful of visits a day, one call each.
  //     If this ever trips, the answer is to look at why, not to raise it.
  //     Null means the count could not be read, and that is treated as stop —
  //     the failure that costs money is assuming there is room left.
  const dispatchedToday = await countCallsDispatchedToday(now);
  if (dispatchedToday === null) {
    return NextResponse.json({
      ok: true,
      skipped: "could not read today's call count — not dialling blind",
      swept,
      ranAt: now.toISOString(),
    });
  }
  const dailyBudget = Math.max(0, MAX_CALLS_PER_DAY - dispatchedToday);
  if (dailyBudget === 0) {
    console.error(
      `[cron/outbound] daily ceiling reached: ${dispatchedToday} calls dispatched (cap ${MAX_CALLS_PER_DAY}). Nothing further will be dialled today.`,
    );
    return NextResponse.json({
      ok: true,
      skipped: `daily cap reached — ${dispatchedToday} call(s) dispatched (cap ${MAX_CALLS_PER_DAY})`,
      swept,
      ranAt: now.toISOString(),
    });
  }

  const budget = Math.min(concurrencyBudget, dailyBudget);

  // 3. Claim. The compare-and-swap inside claimDueCallTasks is what stops two
  //    overlapping runs dialling the same customer twice.
  const claim = await claimDueCallTasks(budget, now);
  if (!claim.ok) {
    return NextResponse.json({
      ok: true,
      skipped:
        claim.reason === "migration_pending"
          ? "migration 0018 not run"
          : `could not claim: ${claim.reason}`,
      swept,
      ranAt: now.toISOString(),
    });
  }
  if (claim.tasks.length === 0) {
    return NextResponse.json({ ok: true, claimed: 0, swept, notes, ranAt: now.toISOString() });
  }

  // 4. One query for the do-not-call flags and today's attempts, then dial.
  const clients = await loadDialClients(
    claim.tasks.map((task) => task.client_id).filter((id): id is string => Boolean(id)),
    now,
  );

  let dialed = 0;
  for (const task of claim.tasks) {
    try {
      const report = await dialOne(task, clients.get(task.client_id ?? "") ?? null, now);
      if (report.result === "dialed") dialed += 1;
      tasks.push(report);
    } catch (err) {
      // A throw here would strand this task in `dialing` and abandon the rest
      // of the batch. Neither is acceptable: record it and carry on.
      const detail = message(err);
      console.error(`[outbound] task ${task.id} threw:`, detail);
      await failCallTask(task.id, `dialer threw: ${detail}`, now).catch(() => {});
      tasks.push({ id: task.id, kind: task.kind, result: `error: ${detail}` });
    }
  }

  return NextResponse.json({
    ok: true,
    claimed: claim.tasks.length,
    dialed,
    swept,
    inFlightBefore: inFlight,
    notes,
    tasks,
    ranAt: now.toISOString(),
  });
}

/** Re-check, dial, record. Returns what happened, in words, for the summary. */
async function dialOne(
  task: CallTask,
  client: Parameters<typeof canDialNow>[1],
  now: Date,
): Promise<TaskReport> {
  // Consent first, and re-read from the database rather than trusted from
  // queue time. It may have been granted last month and withdrawn this
  // morning, and a withdrawal that only takes effect on the next queue is a
  // withdrawal we ignored. Cancelled outright, never deferred: unlike the
  // hours or the daily cap, this does not come good by waiting.
  if (requiresExpressConsent(task.kind)) {
    const consent = await consentVerdictFor(task.to_number, now);
    if (!consent.ok) {
      const why =
        consent.reason === "consent_unavailable"
          ? (consent.detail ?? "consent could not be verified")
          : CONSENT_REFUSAL_MESSAGE[consent.reason];
      await cancelCallTask(task.id, `no express consent at dial time: ${why}`.slice(0, 2000));
      return { id: task.id, kind: task.kind, result: `cancelled: ${consent.reason}` };
    }
  }

  const verdict = canDialNow(task, client, now);

  if (!verdict.ok) {
    // `do_not_call` is the one refusal that never resolves with time. Parking
    // it at the next opening would re-claim and re-refuse it every morning
    // until its attempts ran out, so it is cancelled outright — and cancelled,
    // not failed: we did not fail to reach this person, we chose not to.
    if (verdict.reason === "do_not_call") {
      await cancelCallTask(task.id, "client is on the do-not-call list");
      return { id: task.id, kind: task.kind, result: "cancelled: do_not_call" };
    }
    if (verdict.reason === "attempts_exhausted") {
      await failCallTask(task.id, verdict.detail ?? "attempts exhausted", now);
      return { id: task.id, kind: task.kind, result: "refused: attempts_exhausted" };
    }

    // Hours, holidays and the daily cap all resolve themselves. Push
    // `not_before` to the next moment the window is genuinely open — skipping
    // the rest of today when the customer has already been called once — so
    // the row stops being re-claimed every fifteen minutes until then.
    const retryAt = nextDialWindowOpening(now, verdict.reason === "already_attempted_today");
    await releaseCallTask(task.id, {
      notBefore: retryAt,
      note: `${verdict.reason}${verdict.detail ? `: ${verdict.detail}` : ""}`,
    });
    return {
      id: task.id,
      kind: task.kind,
      result: `deferred to ${retryAt.toISOString()} (${verdict.reason})`,
    };
  }

  const dispatch = await placeOutboundCall(task);

  if (!dispatch.ok) {
    if (dispatch.retryable) {
      // A 429 is the concurrency cap, not a mistake, and a timeout may or may
      // not have created a leg. Back off without counting an attempt on the
      // customer for the transport's benefit — but do not retry inside this
      // run: there is no idempotency key on the outbound endpoint, and a
      // duplicate POST is a duplicate ring on someone's phone.
      await releaseCallTask(task.id, {
        notBefore: new Date(now.getTime() + 5 * 60_000),
        note: `provider ${dispatch.status}: ${dispatch.message}`.slice(0, 2000),
      });
      return {
        id: task.id,
        kind: task.kind,
        result: `retrying in 5 min (${dispatch.status} ${dispatch.message})`,
      };
    }
    await failCallTask(task.id, `${dispatch.status}: ${dispatch.message}`, now);
    return { id: task.id, kind: task.kind, result: `failed: ${dispatch.message}` };
  }

  // The phone is ringing. This is the point the attempt is counted and the
  // customer's one call for the day is spent — not the claim.
  await recordCallTaskDispatch(
    task.id,
    { conversationId: dispatch.conversationId, attemptsBefore: task.attempts },
    now,
  );
  console.log(
    `[outbound] dialed ${task.kind} task ${task.id} (${task.call_sid}) → conversation ${dispatch.conversationId ?? "unknown"}`,
  );
  return { id: task.id, kind: task.kind, result: "dialed" };
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
