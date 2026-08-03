"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/adminAuth";
import {
  conversionError,
  type ConversionResult,
  type ConversionState,
} from "@/lib/crm/conversions";
import { parseMoneyToCents } from "@/lib/crm/money";
import {
  createInvoiceFromJob,
  createInvoiceFromQuote,
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

/**
 * Bill a job.
 *
 * Idempotent — a job already invoiced opens the invoice that exists rather than
 * raising a second one. Everything it will not do (a cancelled job, work that
 * no longer totals what the customer approved, a deposit asked for after the
 * final bill) comes back as a sentence to put on the screen, because a thrown
 * error loses its message in production.
 */
export async function createFromJobAction(
  jobId: string,
  depositPercent?: number,
): Promise<ConversionState> {
  await requireSession();

  let invoice: ConversionResult;
  try {
    invoice = await createInvoiceFromJob(jobId, { depositPercent });
  } catch (err) {
    return conversionError(err, "Could not create the invoice.");
  }

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/jobs/${jobId}`);
  redirect(`/admin/invoices/${invoice.id}`);
}

/**
 * Bill an approved quote in one press: convert it to a job, then invoice that
 * job. Both halves are idempotent, so this can be pressed on a quote that was
 * already converted, already invoiced, or both.
 */
export async function invoiceQuoteAction(
  quoteId: string,
  depositPercent?: number,
): Promise<ConversionState> {
  await requireSession();

  let invoice: ConversionResult;
  try {
    invoice = await createInvoiceFromQuote(quoteId, { depositPercent });
  } catch (err) {
    return conversionError(err, "Could not invoice the quote.");
  }

  revalidatePath("/admin/invoices");
  revalidatePath("/admin/jobs");
  revalidatePath("/admin/quotes");
  redirect(`/admin/invoices/${invoice.id}`);
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
