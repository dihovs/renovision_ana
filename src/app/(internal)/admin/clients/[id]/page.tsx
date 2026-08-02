import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addPropertyAction,
  createHubLinkAction,
  removePropertyAction,
  revokeHubLinkAction,
  setArchivedAction,
  updatePropertyAction,
} from "../actions";
import AdminNotice from "@/components/admin/AdminNotice";
import ArchiveToggleButton from "@/components/admin/ArchiveToggleButton";
import AskClaude from "@/components/admin/AskClaude";
import HubLink from "@/components/admin/HubLink";
import PropertyEditor from "@/components/admin/PropertyEditor";
import { SITE_URL } from "@/lib/constants";
import { getClient } from "@/lib/crm/clients";
import { MigrationPendingError } from "@/lib/crm/db";
import { formatRate, getTaxRates, resolveTaxRate } from "@/lib/crm/settings";
import {
  clientDisplayName,
  clientPersonName,
  formatAddress,
  type ClientWithProperties,
} from "@/lib/crm/types";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let client: ClientWithProperties | null;
  try {
    client = await getClient(id);
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration left to run">
          Run{" "}
          <code className="font-mono text-brand-blue">
            supabase/migrations/0004_clients_properties.sql
          </code>{" "}
          in the Supabase SQL editor.
        </AdminNotice>
      );
    }
    throw err;
  }

  if (!client) notFound();

  const taxRates = await getTaxRates();
  const effectiveRate = resolveTaxRate(taxRates, client.tax_rate_id);
  const person = clientPersonName(client);
  const billing = formatAddress({
    street1: client.billing_street1,
    street2: client.billing_street2,
    city: client.billing_city,
    province: client.billing_province,
    postal_code: client.billing_postal_code,
  });

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

      <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-bold text-charcoal">
              {clientDisplayName(client)}
            </h2>
            {person && <p className="text-sm text-charcoal/55">{person}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {client.lead_source && <Chip>{client.lead_source}</Chip>}
              {client.tags.map((tag) => (
                <Chip key={tag} accent>
                  {tag}
                </Chip>
              ))}
              {client.archived_at && <Chip>Archived</Chip>}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/admin/clients/${client.id}/edit`}
              className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-bold text-charcoal transition-colors hover:bg-black/[0.03]"
            >
              Edit
            </Link>
            <form action={setArchivedAction.bind(null, client.id, !client.archived_at)}>
              <ArchiveToggleButton archived={Boolean(client.archived_at)} />
            </form>
          </div>
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-black/5 pt-4 sm:grid-cols-2">
          <Row label="Email">
            {client.emails.length === 0 ? (
              <span className="text-charcoal/35">—</span>
            ) : (
              <ul className="space-y-0.5">
                {client.emails.map((email) => (
                  <li key={email.address}>
                    <a
                      href={`mailto:${email.address}`}
                      className="font-medium text-brand-blue hover:underline"
                    >
                      {email.address}
                    </a>
                    <span className="ml-1.5 text-[11px] uppercase tracking-wide text-charcoal/35">
                      {email.type}
                      {email.primary ? " · primary" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Row>

          <Row label="Phone">
            {client.phones.length === 0 ? (
              <span className="text-charcoal/35">—</span>
            ) : (
              <ul className="space-y-0.5">
                {client.phones.map((phone) => (
                  <li key={phone.number}>
                    <a
                      href={`tel:${phone.number.replace(/[^\d+]/g, "")}`}
                      className="font-medium text-brand-blue hover:underline"
                    >
                      {phone.number}
                    </a>
                    <span className="ml-1.5 text-[11px] uppercase tracking-wide text-charcoal/35">
                      {phone.type}
                      {phone.smsAllowed ? " · sms ok" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Row>

          <Row label="Billing address">{billing || <span className="text-charcoal/35">—</span>}</Row>

          <Row label="Tax rate">
            {effectiveRate.label} · {formatRate(effectiveRate)}
            {!client.tax_rate_id && (
              <span className="ml-1.5 text-[11px] text-charcoal/40">(account default)</span>
            )}
          </Row>
        </dl>

        {client.notes && (
          <div className="mt-4 border-t border-black/5 pt-4">
            <span className="text-xs font-semibold text-charcoal/70">Notes</span>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-charcoal/75">
              {client.notes}
            </p>
          </div>
        )}
      </div>

      <AskClaude subject={{ kind: "client", id: client.id }} />

      <PropertyEditor
        properties={client.properties}
        taxRates={taxRates}
        addAction={addPropertyAction.bind(null, client.id)}
        updateAction={updatePropertyAction.bind(null, client.id)}
        removeAction={removePropertyAction.bind(null, client.id)}
      />

      <HubLink
        url={
          (client as { hub_token?: string | null }).hub_token
            ? `${SITE_URL}/hub/${(client as { hub_token?: string | null }).hub_token}`
            : null
        }
        createAction={createHubLinkAction.bind(null, client.id)}
        revokeAction={revokeHubLinkAction.bind(null, client.id)}
      />

      <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-heading text-sm font-bold text-charcoal">Quotes</h2>
        <p className="mt-0.5 text-xs text-charcoal/50">
          Every quote for this client, and the jobs and invoices that follow from them.
        </p>
        <Link
          href={`/admin/quotes/new?client=${client.id}`}
          className="mt-3 inline-block rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90"
        >
          New quote for this client
        </Link>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-charcoal/70">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-charcoal/80">{children}</dd>
    </div>
  );
}

function Chip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        accent ? "bg-brand-blue/[0.08] text-brand-blue" : "bg-black/[0.05] text-charcoal/60"
      }`}
    >
      {children}
    </span>
  );
}
