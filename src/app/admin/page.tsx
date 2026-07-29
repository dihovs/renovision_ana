import type { Metadata } from "next";
import { logoutAction } from "./actions";
import LoginForm from "@/components/admin/LoginForm";
import LeadPipeline from "@/components/admin/LeadPipeline";
import { isAuthConfigured, isSignedIn } from "@/lib/adminAuth";
import { isConfigured as isStoreConfigured, listLeads, type StoredLead } from "@/lib/leadStore";

// Never index or cache the lead list.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isAuthConfigured) {
    return (
      <Shell>
        <Notice title="Admin is not enabled">
          Set <code className="font-mono text-brand-blue">ADMIN_PASSWORD</code> in the environment
          to turn this on. Until then the page refuses everyone rather than defaulting open.
        </Notice>
      </Shell>
    );
  }

  if (!(await isSignedIn())) {
    return (
      <Shell>
        <LoginForm />
      </Shell>
    );
  }

  if (!isStoreConfigured) {
    return (
      <Shell onSignOut>
        <Notice title="No database connected yet">
          Leads are still arriving by email and nothing is being lost — they just aren&apos;t stored
          anywhere this page can read. Set{" "}
          <code className="font-mono text-brand-blue">SUPABASE_URL</code> and{" "}
          <code className="font-mono text-brand-blue">SUPABASE_SERVICE_ROLE_KEY</code>, run the
          migration in <code className="font-mono text-brand-blue">supabase/migrations</code>, and
          this list fills itself in.
        </Notice>
      </Shell>
    );
  }

  let leads: StoredLead[] = [];
  let error: string | null = null;
  try {
    leads = await listLeads();
  } catch (err) {
    // Most likely a paused free-tier project. Say so plainly rather than
    // showing an empty list, which would read as "no leads".
    error = err instanceof Error ? err.message : "Could not load leads";
  }

  return (
    <Shell onSignOut>
      {error ? (
        <Notice title="Could not reach the database">
          {error}. If the project has been idle for over a week it may be paused — open the Supabase
          dashboard to resume it. Leads are still arriving by email in the meantime.
        </Notice>
      ) : (
        <LeadPipeline leads={leads} />
      )}
    </Shell>
  );
}

function Shell({ children, onSignOut }: { children: React.ReactNode; onSignOut?: boolean }) {
  return (
    <div className="min-h-dvh bg-brand-blue-light/20">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold text-brand-blue">Leads</h1>
          {onSignOut && (
            <form action={logoutAction}>
              <button
                type="submit"
                className="cursor-pointer text-sm font-semibold text-charcoal/50 hover:text-brand-blue"
              >
                Sign out
              </button>
            </form>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <h2 className="font-heading text-base font-bold text-brand-blue">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-charcoal/70">{children}</p>
    </div>
  );
}
