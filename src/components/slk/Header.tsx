import Link from "next/link";
import { bookingLink, copy, type Locale } from "@/content/slk/copy";
import { slkPath, slkCounterpart } from "@/content/slk/paths";

export default function SlkHeader({ locale, path }: { locale: Locale; path: string }) {
  const t = copy[locale].nav;
  const book = bookingLink();
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
          <Link href={slkPath(locale, "/")} className="hover:text-[var(--slk-terracotta-dark)]">
            {t.home}
          </Link>
          <Link href={slkPath(locale, "/services")} className="hover:text-[var(--slk-terracotta-dark)]">
            {t.services}
          </Link>
          <Link
            href={slkPath(locale, locale === "fr" ? "/a-propos" : "/about")}
            className="hover:text-[var(--slk-terracotta-dark)]"
          >
            {t.about}
          </Link>
          <Link href={slkPath(locale, "/contact")} className="hover:text-[var(--slk-terracotta-dark)]">
            {t.contact}
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link
            href={slkCounterpart(locale, path)}
            className="text-xs font-semibold uppercase tracking-wide text-[var(--slk-charcoal)]/70 hover:text-[var(--slk-terracotta-dark)]"
          >
            {locale === "fr" ? "EN" : "FR"}
          </Link>
          <a
            href={book.href}
            target={book.external ? "_blank" : undefined}
            rel={book.external ? "noopener noreferrer" : undefined}
            className="rounded-full bg-[var(--slk-terracotta)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--slk-terracotta-dark)]"
          >
            {t.book}
          </a>
        </div>
      </div>
    </header>
  );
}
