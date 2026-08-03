import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The database half of the call queue.
 *
 * Two things are worth the cost of a fake Supabase client here, and they are
 * the two things that would be most expensive to get wrong in production:
 *
 *   1. **The claim really is a compare-and-swap.** Every claim must carry both
 *      `eq("id")` and `eq("status", "queued")`, and a claim that comes back
 *      with zero rows must be treated as "another run got it" and skipped —
 *      not retried, not counted, and above all not dialled.
 *
 *   2. **A missing migration is a typed result, never a throw.** These
 *      migrations are run by hand; until 0018 is applied every call here has to
 *      say `migration_pending` and let the caller decide what that means.
 */

const from = vi.fn();
const supabase = { from } as unknown as ReturnType<typeof import("./db").db>;
const dbMock = vi.fn(() => supabase);

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, db: () => dbMock() };
});

const {
  cancelCallTask,
  cancelCallTasksForVisit,
  claimDueCallTasks,
  completeCallTask,
  failCallTask,
  listRecentCallTasks,
  queueCallTask,
  recordCallTaskDispatch,
  releaseCallTask,
} = await import("./callTasks");

// ---------------------------------------------------------------------------
// A fake PostgREST builder: records the chained calls, answers with whatever
// the current handler says.
// ---------------------------------------------------------------------------

type Op = { op: string; args: unknown[] };
type Reply = { data?: unknown; error?: unknown; count?: number };
type Handler = (table: string, ops: Op[]) => Reply;

let calls: Array<{ table: string; ops: Op[] }> = [];
let handler: Handler = () => ({ data: [], error: null });

function makeBuilder(table: string) {
  const ops: Op[] = [];
  const record = { table, ops };
  calls.push(record);

  const proxy: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          const reply = handler(table, ops);
          return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null, ...reply }).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          ops.push({ op: String(prop), args });
          return proxy;
        };
      },
    },
  ) as Record<string | symbol, unknown>;

  return proxy;
}

/** The arguments a given chained method was called with, or undefined. */
function argsOf(ops: Op[], name: string, index = 0): unknown[] | undefined {
  return ops.filter((o) => o.op === name)[index]?.args;
}

/** The patch object handed to `.update()`. */
function patchOf(ops: Op[]): Record<string, unknown> {
  return (argsOf(ops, "update")?.[0] ?? {}) as Record<string, unknown>;
}

const MISSING_TABLE = { code: "PGRST205", message: "Could not find the table 'public.call_tasks'" };

beforeEach(() => {
  calls = [];
  handler = () => ({ data: [], error: null });
  dbMock.mockReturnValue(supabase);
  from.mockReset();
  from.mockImplementation((table: string) => makeBuilder(table));
});

// ---------------------------------------------------------------------------

describe("queueCallTask", () => {
  it("refuses a number that is not E.164 before touching the database", async () => {
    const result = await queueCallTask({ kind: "confirm_visit", toNumber: "514-555-0188" });
    expect(result).toMatchObject({ ok: false, reason: "failed" });
    expect(from).not.toHaveBeenCalled();
  });

  it("mints a correlation id at insert time", async () => {
    handler = () => ({ data: { id: "t1", call_sid: "x" }, error: null });
    await queueCallTask({
      kind: "crew_on_way",
      toNumber: "+15145550188",
      clientId: "c1",
      payload: { eta: "09:30" },
    });

    const insert = argsOf(calls[0].ops, "insert")?.[0] as Record<string, unknown>;
    expect(insert.call_sid).toMatch(/^task_[0-9a-f]{32}$/);
    expect(insert.kind).toBe("crew_on_way");
    expect(insert.to_number).toBe("+15145550188");
    expect(insert.locale).toBe("fr");
    expect(insert.payload).toEqual({ eta: "09:30" });
  });

  it("reports a duplicate rather than a failure — the unique index doing its job", async () => {
    handler = () => ({ error: { code: "23505", message: "duplicate key value" } });
    const result = await queueCallTask({ kind: "confirm_visit", toNumber: "+15145550188" });
    expect(result).toEqual({ ok: false, reason: "duplicate" });
  });

  it("reports migration_pending instead of throwing", async () => {
    handler = () => ({ error: MISSING_TABLE });
    const result = await queueCallTask({ kind: "confirm_visit", toNumber: "+15145550188" });
    expect(result).toEqual({ ok: false, reason: "migration_pending" });
  });

  it("reports unconfigured when there is no database at all", async () => {
    dbMock.mockReturnValue(null as never);
    const result = await queueCallTask({ kind: "confirm_visit", toNumber: "+15145550188" });
    expect(result).toEqual({ ok: false, reason: "unconfigured" });
  });
});

describe("claimDueCallTasks", () => {
  it("claims each candidate with a conditional update on status", async () => {
    handler = (table, ops) => {
      if (ops.some((o) => o.op === "update")) {
        return { data: [{ id: "a", status: "dialing" }], error: null };
      }
      return { data: [{ id: "a" }], error: null };
    };

    const result = await claimDueCallTasks(2, new Date("2026-07-08T18:00:00Z"));
    expect(result).toEqual({ ok: true, tasks: [{ id: "a", status: "dialing" }] });

    const claim = calls[1];
    expect(patchOf(claim.ops)).toEqual({ status: "dialing" });
    // Both halves of the compare-and-swap have to be there.
    expect(argsOf(claim.ops, "eq", 0)).toEqual(["id", "a"]);
    expect(argsOf(claim.ops, "eq", 1)).toEqual(["status", "queued"]);
  });

  it("does not count attempts or stamp last_attempt_at — a claim is not an attempt", async () => {
    handler = (_t, ops) =>
      ops.some((o) => o.op === "update")
        ? { data: [{ id: "a" }], error: null }
        : { data: [{ id: "a" }], error: null };

    await claimDueCallTasks(1);
    const patch = patchOf(calls[1].ops);
    expect(patch).not.toHaveProperty("attempts");
    expect(patch).not.toHaveProperty("last_attempt_at");
  });

  it("skips a row another run took — zero updated rows is not an error", async () => {
    handler = (_t, ops) => {
      if (!ops.some((o) => o.op === "update")) {
        return { data: [{ id: "lost" }, { id: "won" }], error: null };
      }
      const id = (argsOf(ops, "eq", 0) ?? [])[1];
      // "lost" was claimed by a concurrent run between the select and the update.
      return { data: id === "won" ? [{ id: "won" }] : [], error: null };
    };

    const result = await claimDueCallTasks(5);
    expect(result.ok && result.tasks).toEqual([{ id: "won" }]);
  });

  it("stops at the limit even when more candidates come back", async () => {
    handler = (_t, ops) =>
      ops.some((o) => o.op === "update")
        ? { data: [{ id: "x" }], error: null }
        : { data: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }], error: null };

    const result = await claimDueCallTasks(2);
    expect(result.ok && result.tasks).toHaveLength(2);
  });

  it("only looks at queued rows whose not_before has passed", async () => {
    const now = new Date("2026-07-08T18:00:00Z");
    handler = () => ({ data: [], error: null });
    await claimDueCallTasks(2, now);

    const select = calls[0].ops;
    expect(argsOf(select, "eq", 0)).toEqual(["status", "queued"]);
    expect(argsOf(select, "lte", 0)).toEqual(["not_before", now.toISOString()]);
  });

  it("keeps going when one claim errors", async () => {
    handler = (_t, ops) => {
      if (!ops.some((o) => o.op === "update")) return { data: [{ id: "bad" }, { id: "good" }], error: null };
      const id = (argsOf(ops, "eq", 0) ?? [])[1];
      if (id === "bad") return { error: { code: "40001", message: "serialization failure" } };
      return { data: [{ id: "good" }], error: null };
    };

    const result = await claimDueCallTasks(5);
    expect(result.ok && result.tasks).toEqual([{ id: "good" }]);
  });

  it("asks for nothing when the budget is zero", async () => {
    const result = await claimDueCallTasks(0);
    expect(result).toEqual({ ok: true, tasks: [] });
    expect(from).not.toHaveBeenCalled();
  });

  it("reports migration_pending instead of throwing", async () => {
    handler = () => ({ error: MISSING_TABLE });
    expect(await claimDueCallTasks(2)).toEqual({ ok: false, reason: "migration_pending" });
  });
});

describe("releaseCallTask", () => {
  it("puts the task back without spending an attempt", async () => {
    handler = () => ({ data: [{ id: "a" }], error: null });
    const retryAt = new Date("2026-07-09T13:00:00Z");
    await releaseCallTask("a", { notBefore: retryAt, note: "outside_calling_hours" });

    const patch = patchOf(calls[0].ops);
    expect(patch.status).toBe("queued");
    expect(patch.not_before).toBe(retryAt.toISOString());
    expect(patch).not.toHaveProperty("attempts");
    expect(patch).not.toHaveProperty("last_attempt_at");
    // Guarded so it cannot resurrect a completed or cancelled row.
    expect(argsOf(calls[0].ops, "eq", 1)).toEqual(["status", "dialing"]);
  });
});

describe("recordCallTaskDispatch", () => {
  it("counts the attempt at the moment the phone starts ringing", async () => {
    handler = () => ({ data: [{ id: "a" }], error: null });
    const now = new Date("2026-07-08T18:00:00Z");
    await recordCallTaskDispatch("a", { attemptsBefore: 1, conversationId: "conv_9" }, now);

    const patch = patchOf(calls[0].ops);
    expect(patch.attempts).toBe(2);
    expect(patch.last_attempt_at).toBe(now.toISOString());
    expect(patch.conversation_id).toBe("conv_9");
  });
});

describe("failCallTask", () => {
  const now = new Date("2026-07-08T18:00:00Z");

  it("backs off and requeues while attempts remain", async () => {
    handler = (_t, ops) =>
      ops.some((o) => o.op === "update")
        ? { data: [{ id: "a" }], error: null }
        : { data: { attempts: 0, max_attempts: 3 }, error: null };

    await failCallTask("a", "provider timed out", now);
    const patch = patchOf(calls[1].ops);
    expect(patch.status).toBe("queued");
    expect(patch.attempts).toBe(1);
    expect(patch.not_before).toBe(new Date(now.getTime() + 30 * 60_000).toISOString());
    expect(patch.error).toBe("provider timed out");
    expect(patch).not.toHaveProperty("outcome");
  });

  it("gives up once the attempts are spent", async () => {
    handler = (_t, ops) =>
      ops.some((o) => o.op === "update")
        ? { data: [{ id: "a" }], error: null }
        : { data: { attempts: 2, max_attempts: 3 }, error: null };

    await failCallTask("a", "no answer", now);
    const patch = patchOf(calls[1].ops);
    expect(patch.status).toBe("failed");
    expect(patch.attempts).toBe(3);
    expect(patch.outcome).toBe("failed");
    expect(patch.completed_at).toBe(now.toISOString());
    expect(patch).not.toHaveProperty("not_before");
  });

  it("never leaves the row in dialing", async () => {
    for (const attempts of [0, 1, 2, 5]) {
      calls = [];
      handler = (_t, ops) =>
        ops.some((o) => o.op === "update")
          ? { data: [{ id: "a" }], error: null }
          : { data: { attempts, max_attempts: 3 }, error: null };
      await failCallTask("a", "boom", now);
      expect(patchOf(calls[1].ops).status).not.toBe("dialing");
    }
  });

  it("shrugs at a task that no longer exists", async () => {
    handler = () => ({ data: null, error: null });
    expect(await failCallTask("gone", "boom", now)).toEqual({ ok: true, changed: 0 });
  });
});

describe("completeCallTask", () => {
  it("is keyed on the correlation id, not the row id", async () => {
    handler = () => ({ data: [{ id: "a" }], error: null });
    await completeCallTask("task_abc", { outcome: "reached_confirmed", conversationId: "conv_1" });

    expect(argsOf(calls[0].ops, "eq", 0)).toEqual(["call_sid", "task_abc"]);
    const patch = patchOf(calls[0].ops);
    expect(patch.status).toBe("done");
    expect(patch.outcome).toBe("reached_confirmed");
    expect(patch.conversation_id).toBe("conv_1");
  });

  it("keeps status and outcome from disagreeing on a failed call", async () => {
    handler = () => ({ data: [{ id: "a" }], error: null });
    await completeCallTask("task_abc", { outcome: "failed" });
    expect(patchOf(calls[0].ops).status).toBe("failed");
  });

  it("records voicemail as a call that happened", async () => {
    handler = () => ({ data: [{ id: "a" }], error: null });
    await completeCallTask("task_abc", { outcome: "voicemail_left" });
    expect(patchOf(calls[0].ops).status).toBe("done");
  });

  it("will not reopen a cancelled task", async () => {
    handler = () => ({ data: [], error: null });
    await completeCallTask("task_abc", { outcome: "no_answer" });
    expect(argsOf(calls[0].ops, "in", 0)).toEqual(["status", ["queued", "dialing"]]);
  });
});

describe("cancelling", () => {
  it("cancels every pending call for a visit and leaves history alone", async () => {
    handler = () => ({ data: [{ id: "a" }, { id: "b" }], error: null });
    const result = await cancelCallTasksForVisit("v1");

    expect(result).toEqual({ ok: true, changed: 2 });
    expect(patchOf(calls[0].ops).status).toBe("cancelled");
    expect(argsOf(calls[0].ops, "eq", 0)).toEqual(["visit_id", "v1"]);
    expect(argsOf(calls[0].ops, "in", 0)).toEqual(["status", ["queued", "dialing"]]);
  });

  it("cancels a single task with a reason", async () => {
    handler = () => ({ data: [{ id: "a" }], error: null });
    await cancelCallTask("a", "client is on the do-not-call list");
    const patch = patchOf(calls[0].ops);
    expect(patch.status).toBe("cancelled");
    expect(patch.error).toBe("client is on the do-not-call list");
  });

  it("reports migration_pending instead of throwing", async () => {
    handler = () => ({ error: MISSING_TABLE });
    expect(await cancelCallTasksForVisit("v1")).toEqual({ ok: false, reason: "migration_pending" });
  });
});

describe("listRecentCallTasks", () => {
  it("returns the newest first", async () => {
    handler = () => ({ data: [{ id: "a" }], error: null });
    const result = await listRecentCallTasks(10);
    expect(result).toEqual({ ok: true, tasks: [{ id: "a" }] });
    expect(argsOf(calls[0].ops, "order", 0)).toEqual(["created_at", { ascending: false }]);
    expect(argsOf(calls[0].ops, "limit", 0)).toEqual([10]);
  });

  it("says migration_pending rather than pretending the list is empty", async () => {
    handler = () => ({ error: MISSING_TABLE });
    expect(await listRecentCallTasks()).toEqual({ ok: false, reason: "migration_pending" });
  });
});
