"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import {
  SITE_ADDRESS,
  SITE_EMAIL,
  SITE_PHONE,
  SITE_PHONE_TEL,
  SOCIAL_LINKS,
} from "@/lib/constants";

export default function Footer() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const year = new Date().getFullYear();
  const [openSection, setOpenSection] = useState<string | null>(null);

  function handleLogoClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const exploreLinks = [
    { href: "/services", label: t.nav.services },
    { href: "/commercial", label: t.nav.commercial },
    { href: "/gallery", label: t.nav.gallery },
    { href: "/blog", label: t.nav.blog },
  ];

  const companyLinks = [
    { href: "/about", label: t.nav.about },
    { href: "/case-studies", label: t.nav.caseStudies },
    { href: "/safety", label: t.nav.safety },
    { href: "/careers", label: t.nav.careers },
    { href: "/contact", label: t.nav.contact },
  ];

  const mapQuery = encodeURIComponent(
    `${SITE_ADDRESS.streetAddress}, ${SITE_ADDRESS.addressLocality}, ${SITE_ADDRESS.addressRegion} ${SITE_ADDRESS.postalCode}`,
  );

  return (
    <footer className="border-t border-white/10 bg-charcoal-dark text-white/90">
      <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-6 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {/* Brand + social */}
        <div className="md:col-span-2 lg:col-span-1">
          <Link href="/" onClick={handleLogoClick} className="flex items-center gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1.5">
              <Image
                src="/renovision-logo.png"
                alt="Renovision AnA"
                width={36}
                height={42}
                className="h-9 w-auto"
              />
            </span>
            <span className="font-heading text-lg font-bold text-white">
              Renovision AnA
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-sm text-white/70">{t.footer.tagline}</p>
          <div className="mt-5 flex gap-3">
            <SocialLink href={SOCIAL_LINKS.facebook} label="Facebook" brand="hover:bg-[#1877F2]">
              <path d="M13 21v-7h2.3l.35-2.7H13v-1.7c0-.78.22-1.3 1.34-1.3H16V5.6c-.28-.04-1.25-.12-2.37-.12-2.35 0-3.96 1.44-3.96 4.06V11.3H7.3V14H9.7v7H13Z" />
            </SocialLink>
            <SocialLink href={SOCIAL_LINKS.instagram} label="Instagram" brand="hover:bg-gradient-to-br hover:from-[#833AB4] hover:via-[#E1306C] hover:to-[#F77737]">
              <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm0 6.27a2.47 2.47 0 1 1 0-4.94 2.47 2.47 0 0 1 0 4.94ZM17.5 4h-11A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5v-11A2.5 2.5 0 0 0 17.5 4Zm1.17 13.5a1.17 1.17 0 0 1-1.17 1.17h-11a1.17 1.17 0 0 1-1.17-1.17v-11A1.17 1.17 0 0 1 6.5 5.33h11a1.17 1.17 0 0 1 1.17 1.17v11ZM16.9 7.1a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z" />
            </SocialLink>
          </div>
        </div>

        {/* Explore links (accordion on mobile) */}
        <FooterLinkGroup
          id="explore"
          title={t.footer.explore}
          links={exploreLinks}
          openSection={openSection}
          setOpenSection={setOpenSection}
        />

        {/* Company links (accordion on mobile) */}
        <FooterLinkGroup
          id="company"
          title={t.nav.company}
          links={companyLinks}
          openSection={openSection}
          setOpenSection={setOpenSection}
        />

        {/* Contact */}
        <div>
          <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-white">
            {t.footer.contactUs}
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm text-white/70">
            <li>
              <a
                href={`tel:${SITE_PHONE_TEL}`}
                className="-my-2.5 inline-block py-2.5 hover:text-white"
              >
                {SITE_PHONE}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${SITE_EMAIL}`}
                className="-my-2.5 inline-block py-2.5 hover:text-white"
              >
                {SITE_EMAIL}
              </a>
            </li>
            <li>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex flex-col hover:text-white"
              >
                <span>{SITE_ADDRESS.streetAddress}</span>
                <span>
                  {SITE_ADDRESS.addressLocality}, {SITE_ADDRESS.addressRegion}{" "}
                  {SITE_ADDRESS.postalCode}
                </span>
                <span className="mt-0.5 text-xs font-semibold text-brand-green-soft group-hover:underline">
                  {t.footer.viewOnMap} →
                </span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-5">
        <p className="text-center text-xs text-white/60">
          &copy; {year} Renovision AnA. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}

function FooterLinkGroup({
  id,
  title,
  links,
  openSection,
  setOpenSection,
}: {
  id: string;
  title: string;
  links: { href: string; label: string }[];
  openSection: string | null;
  setOpenSection: (v: string | null) => void;
}) {
  const isOpen = openSection === id;
  return (
    <div className="border-b border-white/10 py-1 md:border-none md:py-0">
      <button
        type="button"
        onClick={() => setOpenSection(isOpen ? null : id)}
        className="flex w-full items-center justify-between py-3 md:pointer-events-none md:py-0"
        aria-expanded={isOpen}
      >
        <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-white">
          {title}
        </h3>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-white/60 transition-transform md:hidden ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <ul className={`space-y-2.5 pb-3 md:mt-4 md:block md:pb-0 ${isOpen ? "block" : "hidden"}`}>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-white/70 hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SocialLink({
  href,
  label,
  brand,
  children,
}: {
  href: string;
  label: string;
  brand: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all duration-300 hover:-translate-y-1 hover:scale-110 hover:text-white hover:shadow-lg ${brand}`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        {children}
      </svg>
    </a>
  );
}
