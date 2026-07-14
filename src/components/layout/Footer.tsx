"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageProvider";
import { SITE_EMAIL, SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

export default function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  const navLinks = [
    { href: "/services", label: t.nav.services },
    { href: "/commercial", label: t.nav.commercial },
    { href: "/about", label: t.nav.about },
    { href: "/gallery", label: t.nav.gallery },
    { href: "/case-studies", label: t.nav.caseStudies },
    { href: "/safety", label: t.nav.safety },
    { href: "/careers", label: t.nav.careers },
    { href: "/blog", label: t.nav.blog },
    { href: "/contact", label: t.nav.contact },
  ];

  return (
    <footer className="border-t border-white/10 bg-navy text-white/90">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1.5">
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
        </div>

        <div>
          <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-white">
            {t.footer.quickLinks}
          </h3>
          <ul className="mt-4 space-y-2.5">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-white/70 hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-white">
            {t.footer.contactUs}
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm text-white/70">
            <li>
              <a href={`tel:${SITE_PHONE_TEL}`} className="hover:text-white">
                {SITE_PHONE}
              </a>
            </li>
            <li>
              <a href={`mailto:${SITE_EMAIL}`} className="hover:text-white">
                {SITE_EMAIL}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-white">
            Follow Us
          </h3>
          <div className="mt-4 flex gap-3">
            <SocialLink href="https://facebook.com" label="Facebook">
              <path d="M13 21v-7h2.3l.35-2.7H13v-1.7c0-.78.22-1.3 1.34-1.3H16V5.6c-.28-.04-1.25-.12-2.37-.12-2.35 0-3.96 1.44-3.96 4.06V11.3H7.3V14H9.7v7H13Z" />
            </SocialLink>
            <SocialLink href="https://instagram.com" label="Instagram">
              <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm0 6.27a2.47 2.47 0 1 1 0-4.94 2.47 2.47 0 0 1 0 4.94ZM17.5 4h-11A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5v-11A2.5 2.5 0 0 0 17.5 4Zm1.17 13.5a1.17 1.17 0 0 1-1.17 1.17h-11a1.17 1.17 0 0 1-1.17-1.17v-11A1.17 1.17 0 0 1 6.5 5.33h11a1.17 1.17 0 0 1 1.17 1.17v11ZM16.9 7.1a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z" />
            </SocialLink>
          </div>
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

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-brand-green"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4.5 w-4.5">
        {children}
      </svg>
    </a>
  );
}
