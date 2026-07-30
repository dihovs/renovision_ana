"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  IconBuilding,
  IconCalendar,
  IconClipboard,
  IconFlag,
  IconHammer,
  IconHome,
} from "@/components/ui/icons";

/**
 * Field-service shell in the Jobber idiom: dark left rail, a prominent create
 * action at the top of it, light neutral canvas, dense white cards.
 *
 * The dark rail is the load-bearing choice — it's what makes this read as an
 * operational tool rather than another page of the marketing site, and it lets
 * the white content area hold attention without competing chrome.
 *
 * Sections that don't exist are disabled with a "soon" marker rather than being
 * live links to nothing. Same for the create action: on a job site, a control
 * that looks live and silently does nothing costs a tap and a moment of doubt
 * about whether the tool is broken.
 */

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ready: boolean;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Leads", icon: IconFlag, ready: true },
  { href: "/admin/clients", label: "Clients", icon: IconBuilding, ready: false },
  { href: "/admin/quotes", label: "Quotes", icon: IconClipboard, ready: false },
  { href: "/admin/jobs", label: "Jobs", icon: IconHammer, ready: false },
  { href: "/admin/schedule", label: "Schedule", icon: IconCalendar, ready: false },
];

export default function AdminShell({
  children,
  onSignOut,
}: {
  children: React.ReactNode;
  onSignOut?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const current = NAV.find((item) => item.href === pathname);

  return (
    <div className="min-h-dvh bg-[#f1f3f5] lg:flex">
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col bg-charcoal-dark transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 px-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-green text-xs font-bold text-white">
            R
          </span>
          <span className="font-heading text-sm font-bold text-white">
            Renovision <span className="text-brand-green-soft">AnA</span>
          </span>
        </div>

        {/* Jobber's rail leads with Create. Disabled until there's a database to
            write a manually-entered lead into. */}
        <div className="px-3 pb-2">
          <span
            aria-disabled="true"
            className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-brand-green-soft/45"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Create
            <span className="ml-auto rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/40">
              Soon
            </span>
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 px-3" aria-label="Admin">
          {NAV.map(({ href, label, icon: Icon, ready }) => {
            const active = pathname === href;
            if (!ready) {
              return (
                <span
                  key={href}
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/25"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                  <span className="ml-auto rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/35">
                    Soon
                  </span>
                </span>
              );
            }
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileNavOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <IconHome className="h-4 w-4 shrink-0" />
            View website
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-black/10 bg-white px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-md text-charcoal/70 hover:bg-black/[0.04] lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>

          <h1 className="font-heading text-base font-bold text-charcoal">
            {current?.label ?? "Admin"}
          </h1>

          <div className="ml-auto flex items-center gap-3">{onSignOut}</div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
