"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import LanguageToggle from "./LanguageToggle";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

export default function Header() {
  const { t } = useLanguage();
  const { openChat } = useChat();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Auto-hide on scroll down, reappear on scroll up — gives the page more
  // vertical room (especially on mobile) without losing quick access to nav.
  // Always visible while any menu is open. On the homepage, also always
  // visible until the scroll-jacked hero's before/after reveal finishes and
  // the sticky pin releases into normal scrolling — on other pages (no hero),
  // that threshold falls back to a small fixed offset near the very top.
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    let releaseY = 80;

    const measureRelease = () => {
      const heroEl = document.querySelector("[data-scroll-hero]");
      if (!heroEl) {
        releaseY = 80;
        return;
      }
      const rect = heroEl.getBoundingClientRect();
      const documentTop = window.scrollY + rect.top;
      releaseY = documentTop + (rect.height - window.innerHeight);
    };
    measureRelease();
    window.addEventListener("resize", measureRelease);

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const delta = y - lastY;
      if (mobileOpen || companyOpen || y < releaseY) {
        setHidden(false);
      } else if (delta > 4) {
        setHidden(true);
      } else if (delta < -4) {
        setHidden(false);
      }
      lastY = y;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measureRelease);
    };
  }, [mobileOpen, companyOpen]);

  function handleLogoClick(e: React.MouseEvent<HTMLAnchorElement>) {
    setMobileOpen(false);
    // Already home: smooth-scroll to top instead of a no-op navigation.
    // On any other page: let Link do its normal client-side nav to "/",
    // which lands at the top of the homepage.
    if (pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const navLinks = [
    { href: "/services", label: t.nav.services },
    { href: "/commercial", label: t.nav.commercial },
    { href: "/gallery", label: t.nav.gallery },
    { href: "/blog", label: t.nav.blog },
    { href: "/contact", label: t.nav.contact },
  ];

  const companyLinks = [
    { href: "/about", label: t.nav.about },
    { href: "/case-studies", label: t.nav.caseStudies },
    { href: "/safety", label: t.nav.safety },
    { href: "/careers", label: t.nav.careers },
  ];

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b border-black/5 bg-white/95 backdrop-blur transition-transform duration-300 ease-out ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" onClick={handleLogoClick} className="flex shrink-0 items-center gap-2">
          <Image
            src="/renovision-logo.png"
            alt="Renovision AnA"
            width={40}
            height={46}
            priority
            className="h-10 w-auto"
          />
          <span className="hidden font-heading text-xl font-semibold text-brand-blue sm:block">
            Renovision <span className="text-brand-green">AnA</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-5 xl:flex" aria-label="Main">
          {navLinks.slice(0, -1).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-sm font-semibold text-charcoal transition-colors hover:text-brand-blue"
            >
              {link.label}
            </Link>
          ))}

          <div
            className="relative"
            onMouseEnter={() => setCompanyOpen(true)}
            onMouseLeave={() => setCompanyOpen(false)}
          >
            <button
              type="button"
              className="flex cursor-pointer items-center gap-1 whitespace-nowrap text-sm font-semibold text-charcoal transition-colors hover:text-brand-blue"
              onClick={() => setCompanyOpen((v) => !v)}
              aria-expanded={companyOpen}
              aria-haspopup="true"
            >
              {t.nav.company}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {companyOpen && (
              <div className="absolute left-0 top-full w-56 rounded-xl border border-black/5 bg-white py-2 shadow-lg">
                {companyLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setCompanyOpen(false)}
                    className="block px-4 py-2 text-sm font-semibold text-charcoal hover:bg-brand-blue-light hover:text-brand-blue"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {navLinks.slice(-1).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-sm font-semibold text-charcoal transition-colors hover:text-brand-blue"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 xl:flex">
          <a
            href={`tel:${SITE_PHONE_TEL}`}
            className="whitespace-nowrap text-sm font-semibold text-brand-blue hover:text-brand-blue-dark"
          >
            {SITE_PHONE}
          </a>
          <LanguageToggle />
          <button
            type="button"
            onClick={openChat}
            className="cursor-pointer whitespace-nowrap rounded-full bg-brand-green px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-green-dark"
          >
            {t.header.freeEstimate}
          </button>
        </div>

        <div className="flex items-center gap-2 xl:hidden">
          <LanguageToggle className="text-xs" />
          <button
            type="button"
            className="flex items-center justify-center rounded-md p-2 text-brand-blue"
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
      </div>

      {mobileOpen && (
        <div className="border-t border-black/5 bg-white px-4 pb-6 pt-2 xl:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {navLinks.slice(0, -1).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2.5 text-base font-semibold text-charcoal hover:bg-brand-blue-light hover:text-brand-blue"
              >
                {link.label}
              </Link>
            ))}

            <span className="mt-2 px-2 text-xs font-bold uppercase tracking-wide text-charcoal/40">
              {t.nav.company}
            </span>
            {companyLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2.5 text-base font-semibold text-charcoal hover:bg-brand-blue-light hover:text-brand-blue"
              >
                {link.label}
              </Link>
            ))}

            {navLinks.slice(-1).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="mt-2 rounded-md px-2 py-2.5 text-base font-semibold text-charcoal hover:bg-brand-blue-light hover:text-brand-blue"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4">
            <a href={`tel:${SITE_PHONE_TEL}`} className="text-sm font-semibold text-brand-blue">
              {SITE_PHONE}
            </a>
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
