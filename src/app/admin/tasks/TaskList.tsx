"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { OwnerTask } from "@/lib/crm/tasks";

/**
 * The dictated to-do list.
 *
 * Same interaction grammar as the job checklist — a tick circle, a pending
 * state on everything, strike-through when done — so the two read as one tool.
 * What differs is provenance: every row here was spoken aloud on a phone call,
 * and the line under it says so and links back to the transcript, because the
 * transcription is one sentence out of context and the recording of what he
 * actually meant is two clicks away.
 *
 * Order is newest first, open before done, and deliberately NOT sorted by due
 * date. Most of these have no date at all; promoting the few that do would
 * bury the note he dictated an hour ago under a reminder for next month.
 * Overdue is carried by colour instead, which survives any sort.
 */

const TZ = "America/Toronto";

export default function TaskList({
  tasks,
  today,
  setDone,
}: {
  tasks: OwnerTask[];
  /** "YYYY-MM-DD" in Montreal, from the server — see the page for why. */
  today: string;
  setDone: (id: string, done: boolean) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const open = tasks.filter((task) => !task.done_at);
  const done = tasks
    .filter((task) => task.done_at)
    .sort((a, b) => (a.done_at! < b.done_at! ? 1 : -1));

  const overdueCount = open.filter((task) => isOverdue(task, today)).length;

  return (
    <div className="space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <SectionTitle>Open · {open.length}</SectionTitle>
          {overdueCount > 0 && (
            <span className="text-xs font-semibold text-red-700">
              {overdueCount} past its date
            </span>
          )}
        </div>

        {open.length === 0 ? (
          <div className="rounded-xl border border-black/5 bg-white p-4 text-sm text-charcoal/50 shadow-sm">
            All caught up — everything dictated has been ticked off.
          </div>
        ) : (
          <ul className="space-y-2">
            {open.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                pending={pending}
                onToggle={() => run(() => setDone(task.id, true))}
              />
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <div className="mb-2">
            <SectionTitle>Done · {done.length}</SectionTitle>
          </div>
          <ul className="space-y-2">
            {done.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                pending={pending}
                onToggle={() => run(() => setDone(task.id, false))}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Says out loud what the "Not called" markers mean, so they don't read
          as a feature that is broken rather than one that isn't built. */}
      <p className="text-[11px] leading-relaxed text-charcoal/40">
        Ana does not make outbound calls yet. When she does, each task will show here whether the
        call was answered, reached voicemail, or went unanswered — with its own transcript.
      </p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-wide text-charcoal/45">{children}</h3>
  );
}

function TaskRow({
  task,
  today,
  pending,
  onToggle,
}: {
  task: OwnerTask;
  today: string;
  pending: boolean;
  onToggle: () => void;
}) {
  const isDone = Boolean(task.done_at);
  const overdue = isOverdue(task, today);

  return (
    <li
      className={`flex items-start gap-3 rounded-xl border p-3 shadow-sm sm:p-4 ${
        isDone
          ? "border-black/5 bg-black/[0.015]"
          : overdue
            ? "border-red-200 bg-white"
            : "border-black/5 bg-white"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        aria-label={isDone ? "Reopen this task" : "Mark this task done"}
        className={`mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors disabled:cursor-wait disabled:opacity-50 ${
          isDone
            ? "border-brand-green bg-brand-green text-white"
            : "border-black/20 hover:border-brand-green"
        }`}
      >
        {isDone && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            aria-hidden
          >
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold leading-relaxed ${
            isDone ? "text-charcoal/45 line-through" : "text-charcoal"
          }`}
        >
          {task.body}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-charcoal/45">
          {task.due_date && <DueChip due={task.due_date} overdue={overdue} today={today} />}

          <span>{sourceLabel(task.source)}</span>

          {task.call_sid && (
            <Link
              href={`/admin/calls#call-${encodeURIComponent(task.call_sid)}`}
              className="font-semibold text-brand-blue underline-offset-2 hover:underline"
            >
              Transcript →
            </Link>
          )}

          <span className="text-charcoal/35">· {formatTimestamp(task.created_at)}</span>

          {isDone && task.done_at && (
            <span className="text-charcoal/35">· done {formatTimestamp(task.done_at)}</span>
          )}
        </div>
      </div>

      {/* Reserved for the outbound-call outcome. Today there is only one
          truthful value, and it is the honest one: nobody has been called. */}
      {!isDone && (
        <span
          title="Outbound calling isn't built yet."
          className="mt-0.5 shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-charcoal/40"
        >
          Not called
        </span>
      )}
    </li>
  );
}

function DueChip({
  due,
  overdue,
  today,
}: {
  due: string;
  overdue: boolean;
  today: string;
}) {
  const style = overdue
    ? "bg-red-100 text-red-800"
    : due === today
      ? "bg-amber-100 text-amber-800"
      : "bg-black/[0.05] text-charcoal/60";

  const label = overdue
    ? `Overdue · ${formatDueDate(due)}`
    : due === today
      ? "Due today"
      : `Due ${formatDueDate(due)}`;

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style}`}
    >
      {label}
    </span>
  );
}

/** A task is only late if it has a date, that date has passed, and it's open. */
function isOverdue(task: OwnerTask, today: string): boolean {
  // Both sides are "YYYY-MM-DD", so a string compare is a date compare.
  return !task.done_at && Boolean(task.due_date) && task.due_date! < today;
}

/**
 * `due_date` is a plain date, not an instant. Parsing "2026-08-07" yields UTC
 * midnight, so it must be formatted in UTC — rendering it in Montreal time
 * would shift every due date back a day.
 */
function formatDueDate(due: string): string {
  const date = new Date(`${due}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return due;
  return date.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** `created_at` and `done_at` are real instants, so they get the office clock. */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  });
}

/**
 * `source` is free text by design (see the migration), so unknown values are
 * shown rather than swallowed — a channel added later should appear here
 * without anyone remembering to update this map.
 */
function sourceLabel(source: string): string {
  if (source === "voice") return "Dictated by phone";
  return `From ${source}`;
}
