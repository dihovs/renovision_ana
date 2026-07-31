import Link from "next/link";
import AdminNotice from "@/components/admin/AdminNotice";
import { listClients, type ClientListItem } from "@/lib/crm/clients";
import { isConfigured, MigrationPendingError } from "@/lib/crm/db";
import {
  clientDisplayName,
  clientPersonName,
  formatAddress,
  primaryEmail,
  primaryPhone,
} from "@/lib/crm/types";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  // Async in this version of Next — awaiting is required, not optional.
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q?.trim() ?? "";

  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set <code className="font-mono text-brand-blue">SUPABASE_URL</code> and{" "}
        <code className="font-mono text-brand-blue">SUPABASE_SERVICE_ROLE_KEY</code> to turn this
        on.
      </AdminNotice>
    );
  }

  let clients: ClientListItem[] = [];
  let error: string | null = null;
  try {
    clients = await listClients({ search });
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration left to run">
          Open the Supabase SQL editor and run{" "}
          <code className="font-mono text-brand-blue">
            supabase/migrations/0004_clients_properties.sql
          </code>
          . This screen fills itself in as soon as the tables exist — nothing else needs deploying.
        </AdminNotice>
      );
    }
    error = err instanceof Error ? err.message : "Could not load clients";
  }

  if (error) {
    return (
      <AdminNotice title="Could not reach the database">
        {error}. If the project has been idle for over a week it may be paused — open the Supabase
        dashboard to resume it.
      </AdminNotice>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form className="relative flex-1 min-w-[200px]">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/35"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search name or company"
            aria-label="Search clients"
            className="w-full rounded-lg border border-black/10 bg-white py-2 pl-9 pr-3 text-sm text-charcoal outline-none transition-colors placeholder:text-charcoal/30 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
          />
        </form>

        <Link
          href="/admin/clients/new"
          className="shrink-0 rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90"
        >
          New client
        </Link>
      </div>

      {clients.length === 0 ? (
        <AdminNotice title={search ? "No matches" : "No clients yet"}>
          {search ? (
            <>
              Nothing matched &ldquo;{search}&rdquo;.{" "}
              <Link href="/admin/clients" className="font-semibold text-brand-blue">
                Clear the search
              </Link>
              .
            </>
          ) : (
            <>
              Add one from the button above, or open a lead and convert it — that keeps the
              customer&apos;s original enquiry attached to the client record.
            </>
          )}
        </AdminNotice>
      ) : (
        <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          {clients.map((client) => {
            const person = clientPersonName(client);
            const email = primaryEmail(client);
            const phone = primaryPhone(client);
            const billing = formatAddress({
              street1: client.billing_street1,
              city: client.billing_city,
              province: client.billing_province,
            });

            return (
              <li key={client.id}>
                <Link
                  href={`/admin/clients/${client.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02]"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-charcoal">
                      {clientDisplayName(client)}
                    </span>
                    <span className="block truncate text-xs text-charcoal/55">
                      {[person, email, phone].filter(Boolean).join(" · ") || billing || "—"}
                    </span>
                  </div>

                  {client.property_count > 1 && (
                    <span className="shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-semibold text-charcoal/60">
                      {client.property_count} properties
                    </span>
                  )}
                  {client.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="hidden shrink-0 rounded-full bg-brand-blue/[0.07] px-2 py-0.5 text-[11px] font-semibold text-brand-blue sm:inline"
                    >
                      {tag}
                    </span>
                  ))}

                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                    className="shrink-0 text-charcoal/25"
                  >
                    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
