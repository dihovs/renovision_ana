"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

/**
 * Outbound calls: what is queued, what came of the ones that happened, and the
 * one control the owner has over them — stopping one before it goes out.
 *
 * Three things drive the layout, in this order:
 *
 *  1. An opt-out is not a row. `opt_out_requested` means that number must never
 *     be dialled again; Ana already made it true mid-call. Rendered as a
 *     standing state at the top, deduplicated by number, because a customer who
 *     asked to be left alone appearing as the fourth line of a list is how they
 *     get called a fifth time.
 *  2. What needs him is separated from what is merely finished. He reads this
 *     between jobs; a reschedule request and a voicemail must not look alike.
 *     Membership is taken straight from the "owner does next" column of
 *     Docs/Voice-Outbound-Conversation.md §4 — every outcome whose answer there
 *     is anything other than "nothing".
 *  3. Where the customer named a new date, their own words are shown verbatim.
 *     They were deliberately never parsed into a timestamp (§5): "jeudi
 *     prochain avant-midi" off a phone line is how a crew ends up at the wrong
 *     house. The owner reads the words and books it himself.
 *
 * There is no "call now" button, on purpose. Eligibility — permitted hours, the
 * do-not-call list, the per-number daily caps — lives in the dialer, and a
 * button here would route around all of it.
 */

const TZ = "America/Toronto";

/**
 * What this screen needs off a `call_tasks` row (migration 0018).
 *
 * A props contract, not a second copy of the model — `CallTask` in
 * src/lib/crm/callTasks.ts is the model, and it satisfies this structurally,
 * so the page passes rows straight through with no mapping and no cast.
 *
 * Two deliberate widenings. `kind`, `status` and `outcome` are plain strings
 * here rather than the library's unions, so a value added to the enum in a
 * later migration renders as itself instead of failing to compile or, worse,
 * being silently dropped by an exhaustive switch. And `contact_name` /
 * `do_not_call` are optional: the loader does not join `clients` today, and
 * the display degrades to the phone number rather than blocking on it.
 */
export type CallTaskView = {
  id: string;
  created_at: string;
  kind: string;
  status: string;
  to_number: string;
  locale: string;
  not_before: string;
  attempts: number;
  max_attempts: number;
  last_attempt_at: string | null;
  call_sid: string | null;
  outcome: string | null;
  outcome_detail: unknown;
  completed_at: string | null;
  error: string | null;
  /** Joined from `clients` when available. Falls back to the number. */
  contact_name?: string | null;
  /**
   * `clients.do_not_call` as it stands right now — not what the outcome code
   * implies. `undefined` means it could not be read, which is not the same as
   * `false`, and only `false` is worth an alarm.
   */
  do_not_call?: boolean | null;
};

export default function CallTaskList({
  tasks,
  now,
  cancel,
}: {
  tasks: CallTaskView[];
  /** Server clock, ISO. Relative labels are computed from it so the first
   *  paint matches the server render instead of tripping hydration. */
  now: string;
  cancel: (id: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  function runCancel(id: string) {
    setError(null);
    setConfirming(null);
    startTransition(async () => {
      try {
        await cancel(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not stop that call.");
      }
    });
  }

  const optOuts = dedupeByNumber(tasks.filter((t) => t.outcome === "opt_out_requested"));

  const isPending = (t: CallTaskView) => t.status === "queued" || t.status === "dialing";

  const queued = tasks.filter(isPending).sort((a, b) => (a.not_before < b.not_before ? -1 : 1));

  // Anything not still going out and not already shown as an opt-out. Written
  // as the complement rather than a status allow-list so a status added to the
  // enum later surfaces somewhere instead of vanishing off the screen.
  const finished = tasks.filter((t) => !isPending(t) && t.outcome !== "opt_out_requested");

  const needsYou = finished.filter(needsOwner).sort(byMostRecentFirst);
  const settled = finished.filter((t) => !needsOwner(t)).sort(byMostRecentFirst);

  return (
    <div className="space-y-5">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}

      {optOuts.length > 0 && <OptOutBanner tasks={optOuts} />}

      {needsYou.length > 0 && (
        <section>
          <SectionTitle tone="alert">Needs you · {needsYou.length}</SectionTitle>
          <ul className="mt-2 space-y-2">
            {needsYou.map((task) => (
              <FinishedRow key={task.id} task={task} prominent />
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle>Queued · {queued.length}</SectionTitle>
        {queued.length === 0 ? (
          <EmptyCard>
            Nothing waiting to go out. Ana queues these herself — a confirmation the day before a
            booked visit, a heads-up when the crew leaves, a call when a time moves — so an empty
            queue means nothing is due, not that something is switched off.
          </EmptyCard>
        ) : (
          <ul className="mt-2 space-y-2">
            {queued.map((task) => (
              <QueuedRow
                key={task.id}
                task={task}
                now={now}
                pending={pending}
                confirming={confirming === task.id}
                onAskCancel={() => setConfirming(task.id)}
                onDismissCancel={() => setConfirming(null)}
                onCancel={() => runCancel(task.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {settled.length > 0 && (
        <section>
          <SectionTitle>Done · {settled.length}</SectionTitle>
          <p className="mt-1 text-[11px] text-charcoal/40">Nothing here is waiting on you.</p>
          <ul className="mt-2 space-y-1.5">
            {settled.map((task) => (
              <FinishedRow key={task.id} task={task} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Opt-outs                                                            */
/* ------------------------------------------------------------------ */

/**
 * The one thing on this screen that is a state rather than an event.
 *
 * Ana sets `clients.do_not_call` live, mid-call, in the same breath as telling
 * the customer she is doing it, so by the time this renders it is already true.
 * What this block is for is making sure the owner knows — the doc asks for it
 * to be surfaced the same day — and reminding him that clearing it is his hand
 * on the switch, not a side effect of anything here.
 */
function OptOutBanner({ tasks }: { tasks: CallTaskView[] }) {
  return (
    <section
      aria-label="Numbers that must never be called again"
      className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-center gap-2">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          aria-hidden
          className="shrink-0 text-red-700"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M5.6 5.6l12.8 12.8" strokeLinecap="round" />
        </svg>
        <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-red-800">
          Do not call · {tasks.length}
        </h3>
      </div>

      <ul className="mt-3 space-y-3">
        {tasks.map((task) => (
          <li key={task.id} className="border-t border-red-200 pt-3 first:border-0 first:pt-0">
            <p className="text-sm font-bold leading-snug text-red-900">
              {displayName(task)} asked never to be called again.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-red-900/75">
              {hasName(task)
                ? `${formatNumber(task.to_number)} — taken off the list during the call on `
                : "Taken off the list during the call on "}
              {formatTimestamp(task.completed_at ?? task.last_attempt_at ?? task.created_at)}.
              {/* Only claim the suppression holds when the record says so.
                  The warning below covers the case where it does not. */}
              {task.do_not_call === false
                ? ""
                : " Ana will not dial this number for any errand from now on."}
            </p>
            <Note task={task} tone="alert" />

            {/* The flag and the outcome code are written by two independent
                paths on purpose — Ana sets the flag live and the webhook
                writes it again afterwards — so that both have to fail before
                someone gets called after being promised they would not. This
                is what "both failed" looks like, and it is the only thing on
                this screen worth shouting about. */}
            {task.do_not_call === false && (
              <p className="mt-2 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold leading-relaxed text-white">
                The do-not-call flag is not set on this client. She told them they would not be
                called again and the record does not agree — set it on the client now, before the
                next sweep runs.
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              <TranscriptLink task={task} className="text-red-800" />
              <span className="text-red-900/55">
                Only you can undo this, in the client&apos;s record. Worth a personal apology — from
                you, not from Ana.
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Queued                                                              */
/* ------------------------------------------------------------------ */

function QueuedRow({
  task,
  now,
  pending,
  confirming,
  onAskCancel,
  onDismissCancel,
  onCancel,
}: {
  task: CallTaskView;
  now: string;
  pending: boolean;
  confirming: boolean;
  onAskCancel: () => void;
  onDismissCancel: () => void;
  onCancel: () => void;
}) {
  const dialing = task.status === "dialing";

  return (
    <li className="rounded-xl border border-black/5 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-charcoal">{displayName(task)}</span>
            <KindChip kind={task.kind} />
            {dialing && (
              <span className="rounded-full bg-brand-green px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                On the line
              </span>
            )}
            {task.locale && (
              <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-charcoal/50">
                {task.locale}
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-charcoal/70">{kindPurpose(task.kind)}</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-charcoal/50">
            {hasName(task) && (
              <>
                <span className="font-semibold text-charcoal/65">
                  {formatNumber(task.to_number)}
                </span>
                <span>·</span>
              </>
            )}
            <span>{dialing ? "Dialling now" : dueLabel(task.not_before, now)}</span>
            {task.attempts > 0 && (
              <>
                <span>·</span>
                <span>
                  attempt {task.attempts + 1} of {task.max_attempts}
                </span>
              </>
            )}
          </div>
        </div>

        {task.status === "queued" ? (
          confirming ? (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={pending}
                className="cursor-pointer rounded-full bg-red-700 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-800 disabled:cursor-wait disabled:opacity-50"
              >
                Yes, don&apos;t call
              </button>
              <button
                type="button"
                onClick={onDismissCancel}
                disabled={pending}
                className="cursor-pointer text-xs font-semibold text-charcoal/50 hover:text-charcoal disabled:opacity-50"
              >
                Keep it
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAskCancel}
              disabled={pending}
              className="shrink-0 cursor-pointer rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-charcoal/60 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-50"
            >
              Cancel
            </button>
          )
        ) : (
          // A row that is already dialling cannot be recalled — the call is
          // in progress. Saying so beats a disabled button with no reason.
          <span className="shrink-0 text-[11px] text-charcoal/40">Too late to stop</span>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Finished                                                            */
/* ------------------------------------------------------------------ */

function FinishedRow({ task, prominent = false }: { task: CallTaskView; prominent?: boolean }) {
  const failedOutright = task.status === "failed" || task.outcome === "failed";
  const verbatim = verbatimFields(task);

  return (
    <li
      className={
        prominent
          ? `rounded-xl border-l-4 bg-white p-3 shadow-sm sm:p-4 ${
              failedOutright ? "border-l-red-500" : "border-l-amber-400"
            } border-y border-r border-y-black/5 border-r-black/5`
          : "rounded-xl border border-black/5 bg-black/[0.015] px-3 py-2"
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={
            prominent ? "text-sm font-bold text-charcoal" : "text-sm font-semibold text-charcoal/75"
          }
        >
          {displayName(task)}
        </span>
        <span className={prominent ? "text-sm text-charcoal/70" : "text-xs text-charcoal/55"}>
          {outcomeSentence(task)}
        </span>
        {!prominent && <KindChip kind={task.kind} muted />}
      </div>

      {verbatim.length > 0 && (
        <div className="mt-2 space-y-2">
          {verbatim.map((field) => (
            <blockquote
              key={field.label}
              className="rounded-lg border-l-2 border-brand-blue/30 bg-brand-blue/[0.04] px-3 py-2"
            >
              <span className="block text-[10px] font-bold uppercase tracking-wide text-brand-blue/70">
                {field.label}
              </span>
              <span className="mt-0.5 block text-sm italic leading-relaxed text-charcoal/85">
                &ldquo;{field.text}&rdquo;
              </span>
            </blockquote>
          ))}
          {verbatim.some((field) => field.scheduling) && (
            <p className="text-[11px] text-charcoal/45">
              Their words, not a date. Nothing has been booked — that is yours to do.
            </p>
          )}
        </div>
      )}

      <Note task={task} />

      {prominent && (
        <p className="mt-2 text-xs font-semibold text-charcoal/60">{nextStep(task)}</p>
      )}

      {failedOutright && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-900">
          <span className="font-bold">
            {task.attempts} of {task.max_attempts} tries used
            {task.status === "failed" ? " — giving up" : ""}.
          </span>{" "}
          {task.error ? task.error : "No error was recorded, which is itself worth a look."}
        </p>
      )}

      <div
        className={`mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 ${
          prominent ? "text-[11px]" : "text-[10px]"
        } text-charcoal/45`}
      >
        {hasName(task) && (
          <>
            <span>{formatNumber(task.to_number)}</span>
            <span>·</span>
          </>
        )}
        {prominent && (
          <>
            <KindChip kind={task.kind} muted />
            <span>·</span>
          </>
        )}
        <span>{formatTimestamp(task.completed_at ?? task.last_attempt_at ?? task.created_at)}</span>
        <TranscriptLink task={task} />
      </div>
    </li>
  );
}

function Note({ task, tone }: { task: CallTaskView; tone?: "alert" }) {
  const note = detailString(task.outcome_detail, "note_for_owner");
  if (!note) return null;
  return (
    <p
      className={`mt-1.5 text-xs leading-relaxed ${
        tone === "alert" ? "text-red-900/80" : "text-charcoal/65"
      }`}
    >
      {note}
    </p>
  );
}

function TranscriptLink({ task, className }: { task: CallTaskView; className?: string }) {
  if (!task.call_sid) return null;
  return (
    <Link
      href={`/admin/calls#call-${encodeURIComponent(task.call_sid)}`}
      className={`font-semibold underline-offset-2 hover:underline ${className ?? "text-brand-blue"}`}
    >
      Transcript →
    </Link>
  );
}

function KindChip({ kind, muted = false }: { kind: string; muted?: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        muted ? "bg-black/[0.04] text-charcoal/45" : "bg-brand-blue/10 text-brand-blue"
      }`}
    >
      {kindLabel(kind)}
    </span>
  );
}

function SectionTitle({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "alert";
}) {
  return (
    <h3
      className={`text-xs font-bold uppercase tracking-wide ${
        tone === "alert" ? "text-amber-700" : "text-charcoal/45"
      }`}
    >
      {children}
    </h3>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 rounded-xl border border-black/5 bg-white p-4 text-sm leading-relaxed text-charcoal/50 shadow-sm">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Wording                                                             */
/* ------------------------------------------------------------------ */

const KIND_LABEL: Record<string, string> = {
  confirm_visit: "Confirm visit",
  crew_on_way: "Crew on the way",
  schedule_change: "Schedule change",
};

/** Unknown kinds are shown, not swallowed — the enum can grow. */
function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind.replace(/_/g, " ");
}

const KIND_PURPOSE: Record<string, string> = {
  confirm_visit: "Checking the appointment still holds.",
  crew_on_way: "Letting them know the crew is on the way.",
  schedule_change: "Telling them the time has moved.",
};

function kindPurpose(kind: string): string {
  return KIND_PURPOSE[kind] ?? "";
}

/**
 * The outcome as a person would say it, not as the enum spells it.
 *
 * `no_answer` and the voicemail codes carry the attempt count inline, because
 * "no answer" on its own reads as a dead end when it is usually a retry that
 * hasn't happened yet.
 */
function outcomeSentence(task: CallTaskView): string {
  const tries = `${task.attempts} of ${task.max_attempts} tries`;

  if (task.status === "cancelled") return "Cancelled before it went out";

  switch (task.outcome) {
    case "reached_confirmed":
      return "Confirmed";
    case "reached_declined":
      return task.kind === "confirm_visit" ? "Cancelled the visit" : "Said no";
    case "reached_reschedule_requested":
      return "Asked to reschedule";
    case "reached_unresolved":
      return "Answered, but nothing was settled";
    case "reached_third_party":
      return "Someone else answered — the file was not discussed";
    case "voicemail_left":
      return "Left a voicemail";
    case "voicemail_no_message":
      return "Reached the voicemail, left no message";
    case "no_answer":
      return `No answer, ${tries}`;
    case "wrong_number":
      return "Wrong number";
    case "opt_out_requested":
      return "Asked never to be called again";
    case "failed":
      // The attempt count is carried by the failure block underneath, which
      // also has the error, so repeating it here would say it twice.
      return "The call never happened";
    default:
      // status === "failed" with no outcome written, or an outcome added to
      // the enum after this screen was built.
      if (task.status === "failed") return `Could not be placed, ${tries}`;
      return task.outcome ? task.outcome.replace(/_/g, " ") : "No outcome recorded";
  }
}

/**
 * What he does about it. Lifted from the "Owner does next" column of
 * Docs/Voice-Outbound-Conversation.md §4 rather than reworded, so the screen
 * and the spec cannot drift apart.
 */
function nextStep(task: CallTaskView): string {
  if (task.status === "failed" || task.outcome === "failed") {
    return "Look at this one. The same number failing repeatedly is a data problem, not a customer problem.";
  }
  switch (task.outcome) {
    case "reached_declined":
      return task.kind === "confirm_visit"
        ? "Free the slot, and decide whether it is worth a call from you."
        : "Decide whether it is worth a call from you.";
    case "reached_reschedule_requested":
      return "Book it against what they said, then call to confirm. Nothing is booked yet.";
    case "reached_unresolved":
      return "Usually worth one more attempt — Ana will retry unless you cancel it.";
    case "reached_third_party":
      return "Try again when they suggested, or call yourself.";
    case "wrong_number":
      return "Fix the number on the client record. It is suppressed for this errand, not blacklisted.";
    default:
      break;
  }
  // The errand itself landed fine; what puts the row here is something the
  // customer raised on the way past, and both of those are owed a call back.
  if (detailString(task.outcome_detail, "new_enquiry_text")) {
    return "New work they want done — the estimator should call them about it.";
  }
  if (detailString(task.outcome_detail, "unanswered_question")) {
    return "They asked something Ana is not allowed to answer. Someone owes them a reply.";
  }
  return "Worth a look.";
}

/**
 * Which finished calls are his problem.
 *
 * Everything the spec's outcome table answers with something other than
 * "nothing", plus any call that came back carrying a question Ana refused or a
 * new job the customer mentioned — those are owed a callback regardless of how
 * the errand itself landed.
 */
const NEEDS_OWNER_OUTCOMES = new Set([
  "reached_declined",
  "reached_reschedule_requested",
  "reached_unresolved",
  "reached_third_party",
  "wrong_number",
  "failed",
]);

function needsOwner(task: CallTaskView): boolean {
  if (task.status === "cancelled") return false;
  if (task.status === "failed") return true;
  if (task.outcome && NEEDS_OWNER_OUTCOMES.has(task.outcome)) return true;
  return (
    Boolean(detailString(task.outcome_detail, "unanswered_question")) ||
    Boolean(detailString(task.outcome_detail, "new_enquiry_text"))
  );
}

/**
 * The free-text fields that hold the customer's own words. Shown as quotes and
 * never reformatted: §5 of the spec keeps them unparsed on purpose, and the
 * whole value is that a human reads what was actually said.
 */
const VERBATIM_FIELDS: { key: string; label: string; scheduling: boolean }[] = [
  { key: "requested_date_text", label: "When they want it instead", scheduling: true },
  { key: "callback_window_text", label: "When to try again", scheduling: true },
  {
    key: "unanswered_question",
    label: "What they asked that Ana could not answer",
    scheduling: false,
  },
  { key: "new_enquiry_text", label: "New work they mentioned", scheduling: false },
];

type VerbatimField = { label: string; text: string; scheduling: boolean };

function verbatimFields(task: CallTaskView): VerbatimField[] {
  const out: VerbatimField[] = [];
  for (const field of VERBATIM_FIELDS) {
    const text = detailString(task.outcome_detail, field.key);
    if (text) out.push({ label: field.label, text, scheduling: field.scheduling });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Plumbing                                                            */
/* ------------------------------------------------------------------ */

/**
 * `outcome_detail` is jsonb, so it is whatever the webhook wrote. Only strings
 * are pulled out of it and everything else is ignored — a field that arrives as
 * an object must render as nothing rather than as "[object Object]".
 */
function detailString(detail: unknown, key: string): string | null {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const value = (detail as Record<string, unknown>)[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasName(task: CallTaskView): boolean {
  return Boolean(task.contact_name?.trim());
}

/**
 * Who the call is to. Falls back to the number, which is why every caller
 * checks `hasName` before printing the number a second time — a row headed
 * "(514) 555-0123" with "(514) 555-0123" underneath it says nothing twice.
 */
function displayName(task: CallTaskView): string {
  const name = task.contact_name?.trim();
  return name && name.length > 0 ? name : formatNumber(task.to_number);
}

/** One opt-out per number: the same person refusing twice is still one state. */
function dedupeByNumber(tasks: CallTaskView[]): CallTaskView[] {
  const seen = new Set<string>();
  const out: CallTaskView[] = [];
  for (const task of [...tasks].sort(byMostRecentFirst)) {
    if (seen.has(task.to_number)) continue;
    seen.add(task.to_number);
    out.push(task);
  }
  return out;
}

function byMostRecentFirst(a: CallTaskView, b: CallTaskView): number {
  const left = a.completed_at ?? a.last_attempt_at ?? a.created_at;
  const right = b.completed_at ?? b.last_attempt_at ?? b.created_at;
  // Tie-broken on id so two rows written in the same second do not swap
  // places between renders — a list that reorders on refresh reads as though
  // something changed when nothing did.
  if (left === right) return a.id < b.id ? 1 : -1;
  return left < right ? 1 : -1;
}

/** E.164 to the shape a Quebec number is read aloud in. Anything else as-is. */
function formatNumber(e164: string): string {
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : e164;
}

/**
 * When a queued call goes out, against the server's clock.
 *
 * "Ready to go" rather than a past time when `not_before` has already passed:
 * the row is waiting for the next sweep, and printing a timestamp from an hour
 * ago reads as a call that was missed.
 */
function dueLabel(notBefore: string, now: string): string {
  const due = new Date(notBefore);
  const current = new Date(now);
  if (Number.isNaN(due.getTime()) || Number.isNaN(current.getTime())) return "";

  if (due.getTime() <= current.getTime()) return "Ready to go — waiting for the next sweep";

  const dueDay = due.toLocaleDateString("en-CA", { timeZone: TZ });
  const today = current.toLocaleDateString("en-CA", { timeZone: TZ });
  const time = due.toLocaleTimeString("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  });

  if (dueDay === today) return `Goes out today at ${time}`;

  const tomorrow = new Date(current.getTime() + 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", {
    timeZone: TZ,
  });
  if (dueDay === tomorrow) return `Goes out tomorrow at ${time}`;

  return `Goes out ${due.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: TZ,
  })} at ${time}`;
}

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
