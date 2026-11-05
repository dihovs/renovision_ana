import Link from "next/link";
import { createProjectAction } from "../actions";
import AdminNotice from "@/components/admin/AdminNotice";
import ProjectForm from "@/components/admin/ProjectForm";
import { listClients } from "@/lib/crm/clients";
import { isConfigured, MigrationPendingError } from "@/lib/crm/db";
import { clientDisplayName } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client: presetClient } = await searchParams;
  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Set <code className="font-mono text-brand-blue">SUPABASE_URL</code> and{" "}
        <code className="font-mono text-brand-blue">SUPABASE_SERVICE_ROLE_KEY</code> to turn this
        on.
      </AdminNotice>
    );
  }

  // The client picker is a convenience, not a requirement — if the clients
  // table is missing or unreadable the form still works, just without it.
  let clients: { id: string; label: string }[] = [];
  try {
    clients = (await listClients({ limit: 200 })).map((client) => ({
      id: client.id,
      label: clientDisplayName(client),
    }));
  } catch (err) {
    if (!(err instanceof MigrationPendingError)) throw err;
  }

  const defaultClientId = clients.some((c) => c.id === presetClient) ? presetClient! : "";
  const backHref = defaultClientId ? `/admin/clients/${defaultClientId}` : "/admin/projects";

  return (
    <div className="space-y-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm font-semibold text-charcoal/50 transition-colors hover:text-charcoal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {defaultClientId ? "Client" : "Projects"}
      </Link>

      <ProjectForm
        action={createProjectAction}
        clients={clients}
        cancelHref={backHref}
        defaultClientId={defaultClientId}
      />
    </div>
  );
}
