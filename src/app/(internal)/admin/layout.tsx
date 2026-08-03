import type { Metadata } from "next";
import { logoutAction } from "./actions";
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

export const metadata: Metadata = { robots: { index: false, follow: false } };
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
