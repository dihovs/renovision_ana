import type { Metadata } from "next";
import SlkHeader from "@/components/slk/Header";
import SlkFooter from "@/components/slk/Footer";
import { business, bookingLink, copy } from "@/content/slk/copy";
import { FaqSection, MapBlock } from "@/components/slk/sections";

export const metadata: Metadata = { title: copy.en.contactPage.title };

export default function SlkContactEn() {
  const t = copy.en.contactPage;
  const book = bookingLink();
  return (
    <>
      <SlkHeader locale="en" path="/slk/en/contact" />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <h1 className="font-slk-serif text-4xl font-semibold text-[var(--slk-charcoal)]">
            {t.title}
          </h1>
          <p className="mt-3 text-lg text-[var(--slk-charcoal)]/70">{t.intro}</p>
          <dl className="mt-10 grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-semibold uppercase tracking-wide text-[var(--slk-gold)]">
                {t.addressLabel}
              </dt>
              <dd className="mt-1 text-[var(--slk-charcoal)]/85">
                {business.address.line1}
                <br />
                {business.address.city}, {business.address.region} {business.address.postal}
              </dd>
              <p className="mt-2 text-xs text-[var(--slk-terracotta-dark)]">{t.addressConfirmNote}</p>
            </div>
            <div>
              <dt className="text-sm font-semibold uppercase tracking-wide text-[var(--slk-gold)]">
                {t.phoneLabel}
              </dt>
              <dd className="mt-1">
                <a href={business.phoneHref} className="text-[var(--slk-terracotta-dark)] hover:underline">
                  {business.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold uppercase tracking-wide text-[var(--slk-gold)]">
                {t.emailLabel}
              </dt>
              <dd className="mt-1">
                <a
                  href={`mailto:${business.email}`}
                  className="text-[var(--slk-terracotta-dark)] hover:underline"
                >
                  {business.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold uppercase tracking-wide text-[var(--slk-gold)]">
                {t.hoursLabel}
              </dt>
              <dd className="mt-1 text-[var(--slk-charcoal)]/85">
                {t.hours.map((h) => (
                  <p key={h}>{h}</p>
                ))}
              </dd>
            </div>
          </dl>
          <a
            href={book.href}
            target={book.external ? "_blank" : undefined}
            rel={book.external ? "noopener noreferrer" : undefined}
            className="mt-10 inline-block rounded-full bg-[var(--slk-terracotta)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--slk-terracotta-dark)]"
          >
            {t.bookCta}
          </a>
          <p className="mt-6 text-xs text-[var(--slk-charcoal)]/50">{t.confirmNote}</p>
          <div className="mt-10">
            <MapBlock locale="en" />
          </div>
        </section>
      </main>
      <FaqSection locale="en" />
      <SlkFooter locale="en" />
    </>
  );
}
