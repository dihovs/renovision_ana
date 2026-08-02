"use client";

import { useActionState, useId, useRef, useState, useTransition } from "react";
import { inputClass, labelClass } from "./AddressFields";
import type { EntryState } from "@/app/(internal)/admin/expenses/actions";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  formatHours,
  type ExpenseListItem,
  type TimeEntryListItem,
} from "@/lib/crm/expenses";
import { formatMoney } from "@/lib/crm/money";

/**
 * Expenses and time entries, one screen with two tabs.
 *
 * The entry form sits above the list and stays open, because receipts get
 * typed in batches — open form, enter, enter, enter — and a form behind a
 * button turns each receipt into three clicks. Successful submits clear the
 * form so the next receipt starts blank.
 */

type JobOption = { id: string; label: string };

export default function ExpensesManager({
  expenses,
  timeEntries,
  jobs,
  today,
  createExpense,
  createTimeEntry,
  deleteExpense,
  deleteTimeEntry,
}: {
  expenses: ExpenseListItem[];
  timeEntries: TimeEntryListItem[];
  jobs: JobOption[];
  /** "YYYY-MM-DD" in America/Toronto, computed server-side. */
  today: string;
  createExpense: (prev: EntryState, formData: FormData) => Promise<EntryState>;
  createTimeEntry: (prev: EntryState, formData: FormData) => Promise<EntryState>;
  deleteExpense: (id: string) => Promise<void>;
  deleteTimeEntry: (id: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<"expenses" | "time">("expenses");
  const [removing, startRemoving] = useTransition();

  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount_cents, 0);
  const totalMinutes = timeEntries.reduce((sum, t) => sum + t.minutes, 0);
  const people = [...new Set(timeEntries.map((t) => t.person))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TabButton active={tab === "expenses"} onClick={() => setTab("expenses")}>
          Expenses{expenses.length > 0 && ` · ${expenses.length}`}
        </TabButton>
        <TabButton active={tab === "time"} onClick={() => setTab("time")}>
          Time{timeEntries.length > 0 && ` · ${timeEntries.length}`}
        </TabButton>
        <span className="ml-auto text-xs font-semibold text-charcoal/50">
          {tab === "expenses"
            ? `${formatMoney(expenseTotal)} recorded`
            : `${formatHours(totalMinutes)} logged`}
        </span>
      </div>

      {tab === "expenses" ? (
        <>
          <ExpenseForm action={createExpense} jobs={jobs} today={today} />

          {expenses.length === 0 ? (
            <p className="rounded-xl border border-black/5 bg-white p-6 text-center text-sm text-charcoal/50 shadow-sm">
              No expenses yet. The first receipt you add appears here — and feeds the job-costing
              view on Reports.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
              {expenses.map((expense) => (
                <li
                  key={expense.id}
                  className="flex items-center gap-3 border-b border-black/5 px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-charcoal">
                      {expense.description}
                      {expense.vendor && (
                        <span className="ml-1.5 font-normal text-charcoal/45">
                          {expense.vendor}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-charcoal/50">
                      {[
                        expense.incurred_on,
                        EXPENSE_CATEGORY_LABEL[expense.category],
                        jobLine(expense),
                      ].join(" · ")}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold tabular-nums ${
                      expense.amount_cents < 0 ? "text-red-700" : "text-charcoal"
                    }`}
                  >
                    {formatMoney(expense.amount_cents)}
                  </span>
                  <button
                    type="button"
                    disabled={removing}
                    onClick={() => startRemoving(async () => deleteExpense(expense.id))}
                    aria-label={`Remove ${formatMoney(expense.amount_cents)} expense from ${expense.incurred_on}`}
                    className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs font-bold text-charcoal/30 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <TimeForm action={createTimeEntry} jobs={jobs} today={today} people={people} />

          {timeEntries.length === 0 ? (
            <p className="rounded-xl border border-black/5 bg-white p-6 text-center text-sm text-charcoal/50 shadow-sm">
              No hours logged yet. One entry per person per day per job keeps the labour picture
              honest.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
              {timeEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 border-b border-black/5 px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-charcoal">
                      {entry.person}
                      {entry.note && (
                        <span className="ml-1.5 font-normal text-charcoal/45">{entry.note}</span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-charcoal/50">
                      {[entry.worked_on, jobLine(entry)].join(" · ")}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-charcoal">
                    {formatHours(entry.minutes)}
                  </span>
                  <button
                    type="button"
                    disabled={removing}
                    onClick={() => startRemoving(async () => deleteTimeEntry(entry.id))}
                    aria-label={`Remove ${formatHours(entry.minutes)} by ${entry.person} on ${entry.worked_on}`}
                    className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs font-bold text-charcoal/30 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/** "#1042 · Kitchen reno", or "Overhead" for an expense tied to no job. */
function jobLine(item: {
  job_number: number | null;
  job_title: string | null;
  job_client: string | null;
}): string {
  if (item.job_number === null) return "Overhead";
  return `#${item.job_number} · ${item.job_title ?? item.job_client ?? "Untitled"}`;
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
        active
          ? "bg-brand-blue text-white"
          : "bg-white text-charcoal/60 shadow-sm ring-1 ring-black/5 hover:text-charcoal"
      }`}
    >
      {children}
    </button>
  );
}

function ExpenseForm({
  action,
  jobs,
  today,
}: {
  action: (prev: EntryState, formData: FormData) => Promise<EntryState>;
  jobs: JobOption[];
  today: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: EntryState, formData: FormData) => {
      const result = await action(prev, formData);
      if (!result.error) formRef.current?.reset();
      return result;
    },
    {} as EntryState,
  );
  const jobId = useId();
  const categoryId = useId();

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-black/5 bg-white p-4 shadow-sm"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field name="description" label="What was it" required placeholder="Subfloor plywood" />
        </div>
        <Field name="vendor" label="Vendor" placeholder="BMR, Réno-Dépôt…" />

        <div>
          <label htmlFor={jobId} className={labelClass}>
            Job
          </label>
          <select id={jobId} name="jobId" defaultValue="" className={inputClass}>
            {/* Overhead is a real answer — fuel and insurance belong to no job,
                and forcing a job here would quietly poison every margin. */}
            <option value="">No job — overhead</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={categoryId} className={labelClass}>
            Category
          </label>
          <select id={categoryId} name="category" defaultValue="materials" className={inputClass}>
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {EXPENSE_CATEGORY_LABEL[category]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field name="amount" label="Amount" required placeholder="86.40" decimal />
          <Field name="incurredOn" label="Date" type="date" defaultValue={today} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add expense"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {state.error}
          </p>
        )}
        {state.ok && !state.error && (
          <p className="text-sm font-medium text-green-700">{state.ok}</p>
        )}
      </div>
    </form>
  );
}

function TimeForm({
  action,
  jobs,
  today,
  people,
}: {
  action: (prev: EntryState, formData: FormData) => Promise<EntryState>;
  jobs: JobOption[];
  today: string;
  people: string[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: EntryState, formData: FormData) => {
      const result = await action(prev, formData);
      if (!result.error) formRef.current?.reset();
      return result;
    },
    {} as EntryState,
  );
  const jobId = useId();
  const personId = useId();

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-black/5 bg-white p-4 shadow-sm"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={jobId} className={labelClass}>
            Job<span className="text-red-500"> *</span>
          </label>
          <select id={jobId} name="jobId" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Pick a job
            </option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.label}
              </option>
            ))}
          </select>
          {jobs.length === 0 && (
            <p className="mt-1 text-[11px] leading-snug text-charcoal/45">
              No jobs yet — hours are always logged against a job. Convert an approved quote into a
              job first.
            </p>
          )}
        </div>

        <div>
          <label htmlFor={personId} className={labelClass}>
            Who<span className="text-red-500"> *</span>
          </label>
          <input
            id={personId}
            name="person"
            required
            list="time-entry-people"
            placeholder="Marc"
            className={inputClass}
          />
          <datalist id="time-entry-people">
            {people.map((person) => (
              <option key={person} value={person} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field name="hours" label="Hours" required placeholder="7.5" decimal />
          <Field name="workedOn" label="Date" type="date" defaultValue={today} />
        </div>

        <div className="sm:col-span-3">
          <Field name="note" label="Note" placeholder="Demo and haul-out" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Saving…" : "Log time"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {state.error}
          </p>
        )}
        {state.ok && !state.error && (
          <p className="text-sm font-medium text-green-700">{state.ok}</p>
        )}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  required,
  type = "text",
  decimal,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  decimal?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        inputMode={decimal ? "decimal" : undefined}
        className={inputClass}
      />
    </div>
  );
}
