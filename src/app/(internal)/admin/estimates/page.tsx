import Link from "next/link";
import { newEstimateAction } from "./actions";
import AdminNotice from "@/components/admin/AdminNotice";
import { Card, EmptyState, HubList, HubRow, RulerIcon, StatTile } from "@/components/admin/ui/Hub";
import { listClients } from "@/lib/crm/clients";
import { isConfigured, MigrationPendingError } from "@/lib/crm/db";
import { listInsuranceEstimates, type InsuranceEstimateListItem } from "@/lib/crm/insuranceEstimates";
import { formatMoney } from "@/lib/crm/money";
import { clientDisplayName } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

/**
 * Every insurance estimate, on its own page.
 *
 * The same documents the client hub lists for one client, here for the whole
 * book — the estimator is reached both ways on purpose. Each opens on its
 * project's estimate screen, where the document actually lives.
 */
export default async function EstimatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const filter = status === "draft" || status === "final" ? status : undefined;
  const search = q?.trim().toLowerCase() ?? "";

  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set <code className="font-mono text-brand-blue">SUPABASE_URL</code> and{" "}
        <code className="font-mono text-brand-blue">SUPABASE_SERVICE_ROLE_KEY</code> to turn this on.
      </AdminNotice>
    );
  }

  let estimates: InsuranceEstimateListItem[] = [];
  try {
    estimates = await listInsuranceEstimates({ status: filter, limit: 300 });
  } catch (err) {
    if (err instanceof MigrationPendingError) {
      return (
        <AdminNotice title="One migration left to run">
          Run <code className="font-mono text-brand-blue">supabase/migrations/0042_insurance_estimates.sql</code>{" "}
          in the Supabase SQL editor.
        </AdminNotice>
      );
    }
    throw err;
  }

  const clients = await listClients({ limit: 300 })
    .then((list) => list.map((c) => ({ id: c.id, label: clientDisplayName(c) })))
    .catch(() => [] as { id: string; label: string }[]);

  const shown = search
    ? estimates.filter((e) =>
        [e.title, e.project_name, e.client_name, e.address].some((v) => v?.toLowerCase().includes(search)),
      )
    : estimates;

  const drafts = estimates.filter((e) => e.status === "draft");
  const draftValue = drafts.reduce((sum, e) => sum + e.total_cents, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Estimates" value={String(estimates.length)} />
        <StatTile label="Drafts" value={String(drafts.length)} />
        <StatTile label="Draft value" value={formatMoney(draftValue)} />
      </div>

      <Card id="new" className="p-4 sm:p-5">
        <h2 className="font-heading text-[15px] font-bold text-charcoal">New estimate</h2>
        <form action={newEstimateAction} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select
            name="clientId"
            aria-label="Client"
            defaultValue=""
            className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">No client yet</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90"
          >
            <RulerIcon />
            Start
          </button>
        </form>
        <p className="mt-2 text-xs text-charcoal/45">
          Makes a project for it and opens the estimator. A client&apos;s page has the same button, already
          set to that client.
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <form className="min-w-[200px] flex-1">
          {filter && <input type="hidden" name="status" value={filter} />}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by client, project or address"
            aria-label="Search estimates"
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-charcoal outline-none placeholder:text-charcoal/30 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
          />
        </form>
        <div className="flex gap-1.5">
          <Chip href="/admin/estimates" label="All" active={!filter} />
          <Chip href="/admin/estimates?status=draft" label="Draft" active={filter === "draft"} />
          <Chip href="/admin/estimates?status=final" label="Final" active={filter === "final"} />
        </div>
      </div>

      <Card>
        {shown.length === 0 ? (
          <div className="pt-4">
            <EmptyState>
              {search || filter ? "Nothing matches." : "No estimates yet. Start one above, or from a client's page."}
            </EmptyState>
          </div>
        ) : (
          <HubList>
            {shown.map((estimate) => (
              <HubRow
                key={estimate.id}
                href={`/admin/projects/${estimate.project_id}/estimate`}
                title={estimate.client_name ?? estimate.project_name}
                subtitle={[estimate.title || estimate.project_name, estimate.address].filter(Boolean).join(" · ")}
                status={
                  estimate.status === "final"
                    ? { tone: "green", label: "Final" }
                    : { tone: "amber", label: "Draft" }
                }
                amount={formatMoney(estimate.total_cents)}
                meta={`${estimate.line_count} lines · ${new Date(estimate.updated_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`}
              />
            ))}
          </HubList>
        )}
      </Card>
    </div>
  );
}

function Chip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
        active ? "bg-charcoal text-white" : "bg-white text-charcoal/60 ring-1 ring-black/10 hover:text-charcoal"
      }`}
    >
      {label}
    </Link>
  );
}
