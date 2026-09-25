import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { bookingLink, copy, type GalleryItem, type Locale } from "@/content/slk/copy";
import { slkPath } from "@/content/slk/paths";
import { CountUp, CurtainReveal, HeroTitle, Reveal } from "./motion";
import { DayTimeline, JourneySteps, ModalitiesRing, RecoveryChart } from "./infographics";

// The "after" half of a real peeling result (text and "before" panel cropped
// out) — even, glowing skin, which is what the hero headline promises.
const HERO_IMAGE = "/slk/instagram/04-peeling-after.jpg";

const CONTAINER = "mx-auto w-full max-w-7xl px-5 sm:px-8";

type Service = (typeof copy)["fr"]["services"][number];

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p
      className={`flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] ${
        dark ? "text-[var(--slk-clay-soft)]" : "text-[var(--slk-clay)]"
      }`}
    >
      <span aria-hidden="true" className="h-px w-8 bg-current" />
      {children}
    </p>
  );
}

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className={className}>
      <path d="M3 9h12m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Every "book" button: primary ink pill on light grounds, paper pill on dark/clay grounds. */
function BookButton({ label, onDark = false }: { label: string; onDark?: boolean }) {
  const book = bookingLink();
  return (
    <a
      href={book.href}
      target={book.external ? "_blank" : undefined}
      rel={book.external ? "noopener noreferrer" : undefined}
      className={`inline-flex items-center gap-3 rounded-full px-7 py-4 text-sm transition ${
        onDark
          ? "bg-[var(--slk-paper)] text-[var(--slk-ink)] hover:bg-[var(--slk-sand)]"
          : "bg-[var(--slk-ink)] text-[var(--slk-paper)] hover:bg-[var(--slk-clay)]"
      }`}
    >
      {label}
      <Arrow />
    </a>
  );
}

function TextLink({ href, children, onDark = false }: { href: string; children: ReactNode; onDark?: boolean }) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2 border-b pb-1 text-sm transition ${
        onDark
          ? "border-[var(--slk-paper)]/40 text-[var(--slk-paper)] hover:border-[var(--slk-paper)]"
          : "border-[var(--slk-ink)]/30 text-[var(--slk-ink)] hover:border-[var(--slk-clay)] hover:text-[var(--slk-clay)]"
      }`}
    >
      {children}
      <Arrow className="transition group-hover:translate-x-0.5" />
    </Link>
  );
}

export function PageIntro({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <section className="border-b border-[var(--slk-line)]">
      <Reveal className={`${CONTAINER} pb-14 pt-16 lg:pb-20 lg:pt-24`}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="font-slk-serif mt-8 max-w-4xl text-[clamp(2.75rem,6.5vw,5.75rem)] font-light leading-[0.98] tracking-[-0.02em]">
          {title}
        </h1>
        {intro && <p className="mt-8 max-w-xl text-lg font-light leading-relaxed text-[var(--slk-ink)]/75">{intro}</p>}
      </Reveal>
    </section>
  );
}

export function Hero({ locale }: { locale: Locale }) {
  const t = copy[locale].hero;
  // Peeling recovery — the same treatment the hero image is a result of.
  const heroStat = copy[locale].expect.items[1];
  return (
    <section className="relative overflow-hidden">
      <div className={`${CONTAINER} grid items-end gap-14 pb-20 pt-12 lg:grid-cols-[1.3fr_1fr] lg:gap-20 lg:pb-28 lg:pt-20`}>
        <div>
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h1 className="font-slk-serif mt-8 text-[clamp(3.25rem,8.5vw,7.75rem)] font-light leading-[0.94] tracking-[-0.025em]">
            <HeroTitle title={t.title} accent={t.accent} />
          </h1>
          <Reveal delay={0.7}>
            <p className="mt-8 max-w-md text-lg font-light leading-relaxed text-[var(--slk-ink)]/75">{t.subtitle}</p>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
              <BookButton label={t.cta} />
              <TextLink href={slkPath(locale, "/services")}>{t.ctaSecondary}</TextLink>
            </div>
          </Reveal>
          <Reveal delay={0.9}>
            <ul className="mt-12 flex flex-wrap gap-x-8 gap-y-2 border-t border-[var(--slk-line)] pt-6 text-[11px] uppercase tracking-[0.2em] text-[var(--slk-ink)]/65 lg:mt-16">
              {t.meta.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* Full-width on phones; capped on desktop, where the ~280px source would otherwise be blown up too far. */}
        <div className="relative mx-auto w-full lg:mr-0 lg:max-w-[26rem]">
          <div className="slk-arch relative aspect-[284/412] overflow-hidden bg-[var(--slk-sand)]">
            <CurtainReveal>
              <Image src={HERO_IMAGE} alt="" fill priority sizes="(min-width: 1024px) 26rem, 90vw" className="object-cover" />
            </CurtainReveal>
          </div>
          <Reveal delay={1.3} y={16} className="absolute -bottom-6 left-4 z-20 max-w-[15rem] rounded-2xl bg-[var(--slk-paper)] p-5 shadow-[0_20px_50px_-20px_rgba(30,25,21,0.35)] sm:-left-10">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--slk-ink)]/60">{heroStat.label}</p>
            <p className="font-slk-serif mt-2 text-3xl font-light text-[var(--slk-clay)]">{heroStat.value}</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function Marquee({ locale }: { locale: Locale }) {
  const items = copy[locale].marquee;
  return (
    <div aria-hidden="true" className="overflow-hidden border-y border-[var(--slk-line)] bg-[var(--slk-paper)] py-6">
      <div className="slk-marquee-track flex w-max items-center">
        {[...items, ...items].map((m, i) => (
          <span key={i} className="flex items-center">
            <span className="font-slk-serif px-8 text-2xl font-light italic text-[var(--slk-ink)]/80 sm:text-3xl">{m}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--slk-clay)]" />
          </span>
        ))}
      </div>
    </div>
  );
}

function ServiceRow({ locale, s }: { locale: Locale; s: Service }) {
  return (
    <Link
      href={slkPath(locale, `/services/${s.slug}`)}
      className="group grid grid-cols-[1fr_auto] items-center gap-6 border-b border-[var(--slk-line)] py-7"
    >
      <div>
        <p className="font-slk-serif text-2xl font-light leading-tight transition group-hover:text-[var(--slk-clay)] sm:text-3xl">
          {s.title}
        </p>
        <p className="mt-2 max-w-lg text-sm font-light leading-relaxed text-[var(--slk-ink)]/70">{s.blurb}</p>
      </div>
      <div className="flex items-center gap-5">
        {s.image && (
          <div className="relative hidden h-20 w-28 overflow-hidden rounded-lg sm:block">
            <Image
              src={s.image}
              alt=""
              fill
              sizes="112px"
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          </div>
        )}
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--slk-line)] text-[var(--slk-ink)] transition group-hover:border-[var(--slk-clay)] group-hover:bg-[var(--slk-clay)] group-hover:text-[var(--slk-paper)]">
          <Arrow />
        </span>
      </div>
    </Link>
  );
}

/** The treatment index — used on the homepage (with its own intro) and on /services (under PageIntro). */
export function ServicesGrid({ locale, showIntro = true }: { locale: Locale; showIntro?: boolean }) {
  const t = copy[locale];
  const categories = (Object.keys(t.serviceCategories) as (keyof typeof t.serviceCategories)[]).filter((c) =>
    t.services.some((s) => s.category === c),
  );
  return (
    <section className="bg-[var(--slk-bone)]">
      <div className={`${CONTAINER} py-24 lg:py-32`}>
        {showIntro && (
          <Reveal className="mb-16 grid gap-8 lg:grid-cols-2 lg:items-end">
            <div>
              <Eyebrow>{t.servicesIntro.eyebrow}</Eyebrow>
              <h2 className="font-slk-serif mt-6 text-[clamp(2.25rem,5vw,4rem)] font-light leading-[1.02] tracking-[-0.02em]">
                {t.servicesIntro.title}
              </h2>
            </div>
            <div className="lg:justify-self-end lg:text-right">
              <p className="max-w-md font-light leading-relaxed text-[var(--slk-ink)]/75 lg:ml-auto">
                {t.servicesIntro.subtitle}
              </p>
              <div className="mt-6">
                <TextLink href={slkPath(locale, "/services")}>{t.ui.allTreatments}</TextLink>
              </div>
            </div>
          </Reveal>
        )}

        {categories.map((cat, ci) => (
          <Reveal
            key={cat}
            className="grid gap-6 border-t border-[var(--slk-ink)]/80 pt-8 [&:not(:last-child)]:mb-20 lg:grid-cols-[18rem_1fr] lg:gap-16"
          >
            <div>
              <p className="font-slk-serif text-5xl font-light italic text-[var(--slk-clay)]">{ci === 0 ? "I" : "II"}</p>
              <h3 className="font-slk-serif mt-3 text-2xl font-light">{t.serviceCategories[cat]}</h3>
            </div>
            <div className="-mt-7">
              {t.services
                .filter((s) => s.category === cat)
                .map((s) => (
                  <ServiceRow key={s.slug} locale={locale} s={s} />
                ))}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function SignatureSpotlight({ locale }: { locale: Locale }) {
  const t = copy[locale].spotlight;
  const ui = copy[locale].ui;
  return (
    <section className="bg-[var(--slk-ink)] text-[var(--slk-paper)]">
      <div className={`${CONTAINER} grid items-start gap-14 py-24 lg:grid-cols-2 lg:gap-20 lg:py-32`}>
        <Reveal className="relative aspect-[640/420] overflow-hidden rounded-2xl lg:sticky lg:top-28">
          <Image src={t.image} alt="" fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
        </Reveal>
        <Reveal delay={0.1}>
          <Eyebrow dark>{t.eyebrow}</Eyebrow>
          <h2 className="font-slk-serif mt-6 text-[clamp(2.25rem,4.5vw,3.75rem)] font-light leading-[1.04] tracking-[-0.02em]">
            {t.title}
          </h2>
          <p className="mt-6 max-w-lg font-light leading-relaxed text-[var(--slk-paper)]/75">{t.body}</p>
          <p className="mt-10 text-[11px] uppercase tracking-[0.22em] text-[var(--slk-paper)]/60">{ui.modalitiesLabel}</p>
          <div className="mt-8">
            <ModalitiesRing modalities={t.modalities} center={t.ringCenter} />
          </div>
          <div className="mt-10">
            <BookButton label={t.cta} onDark />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function ExpectStrip({ locale }: { locale: Locale }) {
  const t = copy[locale].expect;
  const ui = copy[locale].ui;
  return (
    <section className="border-b border-[var(--slk-line)] bg-[var(--slk-paper)]">
      <div className={`${CONTAINER} grid gap-14 py-24 lg:grid-cols-[1fr_1.05fr] lg:gap-20 lg:py-32`}>
        <div>
          <Reveal>
            <Eyebrow>{t.eyebrow}</Eyebrow>
            <h2 className="font-slk-serif mt-6 max-w-xl text-[clamp(2rem,4vw,3.25rem)] font-light leading-[1.05] tracking-[-0.02em]">
              {t.title}
            </h2>
          </Reveal>
          <div className="mt-12 border-t border-[var(--slk-ink)]/80">
            {t.items.map((item, i) => (
              <Reveal
                key={item.label}
                delay={i * 0.12}
                className="grid gap-3 border-b border-[var(--slk-line)] py-7 sm:grid-cols-[12rem_1fr] sm:gap-8"
              >
                <p
                  className={`font-slk-serif font-light leading-[1.05] text-[var(--slk-clay)] ${
                    item.count ? "whitespace-nowrap text-4xl" : "text-3xl"
                  }`}
                >
                  {item.count ? (
                    <CountUp to={item.count.to} kind={item.count.kind} locale={locale} dayUnit={ui.dayUnit} />
                  ) : (
                    item.value
                  )}
                </p>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--slk-ink)]/65">{item.label}</p>
                  <p className="mt-2 text-sm font-light leading-relaxed text-[var(--slk-ink)]/75">{item.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal delay={0.15} className="lg:self-center">
          <RecoveryChart locale={locale} />
        </Reveal>
      </div>
    </section>
  );
}

/** The booking path as four steps on a self-drawing line. */
export function Journey({ locale }: { locale: Locale }) {
  const t = copy[locale].journey;
  return (
    <section className="border-y border-[var(--slk-line)] bg-[var(--slk-paper)]">
      <div className={`${CONTAINER} py-24 lg:py-32`}>
        <Reveal>
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h2 className="font-slk-serif mt-6 max-w-2xl text-[clamp(2rem,4vw,3.25rem)] font-light leading-[1.05] tracking-[-0.02em]">
            {t.title}
          </h2>
        </Reveal>
        <div className="mt-16">
          <JourneySteps locale={locale} />
        </div>
      </div>
    </section>
  );
}

function ResultFigure({ item, className = "" }: { item: GalleryItem; className?: string }) {
  return (
    <figure className={className}>
      <div className="relative aspect-[640/420] overflow-hidden rounded-xl bg-[var(--slk-sand)]">
        <Image src={item.src} alt={item.alt} fill sizes="(min-width: 1024px) 33vw, 80vw" className="object-cover" />
      </div>
      <figcaption className="mt-3 text-xs text-[var(--slk-ink)]/65">{item.alt}</figcaption>
    </figure>
  );
}

export function ResultsGallery({ locale }: { locale: Locale }) {
  const t = copy[locale].results;
  const groupHead = (label: string, count: number) => (
    <div className="mb-6 flex items-baseline justify-between border-b border-[var(--slk-line)] pb-3">
      <p className="font-slk-serif text-2xl font-light">{label}</p>
      <p className="text-xs text-[var(--slk-ink)]/60">{String(count).padStart(2, "0")}</p>
    </div>
  );
  return (
    <section className="bg-[var(--slk-bone)]">
      <div className={`${CONTAINER} py-24 lg:py-32`}>
        <Reveal className="grid gap-8 lg:grid-cols-2 lg:items-end">
          <div>
            <Eyebrow>{t.eyebrow}</Eyebrow>
            <h2 className="font-slk-serif mt-6 text-[clamp(2.25rem,5vw,4rem)] font-light leading-[1.02] tracking-[-0.02em]">
              {t.title}
            </h2>
          </div>
          <p className="max-w-md font-light leading-relaxed text-[var(--slk-ink)]/75 lg:justify-self-end">{t.subtitle}</p>
        </Reveal>

        <div className="mt-16">
          {groupHead(t.peauLabel, t.peau.length)}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {t.peau.map((item, i) => (
              <Reveal key={item.src} delay={i * 0.12}>
                <ResultFigure item={item} />
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal className="mt-16">
          {groupHead(t.corpsLabel, t.corps.length)}
          {/* Seven items don't sit well on a 3-col grid; a snap-scrolling row
              handles any count and reads as a proper gallery. */}
          <div
            role="region"
            aria-label={t.corpsLabel}
            tabIndex={0}
            className="-mx-5 flex snap-x snap-mandatory gap-6 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8"
          >
            {t.corps.map((item) => (
              <ResultFigure key={item.src} item={item} className="w-[80%] shrink-0 snap-start sm:w-[45%] lg:w-[31%]" />
            ))}
          </div>
        </Reveal>

        <p className="mt-10 max-w-2xl text-xs leading-relaxed text-[var(--slk-ink)]/65">{t.disclaimer}</p>
      </div>
    </section>
  );
}

export function ReviewsStrip({ locale }: { locale: Locale }) {
  const t = copy[locale].reviews;
  return (
    <section className="border-y border-[var(--slk-line)] bg-[var(--slk-paper)]">
      <Reveal className={`${CONTAINER} py-24 text-center`}>
        <div className="flex justify-center">
          <Eyebrow>{t.eyebrow}</Eyebrow>
        </div>
        <h2 className="font-slk-serif mt-6 text-[clamp(2rem,4vw,3.25rem)] font-light tracking-[-0.02em]">{t.title}</h2>
        {t.items.length > 0 ? (
          <div className="mt-14 grid gap-10 text-left md:grid-cols-3">
            {t.items.map((r) => (
              <figure key={r.quote} className="border-t border-[var(--slk-line)] pt-6">
                <blockquote className="font-slk-serif text-xl font-light italic leading-snug">“{r.quote}”</blockquote>
                <figcaption className="mt-4 text-[11px] uppercase tracking-[0.2em] text-[var(--slk-ink)]/60">{r.author}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="mx-auto mt-10 max-w-lg rounded-2xl border border-dashed border-[var(--slk-ink)]/25 px-8 py-6 text-sm font-light leading-relaxed text-[var(--slk-ink)]/70">
            {t.placeholder}
          </p>
        )}
      </Reveal>
    </section>
  );
}

export function AboutTeaser({ locale }: { locale: Locale }) {
  const t = copy[locale];
  return (
    <section className="bg-[var(--slk-sand)]">
      <div className={`${CONTAINER} grid gap-12 py-24 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-20 lg:py-32`}>
        <Reveal>
          <Eyebrow>{t.aboutPage.eyebrow}</Eyebrow>
          <p className="font-slk-serif mt-8 text-[clamp(2rem,4.5vw,3.75rem)] font-light italic leading-[1.08] tracking-[-0.015em]">
            {locale === "fr" ? <>«&nbsp;{t.aboutPage.quote}&nbsp;»</> : <>“{t.aboutPage.quote}”</>}
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="font-light leading-relaxed text-[var(--slk-ink)]/80">{t.aboutTeaser.body}</p>
          <div className="mt-8">
            <TextLink href={slkPath(locale, locale === "fr" ? "/a-propos" : "/about")}>{t.aboutTeaser.cta}</TextLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function FaqSection({ locale }: { locale: Locale }) {
  const t = copy[locale].faq;
  return (
    <section className="bg-[var(--slk-bone)]">
      <div className={`${CONTAINER} grid gap-12 py-24 lg:grid-cols-[1fr_1.6fr] lg:gap-20 lg:py-32`}>
        <Reveal>
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h2 className="font-slk-serif mt-6 text-[clamp(2rem,4vw,3.25rem)] font-light leading-[1.05] tracking-[-0.02em]">
            {t.title}
          </h2>
        </Reveal>
        <Reveal delay={0.12} className="border-t border-[var(--slk-ink)]/80">
          {t.items.map((item) => (
            <details key={item.q} className="slk-faq border-b border-[var(--slk-line)]">
              <summary className="flex cursor-pointer items-center justify-between gap-6 py-6">
                <span className="font-slk-serif text-xl font-light sm:text-2xl">{item.q}</span>
                <span
                  aria-hidden="true"
                  className="slk-faq-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--slk-line)] text-lg text-[var(--slk-clay)] transition"
                >
                  +
                </span>
              </summary>
              <p className="max-w-2xl pb-7 font-light leading-relaxed text-[var(--slk-ink)]/75">{item.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/** Plain Google Maps embed — no API key needed, just a text query. */
export function MapBlock({ locale }: { locale: Locale }) {
  const query = copy[locale].contactPage.mapQuery;
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[var(--slk-line)] bg-[var(--slk-sand)] lg:aspect-auto lg:h-full lg:min-h-[28rem]">
      <iframe
        title={locale === "fr" ? "Carte — Clinique Esthétique SLK" : "Map — Clinique Esthétique SLK"}
        src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`}
        className="absolute inset-0 h-full w-full border-0 grayscale-[35%]"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}

/** Closing booking band — clay ground so it reads distinct from the espresso footer below it. */
export function ContactTeaser({ locale }: { locale: Locale }) {
  const t = copy[locale];
  return (
    <section className="bg-[var(--slk-clay)] text-[var(--slk-paper)]">
      <div className={`${CONTAINER} grid gap-10 py-24 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:py-28`}>
        <Reveal>
          <h2 className="font-slk-serif text-[clamp(2.5rem,6vw,5rem)] font-light leading-[0.98] tracking-[-0.02em]">
            {t.contactTeaser.title}
          </h2>
          <p className="mt-6 max-w-md font-light leading-relaxed text-[var(--slk-paper)]/90">{t.contactTeaser.body}</p>
        </Reveal>
        <Reveal delay={0.15} className="lg:justify-self-end">
          <p className="mb-6 text-[11px] uppercase tracking-[0.2em] text-[var(--slk-paper)]/85">{t.noWalkIns}</p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
            <BookButton label={t.contactPage.bookCta} onDark />
            <TextLink href={slkPath(locale, "/contact")} onDark>
              {t.nav.contact}
            </TextLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** A single service's own page: what it is, what to expect, and links to the rest of the menu. */
export function ServiceDetail({ locale, slug }: { locale: Locale; slug: string }) {
  const t = copy[locale];
  const service = t.services.find((s) => s.slug === slug);
  if (!service) return null;
  const others = t.services.filter((s) => s.slug !== slug);

  return (
    <>
      <section>
        <div className={`${CONTAINER} grid gap-14 pb-24 pt-12 lg:grid-cols-[1.25fr_1fr] lg:gap-20 lg:pt-16`}>
          <div>
            <Link
              href={slkPath(locale, "/services")}
              className="inline-flex items-center gap-2 text-sm text-[var(--slk-ink)]/70 transition hover:text-[var(--slk-clay)]"
            >
              <Arrow className="rotate-180" />
              {t.ui.allTreatments}
            </Link>
            <div className="mt-12">
              <Eyebrow>{t.serviceCategories[service.category]}</Eyebrow>
            </div>
            <h1 className="font-slk-serif mt-6 text-[clamp(2.5rem,5.5vw,4.75rem)] font-light leading-[1] tracking-[-0.02em]">
              {service.title}
            </h1>
            <p className="mt-8 max-w-xl text-lg font-light leading-relaxed text-[var(--slk-ink)]/80">
              {service.detail.intro}
            </p>

            <ol className="mt-12 border-t border-[var(--slk-ink)]/80">
              {service.detail.points.map((point, i) => (
                <li key={point} className="grid grid-cols-[3rem_1fr] gap-4 border-b border-[var(--slk-line)] py-5">
                  <span className="font-slk-serif text-lg italic text-[var(--slk-clay)]">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-light leading-relaxed text-[var(--slk-ink)]/85">{point}</span>
                </li>
              ))}
            </ol>

            {service.recovery && <DayTimeline locale={locale} recovery={service.recovery} />}

            {service.detail.note && (
              <p className="mt-8 rounded-2xl bg-[var(--slk-sand)] px-6 py-5 text-sm font-light leading-relaxed text-[var(--slk-ink)]/80">
                {service.detail.note}
              </p>
            )}
          </div>

          <aside className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
            {service.image && (
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[var(--slk-sand)]">
                <Image src={service.image} alt="" fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
              </div>
            )}
            <div className="rounded-2xl bg-[var(--slk-ink)] p-8 text-[var(--slk-paper)]">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--slk-clay-soft)]">{t.noWalkIns}</p>
              <p className="font-slk-serif mt-4 text-2xl font-light">{t.contactTeaser.title}</p>
              <p className="mt-2 text-sm font-light text-[var(--slk-paper)]/75">{t.ui.instagramHandle}</p>
              <div className="mt-8">
                <BookButton label={t.contactPage.bookCta} onDark />
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-t border-[var(--slk-line)] bg-[var(--slk-paper)]">
        <div className={`${CONTAINER} py-20`}>
          <Eyebrow>{t.ui.otherTreatments}</Eyebrow>
          {/* Separate cards, not a hairline-gap grid: the count varies per page
              and a gap grid shows its background through any empty last-row cell. */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((s) => (
              <Link
                key={s.slug}
                href={slkPath(locale, `/services/${s.slug}`)}
                className="group flex items-end justify-between gap-6 rounded-2xl border border-[var(--slk-line)] bg-[var(--slk-paper)] p-7 transition hover:border-[var(--slk-clay)]/40 hover:bg-[var(--slk-bone)]"
              >
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--slk-ink)]/60">
                    {t.serviceCategories[s.category]}
                  </p>
                  <p className="font-slk-serif mt-3 text-xl font-light leading-snug transition group-hover:text-[var(--slk-clay)]">
                    {s.title}
                  </p>
                </div>
                <Arrow className="shrink-0 text-[var(--slk-ink)]/50 transition group-hover:translate-x-0.5 group-hover:text-[var(--slk-clay)]" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
