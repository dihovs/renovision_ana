import Link from "next/link";
import { notFound } from "next/navigation";
import { updateClientAction } from "../../actions";
import ClientForm from "@/components/admin/ClientForm";
import { getClient } from "@/lib/crm/clients";
import { getCustomFields, getLeadSources, getTaxRates } from "@/lib/crm/settings";
import { clientDisplayName } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [client, taxRates, leadSources, customFields] = await Promise.all([
    getClient(id),
    getTaxRates(),
    getLeadSources(),
    getCustomFields(),
  ]);

  if (!client) notFound();

  return (
    <div className="space-y-4">
      <Link
        href={`/admin/clients/${client.id}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-charcoal/50 transition-colors hover:text-charcoal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {clientDisplayName(client)}
      </Link>

      <ClientForm
        action={updateClientAction.bind(null, client.id)}
        // Properties are edited on the detail page, where the whole list is
        // visible — editing "the property" here would be wrong the moment a
        // client has two.
        initial={{
          firstName: client.first_name ?? "",
          lastName: client.last_name ?? "",
          companyName: client.company_name ?? "",
          emails: client.emails ?? [],
          phones: client.phones ?? [],
          billing: {
            street1: client.billing_street1 ?? "",
            street2: client.billing_street2 ?? "",
            city: client.billing_city ?? "",
            province: client.billing_province ?? "QC",
            postalCode: client.billing_postal_code ?? "",
            country: client.billing_country ?? "Canada",
          },
          taxRateId: client.tax_rate_id ?? "",
          leadSource: client.lead_source ?? "",
          tags: (client.tags ?? []).join(", "),
          notes: client.notes ?? "",
          custom: Object.fromEntries(
            Object.entries(client.custom ?? {}).map(([key, value]) => [key, String(value ?? "")]),
          ),
        }}
        taxRates={taxRates}
        leadSources={leadSources}
        customFields={customFields.client}
        submitLabel="Save changes"
        cancelHref={`/admin/clients/${client.id}`}
      />
    </div>
  );
}
