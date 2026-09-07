"use client";

import Image from "next/image";
import Link from "@/components/ui/LocaleLink";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { splitLocale } from "@/i18n/routing";
import { useGazeTracking } from "./useGazeTracking";
import {
  SITE_ADDRESS,
  SITE_EMAIL,
  SITE_PHONE,
  SITE_PHONE_TEL,
  SOCIAL_LINKS,
} from "@/lib/constants";

/**
 * `year` is a prop, not `new Date().getFullYear()` in here.
 *
 * This is a client component rendered inside pages that prerender with a
 * one-week revalidate. Reading the clock during render meant the cached HTML
 * and the browser could disagree across a New Year — the server said 2026 in
 * HTML generated in December, the client said 2027, and React reported a
 * hydration mismatch on every page of the site. The server picks the year now,
 * so both sides say whatever the cache says.
 */
/** Slug + display names only — the full serviceAreas data file stays out of
 * the client bundle; the server layout derives this. */
export type FooterAreaLink = { slug: string; nameFr: string; nameEn: string };

export default function Footer({ year, areaLinks }: { year: number; areaLinks: FooterAreaLink[] }) {
  const { t, locale } = useLanguage();
  const pathname = usePathname();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const gazeTracking = useGazeTracking();

  function handleLogoClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // `/` in either language — splitLocale drops the `/en` prefix.
    if (splitLocale(pathname).path === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const exploreLinks = [
    { href: "/services", label: t.nav.services },
    { href: "/service-areas", label: t.nav.serviceAreas },
    { href: "/estimation", label: t.nav.estimate },
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
            <SocialLink href={SOCIAL_LINKS.facebook} label="Facebook" brand="hover:bg-[#1877F2]" gaze={gazeTracking.active ? gazeTracking.gaze : null}>
              <path d="M13 21v-7h2.3l.35-2.7H13v-1.7c0-.78.22-1.3 1.34-1.3H16V5.6c-.28-.04-1.25-.12-2.37-.12-2.35 0-3.96 1.44-3.96 4.06V11.3H7.3V14H9.7v7H13Z" />
            </SocialLink>
            <SocialLink href={SOCIAL_LINKS.instagram} label="Instagram" brand="hover:bg-gradient-to-br hover:from-[#833AB4] hover:via-[#E1306C] hover:to-[#F77737]" gaze={gazeTracking.active ? gazeTracking.gaze : null}>
              <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm0 6.27a2.47 2.47 0 1 1 0-4.94 2.47 2.47 0 0 1 0 4.94ZM17.5 4h-11A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5v-11A2.5 2.5 0 0 0 17.5 4Zm1.17 13.5a1.17 1.17 0 0 1-1.17 1.17h-11a1.17 1.17 0 0 1-1.17-1.17v-11A1.17 1.17 0 0 1 6.5 5.33h11a1.17 1.17 0 0 1 1.17 1.17v11ZM16.9 7.1a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z" />
            </SocialLink>
            <SocialLink href={SOCIAL_LINKS.linkedin} label="LinkedIn" brand="hover:bg-[#0A66C2]" gaze={gazeTracking.active ? gazeTracking.gaze : null}>
              <path d="M6.94 8.5H3.56V20h3.38V8.5ZM5.25 3.5a1.97 1.97 0 1 0 0 3.94 1.97 1.97 0 0 0 0-3.94ZM20.44 20h-3.37v-5.6c0-1.34-.03-3.06-1.87-3.06-1.87 0-2.16 1.46-2.16 2.96V20H9.68V8.5h3.24v1.57h.05c.45-.86 1.56-1.76 3.21-1.76 3.43 0 4.26 2.26 4.26 5.2V20Z" />
            </SocialLink>
          </div>

          {/* Real webcam gaze tracking — opt-in experiment, owner asked to
              try it 2026-09-07. On-device only (MediaPipe WASM), nothing
              leaves the browser; never auto-starts the camera. */}
          <button
            type="button"
            onClick={gazeTracking.active ? gazeTracking.stop : gazeTracking.start}
            disabled={gazeTracking.loading}
            className="mt-3 text-xs text-white/50 underline decoration-white/30 underline-offset-2 hover:text-white/80 disabled:opacity-50"
          >
            {gazeTracking.loading
              ? "Starting camera…"
              : gazeTracking.active
                ? "Stop eye tracking (turns camera off)"
                : "👁 Try eye tracking (uses your camera)"}
          </button>
          {gazeTracking.error && (
            <p className="mt-1 text-xs text-red-400">{gazeTracking.error}</p>
          )}
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

      {/* Service-area links, sitewide. Before this, the only pages linking to
          the local pages were the index and the about page — the footer gives
          each area page a link from every page on the site. */}
      <div className="border-t border-white/10 py-5">
        <p className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 text-center text-xs text-white/60">
          <span className="font-semibold text-white/70">{t.nav.serviceAreas}:</span>
          {areaLinks.map((area, i) => (
            <span key={area.slug} className="flex items-center gap-x-2">
              {i > 0 && (
                <span aria-hidden className="text-white/25">
                  &middot;
                </span>
              )}
              <Link
                href={`/service-areas/${area.slug}`}
                className="text-white/60 underline-offset-2 hover:text-white hover:underline"
              >
                {locale === "fr" ? area.nameFr : area.nameEn}
              </Link>
            </span>
          ))}
        </p>
      </div>

      <div className="border-t border-white/10 py-5">
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-white/60">
          <span>
            &copy; {year} Renovision AnA. {t.footer.rights}
          </span>
          <span aria-hidden className="text-white/25">
            &middot;
          </span>
          <Link href="/privacy" className="text-white/60 underline-offset-2 hover:text-white hover:underline">
            {t.footer.privacy}
          </Link>
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

/**
 * Icons tilt and lean toward the cursor as it passes nearby, like they're
 * "watching" it — owner asked for an eye-tracking feel on 2026-09-07.
 * Reads the cursor position on every mousemove, so it's rAF-throttled and
 * only computed at all while the cursor is within WATCH_RADIUS of the icon.
 */
const WATCH_RADIUS = 160;

function useLookAtCursor<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const frame = useRef<number | null>(null);

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);

        if (dist > WATCH_RADIUS) {
          setStyle({});
          return;
        }

        const strength = 1 - dist / WATCH_RADIUS;
        const angle = Math.atan2(dy, dx);
        const shiftX = Math.cos(angle) * 5 * strength;
        const shiftY = Math.sin(angle) * 5 * strength;
        const rotate = (dx / WATCH_RADIUS) * 14 * strength;

        setStyle({
          transform: `translate(${shiftX}px, ${shiftY}px) rotate(${rotate}deg) scale(${1 + 0.12 * strength})`,
        });
      });
    }

    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMove);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  return { ref, style };
}

function SocialLink({
  href,
  label,
  brand,
  children,
  gaze,
}: {
  href: string;
  label: string;
  brand: string;
  children: React.ReactNode;
  /** When set (webcam eye tracking active), drives the tilt instead of the cursor. */
  gaze?: { x: number; y: number } | null;
}) {
  const { ref, style: cursorStyle } = useLookAtCursor<HTMLAnchorElement>();

  const style: React.CSSProperties = gaze
    ? {
        transform: `translate(${gaze.x * 7}px, ${gaze.y * 7}px) rotate(${gaze.x * 16}deg) scale(1.1)`,
      }
    : cursorStyle;

  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      style={style}
      className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-[background-color,box-shadow,color] duration-300 ease-out hover:text-white hover:shadow-lg ${brand}`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 transition-transform duration-300 ease-out">
        {children}
      </svg>
    </a>
  );
}
