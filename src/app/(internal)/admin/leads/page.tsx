import LeadPipeline from "@/components/admin/LeadPipeline";
import AdminNotice from "@/components/admin/AdminNotice";
import {
  isConfigured as isStoreConfigured,
  listLeads,
  signPhotoUrls,
  type StoredLead,
} from "@/lib/leadStore";

// Auth, the shell, and noindex all come from the layout. This page moved from
// /admin when the dashboard took that spot — same shape as Jobber, where Home
// and the work screens are separate.
export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  if (!isStoreConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Leads are still arriving by email and nothing is being lost — they just aren&apos;t stored
        anywhere this page can read. Set{" "}
        <code className="font-mono text-brand-blue">SUPABASE_URL</code> and{" "}
        <code className="font-mono text-brand-blue">SUPABASE_SERVICE_ROLE_KEY</code>, run the
        migration in <code className="font-mono text-brand-blue">supabase/migrations</code>, and
        this list fills itself in.
      </AdminNotice>
    );
  }

  let leads: StoredLead[] = [];
  let photoUrls: Record<string, string[]> = {};
  let error: string | null = null;
  try {
    leads = await listLeads();
    // Signed per request, never stored: a persisted URL would outlive its own
    // expiry and render as a broken image later.
    const withPhotos = leads.filter((l) => l.photo_paths?.length);
    photoUrls = Object.fromEntries(
      await Promise.all(
        withPhotos.map(async (l) => [l.id, await signPhotoUrls(l.photo_paths)] as const),
      ),
    );
  } catch (err) {
    // Most likely a paused free-tier project. Say so plainly rather than
    // showing an empty list, which would read as "no leads".
    error = err instanceof Error ? err.message : "Could not load leads";
  }

  if (error) {
    return (
      <AdminNotice title="Could not reach the database">
        {error}. If the project has been idle for over a week it may be paused — open the Supabase
        dashboard to resume it. Leads are still arriving by email in the meantime.
      </AdminNotice>
    );
  }

  return <LeadPipeline leads={leads} photoUrls={photoUrls} />;
}
