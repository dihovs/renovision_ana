import { NextResponse } from "next/server";
import { guarded } from "../../../guard";
import { getClient } from "@/lib/crm/clients";
import { listInsuranceEstimates } from "@/lib/crm/insuranceEstimates";
import { listInvoices } from "@/lib/crm/invoices";
import { listJobs } from "@/lib/crm/jobs";
import { listProjects } from "@/lib/crm/projects";
import { listQuotes } from "@/lib/crm/quotes";
import { listLeads } from "@/lib/leadStore";
import { clientDisplayName, clientPersonName, formatAddress } from "@/lib/crm/types";

/**
 * Everything about one customer, in one call — the phone's Customer screen.
 * The same lists the web client hub shows (clients/[id]/page.tsx), each one
 * failing on its own so a pending migration costs a section, not the screen.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id).catch(() => null);
  if (!client) return NextResponse.json({ error: "No such customer." }, { status: 404 });

  return guarded(async () => {
    const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
    const [leads, estimates, quotes, projects, jobs, invoices] = await Promise.all([
      safe(listLeads(50, id)),
      safe(listInsuranceEstimates({ clientId: id, limit: 50 })),
      safe(listQuotes({ clientId: id, limit: 50 })),
      safe(listProjects({ clientId: id, limit: 50 })),
      safe(listJobs({ clientId: id, limit: 50 })),
      safe(listInvoices({ clientId: id, limit: 50 })),
    ]);

    const addresses = client.properties
      .map((p) => ({
        id: p.id,
        label: formatAddress({ street1: p.street1, street2: p.street2, city: p.city, province: p.province, postal_code: p.postal_code }),
      }))
      .filter((p) => p.label);

    return {
      client: {
        id: client.id,
        name: clientDisplayName(client),
        person: clientPersonName(client),
        phones: client.phones.map((p) => p.number),
        emails: client.emails.map((e) => e.address),
        properties: addresses,
        notes: client.notes,
        archived: Boolean(client.archived_at),
      },
      requests: leads.map((l) => ({
        id: l.id,
        title: l.scope_summary?.split("\n")[0] || l.name,
        status: l.status,
        createdAt: l.created_at,
      })),
      estimates: estimates.map((e) => ({
        id: e.id,
        projectId: e.project_id,
        title: e.title || e.project_name,
        address: e.address,
        status: e.status,
        totalCents: e.total_cents,
        lineCount: e.line_count,
        updatedAt: e.updated_at,
      })),
      quotes: quotes.map((q) => ({
        id: q.id,
        number: q.quote_number,
        title: q.title,
        status: q.status,
        totalCents: q.total_cents,
        updatedAt: q.updated_at,
      })),
      projects: projects.map((p) => ({ id: p.id, name: p.name, status: p.status, roomCount: p.room_count })),
      jobs: jobs.map((j) => ({
        id: j.id,
        number: j.job_number,
        title: j.title,
        status: j.status,
        totalCents: j.total_cents,
        startsOn: j.starts_on,
      })),
      invoices: invoices.map((i) => ({
        id: i.id,
        number: i.invoice_number,
        title: i.title,
        status: i.status,
        totalCents: i.total_cents,
        balanceCents: Math.max(0, i.total_cents - i.amount_paid_cents),
        issueDate: i.issue_date,
      })),
    };
  });
}
