import Link from "next/link";
import { saveCompanyAction, saveQuoteDefaultsAction } from "./actions";
import AdminNotice from "@/components/admin/AdminNotice";
import { CompanyForm, QuoteDefaultsForm } from "@/components/admin/SettingsForms";
import { isConfigured } from "@/lib/crm/db";
import { getCompany, getQuoteDefaults } from "@/lib/crm/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active = tab === "quotes" ? "quotes" : "company";

  if (!isConfigured) {
    return (
      <AdminNotice title="No database connected yet">
        Settings are stored in Supabase. Set{" "}
        <code className="font-mono text-brand-blue">SUPABASE_URL</code> and{" "}
        <code className="font-mono text-brand-blue">SUPABASE_SERVICE_ROLE_KEY</code> to turn this
        on.
      </AdminNotice>
    );
  }

  const [company, defaults] = await Promise.all([getCompany(), getQuoteDefaults()]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        <Tab href="/admin/settings" label="Business" active={active === "company"} />
        <Tab href="/admin/settings?tab=quotes" label="Quotes" active={active === "quotes"} />
      </div>

      {!company.rbqLicence.trim() && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
            className="mt-0.5 shrink-0 text-amber-600"
          >
            <path
              d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>
            <strong className="font-bold">Add your RBQ licence number.</strong> Quebec law requires
            it on every quote, contract and statement of account, and quotes cannot be sent until
            it is here.
          </span>
        </p>
      )}

      {active === "company" ? (
        <CompanyForm initial={company} action={saveCompanyAction} />
      ) : (
        <QuoteDefaultsForm initial={defaults} action={saveQuoteDefaultsAction} />
      )}
    </div>
  );
}

function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
        active ? "bg-brand-blue text-white" : "bg-white text-charcoal/60 shadow-sm hover:text-charcoal"
      }`}
    >
      {label}
    </Link>
  );
}
