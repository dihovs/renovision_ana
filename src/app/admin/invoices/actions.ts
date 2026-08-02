"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/adminAuth";
import { parseMoneyToCents } from "@/lib/crm/money";
import {
  createInvoiceFromJob,
  deletePayment,
  recordPayment,
  getInvoice,
  sendInvoice,
  setInvoiceArchived,
  setInvoiceStatus,
} from "@/lib/crm/invoices";
import { INVOICE_STATUSES, PAYMENT_METHODS, type InvoiceStatus, type PaymentMethod } from "@/lib/crm/opsTypes";
import { emailInvoice } from "@/lib/crm/sendDocument";

export type InvoiceState = { error?: string; ok?: string };

async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) throw new Error("Not authorised");
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createFromJobAction(jobId: string, depositPercent?: number): Promise<void> {
  await requireSession();
  const id = await createInvoiceFromJob(jobId, { depositPercent });
  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/jobs/${jobId}`);
  redirect(`/admin/invoices/${id}`);
}

export async function sendInvoiceAction(id: string): Promise<void> {
  await requireSession();
  await sendInvoice(id);

  // Best-effort, same reasoning as quotes: the invoice is issued and has a
  // link either way, and a mail outage must not leave it stuck in draft.
  try {
    const invoice = await getInvoice(id);
    if (invoice) await emailInvoice(invoice);
  } catch (err) {
    console.error("[invoices] issued but the email failed:", err);
  }

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${id}`);
}

export async function setInvoiceStatusAction(id: string, status: string): Promise<void> {
  await requireSession();
  if (!INVOICE_STATUSES.includes(status as InvoiceStatus)) {
    throw new Error(`Unknown status: ${status}`);
  }
  await setInvoiceStatus(id, status as InvoiceStatus);
  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${id}`);
}

export async function archiveInvoiceAction(id: string, archived: boolean): Promise<void> {
  await requireSession();
  await setInvoiceArchived(id, archived);
  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${id}`);
}

export async function recordPaymentAction(
  invoiceId: string,
  _prev: InvoiceState,
  formData: FormData,
): Promise<InvoiceState> {
  await requireSession();

  // parseMoneyToCents, never Number(): "1 234,56" from a French keyboard has
  // to land as 123456 cents, not NaN.
  const amount = parseMoneyToCents(str(formData, "amount"));
  if (amount === null || amount === 0) return { error: "Enter the amount received." };

  const method = str(formData, "method");

  try {
    await recordPayment(invoiceId, {
      amountCents: amount,
      method: (PAYMENT_METHODS.includes(method as PaymentMethod)
        ? method
        : "other") as PaymentMethod,
      receivedOn: str(formData, "receivedOn") || undefined,
      reference: str(formData, "reference"),
      notes: str(formData, "notes"),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not record the payment." };
  }

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${invoiceId}`);
  return { ok: "Recorded" };
}

export async function removePaymentAction(invoiceId: string, paymentId: string): Promise<void> {
  await requireSession();
  await deletePayment(paymentId);
  revalidatePath(`/admin/invoices/${invoiceId}`);
}
