import Image from "next/image";
import Link from "next/link";
import { bookingLink, copy, type Locale } from "@/content/slk/copy";
import { slkPath } from "@/content/slk/paths";

// Gradient swatch for service rows that have no real photo yet (see
// `image` on each entry in src/content/slk/copy.ts).
const FALLBACK_SWATCHES = [
  "linear-gradient(135deg, #D9B48F, #A9694A)",
  "linear-gradient(135deg, #C9A98A, #8A9A7E)",
  "linear-gradient(135deg, #B5583A, #5B3A30)",
  "linear-gradient(135deg, #8A9A7E, #4A5744)",
  "linear-gradient(135deg, #D9B48F, #B5583A)",
  "linear-gradient(135deg, #C88B67, #96604A)",
  "linear-gradient(135deg, #A9694A, #5B3A30)",
  "linear-gradient(135deg, #8A9A7E, #8F4128)",
];

export function Hero({ locale }: { locale: Locale }) {
  const t = copy[locale].hero;
  const book = bookingLink();
  return (
    <section className="relative flex min-h-[92vh] items-end overflow-hidden">
      <Image
        src="/slk/instagram/03-facial-treatment-closeup.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="scale-110 object-cover blur-md"
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(160deg, rgba(228,201,174,0.35) 0%, rgba(91,58,48,0.55) 100%)" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(0deg, rgba(20,14,11,0.68) 0%, rgba(20,14,11,0.15) 45%, rgba(20,14,11,0.25) 100%)",
        }}
      />
      <span className="absolute right-6 top-7 rounded-full border border-white/30 px-3 py-1 text-[10px] uppercase tracking-widest text-white/55 sm:right-10">
        {locale === "fr" ? "Photo Instagram, traitée — à remplacer par un vrai portrait" : "Treated Instagram photo — replace with a real portrait"}
      </span>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 text-[var(--slk-ivory)] sm:px-6 sm:pb-24">
        <p className="text-sm uppercase tracking-widest text-[var(--slk-ivory)]/85">{t.eyebrow}</p>
        <h1 className="font-slk-serif max-w-3xl text-5xl font-normal leading-[1.04] tracking-tight sm:text-7xl">
          {t.title}
        </h1>
        <p className="max-w-md text-lg font-light leading-relaxed text-[var(--slk-ivory)]/90">{t.subtitle}</p>
        <div className="flex flex-wrap gap-4 pt-3">
          <a
            href={book.href}
            target={book.external ? "_blank" : undefined}
            rel={book.external ? "noopener noreferrer" : undefined}
            className="rounded-full bg-[var(--slk-ivory)] px-7 py-4 text-sm font-medium text-[var(--slk-charcoal)] transition hover:opacity-90"
          >
            {t.cta}
          </a>
          <Link
            href={slkPath(locale, "/services")}
            className="rounded-full border border-white/50 px-7 py-4 text-sm font-medium text-[var(--slk-ivory)] transition hover:bg-white/10"
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
    <section className="bg-[var(--slk-charcoal)] text-[var(--slk-ivory)]">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <div className="mb-16 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-4 text-sm uppercase tracking-widest text-[var(--slk-terracotta)]">
              {t.servicesIntro.eyebrow}
            </p>
            <h2 className="font-slk-serif text-4xl font-normal sm:text-5xl">{t.servicesIntro.title}</h2>
          </div>
          <Link
            href={slkPath(locale, "/services")}
            className="whitespace-nowrap rounded-full border border-white/25 px-6 py-3 text-sm hover:bg-white/5"
          >
            {locale === "fr" ? "Tous les soins →" : "All treatments →"}
          </Link>
        </div>
        <p className="mb-12 max-w-xl font-light text-[var(--slk-ivory)]/70">{t.servicesIntro.subtitle}</p>

        <div className="flex flex-col">
          {t.services.map((s, i) => (
            <div
              key={s.title}
              className="grid grid-cols-[36px_1fr] items-center gap-4 border-t border-white/10 py-7 last:border-b sm:grid-cols-[60px_1fr_180px]"
            >
              <div className="font-slk-serif text-sm text-[var(--slk-ivory)]/35">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div>
                <Link
                  href={slkPath(locale, `/services/${s.slug}`)}
                  className="font-slk-serif mb-1 block text-xl font-normal hover:text-[var(--slk-terracotta)] sm:text-2xl"
                >
                  {s.title}
                </Link>
                <p className="max-w-md text-sm font-light text-[var(--slk-ivory)]/55">{s.blurb}</p>
              </div>
              {s.image ? (
                <div className="relative hidden h-16 overflow-hidden rounded-lg sm:block">
                  <Image src={s.image} alt="" fill sizes="180px" className="object-cover" />
                </div>
              ) : (
                <div
                  className="hidden h-16 rounded-lg opacity-85 sm:block"
                  style={{ background: FALLBACK_SWATCHES[i % FALLBACK_SWATCHES.length] }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SignatureSpotlight({ locale }: { locale: Locale }) {
  const t = copy[locale].spotlight;
  return (
    <section className="bg-[var(--slk-ivory)]">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-24 sm:px-6 md:grid-cols-2 md:gap-14">
        <div className="relative aspect-square overflow-hidden rounded-2xl">
          {/* Source image is a square 640x640 Instagram still with baked-in
              French promo text — aspect-square matches it exactly so
              object-cover shows the whole graphic instead of cropping text. */}
          <Image src={t.image} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
        </div>
        <div>
          <p className="mb-4 text-sm uppercase tracking-widest text-[var(--slk-terracotta)]">{t.eyebrow}</p>
          <h2 className="font-slk-serif mb-6 text-3xl font-normal sm:text-4xl">{t.title}</h2>
          <p className="mb-8 font-light text-[var(--slk-charcoal)]/70">{t.body}</p>
          <a
            href={bookingLink().href}
            target={bookingLink().external ? "_blank" : undefined}
            rel={bookingLink().external ? "noopener noreferrer" : undefined}
            className="inline-block rounded-full bg-[var(--slk-terracotta)] px-7 py-4 text-sm font-medium text-white transition hover:bg-[var(--slk-terracotta-dark)]"
          >
            {t.cta}
          </a>
        </div>
      </div>
    </section>
  );
}

export function ResultsGallery({ locale }: { locale: Locale }) {
  const t = copy[locale].results;
  return (
    <section className="bg-[var(--slk-terracotta-light)]">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <p className="mb-4 text-sm uppercase tracking-widest text-[var(--slk-terracotta-dark)]">{t.eyebrow}</p>
        <h2 className="font-slk-serif mb-3 text-3xl font-normal text-[var(--slk-charcoal)] sm:text-4xl">
          {t.title}
        </h2>
        <p className="mb-10 max-w-xl font-light text-[var(--slk-charcoal)]/70">{t.subtitle}</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {t.items.map((item) => (
            <div key={item.src} className="group relative aspect-square overflow-hidden rounded-xl">
              <Image
                src={item.src}
                alt={item.alt}
                fill
                sizes="(min-width: 640px) 33vw, 50vw"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
              <span className="absolute bottom-2 left-2 rounded-full bg-[var(--slk-charcoal)]/70 px-3 py-1 text-[11px] text-[var(--slk-ivory)]">
                {item.tag}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-2xl text-xs text-[var(--slk-charcoal)]/55">{t.disclaimer}</p>
      </div>
    </section>
  );
}

export function AboutTeaser({ locale }: { locale: Locale }) {
  const t = copy[locale].aboutTeaser;
  return (
    <section className="bg-[var(--slk-terracotta-light)]">
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <h2 className="font-slk-serif text-3xl font-normal text-[var(--slk-charcoal)] sm:text-4xl">{t.title}</h2>
        <p className="mt-4 font-light text-[var(--slk-charcoal)]/70">{t.body}</p>
        <Link
          href={slkPath(locale, locale === "fr" ? "/a-propos" : "/about")}
          className="mt-8 inline-block rounded-full border border-[var(--slk-terracotta)] px-7 py-3 text-sm font-medium text-[var(--slk-terracotta-dark)] transition hover:bg-white"
        >
          {t.cta}
        </Link>
      </div>
    </section>
  );
}

export function ContactTeaser({ locale }: { locale: Locale }) {
  const t = copy[locale].contactTeaser;
  const book = bookingLink();
  return (
    <section className="bg-[var(--slk-charcoal)] text-[var(--slk-ivory)]">
      <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
        <h2 className="font-slk-serif text-3xl font-normal sm:text-4xl">{t.title}</h2>
        <p className="mx-auto mt-4 max-w-lg font-light text-[var(--slk-ivory)]/65">{t.body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <a
            href={book.href}
            target={book.external ? "_blank" : undefined}
            rel={book.external ? "noopener noreferrer" : undefined}
            className="rounded-full bg-[var(--slk-terracotta)] px-7 py-4 text-sm font-medium text-white transition hover:bg-[var(--slk-terracotta-dark)]"
          >
            {copy[locale].contactPage.bookCta}
          </a>
          <Link
            href={slkPath(locale, "/contact")}
            className="rounded-full border border-white/25 px-7 py-4 text-sm font-medium text-[var(--slk-ivory)] transition hover:bg-white/5"
          >
            {copy[locale].nav.contact}
          </Link>
        </div>
      </div>
    </section>
  );
}

/** A single service's own page: what it is, what to expect, and links to the rest of the menu. */
export function ServiceDetail({ locale, slug }: { locale: Locale; slug: string }) {
  const t = copy[locale];
  const service = t.services.find((s) => s.slug === slug);
  if (!service) return null;
  const book = bookingLink();
  const others = t.services.filter((s) => s.slug !== slug);

  return (
    <>
      <section className="relative flex min-h-[46vh] items-end overflow-hidden bg-[var(--slk-charcoal)]">
        {service.image && (
          <>
            <Image src={service.image} alt="" fill sizes="100vw" className="object-cover opacity-40" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(0deg, rgba(20,14,11,0.85) 0%, rgba(20,14,11,0.3) 60%, rgba(20,14,11,0.4) 100%)",
              }}
            />
          </>
        )}
        <div className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-14 text-[var(--slk-ivory)] sm:px-6">
          <Link
            href={slkPath(locale, "/services")}
            className="mb-6 inline-block text-sm text-[var(--slk-ivory)]/70 hover:text-[var(--slk-ivory)]"
          >
            ← {t.nav.services}
          </Link>
          <h1 className="font-slk-serif text-4xl font-normal sm:text-5xl">{service.title}</h1>
        </div>
      </section>

      <section className="bg-[var(--slk-ivory)]">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <p className="mb-8 text-lg font-light leading-relaxed text-[var(--slk-charcoal)]/80">
            {service.detail.intro}
          </p>
          <ul className="mb-10 flex flex-col gap-4">
            {service.detail.points.map((point) => (
              <li key={point} className="flex gap-3 text-[var(--slk-charcoal)]/80">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--slk-terracotta)]" />
                <span className="font-light">{point}</span>
              </li>
            ))}
          </ul>
          {service.detail.note && (
            <p className="mb-10 rounded-xl bg-[var(--slk-terracotta-light)] px-5 py-4 text-sm text-[var(--slk-charcoal)]/70">
              {service.detail.note}
            </p>
          )}
          <div className="flex flex-wrap gap-4">
            <a
              href={book.href}
              target={book.external ? "_blank" : undefined}
              rel={book.external ? "noopener noreferrer" : undefined}
              className="rounded-full bg-[var(--slk-terracotta)] px-7 py-4 text-sm font-medium text-white transition hover:bg-[var(--slk-terracotta-dark)]"
            >
              {t.contactPage.bookCta}
            </a>
            <Link
              href={slkPath(locale, "/contact")}
              className="rounded-full border border-[var(--slk-terracotta)] px-7 py-4 text-sm font-medium text-[var(--slk-terracotta-dark)] transition hover:bg-white"
            >
              {t.nav.contact}
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[var(--slk-charcoal)] text-[var(--slk-ivory)]">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <p className="mb-6 text-sm uppercase tracking-widest text-[var(--slk-terracotta)]">
            {locale === "fr" ? "Autres soins" : "Other treatments"}
          </p>
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {others.map((s) => (
              <Link
                key={s.slug}
                href={slkPath(locale, `/services/${s.slug}`)}
                className="border-b border-white/10 py-3 font-light hover:text-[var(--slk-terracotta)]"
              >
                {s.title}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
