"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  addTaskAction,
  loadTaskBarAction,
  toggleTaskAction,
  type TaskBarResult,
} from "@/app/(internal)/admin/taskBarActions";
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
} from "@/lib/crm/taskBarState";
import { describeDue, parseTaskInput } from "@/lib/crm/taskDates";

/**
 * The to-do list, reachable from every screen in the CRM.
 *
 * There is already a /admin/tasks page, and it is not the same thing. That page
 * is where you go to read the list; this is where you put something ON it
 * without losing the screen you were working from. The moment a task occurs to
 * you is almost never the moment you are looking at the task page — it is
 * halfway through an invoice, on the phone, with the quote open.
 *
 * So: a count in the header, a panel over the right edge, one input. Type the
 * line, press Enter, keep working.
 *
 * Two decisions worth keeping:
 *
 *   - Nothing here throws. The bar is mounted by the admin layout, so it hangs
 *     over every page in the tool; an error boundary triggered by a paused
 *     database would take out the invoice he was in the middle of. Failures
 *     render as a line of text inside the panel and nothing else moves.
 *
 *   - The due date is parsed from the sentence and SHOWN as a chip before
 *     saving. Guessing is fine; guessing invisibly is not. See taskDates.ts.
 */

const PANEL_WIDTH = "sm:w-[380px]";

export default function TaskBar() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<TaskBarResult | null>(null);
  // Every move between these two lists goes through taskBarState, which is
  // tested. The rollback paths especially — see the module header.
  const [rows, setRows] = useState<TaskRows>(EMPTY_ROWS);
  const [today, setToday] = useState("");
  const [draft, setDraft] = useState("");
  // `undefined` = use the parsed date, `null` = the chip was cleared, a string
  // = picked by hand. Collapsing the first two would make clearing a no-op.
  const [dueOverride, setDueOverride] = useState<string | null | undefined>(undefined);
  const [showPicker, setShowPicker] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const result = await loadTaskBarAction();
      setState(result);
      if (result.ok) {
        setRows({ open: result.open, done: result.done });
        setToday(result.today);
      }
    } catch {
      // Signed out mid-session, or the action itself is unreachable. The badge
      // simply doesn't appear; the page underneath is unaffected.
      setState({ ok: false, reason: "failed", detail: "Could not reach the task list." });
    }
  }, []);

  // Once per full page load, for the count. Client-side navigation keeps this
  // component mounted — the layout owns it — so this does not re-run on every
  // route change, which is the point.
  useEffect(() => {
    void load();
  }, [load]);

  // Opening re-reads, because tasks also arrive by phone: Ana writes one while
  // he is driving and the badge would otherwise still show the old count.
  function toggleOpen() {
    setOpen((wasOpen) => {
      if (!wasOpen) {
        setMessage(null);
        void load();
      }
      return !wasOpen;
    });
  }

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const parsed = today ? parseTaskInput(draft, today) : { body: draft.trim(), dueDate: null };
  const effectiveDue = dueOverride === undefined ? parsed.dueDate : dueOverride;

  function resetDraft() {
    setDraft("");
    setDueOverride(undefined);
    setShowPicker(false);
  }

  function submit() {
    const text = draft.trim();
    if (!text) return;

    // The temporary id is prefixed so it can never collide with a real uuid —
    // a click on the row before the server answers must not be able to address
    // some other task.
    const tempId = `pending-${text}-${rows.open.length}`;
    const optimistic: TaskRow = {
      id: tempId,
      created_at: new Date().toISOString(),
      body: dueOverride === undefined ? parsed.body : text,
      due_date: effectiveDue,
      done_at: null,
      source: "web",
      call_sid: null,
    };
    setRows((current) => addOptimistic(current, optimistic));
    resetDraft();
    setMessage(null);

    startTransition(async () => {
      const result = await addTaskAction(text, dueOverride);
      if (result.ok) {
        setRows((current) => confirmAdd(current, tempId, result.task));
        return;
      }
      // Take the row back off and hand the text back, so nothing is lost and
      // nothing is claimed to have been saved.
      setRows((current) => removeRow(current, tempId));
      setDraft(text);
      setMessage(failureMessage(result.reason, result.detail));
    });
  }

  function toggle(task: TaskRow, done: boolean) {
    if (task.pending) return;

    setRows((current) => applyToggle(current, task, done, new Date().toISOString()));
    setMessage(null);

    startTransition(async () => {
      const result = await toggleTaskAction(task.id, done);
      if (result.ok) return;
      // Put it back exactly as it was. A tick that silently didn't take is the
      // one failure here that costs something outside this panel.
      setRows((current) => revertToggle(current, task));
      setMessage(failureMessage(result.reason, result.detail));
    });
  }

  const count = openCount(rows);
  const overdue = overdueCount(rows, today);

  return (
    <>
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-label={count > 0 ? `Tasks, ${count} open` : "Tasks"}
        className="relative flex h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 text-sm font-semibold text-charcoal/60 transition-colors hover:bg-black/[0.04] hover:text-brand-blue"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Tasks</span>
        {count > 0 && (
          <span
            className={`min-w-[18px] rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ${
              overdue > 0 ? "bg-red-600" : "bg-brand-blue"
            }`}
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close tasks"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-black/20"
          />
          <aside
            aria-label="Tasks"
            className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-black/10 bg-white shadow-2xl ${PANEL_WIDTH}`}
          >
            <div className="flex h-14 shrink-0 items-center gap-2 border-b border-black/10 px-4">
              <h2 className="font-heading text-base font-bold text-charcoal">Tasks</h2>
              {count > 0 && (
                <span className="text-xs font-semibold text-charcoal/40">{count} open</span>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="ml-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-charcoal/50 transition-colors hover:bg-black/[0.04] hover:text-charcoal"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="shrink-0 border-b border-black/10 p-3">
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  // A fresh line gets a fresh parse; the override belonged to
                  // whatever was typed before it.
                  if (dueOverride !== undefined) setDueOverride(undefined);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submit();
                  }
                }}
                placeholder="Order the membrane for Thursday"
                aria-label="New task"
                className="w-full rounded-md border border-black/15 px-3 py-2 text-sm text-charcoal outline-none transition-colors placeholder:text-charcoal/35 focus:border-brand-blue"
              />

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {/* `today` gates the chip as well as the date: describeDue
                    needs a reference day, and before the first load there
                    isn't one. */}
                {effectiveDue && today ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-blue/10 py-1 pl-2.5 pr-1.5 text-[11px] font-bold text-brand-blue">
                    {describeDue(effectiveDue, today).label}
                    <button
                      type="button"
                      onClick={() => {
                        setDueOverride(null);
                        setShowPicker(false);
                      }}
                      aria-label="Remove the due date"
                      className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-brand-blue/20"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                      </svg>
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPicker((shown) => !shown)}
                    className="cursor-pointer text-[11px] font-semibold text-charcoal/45 transition-colors hover:text-brand-blue"
                  >
                    + Due date
                  </button>
                )}

                {showPicker && !(effectiveDue && today) && (
                  <input
                    type="date"
                    aria-label="Due date"
                    min={today || undefined}
                    onChange={(event) => setDueOverride(event.target.value || null)}
                    className="rounded-md border border-black/15 px-2 py-1 text-[11px] text-charcoal outline-none focus:border-brand-blue"
                  />
                )}

                <button
                  type="button"
                  onClick={submit}
                  disabled={!draft.trim()}
                  className="ml-auto cursor-pointer rounded-md bg-brand-blue px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {message && (
                <p className="border-b border-red-100 bg-red-50 px-4 py-2.5 text-xs leading-relaxed text-red-800">
                  {message}
                </p>
              )}

              {state === null ? (
                <p className="px-4 py-6 text-xs text-charcoal/40">Loading…</p>
              ) : !state.ok ? (
                <Unavailable reason={state.reason} detail={state.detail} />
              ) : rows.open.length === 0 && rows.done.length === 0 ? (
                <p className="px-4 py-6 text-xs leading-relaxed text-charcoal/45">
                  Nothing on the list. Type one above, or call Ana, give her your PIN and say it
                  out loud — both land here.
                </p>
              ) : (
                <>
                  {rows.open.map((task) => (
                    <TaskRow key={task.id} task={task} today={today} onToggle={toggle} />
                  ))}
                  {rows.done.length > 0 && (
                    <>
                      <p className="px-4 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wide text-charcoal/35">
                        Done today
                      </p>
                      {rows.done.map((task) => (
                        <TaskRow key={task.id} task={task} today={today} onToggle={toggle} />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>

            <div className="shrink-0 border-t border-black/10 px-4 py-2.5">
              <Link
                href="/admin/tasks"
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-brand-blue transition-colors hover:text-brand-blue/70"
              >
                Full list and queued calls →
              </Link>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

function TaskRow({
  task,
  today,
  onToggle,
}: {
  task: TaskRow;
  today: string;
  onToggle: (task: TaskRow, done: boolean) => void;
}) {
  const done = Boolean(task.done_at);
  const due = task.due_date && today ? describeDue(task.due_date, today) : null;

  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 border-b border-black/5 px-4 py-2.5 transition-colors hover:bg-black/[0.02] ${
        task.pending ? "opacity-50" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={done}
        disabled={task.pending}
        onChange={(event) => onToggle(task, event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-green"
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm leading-snug ${
            done ? "text-charcoal/35 line-through" : "text-charcoal/85"
          }`}
        >
          {task.body}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2">
          {due && !done && (
            <span
              className={`text-[10px] font-bold uppercase tracking-wide ${
                due.overdue ? "text-red-600" : "text-charcoal/40"
              }`}
            >
              {due.label}
            </span>
          )}
          {/* Where it came from, because "I said this to Ana on the phone" and
              "I typed this" are different kinds of memory to jog. */}
          {task.source === "voice" && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-charcoal/30">
              Dictated
            </span>
          )}
        </span>
      </span>
    </label>
  );
}

function failureMessage(reason: string, detail?: string): string {
  if (reason === "unconfigured") return "No database is connected, so nothing was saved.";
  if (reason === "migration_pending") {
    return "The task table doesn't exist yet — run migration 0017. Nothing was saved.";
  }
  return detail ? `Not saved: ${detail}` : "Not saved — the database refused the change.";
}

/**
 * Why the panel is empty. Named rather than shown as a blank list, and the
 * migration case says which file to run, because that one the owner fixes
 * himself in a minute.
 */
function Unavailable({ reason, detail }: { reason: string; detail?: string }) {
  if (reason === "migration_pending") {
    return (
      <p className="px-4 py-6 text-xs leading-relaxed text-charcoal/55">
        One migration left to run. Open the Supabase SQL editor and run{" "}
        <code className="font-mono text-brand-blue">supabase/migrations/0017_owner_tasks.sql</code>.
        Until it exists there is nowhere to keep a task — typed here or dictated to Ana.
      </p>
    );
  }
  if (reason === "unconfigured") {
    return (
      <p className="px-4 py-6 text-xs leading-relaxed text-charcoal/55">
        No database is connected yet. Set the Supabase environment variables to turn this on.
      </p>
    );
  }
  return (
    <p className="px-4 py-6 text-xs leading-relaxed text-charcoal/55">
      {detail ?? "Could not reach the task list."} If the project has been idle for over a week it
      may be paused — open the Supabase dashboard to resume it.
    </p>
  );
}
