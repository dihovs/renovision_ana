import Link from "next/link";
import { business, copy, type Locale } from "@/content/slk/copy";
import { slkPath } from "@/content/slk/paths";

export default function SlkFooter({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[var(--slk-charcoal-dark)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="font-slk-serif text-lg font-medium text-[var(--slk-ivory)]">{business.name}</p>
            <p className="mt-2 text-sm text-[var(--slk-ivory)]/55">
              {business.address.line1}
              <br />
              {business.address.city}, {business.address.region} {business.address.postal}
            </p>
          </div>
          <div className="flex flex-col gap-1 text-sm text-[var(--slk-ivory)]/70">
            <a href={business.phoneHref} className="hover:text-[var(--slk-terracotta)]">
              {business.phone}
            </a>
            <a href={`mailto:${business.email}`} className="hover:text-[var(--slk-terracotta)]">
              {business.email}
            </a>
            <a
              href={business.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--slk-terracotta)]"
            >
              Instagram
            </a>
          </div>
          <nav className="flex flex-col gap-1 text-sm text-[var(--slk-ivory)]/70">
            <Link href={slkPath(locale, "/services")} className="hover:text-[var(--slk-terracotta)]">
              {t.nav.services}
            </Link>
            <Link
              href={slkPath(locale, locale === "fr" ? "/a-propos" : "/about")}
              className="hover:text-[var(--slk-terracotta)]"
            >
              {t.nav.about}
            </Link>
            <Link href={slkPath(locale, "/contact")} className="hover:text-[var(--slk-terracotta)]">
              {t.nav.contact}
            </Link>
          </nav>
        </div>
        <p className="mt-8 text-xs text-[var(--slk-ivory)]/35">
          © {year} {business.name}. {t.footer.rights}
        </p>
        <p className="mt-1 text-xs text-[var(--slk-ivory)]/35">{t.footer.confirmNote}</p>
      </div>
    </footer>
  );
}
