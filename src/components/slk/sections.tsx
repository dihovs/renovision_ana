import Link from "next/link";
import { business, copy, type Locale } from "@/content/slk/copy";
import { slkPath } from "@/content/slk/paths";

export function Hero({ locale }: { locale: Locale }) {
  const t = copy[locale].hero;
  return (
    <section className="bg-[var(--slk-cream)]">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:px-6 sm:py-28">
        <p className="text-sm font-semibold uppercase tracking-widest text-[var(--slk-gold)]">
          {t.eyebrow}
        </p>
        <h1 className="max-w-2xl font-slk-serif text-4xl font-semibold leading-tight text-[var(--slk-charcoal)] sm:text-5xl">
          {t.title}
        </h1>
        <p className="max-w-xl text-lg text-[var(--slk-charcoal)]/75">{t.subtitle}</p>
        <div className="flex flex-wrap gap-4 pt-2">
          <a
            href={business.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[var(--slk-rose)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--slk-rose-dark)]"
          >
            {t.cta}
          </a>
          <Link
            href={slkPath(locale, "/services")}
            className="rounded-full border border-[var(--slk-rose)] px-6 py-3 text-sm font-semibold text-[var(--slk-rose-dark)] transition hover:bg-[var(--slk-rose-light)]"
          >
            {t.ctaSecondary}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function ServicesGrid({ locale }: { locale: Locale }) {
  const t = copy[locale];
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-[var(--slk-gold)]">
        {t.servicesIntro.eyebrow}
      </p>
      <h2 className="mt-2 font-slk-serif text-3xl font-semibold text-[var(--slk-charcoal)] sm:text-4xl">
        {t.servicesIntro.title}
      </h2>
      <p className="mt-3 max-w-xl text-[var(--slk-charcoal)]/70">{t.servicesIntro.subtitle}</p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {t.services.map((s) => (
          <div
            key={s.title}
            className="rounded-2xl border border-[var(--slk-rose-light)] bg-white p-6 shadow-sm"
          >
            <h3 className="font-slk-serif text-lg font-semibold text-[var(--slk-rose-dark)]">
              {s.title}
            </h3>
            <p className="mt-2 text-sm text-[var(--slk-charcoal)]/75">{s.blurb}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AboutTeaser({ locale }: { locale: Locale }) {
  const t = copy[locale].aboutTeaser;
  return (
    <section className="bg-[var(--slk-rose-light)]">
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h2 className="font-slk-serif text-3xl font-semibold text-[var(--slk-charcoal)]">{t.title}</h2>
        <p className="mt-4 text-[var(--slk-charcoal)]/75">{t.body}</p>
        <Link
          href={slkPath(locale, locale === "fr" ? "/a-propos" : "/about")}
          className="mt-6 inline-block rounded-full border border-[var(--slk-rose)] px-6 py-3 text-sm font-semibold text-[var(--slk-rose-dark)] transition hover:bg-white"
        >
          {t.cta}
        </Link>
      </div>
    </section>
  );
}

export function ContactTeaser({ locale }: { locale: Locale }) {
  const t = copy[locale].contactTeaser;
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
      <h2 className="font-slk-serif text-3xl font-semibold text-[var(--slk-charcoal)]">{t.title}</h2>
      <p className="mx-auto mt-4 max-w-lg text-[var(--slk-charcoal)]/75">{t.body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-4">
        <a
          href={business.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-[var(--slk-rose)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--slk-rose-dark)]"
        >
          {copy[locale].contactPage.bookCta}
        </a>
        <Link
          href={slkPath(locale, "/contact")}
          className="rounded-full border border-[var(--slk-rose)] px-6 py-3 text-sm font-semibold text-[var(--slk-rose-dark)] transition hover:bg-[var(--slk-rose-light)]"
        >
          {copy[locale].nav.contact}
        </Link>
      </div>
    </section>
  );
}
