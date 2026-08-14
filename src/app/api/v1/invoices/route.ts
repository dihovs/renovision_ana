import { guarded } from "../guard";
import { listInvoices } from "@/lib/crm/invoices";

/**
 * Invoices, newest first.
 *
 * Cents on the wire, exactly as stored. Formatting money is a presentation
 * concern and doing it here would mean two places that decide what a dollar
 * looks like — and the one on the phone would be the one the customer is
 * shown.
 */
export async function GET() {
  return guarded(async () => ({
    invoices: (await listInvoices({ limit: 300 })).map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      clientName: invoice.client_name,
      title: invoice.title,
      status: invoice.status,
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      totalCents: invoice.total_cents,
      amountPaidCents: invoice.amount_paid_cents,
      // What is actually outstanding — the number that decides whether this
      // invoice needs a phone call today. Derived rather than stored, so it
      // cannot drift from the payments recorded against it.
      balanceCents: invoice.total_cents - invoice.amount_paid_cents,
    })),
  }));
}
