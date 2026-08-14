import { db, isMissingTable, MigrationPendingError } from "./db";

/**
 * Expenses and time entries — what the work costs.
 *
 * Quotes and invoices say what a job is worth; these two tables say what it
 * took to deliver. Money stays integer cents and durations are integer
 * minutes, for the same reason: "7.5 hours" as a float invites drift, and
 * 450 minutes is exact. The UI speaks hours and converts at the edge.
 */

export const EXPENSE_CATEGORIES = [
  "materials",
  "subcontractor",
  "equipment",
  "fuel",
  "permits",
  "disposal",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  materials: "Materials",
  subcontractor: "Subcontractor",
  equipment: "Equipment",
  fuel: "Fuel",
  permits: "Permits",
  disposal: "Disposal",
  other: "Other",
};

export type Expense = {
  id: string;
  created_at: string;
  job_id: string | null;
  vendor: string | null;
  description: string;
  category: ExpenseCategory;
  amount_cents: number;
  incurred_on: string;
};

export type TimeEntry = {
  id: string;
  created_at: string;
  job_id: string;
  person: string;
  minutes: number;
  worked_on: string;
  note: string | null;
};

/** The job columns each list carries so a row can name what it was for. */
type JobRef = {
  job_number: number;
  title: string | null;
  client_snapshot: { displayName?: string } | null;
} | null;

export type ExpenseListItem = Expense & {
  job_number: number | null;
  job_title: string | null;
  job_client: string | null;
};

export type TimeEntryListItem = TimeEntry & {
  job_number: number | null;
  job_title: string | null;
  job_client: string | null;
};

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

function orNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function withJob<T>(row: T & { jobs: JobRef }): T & {
  job_number: number | null;
  job_title: string | null;
  job_client: string | null;
} {
  const { jobs, ...rest } = row;
  return {
    ...(rest as T),
    job_number: jobs?.job_number ?? null,
    job_title: jobs?.title ?? null,
    job_client: jobs?.client_snapshot?.displayName ?? null,
  };
}

export async function listExpenses(limit = 300): Promise<ExpenseListItem[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("expenses")
    .select("*, jobs(job_number, title, client_snapshot)")
    .order("incurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("expenses", error.message);
    throw new Error(`Could not load expenses: ${error.message}`);
  }
  return ((data ?? []) as (Expense & { jobs: JobRef })[]).map(withJob);
}

export async function listTimeEntries(limit = 300): Promise<TimeEntryListItem[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("time_entries")
    .select("*, jobs(job_number, title, client_snapshot)")
    .order("worked_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("time_entries", error.message);
    throw new Error(`Could not load time entries: ${error.message}`);
  }
  return ((data ?? []) as (TimeEntry & { jobs: JobRef })[]).map(withJob);
}

export async function createExpense(input: {
  jobId: string | null;
  vendor?: string | null;
  description: string;
  category: ExpenseCategory;
  amountCents: number;
  incurredOn: string;
}): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("expenses").insert({
    job_id: input.jobId,
    vendor: orNull(input.vendor),
    description: input.description.trim(),
    category: input.category,
    amount_cents: input.amountCents,
    incurred_on: input.incurredOn,
  });

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("expenses", error.message);
    throw new Error(`Could not save the expense: ${error.message}`);
  }
}

export async function createTimeEntry(input: {
  jobId: string;
  person: string;
  minutes: number;
  workedOn: string;
  note?: string | null;
}): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("time_entries").insert({
    job_id: input.jobId,
    person: input.person.trim(),
    minutes: input.minutes,
    worked_on: input.workedOn,
    note: orNull(input.note),
  });

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("time_entries", error.message);
    throw new Error(`Could not save the time entry: ${error.message}`);
  }
}

export async function deleteExpense(id: string): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("expenses").delete().eq("id", id);
  if (error) throw new Error(`Could not remove the expense: ${error.message}`);
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("time_entries").delete().eq("id", id);
  if (error) throw new Error(`Could not remove the time entry: ${error.message}`);
}

/** 450 → "7.5 h", 60 → "1 h". Durations render in hours; storage is minutes. */
export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  const text = hours.toFixed(hours % 1 === 0 ? 0 : 1);
  return `${text} h`;
}

/**
 * "7,5" or "7.5" hours → 450 minutes. Comma is not an edge case — this is
 * Quebec and half the keyboards produce it. Capped at 24 because a longer
 * day is a typo, not a shift.
 */
export function parseHoursToMinutes(input: string): number | null {
  const cleaned = input.trim().replace(",", ".");
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === "" || cleaned === ".") return null;
  const hours = Number(cleaned);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return null;
  return Math.round(hours * 60);
}
