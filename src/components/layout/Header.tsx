"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import LanguageToggle from "./LanguageToggle";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

export default function Header() {
  const { t } = useLanguage();
  const { openChat } = useChat();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/services", label: t.nav.services },
    { href: "/about", label: t.nav.about },
    { href: "/gallery", label: t.nav.gallery },
    { href: "/blog", label: t.nav.blog },
    { href: "/contact", label: t.nav.contact },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-black/5 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image
            src="/logo.png"
            alt="Renovision Ana"
            width={44}
            height={49}
            priority
            className="h-11 w-auto"
          />
          <span className="hidden font-heading text-lg font-bold text-brand-blue sm:block">
            Renovision <span className="text-brand-green">Ana</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Main">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-charcoal transition-colors hover:text-brand-blue"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <a
            href={`tel:${SITE_PHONE_TEL}`}
            className="text-sm font-semibold text-brand-blue hover:text-brand-blue-dark"
          >
            {SITE_PHONE}
          </a>
          <LanguageToggle />
          <button
            type="button"
            onClick={openChat}
            className="cursor-pointer rounded-full bg-brand-green px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-green-dark"
          >
            {t.header.freeEstimate}
          </button>
        </div>

        <button
          type="button"
          className="flex items-center justify-center rounded-md p-2 text-brand-blue lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label="Toggle menu"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-black/5 bg-white px-4 pb-6 pt-2 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2.5 text-base font-semibold text-charcoal hover:bg-brand-blue-light hover:text-brand-blue"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex items-center justify-between gap-3">
            <a href={`tel:${SITE_PHONE_TEL}`} className="text-sm font-semibold text-brand-blue">
              {SITE_PHONE}
            </a>
            <LanguageToggle />
          </div>
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              openChat();
            }}
            className="mt-4 w-full cursor-pointer rounded-full bg-brand-green px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-green-dark"
          >
            {t.header.freeEstimate}
          </button>
        </div>
      )}
    </header>
  );
}
