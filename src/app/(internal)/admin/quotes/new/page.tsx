import Link from "next/link";
import { createQuoteAction } from "../actions";
import AdminNotice from "@/components/admin/AdminNotice";
import QuoteBuilder, { blankLine, type ClientOption } from "@/components/admin/QuoteBuilder";
import { listClients } from "@/lib/crm/clients";
import { MigrationPendingError } from "@/lib/crm/db";
import { getCompany, getQuoteDefaults, getTaxRates } from "@/lib/crm/settings";
import { clientDisplayName, formatAddress } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({
  searchParams,
}: {
  // The create menu is global rather than client-scoped, so a quote can be
  // started from a client's page with ?client=<id> already chosen.
  searchParams: Promise<{ client?: string; lead?: string }>;
}) {
  const { client: preselectedClient, lead } = await searchParams;

  let clients: ClientOption[];
  try {
    const rows = await listClients({ limit: 500 });
    // One query with properties joined, mapped into the shape the builder
    // needs — the tax-rate ids travel with it so the browser can resolve the
    // same property → client → default chain the server will.
    clients = rows.map((row) => ({
      id: row.id,
      name: clientDisplayName(row),
      taxRateId: row.tax_rate_id,
      properties: [],
    }));
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration left to run">
          Run <code className="font-mono text-brand-blue">supabase/migrations/0004_clients_properties.sql</code>{" "}
          and <code className="font-mono text-brand-blue">0006_quoting.sql</code> in the Supabase
          SQL editor.
        </AdminNotice>
      );
    }
    throw err;
  }

  // Properties are fetched per client rather than joined into the list, so the
  // dropdown stays correct without loading every address in the business.
  const withProperties = await attachProperties(clients);

  const [taxRates, company, defaults] = await Promise.all([
    getTaxRates(),
    getCompany(),
    getQuoteDefaults(),
  ]);

  if (withProperties.length === 0) {
    return (
      <AdminNotice
        title="Add a client first"
        action={
          <Link
            href="/admin/clients/new"
            className="inline-block rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90"
          >
            New client
          </Link>
        }
      >
        A quote has to be addressed to somebody. Create the client — or open a lead and convert it,
        which keeps their original enquiry attached.
      </AdminNotice>
    );
  }

  const validUntil = new Date(Date.now() + defaults.validDays * 86_400_000)
    .toISOString()
    .slice(0, 10);

  return (
    <div className="space-y-4">
      <Link
        href="/admin/quotes"
        className="inline-flex items-center gap-1 text-sm font-semibold text-charcoal/50 transition-colors hover:text-charcoal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Quotes
      </Link>

      <QuoteBuilder
        action={createQuoteAction}
        clients={withProperties}
        taxRates={taxRates}
        company={company}
        submitLabel="Create quote"
        cancelHref="/admin/quotes"
        initial={{
          clientId: preselectedClient ?? "",
          propertyId: "",
          leadId: lead ?? "",
          title: "",
          taxRateId: "",
          discountKind: "none",
          discountValue: "",
          depositKind: defaults.depositKind,
          depositValue: defaults.depositValue ? String(defaults.depositValue / 100) : "",
          clientMessage: defaults.clientMessageFr,
          contractTerms: defaults.contractTermsFr,
          internalNotes: "",
          showQuantities: defaults.showQuantities,
          showUnitPrices: defaults.showUnitPrices,
          showLineTotals: defaults.showLineTotals,
          showTotalsFooter: defaults.showTotalsFooter,
          requireSignature: defaults.requireSignature,
          validUntil,
          language: "fr",
          isItinerant: false,
          lines: [blankLine()],
        }}
      />
    </div>
  );
}

async function attachProperties(clients: ClientOption[]): Promise<ClientOption[]> {
  const { db } = await import("@/lib/crm/db");
  const client = db();
  if (!client) return clients;

  const { data } = await client
    .from("properties")
    .select("id, client_id, street1, street2, city, province, postal_code, tax_rate_id")
    .is("archived_at", null);

  const byClient = new Map<string, ClientOption["properties"]>();
  for (const row of (data ?? []) as {
    id: string;
    client_id: string;
    street1: string | null;
    street2: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    tax_rate_id: string | null;
  }[]) {
    const list = byClient.get(row.client_id) ?? [];
    list.push({
      id: row.id,
      label: formatAddress(row) || "Property with no address",
      taxRateId: row.tax_rate_id,
    });
    byClient.set(row.client_id, list);
  }

  return clients.map((c) => ({ ...c, properties: byClient.get(c.id) ?? [] }));
}
