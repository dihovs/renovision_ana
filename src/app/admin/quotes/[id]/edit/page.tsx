import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateQuoteAction } from "../../actions";
import QuoteBuilder, { type ClientOption, type EditableLine } from "@/components/admin/QuoteBuilder";
import { listClients } from "@/lib/crm/clients";
import { db } from "@/lib/crm/db";
import { getQuote } from "@/lib/crm/quotes";
import { isEditable } from "@/lib/crm/quoteTypes";
import { getCompany, getTaxRates } from "@/lib/crm/settings";
import { clientDisplayName, formatAddress } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();

  // A sent quote is a document somebody has already been shown. Editing it in
  // place would mean their copy and ours disagree with no record of it.
  if (!isEditable(quote.status)) redirect(`/admin/quotes/${id}`);

  const [clientRows, taxRates, company] = await Promise.all([
    listClients({ limit: 500 }),
    getTaxRates(),
    getCompany(),
  ]);

  const clients: ClientOption[] = await attachProperties(
    clientRows.map((row) => ({
      id: row.id,
      name: clientDisplayName(row),
      taxRateId: row.tax_rate_id,
      properties: [],
    })),
  );

  const lines: EditableLine[] = quote.lines.map((line, index) => ({
    key: `existing-${index}`,
    kind: line.kind,
    name: line.name,
    description: line.description ?? "",
    quantity: line.quantity_milli === null ? "" : String(line.quantity_milli / 1000),
    unit: line.unit ?? "",
    unitPrice: line.unit_price_cents === null ? "" : (line.unit_price_cents / 100).toFixed(2),
    unitCost: line.unit_cost_cents === null ? "" : (line.unit_cost_cents / 100).toFixed(2),
    taxable: line.taxable,
    optional: line.optional,
    selected: line.selected,
    laborHours: line.labor_hours,
    priceBookItemId: line.price_book_item_id,
  }));

  return (
    <div className="space-y-4">
      <Link
        href={`/admin/quotes/${quote.id}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-charcoal/50 transition-colors hover:text-charcoal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Quote #{quote.quote_number}
      </Link>

      <QuoteBuilder
        action={updateQuoteAction.bind(null, quote.id)}
        clients={clients}
        taxRates={taxRates}
        company={company}
        submitLabel="Save changes"
        cancelHref={`/admin/quotes/${quote.id}`}
        initial={{
          clientId: quote.client_id,
          propertyId: quote.property_id ?? "",
          leadId: quote.lead_id ?? "",
          title: quote.title ?? "",
          taxRateId: quote.tax_rate_id ?? "",
          discountKind: quote.discount_kind,
          discountValue:
            quote.discount_kind === "percent"
              ? String(quote.discount_value / 10_000)
              : quote.discount_value
                ? (quote.discount_value / 100).toFixed(2)
                : "",
          depositKind: quote.deposit_kind,
          depositValue:
            quote.deposit_kind === "percent"
              ? String(quote.deposit_value / 10_000)
              : quote.deposit_value
                ? (quote.deposit_value / 100).toFixed(2)
                : "",
          clientMessage: quote.client_message ?? "",
          contractTerms: quote.contract_terms ?? "",
          internalNotes: quote.internal_notes ?? "",
          showQuantities: quote.show_quantities,
          showUnitPrices: quote.show_unit_prices,
          showLineTotals: quote.show_line_totals,
          showTotalsFooter: quote.show_totals_footer,
          requireSignature: quote.require_signature,
          validUntil: quote.valid_until ?? "",
          language: quote.language,
          isItinerant: quote.is_itinerant,
          lines,
        }}
      />
    </div>
  );
}

async function attachProperties(clients: ClientOption[]): Promise<ClientOption[]> {
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
