"use server";

import { revalidatePath } from "next/cache";
import { isSignedIn } from "@/lib/adminAuth";
import {
  createExpense,
  createTimeEntry,
  deleteExpense,
  deleteTimeEntry,
  parseHoursToMinutes,
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from "@/lib/crm/expenses";
import { parseMoneyToCents } from "@/lib/crm/money";

export type EntryState = { error?: string; ok?: string };

async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) throw new Error("Not authorised");
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Today in America/Toronto — the server clock is UTC and receipts are not. */
function todayToronto(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

/** A date input yields "YYYY-MM-DD" or ""; anything else defaults to today. */
function dateOrToday(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayToronto();
}

function revalidate(): void {
  revalidatePath("/admin/expenses");
  // Job costing on the reports screen is derived from these tables.
  revalidatePath("/admin/reports");
}

export async function createExpenseAction(
  _prev: EntryState,
  formData: FormData,
): Promise<EntryState> {
  await requireSession();

  const description = str(formData, "description");
  if (!description) return { error: "Say what the money was for." };

  // parseMoneyToCents, never Number() — "86,40" on a French keyboard must
  // read as $86.40, not NaN.
  const amountCents = parseMoneyToCents(str(formData, "amount"));
  if (amountCents === null || amountCents === 0) {
    return { error: "Enter an amount, like 86.40. Negative for a refund." };
  }

  const rawCategory = str(formData, "category");
  const category: ExpenseCategory = (EXPENSE_CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as ExpenseCategory)
    : "other";

  try {
    await createExpense({
      jobId: str(formData, "jobId") || null,
      vendor: str(formData, "vendor") || null,
      description,
      category,
      amountCents,
      incurredOn: dateOrToday(str(formData, "incurredOn")),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the expense." };
  }

  revalidate();
  return { ok: "Expense added" };
}

export async function createTimeEntryAction(
  _prev: EntryState,
  formData: FormData,
): Promise<EntryState> {
  await requireSession();

  const jobId = str(formData, "jobId");
  if (!jobId) return { error: "Pick the job the hours belong to." };

  const person = str(formData, "person");
  if (!person) return { error: "Say who did the work." };

  const minutes = parseHoursToMinutes(str(formData, "hours"));
  if (minutes === null) return { error: "Enter hours like 7.5 — up to 24 per entry." };

  try {
    await createTimeEntry({
      jobId,
      person,
      minutes,
      workedOn: dateOrToday(str(formData, "workedOn")),
      note: str(formData, "note") || null,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the time entry." };
  }

  revalidate();
  return { ok: "Time logged" };
}

export async function deleteExpenseAction(id: string): Promise<void> {
  await requireSession();
  await deleteExpense(id);
  revalidate();
}

export async function deleteTimeEntryAction(id: string): Promise<void> {
  await requireSession();
  await deleteTimeEntry(id);
  revalidate();
}
