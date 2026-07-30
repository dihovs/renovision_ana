import type { Metadata } from "next";
import { logoutAction } from "./actions";
import LoginForm from "@/components/admin/LoginForm";
import LeadPipeline from "@/components/admin/LeadPipeline";
import AdminShell from "@/components/admin/AdminShell";
import { isAuthConfigured, isSignedIn } from "@/lib/adminAuth";
import {
  isConfigured as isStoreConfigured,
  listLeads,
  signPhotoUrls,
  type StoredLead,
} from "@/lib/leadStore";

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

  return (
    <Shell onSignOut>
      {error ? (
        <Notice title="Could not reach the database">
          {error}. If the project has been idle for over a week it may be paused — open the Supabase
          dashboard to resume it. Leads are still arriving by email in the meantime.
        </Notice>
      ) : (
        <LeadPipeline leads={leads} photoUrls={photoUrls} />
      )}
    </Shell>
  );
}

function Shell({ children, onSignOut }: { children: React.ReactNode; onSignOut?: boolean }) {
  // The sign-in screen deliberately skips the shell — showing a nav rail to
  // someone who isn't authenticated advertises the structure of the tool and
  // gives them nothing they can use.
  if (!onSignOut) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f6f8fb] px-4">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    );
  }

  return (
    <AdminShell
      onSignOut={
        <form action={logoutAction}>
          <button
            type="submit"
            className="cursor-pointer text-sm font-semibold text-charcoal/50 transition-colors hover:text-brand-blue"
          >
            Sign out
          </button>
        </form>
      }
    >
      {children}
    </AdminShell>
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
