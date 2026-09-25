import type { Metadata } from "next";
import SlkHeader from "@/components/slk/Header";
import SlkFooter from "@/components/slk/Footer";
import { PageIntro, MapBlock, Journey, FaqSection } from "@/components/slk/sections";
import { business, bookingLink, copy } from "@/content/slk/copy";

export const metadata: Metadata = { title: copy.fr.contactPage.title };

export default function SlkContactFr() {
  const t = copy.fr.contactPage;
  const ui = copy.fr.ui;
  const book = bookingLink();
  const label = "text-[11px] uppercase tracking-[0.22em] text-[var(--slk-ink)]/60";
  const row = "grid gap-2 border-b border-[var(--slk-line)] py-6 sm:grid-cols-[9rem_1fr] sm:gap-6";
  return (
    <>
      <SlkHeader locale="fr" path="/slk/contact" />
      <main className="flex-1">
        <PageIntro eyebrow={ui.findUs} title={t.title} intro={t.intro} />
        <section className="mx-auto grid w-full max-w-7xl gap-10 sm:gap-14 px-5 py-14 sm:py-20 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:py-24">
          <div>
            <a
              href={book.href}
              target={book.external ? "_blank" : undefined}
              rel={book.external ? "noopener noreferrer" : undefined}
              className="group flex items-center justify-between gap-6 rounded-2xl bg-[var(--slk-ink)] p-8 text-[var(--slk-paper)] transition hover:bg-[var(--slk-clay)]"
            >
              <span>
                <span className="block text-[11px] uppercase tracking-[0.22em] text-[var(--slk-paper)]/70">{t.bookCta}</span>
                <span className="font-slk-serif mt-2 block text-3xl font-light">{ui.instagramHandle}</span>
              </span>
              <span aria-hidden="true" className="font-slk-serif text-3xl transition group-hover:translate-x-1">→</span>
            </a>
            <p className="mt-4 text-sm text-[var(--slk-ink)]/65">
              {ui.alsoOn}{" "}
              <a
                href={business.instagramAlt}
                target="_blank"
                rel="noopener noreferrer"
                className="border-b border-[var(--slk-ink)]/30 text-[var(--slk-ink)] transition hover:border-[var(--slk-clay)] hover:text-[var(--slk-clay)]"
              >
                {ui.instagramHandleAlt}
              </a>
            </p>

            <dl className="mt-10 border-t border-[var(--slk-ink)]/80">
              <div className={row}>
                <dt className={label}>{t.addressLabel}</dt>
                <dd className="font-light leading-relaxed">
                  {business.address.line1}
                  <br />
                  {business.address.city}, {business.address.region} {business.address.postal}
                  <span className="mt-3 block text-sm text-[var(--slk-ink)]/65">{t.addressNote}</span>
                </dd>
              </div>
              <div className={row}>
                <dt className={label}>{t.phoneLabel}</dt>
                <dd>
                  <a href={business.phoneHref} className="font-light hover:text-[var(--slk-clay)]">
                    {business.phone}
                  </a>
                </dd>
              </div>
              <div className={row}>
                <dt className={label}>{t.emailLabel}</dt>
                <dd>
                  <a href={`mailto:${business.email}`} className="font-light hover:text-[var(--slk-clay)]">
                    {business.email}
                  </a>
                </dd>
              </div>
              <div className={row}>
                <dt className={label}>{t.hoursLabel}</dt>
                <dd className="space-y-1 font-light leading-relaxed">
                  {t.hours.map((h) => (
                    <p key={h}>{h}</p>
                  ))}
                </dd>
              </div>
            </dl>
            <p className="mt-6 text-xs leading-relaxed text-[var(--slk-ink)]/60">{t.confirmNote}</p>
          </div>
          <MapBlock locale="fr" />
        </section>
        <Journey locale="fr" />
        <FaqSection locale="fr" />
      </main>
      <SlkFooter locale="fr" />
    </>
  );
}
