"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import { bookingLink, copy, type Locale } from "@/content/slk/copy";
import { slkPath, slkCounterpart } from "@/content/slk/paths";
import { stashScrollPosition } from "./ScrollRestore";
import { EASE, ScrollProgress } from "./motion";

export default function SlkHeader({
  locale,
  path,
}: {
  locale: Locale;
  path: string;
}) {
  const t = copy[locale].nav;
  const book = bookingLink();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  // Tuck the header away while reading down the page; bring it back on any scroll up.
  const { scrollY } = useScroll();
  const last = useRef(0);
  const [hidden, setHidden] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => {
    const delta = y - last.current;
    last.current = y;
    if (y < 120) setHidden(false);
    else if (Math.abs(delta) > 6) setHidden(delta > 0);
  });
  const tucked = hidden && !open && !reduce;

  const navLinks = [
    { href: slkPath(locale, "/services"), label: t.services },
    {
      href: slkPath(locale, locale === "fr" ? "/a-propos" : "/about"),
      label: t.about,
    },
    { href: slkPath(locale, "/contact"), label: t.contact },
  ];

  return (
    <>
      <ScrollProgress />
      <motion.header
        className="sticky top-0 z-40 border-b border-[var(--slk-line)] bg-[var(--slk-bone)]/90 backdrop-blur-md"
        animate={{ y: tucked ? "-100%" : "0%" }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link
            href={slkPath(locale, "/")}
            className="group flex items-baseline gap-3"
            aria-label="Clinique Esthétique SLK"
          >
            <span className="font-slk-serif text-2xl tracking-tight text-[var(--slk-ink)]">
              SLK
            </span>
            <span className="hidden text-[10px] uppercase tracking-[0.22em] text-[var(--slk-ink)]/60 sm:inline">
              Clinique esthétique · Laval
            </span>
          </Link>

          <nav className="hidden items-center gap-10 text-sm text-[var(--slk-ink)]/80 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-[var(--slk-clay)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              href={slkCounterpart(locale, path)}
              onClick={stashScrollPosition}
              className="text-xs uppercase tracking-[0.18em] text-[var(--slk-ink)]/60 transition hover:text-[var(--slk-clay)]"
            >
              {locale === "fr" ? "EN" : "FR"}
            </Link>
            <a
              href={book.href}
              target={book.external ? "_blank" : undefined}
              rel={book.external ? "noopener noreferrer" : undefined}
              className="hidden rounded-full bg-[var(--slk-ink)] px-5 py-2.5 text-sm text-[var(--slk-paper)] transition hover:bg-[var(--slk-clay)] sm:inline-block"
            >
              {t.book}
            </a>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={
                open
                  ? locale === "fr"
                    ? "Fermer le menu"
                    : "Close menu"
                  : locale === "fr"
                    ? "Ouvrir le menu"
                    : "Open menu"
              }
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--slk-line)] text-[var(--slk-ink)] md:hidden"
            >
              {open ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 18 18"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 2l14 14M16 2L2 16"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 18 18"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 6h14M2 12h14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-[var(--slk-line)] bg-[var(--slk-bone)] px-5 pb-6 pt-2 md:hidden">
            {[{ href: slkPath(locale, "/"), label: t.home }, ...navLinks].map(
              (link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="font-slk-serif block border-b border-[var(--slk-line)] py-4 text-2xl font-light text-[var(--slk-ink)]"
                >
                  {link.label}
                </Link>
              ),
            )}
            <a
              href={book.href}
              target={book.external ? "_blank" : undefined}
              rel={book.external ? "noopener noreferrer" : undefined}
              className="mt-6 block rounded-full bg-[var(--slk-ink)] px-5 py-3.5 text-center text-sm text-[var(--slk-paper)]"
            >
              {t.book}
            </a>
          </nav>
        )}
      </motion.header>
    </>
  );
}
