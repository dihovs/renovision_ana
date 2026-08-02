import Link from "next/link";
import { createClientAction } from "../actions";
import ClientForm from "@/components/admin/ClientForm";
import { getCustomFields, getLeadSources, getTaxRates } from "@/lib/crm/settings";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const [taxRates, leadSources, customFields] = await Promise.all([
    getTaxRates(),
    getLeadSources(),
    getCustomFields(),
  ]);

  return (
    <div className="space-y-4">
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1 text-sm font-semibold text-charcoal/50 transition-colors hover:text-charcoal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Clients
      </Link>

      <ClientForm
        action={createClientAction}
        taxRates={taxRates}
        leadSources={leadSources}
        customFields={customFields.client}
        submitLabel="Create client"
        cancelHref="/admin/clients"
        withProperty
      />
    </div>
  );
}
