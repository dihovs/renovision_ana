import { describe, expect, it } from "vitest";
import {
  addOptimistic,
  applyToggle,
  confirmAdd,
  EMPTY_ROWS,
  openCount,
  overdueCount,
  removeRow,
  revertToggle,
  type TaskRow,
  type TaskRows,
} from "./taskBarState";

function task(overrides: Partial<TaskRow> & { id: string }): TaskRow {
  return {
    created_at: "2026-08-13T12:00:00.000Z",
    body: "a task",
    due_date: null,
    done_at: null,
    source: "web",
    call_sid: null,
    ...overrides,
  };
}

const OLD = task({ id: "old", created_at: "2026-08-01T09:00:00.000Z", body: "old one" });
const NEW = task({ id: "new", created_at: "2026-08-13T09:00:00.000Z", body: "new one" });
const START: TaskRows = { open: [NEW, OLD], done: [] };

describe("addOptimistic", () => {
  it("shows the row immediately, marked unconfirmed", () => {
    const rows = addOptimistic(START, task({ id: "temp", created_at: "2026-08-14T09:00:00.000Z" }));
    expect(rows.open).toHaveLength(3);
    expect(rows.open[0].id).toBe("temp");
    expect(rows.open[0].pending).toBe(true);
  });

  it("sorts by creation, newest first", () => {
    const rows = addOptimistic(START, task({ id: "mid", created_at: "2026-08-05T09:00:00.000Z" }));
    expect(rows.open.map((row) => row.id)).toEqual(["new", "mid", "old"]);
  });

  it("leaves the done list alone", () => {
    const withDone: TaskRows = { open: [], done: [task({ id: "d", done_at: "x" })] };
    expect(addOptimistic(withDone, task({ id: "t" })).done).toHaveLength(1);
  });
});

describe("confirmAdd", () => {
  it("swaps the temporary row for the saved one", () => {
    const optimistic = addOptimistic(START, task({ id: "temp", body: "typed" }));
    const rows = confirmAdd(optimistic, "temp", task({ id: "real", body: "typed" }));
    expect(rows.open.map((row) => row.id)).toContain("real");
    expect(rows.open.map((row) => row.id)).not.toContain("temp");
  });

  it("clears the pending flag", () => {
    const optimistic = addOptimistic(EMPTY_ROWS, task({ id: "temp" }));
    const rows = confirmAdd(optimistic, "temp", task({ id: "real" }));
    expect(rows.open[0].pending).toBeUndefined();
  });

  it("matches by id, not position", () => {
    // A tick landing between the add and its confirmation reorders the list.
    // Matching positionally here would overwrite an innocent row.
    let rows = addOptimistic(START, task({ id: "temp", created_at: "2026-08-14T09:00:00.000Z" }));
    rows = applyToggle(rows, NEW, true, "2026-08-14T10:00:00.000Z");
    rows = confirmAdd(rows, "temp", task({ id: "real", created_at: "2026-08-14T09:00:00.000Z" }));
    expect(rows.open.map((row) => row.id)).toEqual(["real", "old"]);
  });

  it("does nothing when the temporary row is already gone", () => {
    const rows = confirmAdd(START, "temp", task({ id: "real" }));
    expect(rows.open.map((row) => row.id)).toEqual(["new", "old"]);
  });
});

describe("applyToggle", () => {
  it("moves a task to done and stamps it", () => {
    const rows = applyToggle(START, NEW, true, "2026-08-13T15:00:00.000Z");
    expect(rows.open.map((row) => row.id)).toEqual(["old"]);
    expect(rows.done[0].done_at).toBe("2026-08-13T15:00:00.000Z");
  });

  it("moves it back and clears the stamp", () => {
    const done = task({ id: "d", done_at: "2026-08-13T15:00:00.000Z" });
    const rows = applyToggle({ open: [], done: [done] }, done, false, "ignored");
    expect(rows.done).toHaveLength(0);
    expect(rows.open[0].done_at).toBeNull();
  });

  it("never leaves the task in both lists", () => {
    const rows = applyToggle(START, NEW, true, "2026-08-13T15:00:00.000Z");
    const ids = [...rows.open, ...rows.done].map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the done list newest-first too", () => {
    let rows: TaskRows = { open: [NEW, OLD], done: [] };
    rows = applyToggle(rows, OLD, true, "2026-08-13T15:00:00.000Z");
    rows = applyToggle(rows, NEW, true, "2026-08-13T15:01:00.000Z");
    expect(rows.done.map((row) => row.id)).toEqual(["new", "old"]);
  });
});

describe("revertToggle", () => {
  it("undoes a failed tick exactly", () => {
    // The failure that matters: the write is refused and the row must land
    // back in `open`, or he walks away believing it is cleared.
    const applied = applyToggle(START, NEW, true, "2026-08-13T15:00:00.000Z");
    expect(revertToggle(applied, NEW)).toEqual(START);
  });

  it("undoes a failed un-tick exactly", () => {
    const done = task({ id: "d", done_at: "2026-08-13T15:00:00.000Z" });
    const before: TaskRows = { open: [NEW], done: [done] };
    const applied = applyToggle(before, done, false, "ignored");
    expect(revertToggle(applied, done)).toEqual(before);
  });

  it("restores the original completion time, not a fresh one", () => {
    const done = task({ id: "d", done_at: "2026-08-01T08:00:00.000Z" });
    const applied = applyToggle({ open: [], done: [done] }, done, false, "ignored");
    expect(revertToggle(applied, done).done[0].done_at).toBe("2026-08-01T08:00:00.000Z");
  });

  it("restores position, not just membership", () => {
    const middle = task({ id: "mid", created_at: "2026-08-07T09:00:00.000Z" });
    const before: TaskRows = { open: [NEW, middle, OLD], done: [] };
    const applied = applyToggle(before, middle, true, "2026-08-13T15:00:00.000Z");
    expect(revertToggle(applied, middle).open.map((row) => row.id)).toEqual(["new", "mid", "old"]);
  });
});

describe("removeRow", () => {
  it("drops the row from whichever list holds it", () => {
    const rows = applyToggle(START, NEW, true, "2026-08-13T15:00:00.000Z");
    expect(removeRow(rows, "new").done).toHaveLength(0);
    expect(removeRow(rows, "old").open).toHaveLength(0);
  });
});

describe("counts", () => {
  it("counts only what is open", () => {
    const rows = applyToggle(START, NEW, true, "2026-08-13T15:00:00.000Z");
    expect(openCount(rows)).toBe(1);
  });

  it("counts overdue strictly before today", () => {
    const rows: TaskRows = {
      open: [
        task({ id: "past", due_date: "2026-08-12" }),
        task({ id: "today", due_date: "2026-08-13" }),
        task({ id: "later", due_date: "2026-08-20" }),
        task({ id: "none" }),
      ],
      done: [],
    };
    // A task due today is not late. Turning the badge red at breakfast for
    // something due at five is how a badge stops meaning anything.
    expect(overdueCount(rows, "2026-08-13")).toBe(1);
  });

  it("does not claim anything is overdue before the date is known", () => {
    const rows: TaskRows = { open: [task({ id: "a", due_date: "2026-08-12" })], done: [] };
    expect(overdueCount(rows, "")).toBe(0);
  });

  it("ignores done tasks when counting overdue", () => {
    const rows: TaskRows = {
      open: [],
      done: [task({ id: "a", due_date: "2026-01-01", done_at: "x" })],
    };
    expect(overdueCount(rows, "2026-08-13")).toBe(0);
  });
});
