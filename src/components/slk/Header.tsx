import Link from "next/link";
import { business, copy, type Locale } from "@/content/slk/copy";
import { slkPath, slkCounterpart } from "@/content/slk/paths";

export default function SlkHeader({ locale, path }: { locale: Locale; path: string }) {
  const t = copy[locale].nav;
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--slk-rose-light)] bg-[var(--slk-cream)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href={slkPath(locale, "/")}
          className="font-slk-serif text-lg font-semibold tracking-wide text-[var(--slk-rose-dark)]"
        >
          SLK
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--slk-charcoal)] md:flex">
          <Link href={slkPath(locale, "/")} className="hover:text-[var(--slk-rose-dark)]">
            {t.home}
          </Link>
          <Link href={slkPath(locale, "/services")} className="hover:text-[var(--slk-rose-dark)]">
            {t.services}
          </Link>
          <Link
            href={slkPath(locale, locale === "fr" ? "/a-propos" : "/about")}
            className="hover:text-[var(--slk-rose-dark)]"
          >
            {t.about}
          </Link>
          <Link href={slkPath(locale, "/contact")} className="hover:text-[var(--slk-rose-dark)]">
            {t.contact}
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link
            href={slkCounterpart(locale, path)}
            className="text-xs font-semibold uppercase tracking-wide text-[var(--slk-charcoal)]/70 hover:text-[var(--slk-rose-dark)]"
          >
            {locale === "fr" ? "EN" : "FR"}
          </Link>
          <a
            href={business.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[var(--slk-rose)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--slk-rose-dark)]"
          >
            {t.book}
          </a>
        </div>
      </div>
    </header>
  );
}
