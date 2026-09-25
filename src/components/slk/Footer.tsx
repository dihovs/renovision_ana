import Link from "next/link";
import { business, copy, type Locale } from "@/content/slk/copy";
import { slkPath } from "@/content/slk/paths";

export default function SlkFooter({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const year = new Date().getFullYear();
  const colHead = "mb-4 text-[11px] uppercase tracking-[0.22em] text-[var(--slk-paper)]/60";
  const link = "transition hover:text-[var(--slk-clay-soft)]";

  return (
    <footer className="bg-[var(--slk-ink-deep)] text-[var(--slk-paper)]">
      {/* Extra bottom room on phones so the docked booking bar never covers the last lines. */}
      <div className="mx-auto max-w-7xl px-5 pb-28 pt-16 sm:px-8 sm:pt-20 md:pb-10">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="font-slk-serif text-6xl font-light leading-none tracking-tight">SLK</p>
            <p className="mt-4 max-w-xs text-sm font-light text-[var(--slk-paper)]/70">{t.noWalkIns}</p>
          </div>
          <div>
            <p className={colHead}>{t.contactPage.addressLabel}</p>
            <p className="text-sm font-light leading-relaxed text-[var(--slk-paper)]/85">
              {business.address.line1}
              <br />
              {business.address.city}, {business.address.region} {business.address.postal}
            </p>
            <p className="mt-2 max-w-xs text-xs font-light leading-relaxed text-[var(--slk-paper)]/60">
              {t.contactPage.addressNote}
            </p>
          </div>
          <div>
            <p className={colHead}>{t.nav.contact}</p>
            <div className="flex flex-col gap-2 text-sm font-light text-[var(--slk-paper)]/85">
              <a href={business.instagram} target="_blank" rel="noopener noreferrer" className={link}>
                Instagram · {t.ui.instagramHandle}
              </a>
              <a href={business.instagramAlt} target="_blank" rel="noopener noreferrer" className={link}>
                Instagram · {t.ui.instagramHandleAlt}
              </a>
              <a href={business.phoneHref} className={link}>
                {business.phone}
              </a>
              <a href={`mailto:${business.email}`} className={link}>
                {business.email}
              </a>
            </div>
          </div>
          <nav>
            <p className={colHead}>{t.ui.menuLabel}</p>
            <div className="flex flex-col gap-2 text-sm font-light text-[var(--slk-paper)]/85">
              <Link href={slkPath(locale, "/services")} className={link}>
                {t.nav.services}
              </Link>
              <Link href={slkPath(locale, locale === "fr" ? "/a-propos" : "/about")} className={link}>
                {t.nav.about}
              </Link>
              <Link href={slkPath(locale, "/contact")} className={link}>
                {t.nav.contact}
              </Link>
            </div>
          </nav>
        </div>
        <div className="mt-16 flex flex-col gap-2 border-t border-[var(--slk-line-dark)] pt-6 text-xs text-[var(--slk-paper)]/55 sm:flex-row sm:justify-between">
          <p>
            © {year} {business.name}. {t.footer.rights}
          </p>
          <p>{t.footer.confirmNote}</p>
        </div>
      </div>
    </footer>
  );
}
