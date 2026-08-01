import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSignedIn } from "@/lib/adminAuth";
import { db } from "@/lib/crm/db";
import { formatMoney } from "@/lib/crm/money";
import { clientDisplayName } from "@/lib/crm/types";

/**
 * Global admin search — one query across clients, leads, quotes, jobs and
 * invoices, for the box in the admin header.
 *
 * Same shape as the price-book picker route: GET with a `q` param, behind the
 * admin session. The layout protects pages, but a route handler is a public
 * endpoint and must check the session itself — this returns customer names and
 * phone numbers, exactly the data the login exists to protect.
 *
 * Each entity fails alone. A table whose migration hasn't run yet drops out of
 * the results rather than taking the whole search down — the same philosophy
 * as the retention cron's per-task results.
 */

export type SearchResult = {
  href: string;
  label: string;
  detail: string | null;
};

export type SearchGroup = {
  kind: "clients" | "leads" | "quotes" | "jobs" | "invoices";
  label: string;
  results: SearchResult[];
};

const PER_ENTITY = 5;
const MAX_TERM_LENGTH = 80;

/** Commas and parens would otherwise split PostgREST's or() clause list. */
function safeTerm(term: string): string {
  return term.replace(/[,()]/g, " ");
}

/** "1042" or "#1042" — a document number, when the term looks like one. */
function asDocumentNumber(term: string): number | null {
  const match = /^#?(\d{1,9})$/.exec(term);
  return match ? Number(match[1]) : null;
}

/** "part_paid" → "Part paid". */
function statusLabel(status: string): string {
  const text = status.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const CLIENT_COLUMNS = "id, first_name, last_name, company_name, emails, phones";

type ClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  emails: { address?: string; primary?: boolean }[] | null;
  phones: { number?: string; primary?: boolean }[] | null;
};

async function searchClients(client: SupabaseClient, term: string): Promise<SearchResult[]> {
  const safe = safeTerm(term);
  const { data, error } = await client
    .from("clients")
    .select(CLIENT_COLUMNS)
    .is("archived_at", null)
    .or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,company_name.ilike.%${safe}%`)
    .order("updated_at", { ascending: false })
    .limit(PER_ENTITY);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ClientRow[];

  // Emails and phones live in jsonb arrays, which PostgREST cannot ilike into.
  // When the term reads as contact info, scan recent clients here instead — a
  // single-operator client book fits comfortably in one fetch.
  const digits = term.replace(/\D/g, "");
  if (rows.length < PER_ENTITY && (term.includes("@") || digits.length >= 3)) {
    const recent = await client
      .from("clients")
      .select(CLIENT_COLUMNS)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(400);
    if (!recent.error) {
      const needle = term.toLowerCase();
      for (const row of (recent.data ?? []) as ClientRow[]) {
        if (rows.length >= PER_ENTITY) break;
        if (rows.some((existing) => existing.id === row.id)) continue;
        const emailHit = (row.emails ?? []).some((e) =>
          (e.address ?? "").toLowerCase().includes(needle),
        );
        const phoneHit =
          digits.length >= 3 &&
          (row.phones ?? []).some((p) => (p.number ?? "").replace(/\D/g, "").includes(digits));
        if (emailHit || phoneHit) rows.push(row);
      }
    }
  }

  return rows.slice(0, PER_ENTITY).map((row) => {
    const emails = row.emails ?? [];
    const phones = row.phones ?? [];
    const email = (emails.find((e) => e.primary) ?? emails[0])?.address;
    const phone = (phones.find((p) => p.primary) ?? phones[0])?.number;
    return {
      href: `/admin/clients/${row.id}`,
      label: clientDisplayName(row),
      detail: email ?? phone ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
};

async function searchLeads(client: SupabaseClient, term: string): Promise<SearchResult[]> {
  const safe = safeTerm(term);
  const { data, error } = await client
    .from("leads")
    .select("id, name, email, phone, status")
    .or(`name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`)
    .order("created_at", { ascending: false })
    .limit(PER_ENTITY);
  if (error) throw new Error(error.message);

  return ((data ?? []) as LeadRow[]).map((row) => ({
    // Leads have no detail route — the pipeline is one page.
    href: "/admin/leads",
    label: row.name?.trim() || "Unnamed lead",
    detail: [statusLabel(row.status), row.email || row.phone].filter(Boolean).join(" · ") || null,
  }));
}

// ---------------------------------------------------------------------------
// Quotes, jobs, invoices — the three documents share a shape
// ---------------------------------------------------------------------------

type DocumentRow = {
  id: string;
  quote_number?: number;
  job_number?: number;
  invoice_number?: number;
  title: string | null;
  status: string;
  total_cents: number | null;
  client_snapshot: { displayName?: string } | null;
};

async function searchQuotes(client: SupabaseClient, term: string): Promise<SearchResult[]> {
  const safe = safeTerm(term);
  const filters = [
    `title.ilike.%${safe}%`,
    `client_snapshot->>displayName.ilike.%${safe}%`,
  ];
  const number = asDocumentNumber(term);
  if (number !== null) filters.push(`quote_number.eq.${number}`);

  const { data, error } = await client
    .from("quotes")
    .select("id, quote_number, title, status, total_cents, client_snapshot")
    .is("archived_at", null)
    .or(filters.join(","))
    .order("updated_at", { ascending: false })
    .limit(PER_ENTITY);
  if (error) throw new Error(error.message);

  return ((data ?? []) as DocumentRow[]).map((row) => ({
    href: `/admin/quotes/${row.id}`,
    label: row.title?.trim() || row.client_snapshot?.displayName || `Quote #${row.quote_number}`,
    detail: `#${row.quote_number} · ${statusLabel(row.status)} · ${formatMoney(row.total_cents ?? 0)}`,
  }));
}

async function searchJobs(client: SupabaseClient, term: string): Promise<SearchResult[]> {
  const safe = safeTerm(term);
  const filters = [`title.ilike.%${safe}%`];
  const number = asDocumentNumber(term);
  if (number !== null) filters.push(`job_number.eq.${number}`);

  const { data, error } = await client
    .from("jobs")
    .select("id, job_number, title, status, total_cents, client_snapshot")
    .is("archived_at", null)
    .or(filters.join(","))
    .order("updated_at", { ascending: false })
    .limit(PER_ENTITY);
  if (error) throw new Error(error.message);

  return ((data ?? []) as DocumentRow[]).map((row) => ({
    href: `/admin/jobs/${row.id}`,
    label: row.title?.trim() || row.client_snapshot?.displayName || `Job #${row.job_number}`,
    detail: `#${row.job_number} · ${statusLabel(row.status)} · ${formatMoney(row.total_cents ?? 0)}`,
  }));
}

async function searchInvoices(client: SupabaseClient, term: string): Promise<SearchResult[]> {
  const safe = safeTerm(term);
  const filters = [
    `title.ilike.%${safe}%`,
    `client_snapshot->>displayName.ilike.%${safe}%`,
  ];
  const number = asDocumentNumber(term);
  if (number !== null) filters.push(`invoice_number.eq.${number}`);

  const { data, error } = await client
    .from("invoices")
    .select("id, invoice_number, title, status, total_cents, client_snapshot")
    .is("archived_at", null)
    .or(filters.join(","))
    .order("updated_at", { ascending: false })
    .limit(PER_ENTITY);
  if (error) throw new Error(error.message);

  return ((data ?? []) as DocumentRow[]).map((row) => ({
    href: `/admin/invoices/${row.id}`,
    label: row.client_snapshot?.displayName || row.title?.trim() || `Invoice #${row.invoice_number}`,
    detail: `#${row.invoice_number} · ${statusLabel(row.status)} · ${formatMoney(row.total_cents ?? 0)}`,
  }));
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const client = db();
  if (!client) {
    // No database is a quiet state, not an error — the UI says so in place.
    return NextResponse.json({ configured: false, groups: [] });
  }

  const term = (new URL(request.url).searchParams.get("q") ?? "")
    .trim()
    .slice(0, MAX_TERM_LENGTH);
  if (term.length < 2) {
    return NextResponse.json({ configured: true, groups: [] });
  }

  const tasks: { kind: SearchGroup["kind"]; label: string; run: () => Promise<SearchResult[]> }[] = [
    { kind: "clients", label: "Clients", run: () => searchClients(client, term) },
    { kind: "leads", label: "Leads", run: () => searchLeads(client, term) },
    { kind: "quotes", label: "Quotes", run: () => searchQuotes(client, term) },
    { kind: "jobs", label: "Jobs", run: () => searchJobs(client, term) },
    { kind: "invoices", label: "Invoices", run: () => searchInvoices(client, term) },
  ];

  const settled = await Promise.allSettled(tasks.map((task) => task.run()));

  const groups: SearchGroup[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      if (result.value.length > 0) {
        groups.push({ kind: tasks[index].kind, label: tasks[index].label, results: result.value });
      }
    } else {
      // Skipped, not fatal — most likely a migration that hasn't run yet.
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.warn(`[search] ${tasks[index].kind} skipped: ${reason}`);
    }
  });

  return NextResponse.json({ configured: true, groups });
}
