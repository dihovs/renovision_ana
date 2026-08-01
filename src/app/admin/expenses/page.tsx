import {
  createExpenseAction,
  createTimeEntryAction,
  deleteExpenseAction,
  deleteTimeEntryAction,
} from "./actions";
import AdminNotice from "@/components/admin/AdminNotice";
import ExpensesManager from "@/components/admin/ExpensesManager";
import { MigrationPendingError, isConfigured } from "@/lib/crm/db";
import {
  listExpenses,
  listTimeEntries,
  type ExpenseListItem,
  type TimeEntryListItem,
} from "@/lib/crm/expenses";
import { listJobs } from "@/lib/crm/jobs";

export const dynamic = "force-dynamic";

/**
 * Expenses and time — the cost side of every job.
 *
 * One screen, two tabs, because the person entering a receipt is usually
 * holding the timesheet too. Both feed the job-costing view on Reports.
 */
export default async function ExpensesPage() {
  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set the Supabase environment variables to turn this on.
      </AdminNotice>
    );
  }

  let expenses: ExpenseListItem[] = [];
  let timeEntries: TimeEntryListItem[] = [];
  let jobs: Awaited<ReturnType<typeof listJobs>> = [];
  try {
    [expenses, timeEntries, jobs] = await Promise.all([
      listExpenses(),
      listTimeEntries(),
      listJobs(),
    ]);
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      // The jobs table missing means 0007 hasn't run either — 0012 references
      // it and would fail in the SQL editor, so name the right file.
      const needsJobs = err.message.includes(`"jobs"`);
      return (
        <AdminNotice title="One migration left to run">
          Open the Supabase SQL editor and run{" "}
          <code className="font-mono text-brand-blue">
            supabase/migrations/{needsJobs ? "0007_jobs_invoices.sql" : "0012_expenses_time.sql"}
          </code>
          {needsJobs ? " (expenses attach to jobs, so jobs come first)" : ""}. This screen fills
          itself in as soon as the tables exist.
        </AdminNotice>
      );
    }
    return (
      <AdminNotice title="Could not reach the database">
        {err instanceof Error ? err.message : "Unknown error"}.
      </AdminNotice>
    );
  }

  return (
    <ExpensesManager
      expenses={expenses}
      timeEntries={timeEntries}
      jobs={jobs.map((job) => ({
        id: job.id,
        label: `#${job.job_number} · ${job.title ?? "Untitled"} · ${job.client_name}`,
      }))}
      // Computed here so the client renders a stable default — the office and
      // its receipts live in America/Toronto, whatever the server clock says.
      today={new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" })}
      createExpense={createExpenseAction}
      createTimeEntry={createTimeEntryAction}
      deleteExpense={deleteExpenseAction}
      deleteTimeEntry={deleteTimeEntryAction}
    />
  );
}
