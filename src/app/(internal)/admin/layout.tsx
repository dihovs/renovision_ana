import type { Metadata } from "next";
import { logoutAction } from "./actions";
import { loadTaskBarAction } from "./taskBarActions";
import LoginForm from "@/components/admin/LoginForm";
import AdminShell from "@/components/admin/AdminShell";
import { isAuthConfigured, isSignedIn } from "@/lib/adminAuth";

/**
 * The gate for everything under /admin.
 *
 * Auth lives here rather than in each page so a new screen cannot ship
 * unprotected by omission — adding a route under this folder is enough to
 * inherit the check. Server actions still re-verify the session themselves,
 * because a layout guards rendering and an action is a public endpoint.
 */

/**
 * The manifest and Apple tags make /admin installable — "Add to Home Screen"
 * on the iPhone yields a full-screen app with the company icon, and the same
 * tags serve the Capacitor shell (capacitor.config.ts). Scoped HERE rather
 * than on the shared internal layout so the customer-facing token pages
 * (/hub, /q, /i) never advertise themselves as an app.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  manifest: "/admin-manifest.webmanifest",
  appleWebApp: { capable: true, title: "Renovision", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isAuthConfigured) {
    return (
      <Centered>
        <Notice title="Admin is not enabled">
          Set <code className="font-mono text-brand-blue">ADMIN_PASSWORD</code> in the environment
          to turn this on. Until then the page refuses everyone rather than defaulting open.
        </Notice>
      </Centered>
    );
  }

  if (!(await isSignedIn())) {
    // No shell on the sign-in screen: showing the nav to someone who isn't
    // authenticated advertises the structure of the tool and gives them
    // nothing they can use.
    return (
      <Centered>
        <LoginForm />
      </Centered>
    );
  }

  // Read here rather than from an effect in the bar itself, so the open count
  // is in the first paint. This layout is already dynamic and already awaited
  // the session, so one indexed read adds nothing a user would notice — and a
  // failure is returned, not thrown, so a paused database costs the badge and
  // not the page.
  const tasks = await loadTaskBarAction();

  return (
    <AdminShell
      tasks={tasks}
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

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f6f8fb] px-4">
      <div className="w-full max-w-sm">{children}</div>
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
