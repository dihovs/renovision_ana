"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import LanguageToggle from "./LanguageToggle";
import { IconPhone } from "@/components/ui/icons";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

/**
 * Routes that render a full-bleed hero behind the header. Used to pick the
 * header's INITIAL transparency during render — measuring the hero can only
 * happen after mount, and starting from the wrong state produced a visible
 * white flash on every refresh of the homepage.
 */
const FULL_BLEED_HERO_PATHS = ["/"];

export default function Header() {
  const { t } = useLanguage();
  const { openChat } = useChat();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [overHero, setOverHero] = useState(() => FULL_BLEED_HERO_PATHS.includes(pathname));

  // Two behaviours, one scroll listener:
  //
  // 1. Auto-hide: the bar shows only at the very top of the page. Once you have
  //    scrolled it stays gone, deliberately — reappearing mid-page drops an
  //    opaque strip over whatever you are reading.
  // 2. Transparency: over a full-bleed hero the bar drops its background and
  //    switches to white text until the hero has scrolled past. Pages with no
  //    hero never go transparent.
  //
  // A plain scroll listener is sufficient again now that Lenis has been removed
  // — while Lenis was mounted it swallowed native scroll events and this
  // listener never ran, which is why the bar used to stay put.
  useEffect(() => {
    let ticking = false;
    let heroBottom = 0;

    const measureHero = () => {
      const heroEl = document.querySelector("[data-scroll-hero]");
      heroBottom = heroEl ? window.scrollY + heroEl.getBoundingClientRect().bottom : 0;
      // A page with no hero can never be "over" one.
      if (!heroEl) setOverHero(false);
    };

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      setHidden(!(mobileOpen || companyOpen || y < 8));
      // Swap to the solid treatment slightly before the hero fully clears, so
      // white text never lands on the pale section underneath.
      setOverHero(heroBottom > 0 && y < heroBottom - 96);
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    measureHero();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measureHero);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measureHero);
    };
  }, [mobileOpen, companyOpen, pathname]);

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

  // The mobile panel is a white sheet, so the bar must go solid with it.
  const transparent = overHero && !mobileOpen;

  return (
    <>
    <header
      className={`sticky top-0 z-40 w-full transition-[transform,background-color,border-color,box-shadow] duration-300 ease-out ${
        hidden ? "-translate-y-full" : "translate-y-0"
      } ${
        transparent
          ? "border-b border-transparent bg-transparent"
          : "border-b border-black/5 bg-white/95 shadow-[0_1px_3px_rgba(0,0,0,0.06)] backdrop-blur"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" onClick={handleLogoClick} className="flex shrink-0 items-center gap-2">
          <Image
            src="/renovision-logo.png"
            alt="Renovision AnA"
            width={40}
            height={46}
            priority
            className="h-8 w-auto"
          />
          <span
            className={`hidden font-heading text-lg font-semibold transition-colors sm:block ${
              transparent ? "text-white" : "text-brand-blue"
            }`}
          >
            Renovision <span className="text-brand-green">AnA</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 xl:flex" aria-label="Main">
          {navLinks.slice(0, -1).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.18em] transition-colors ${
                transparent ? "text-white/85 hover:text-white" : "text-charcoal hover:text-brand-blue"
              }`}
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
              className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.18em] transition-colors ${
                transparent ? "text-white/85 hover:text-white" : "text-charcoal hover:text-brand-blue"
              }`}
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
              className={`whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.18em] transition-colors ${
                transparent ? "text-white/85 hover:text-white" : "text-charcoal hover:text-brand-blue"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-5 xl:flex">
          <a
            href={`tel:${SITE_PHONE_TEL}`}
            className={`whitespace-nowrap text-[13px] font-semibold tracking-wide transition-colors ${
              transparent ? "text-white hover:text-white/80" : "text-brand-blue hover:text-brand-blue-dark"
            }`}
          >
            {SITE_PHONE}
          </a>
          <LanguageToggle transparent={transparent} />
          {/* No estimate button here on purpose. The hero carries the primary
              call to action and the floating launcher takes over once it
              scrolls away, so the same ask never appears twice at once. */}
        </div>

        <div className="flex items-center gap-2 xl:hidden">
          <a
            href={`tel:${SITE_PHONE_TEL}`}
            aria-label={SITE_PHONE}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              transparent
                ? "bg-white/15 text-white hover:bg-white/25"
                : "bg-brand-blue-light text-brand-blue hover:bg-brand-blue hover:text-white"
            }`}
          >
            <IconPhone className="h-4.5 w-4.5" />
          </a>
          <LanguageToggle className="text-xs" transparent={transparent} />
          <button
            type="button"
            className={`flex items-center justify-center rounded-md p-2 transition-colors ${
              transparent ? "text-white" : "text-brand-blue"
            }`}
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

      <div
        aria-hidden={!mobileOpen}
        className={`grid transition-[grid-template-rows] duration-300 ease-out xl:hidden ${
          mobileOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div
            className={`border-t border-black/5 bg-white px-4 pb-6 pt-2 transition-[opacity,transform] duration-300 ease-out ${
              mobileOpen ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
            }`}
          >
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
              className="mt-4 w-full cursor-pointer rounded-full uppercase tracking-[0.08em] bg-brand-green px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-green-dark"
            >
              {t.header.freeEstimate}
            </button>
          </div>
        </div>
      </div>
    </header>

    {/* Floating language toggle: the header itself hides on scroll-down to
        save vertical space, but language should stay reachable at all
        times, so this fades in only while the header is hidden. Rendered as
        a sibling of <header>, not a child — the header has an active CSS
        transform (its own hide/show translate), which makes it a
        containing block for `position: fixed` descendants, so a fixed child
        would track the header's translate instead of staying pinned to the
        viewport. */}
    <div
      aria-hidden={!hidden}
      className={`fixed right-4 top-4 z-40 transition-[opacity,transform] duration-300 ease-out ${
        hidden ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
      }`}
    >
      <LanguageToggle className="text-xs shadow-md" />
    </div>
    </>
  );
}
