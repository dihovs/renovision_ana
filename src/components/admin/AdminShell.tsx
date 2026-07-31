"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconBuilding,
  IconCalendar,
  IconCheckCircle,
  IconClipboard,
  IconDashboard,
  IconFlag,
  IconHammer,
  IconHome,
  IconPhone,
  IconShield,
  IconTag,
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
  { href: "/admin", label: "Home", icon: IconDashboard, ready: true },
  { href: "/admin/leads", label: "Leads", icon: IconFlag, ready: true },
  { href: "/admin/calls", label: "Calls", icon: IconPhone, ready: true },
  { href: "/admin/clients", label: "Clients", icon: IconBuilding, ready: true },
  { href: "/admin/quotes", label: "Quotes", icon: IconClipboard, ready: true },
  { href: "/admin/price-book", label: "Price book", icon: IconTag, ready: true },
  { href: "/admin/jobs", label: "Jobs", icon: IconHammer, ready: true },
  { href: "/admin/schedule", label: "Schedule", icon: IconCalendar, ready: true },
  { href: "/admin/invoices", label: "Invoices", icon: IconCheckCircle, ready: true },
  { href: "/admin/reports", label: "Reports", icon: IconShield, ready: true },
];

/** What the ＋ button offers. Grows as each section becomes real. */
const CREATE_ACTIONS = [
  { href: "/admin/quotes/new", label: "Quote" },
  { href: "/admin/clients/new", label: "Client" },
  { href: "/admin/price-book", label: "Price book item" },
];

/**
 * Longest matching prefix, so /admin/clients/new still reads as "Clients"
 * rather than falling through to the /admin root and titling itself "Leads".
 */
function activeNav(pathname: string): NavItem | undefined {
  return NAV.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
}

export default function AdminShell({
  children,
  onSignOut,
}: {
  children: React.ReactNode;
  onSignOut?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // The rail is a drawer below lg and a permanent column from lg up; `inert`
  // must only apply in the drawer case.
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Any navigation closes both overlays. Without this the create menu survives
  // the route change and hangs over the page it just opened.
  useEffect(() => {
    setCreateOpen(false);
    setMobileNavOpen(false);
  }, [pathname]);

  const current = activeNav(pathname);

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

      {/* Below lg the rail is hidden by transform alone, which leaves its links
          focusable and in the accessibility tree while off-screen — a keyboard
          user tabbing off the burger walked through seven invisible controls.
          `inert` removes them properly; it is cleared from lg up, where the
          rail is permanently visible rather than a drawer. */}
      <aside
        inert={!mobileNavOpen && !isDesktop}
        className={`fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col bg-charcoal-dark transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center gap-2.5 px-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/95 p-1">
            <Image
              src="/renovision-logo.png"
              alt=""
              width={28}
              height={28}
              className="h-full w-auto object-contain"
            />
          </span>
          <span className="font-heading text-sm font-bold text-white">
            Renovision <span className="text-brand-green-soft">AnA</span>
          </span>
        </div>

        {/* Jobber's rail leads with Create — the one control that has to be
            reachable from anywhere in the tool. */}
        <div className="relative px-3 pb-2">
          <button
            type="button"
            onClick={() => setCreateOpen((open) => !open)}
            aria-expanded={createOpen}
            aria-haspopup="menu"
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-brand-green-soft transition-colors hover:bg-white/[0.08]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Create
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden
              className={`ml-auto transition-transform ${createOpen ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {createOpen && (
            <>
              {/* Full-screen catcher so a click anywhere dismisses the menu.
                  Placed under the menu, above everything else. */}
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setCreateOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div
                role="menu"
                className="absolute left-3 right-3 z-50 mt-1 overflow-hidden rounded-md border border-black/10 bg-white py-1 shadow-lg"
              >
                {CREATE_ACTIONS.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    role="menuitem"
                    className="block px-3 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-black/[0.04]"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </>
          )}
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
            href="/admin/settings"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <IconShield className="h-4 w-4 shrink-0" />
            Settings
          </Link>
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
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
