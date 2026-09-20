"use client";

import { useState } from "react";
import Link from "next/link";
import { bookingLink, copy, type Locale } from "@/content/slk/copy";
import { slkPath, slkCounterpart } from "@/content/slk/paths";
import { stashScrollPosition } from "./ScrollRestore";

export default function SlkHeader({ locale, path }: { locale: Locale; path: string }) {
  const t = copy[locale].nav;
  const book = bookingLink();
  const [open, setOpen] = useState(false);

  const navLinks = [
    { href: slkPath(locale, "/"), label: t.home },
    { href: slkPath(locale, "/services"), label: t.services },
    { href: slkPath(locale, locale === "fr" ? "/a-propos" : "/about"), label: t.about },
    { href: slkPath(locale, "/contact"), label: t.contact },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--slk-terracotta-light)] bg-[var(--slk-ivory)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href={slkPath(locale, "/")}
          className="font-slk-serif text-lg font-semibold tracking-wide text-[var(--slk-terracotta-dark)]"
        >
          SLK
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--slk-charcoal)] md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-[var(--slk-terracotta-dark)]">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Link
            href={slkCounterpart(locale, path)}
            onClick={stashScrollPosition}
            className="text-xs font-semibold uppercase tracking-wide text-[var(--slk-charcoal)]/70 hover:text-[var(--slk-terracotta-dark)]"
          >
            {locale === "fr" ? "EN" : "FR"}
          </Link>
          <a
            href={book.href}
            target={book.external ? "_blank" : undefined}
            rel={book.external ? "noopener noreferrer" : undefined}
            className="hidden rounded-full bg-[var(--slk-terracotta)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--slk-terracotta-dark)] sm:inline-block"
          >
            {t.book}
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={locale === "fr" ? "Ouvrir le menu" : "Open menu"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--slk-terracotta-light)] text-[var(--slk-charcoal)] md:hidden"
          >
            <span className="sr-only">{locale === "fr" ? "Menu" : "Menu"}</span>
            {open ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-[var(--slk-terracotta-light)] bg-[var(--slk-ivory)] px-4 py-4 text-sm font-medium text-[var(--slk-charcoal)] md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-3 hover:bg-[var(--slk-terracotta-light)]"
            >
              {link.label}
            </Link>
          ))}
          <a
            href={book.href}
            target={book.external ? "_blank" : undefined}
            rel={book.external ? "noopener noreferrer" : undefined}
            className="mt-2 rounded-full bg-[var(--slk-terracotta)] px-4 py-3 text-center font-semibold text-white"
          >
            {t.book}
          </a>
        </nav>
      )}
    </header>
  );
}
