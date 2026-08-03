import type { OwnerTask } from "./tasks";

/**
 * The task bar's two lists, and every move between them.
 *
 * Pulled out of the component and made pure because this is where the
 * expensive bug lives. The bar updates optimistically — the row jumps the
 * instant the checkbox is clicked, because waiting on a round trip to see a
 * tick land makes the tool feel broken — and every optimistic update needs an
 * exact inverse for when the write fails. A rollback that puts the row back in
 * the wrong list, or drops it, leaves the owner believing he cleared something
 * he did not. That is the one failure in this panel with a cost outside it.
 *
 * Ordering is derived, never maintained: both lists read newest-first by
 * `created_at`, which is exactly what the query returns, so re-sorting after
 * every change makes an insert positionally identical to a reload. No index
 * bookkeeping, and no way for a rollback to land a row a few places off from
 * where it started.
 */

export type TaskRow = OwnerTask & { pending?: boolean };

export type TaskRows = {
  open: TaskRow[];
  done: TaskRow[];
};

export const EMPTY_ROWS: TaskRows = { open: [], done: [] };

/**
 * Newest first, with the id as a tiebreak.
 *
 * The tiebreak is not decoration: an optimistic row is stamped in the browser
 * and a real one on the server, and two tasks added in the same second would
 * otherwise swap places when the real row replaced the temporary one — a
 * visible flicker in the list for no reason.
 */
function byNewest(a: TaskRow, b: TaskRow): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

function sorted(rows: TaskRow[]): TaskRow[] {
  return [...rows].sort(byNewest);
}

/** Show a task the server hasn't confirmed yet. */
export function addOptimistic(rows: TaskRows, task: TaskRow): TaskRows {
  return { open: sorted([...rows.open, { ...task, pending: true }]), done: rows.done };
}

/**
 * Swap the temporary row for the one the server actually wrote.
 *
 * Matched by id rather than by position, so a tick or a second add landing in
 * between cannot make this overwrite the wrong row.
 */
export function confirmAdd(rows: TaskRows, tempId: string, saved: OwnerTask): TaskRows {
  const replaced = rows.open.map((row) => (row.id === tempId ? { ...saved } : row));
  return { open: sorted(replaced), done: rows.done };
}

/** Take an unconfirmed row back off after a failed write. */
export function removeRow(rows: TaskRows, id: string): TaskRows {
  return {
    open: rows.open.filter((row) => row.id !== id),
    done: rows.done.filter((row) => row.id !== id),
  };
}

/**
 * Move a task between the lists, stamping or clearing `done_at`.
 *
 * `at` is the timestamp to record, passed in rather than read from the clock
 * so this stays pure and testable. The value is provisional either way — the
 * server writes its own, and the next load replaces it.
 */
export function applyToggle(rows: TaskRows, task: TaskRow, done: boolean, at: string): TaskRows {
  const without = removeRow(rows, task.id);
  const moved: TaskRow = { ...task, done_at: done ? at : null };
  return done
    ? { open: without.open, done: sorted([...without.done, moved]) }
    : { open: sorted([...without.open, moved]), done: without.done };
}

/**
 * Put a task back exactly as it was before `applyToggle` touched it.
 *
 * Takes the ORIGINAL row, not a reconstruction: only the original still
 * carries the `done_at` it had, and a rollback that re-derives the timestamp
 * would quietly rewrite when the task was completed.
 */
export function revertToggle(rows: TaskRows, original: TaskRow): TaskRows {
  const without = removeRow(rows, original.id);
  return original.done_at
    ? { open: without.open, done: sorted([...without.done, original]) }
    : { open: sorted([...without.open, original]), done: without.done };
}

/** How many are outstanding, for the header badge. */
export function openCount(rows: TaskRows): number {
  return rows.open.length;
}

/**
 * How many are past their date. Drives the badge turning red, which is the
 * only thing in the header that says "this needs you today" — so it counts
 * strictly earlier than today, never today itself.
 */
export function overdueCount(rows: TaskRows, today: string): number {
  if (!today) return 0;
  return rows.open.filter((row) => row.due_date !== null && row.due_date < today).length;
}
