import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { bookingLink, business, copy, googleReviews, type GalleryItem, type Locale } from "@/content/slk/copy";
import { slkPath } from "@/content/slk/paths";
import { ClipReveal, CountUp, CurtainReveal, GrowLine, HeroTitle, Parallax, Reveal, SplitHeading } from "./motion";
import { DayTimeline, JourneySteps, ModalitiesRing, RecoveryChart } from "./infographics";
import { ReviewsCarousel, Stars } from "./reviews";

// The "après" photo of a real peeling result (from the clinic's full-resolution post; frame and "avant"
// panel cropped out) — even, glowing skin, which is what the hero headline promises.
const HERO_IMAGE = "/slk/instagram/04-peeling-after-full.jpg";

const CONTAINER = "mx-auto w-full max-w-7xl px-5 sm:px-8";

type Service = (typeof copy)["fr"]["services"][number];

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p
      className={`flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] ${
        dark ? "text-[var(--slk-clay-soft)]" : "text-[var(--slk-clay)]"
      }`}
    >
      <GrowLine />
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
      className={`group inline-flex items-center gap-3 rounded-full px-7 py-4 text-sm transition duration-300 hover:-translate-y-0.5 ${
        onDark
          ? "bg-[var(--slk-paper)] text-[var(--slk-ink)] hover:bg-[var(--slk-sand)]"
          : "bg-[var(--slk-ink)] text-[var(--slk-paper)] hover:bg-[var(--slk-clay)]"
      }`}
    >
      {label}
      <Arrow className="transition duration-300 group-hover:translate-x-1" />
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
      <Arrow className="transition duration-300 group-hover:translate-x-1" />
    </Link>
  );
}

export function PageIntro({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <section className="border-b border-[var(--slk-line)]">
      <Reveal className={`${CONTAINER} pb-14 pt-16 lg:pb-20 lg:pt-24`}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="font-slk-serif mt-8 max-w-4xl text-[clamp(2.75rem,6.5vw,5.75rem)] font-light leading-[0.98] tracking-[-0.02em]">
            <SplitHeading text={title} />
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
      {/* Phones read headline → photo → copy, so the photo lands on the first screen.
          Desktop puts the photo in its own column spanning both rows. */}
      <div
        className={`${CONTAINER} grid gap-10 pb-16 pt-8 sm:gap-14 sm:pb-20 sm:pt-12 lg:grid-cols-[1.3fr_1fr] lg:gap-x-20 lg:gap-y-0 lg:pb-28 lg:pt-20`}
      >
        <div className="lg:self-end">
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h1 className="font-slk-serif mt-6 text-[clamp(3.25rem,8.5vw,7.75rem)] font-light leading-[0.94] tracking-[-0.025em] sm:mt-8">
            <HeroTitle title={t.title} accent={t.accent} />
          </h1>
        </div>

        <div className="relative mx-auto w-full lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mr-0 lg:max-w-[26rem] lg:self-end">
          <div aria-hidden="true" className="slk-glow pointer-events-none absolute -inset-16 rounded-full sm:-inset-24" />
          <div className="slk-arch relative aspect-[4/5] overflow-hidden bg-[var(--slk-sand)] sm:aspect-[284/412]">
            <CurtainReveal>
              <Parallax amount={5}>
                <Image src={HERO_IMAGE} alt="" fill priority sizes="(min-width: 1024px) 26rem, 90vw" className="object-cover" />
              </Parallax>
            </CurtainReveal>
          </div>
          <Reveal delay={1.3} y={16} className="absolute -bottom-6 left-4 z-20 max-w-[15rem] rounded-2xl bg-[var(--slk-paper)] p-5 shadow-[0_20px_50px_-20px_rgba(30,25,21,0.35)] sm:-left-10">
            <div className="slk-float">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--slk-ink)]/60">{heroStat.label}</p>
              <p className="font-slk-serif mt-2 text-3xl font-light text-[var(--slk-clay)]">{heroStat.value}</p>
            </div>
          </Reveal>
        </div>

        <div className="pt-4 lg:self-start lg:pt-0">
          <Reveal delay={0.7}>
            <p className="max-w-md text-lg font-light leading-relaxed text-[var(--slk-ink)]/75 lg:mt-8">{t.subtitle}</p>
            <div data-slk-hero-cta className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-5 sm:mt-10">
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
        <p className="font-slk-serif text-2xl font-light leading-tight transition duration-500 group-hover:translate-x-2 group-hover:text-[var(--slk-clay)] sm:text-3xl">
          {s.title}
        </p>
        <p className="mt-2 max-w-lg text-sm font-light leading-relaxed text-[var(--slk-ink)]/70">{s.blurb}</p>
      </div>
      <div className="flex items-center gap-5">
        {s.image && (
          <div className="relative hidden h-20 w-20 overflow-hidden rounded-lg sm:block">
            <Image
              src={s.image}
              alt=""
              fill
              sizes="112px"
              className="object-cover"
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
      <div className={`${CONTAINER} py-16 sm:py-24 lg:py-32`}>
        {showIntro && (
          <Reveal className="mb-16 grid gap-8 lg:grid-cols-2 lg:items-end">
            <div>
              <Eyebrow>{t.servicesIntro.eyebrow}</Eyebrow>
              <h2 className="font-slk-serif mt-6 text-[clamp(2.25rem,5vw,4rem)] font-light leading-[1.02] tracking-[-0.02em]">
            <SplitHeading text={t.servicesIntro.title} />
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
                .map((s, i) => (
                  <Reveal key={s.slug} delay={0.1 + i * 0.08} y={18}>
                    <ServiceRow locale={locale} s={s} />
                  </Reveal>
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
      <div className={`${CONTAINER} grid items-start gap-10 sm:gap-14 py-16 sm:py-24 lg:grid-cols-2 lg:gap-20 lg:py-32`}>
        <Reveal className="relative aspect-square overflow-hidden rounded-2xl lg:sticky lg:top-28">
          {/* No parallax/zoom here: before/after posts must show edge to edge. */}
          <Image src={t.image} alt="" fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
        </Reveal>
        <Reveal delay={0.1}>
          <Eyebrow dark>{t.eyebrow}</Eyebrow>
          <h2 className="font-slk-serif mt-6 text-[clamp(2.25rem,4.5vw,3.75rem)] font-light leading-[1.04] tracking-[-0.02em]">
            <SplitHeading text={t.title} />
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
      <div className={`${CONTAINER} grid gap-10 sm:gap-14 py-16 sm:py-24 lg:grid-cols-[1fr_1.05fr] lg:gap-20 lg:py-32`}>
        <div>
          <Reveal>
            <Eyebrow>{t.eyebrow}</Eyebrow>
            <h2 className="font-slk-serif mt-6 max-w-xl text-[clamp(2rem,4vw,3.25rem)] font-light leading-[1.05] tracking-[-0.02em]">
            <SplitHeading text={t.title} />
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
      <div className={`${CONTAINER} py-16 sm:py-24 lg:py-32`}>
        <Reveal>
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h2 className="font-slk-serif mt-6 max-w-2xl text-[clamp(2rem,4vw,3.25rem)] font-light leading-[1.05] tracking-[-0.02em]">
            <SplitHeading text={t.title} />
          </h2>
        </Reveal>
        <div className="mt-16">
          <JourneySteps locale={locale} />
        </div>
      </div>
    </section>
  );
}

function ResultFigure({ item, className = "", delay = 0 }: { item: GalleryItem; className?: string; delay?: number }) {
  return (
    <figure className={`group ${className}`}>
      <ClipReveal delay={delay} className="relative aspect-square overflow-hidden rounded-xl bg-[var(--slk-sand)]">
        <Image
          src={item.src}
          alt={item.alt}
          fill
          sizes="(min-width: 1024px) 33vw, 80vw"
          className="object-cover"
        />
      </ClipReveal>
      <figcaption className="mt-3 text-xs text-[var(--slk-ink)]/65">{item.alt}</figcaption>
    </figure>
  );
}

export function ResultsGallery({ locale }: { locale: Locale }) {
  const t = copy[locale].results;
  const ui = copy[locale].ui;
  const groupHead = (label: string, count: number) => (
    <div className="mb-6 flex items-baseline justify-between border-b border-[var(--slk-line)] pb-3">
      <p className="font-slk-serif text-2xl font-light">{label}</p>
      <p className="flex items-center gap-3 text-xs text-[var(--slk-ink)]/60">
        {/* Swipe hint on phones only — from sm up the rows are plain grids. */}
        <span className="flex items-center gap-1.5 text-[var(--slk-clay)] sm:hidden">
          {ui.swipe}
          <Arrow className="slk-nudge h-3.5 w-3.5" />
        </span>
        {String(count).padStart(2, "0")}
      </p>
    </div>
  );
  // Phones: edge-to-edge swipe row (scroll-padding keeps snapped cards off the
  // screen edge). From sm up: a plain grid, so every photo shows at once.
  const galleryRow =
    "-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:p-0";
  const galleryCard = "w-[84%] shrink-0 snap-start sm:w-auto";
  return (
    <section className="bg-[var(--slk-bone)]">
      <div className={`${CONTAINER} py-16 sm:py-24 lg:py-32`}>
        <Reveal className="grid gap-8 lg:grid-cols-2 lg:items-end">
          <div>
            <Eyebrow>{t.eyebrow}</Eyebrow>
            <h2 className="font-slk-serif mt-6 text-[clamp(2.25rem,5vw,4rem)] font-light leading-[1.02] tracking-[-0.02em]">
            <SplitHeading text={t.title} />
          </h2>
          </div>
          <p className="max-w-md font-light leading-relaxed text-[var(--slk-ink)]/75 lg:justify-self-end">{t.subtitle}</p>
        </Reveal>

        <div className="mt-16">
          {groupHead(t.peauLabel, t.peau.length)}
          <div className={`${galleryRow} lg:grid-cols-3`}>
            {t.peau.map((item, i) => (
              <ResultFigure key={item.src} item={item} delay={i * 0.15} className={galleryCard} />
            ))}
          </div>
        </div>

        <Reveal className="mt-16">
          {groupHead(t.corpsLabel, t.corps.length)}
          <div className={`${galleryRow} lg:grid-cols-4`}>
            {t.corps.map((item, i) => (
              <ResultFigure key={item.src} item={item} delay={i * 0.15} className={galleryCard} />
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
  const { rating, count } = googleReviews;
  // Same-language reviews first, curated order kept within each group. Nothing is translated.
  const items = [...googleReviews.items].sort((a, b) => Number(b.lang === locale) - Number(a.lang === locale));
  const googleLink = (
    <a
      href={business.googleMaps}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-2 border-b border-[var(--slk-ink)]/30 pb-1 text-sm transition hover:border-[var(--slk-clay)] hover:text-[var(--slk-clay)]"
    >
      {t.seeAll}
      <Arrow className="transition duration-300 group-hover:translate-x-1" />
    </a>
  );
  return (
    <section className="overflow-hidden border-y border-[var(--slk-line)] bg-[var(--slk-bone)]">
      <div className={`${CONTAINER} py-16 sm:py-24 lg:py-28`}>
        <Reveal className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Eyebrow>{t.eyebrow}</Eyebrow>
            <h2 className="font-slk-serif mt-6 text-[clamp(2rem,4vw,3.25rem)] font-light leading-[1.05] tracking-[-0.02em]">
              <SplitHeading text={t.title} />
            </h2>
          </div>
          {/* The listing's own totals only — never an average of the few quoted below. */}
          {rating !== null && count !== null && (
            <div className="flex items-center gap-5">
              <p className="font-slk-serif text-6xl font-light leading-none text-[var(--slk-clay)]">
                {rating.toLocaleString(locale === "fr" ? "fr-CA" : "en-CA", { minimumFractionDigits: 1 })}
              </p>
              <div>
                <Stars rating={rating} size={16} label={t.starsLabel.replace("{n}", String(rating))} />
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--slk-ink)]/60">
                  {count} {t.countLabel}
                </p>
              </div>
            </div>
          )}
        </Reveal>

        {items.length > 0 ? (
          <Reveal delay={0.15} className="mt-12">
            <ReviewsCarousel locale={locale} reviews={items} />
            <div className="mt-6">{googleLink}</div>
          </Reveal>
        ) : (
          <Reveal delay={0.15} className="mt-10 flex flex-col items-start gap-5">
            <p className="max-w-md font-light leading-relaxed text-[var(--slk-ink)]/75">{t.placeholder}</p>
            {googleLink}
          </Reveal>
        )}
      </div>
    </section>
  );
}

export function AboutTeaser({ locale }: { locale: Locale }) {
  const t = copy[locale];
  return (
    <section className="bg-[var(--slk-sand)]">
      <div className={`${CONTAINER} grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-20 lg:py-32`}>
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
      <div className={`${CONTAINER} grid gap-12 py-16 sm:py-24 lg:grid-cols-[1fr_1.6fr] lg:gap-20 lg:py-32`}>
        <Reveal>
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h2 className="font-slk-serif mt-6 text-[clamp(2rem,4vw,3.25rem)] font-light leading-[1.05] tracking-[-0.02em]">
            <SplitHeading text={t.title} />
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
      <div className={`${CONTAINER} grid gap-10 py-16 sm:py-24 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:py-28`}>
        <Reveal>
          <h2 className="font-slk-serif text-[clamp(2.5rem,6vw,5rem)] font-light leading-[0.98] tracking-[-0.02em]">
            <SplitHeading text={t.contactTeaser.title} />
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
        <div className={`${CONTAINER} grid gap-10 pb-16 pt-8 sm:gap-14 sm:pb-24 sm:pt-12 lg:grid-cols-[1.25fr_1fr] lg:gap-20 lg:pt-16`}>
          <div>
            <Link
              href={slkPath(locale, "/services")}
              className="inline-flex items-center gap-2 text-sm text-[var(--slk-ink)]/70 transition hover:text-[var(--slk-clay)]"
            >
              <Arrow className="rotate-180" />
              {t.ui.allTreatments}
            </Link>
            <div className="mt-8 sm:mt-12">
              <Eyebrow>{t.serviceCategories[service.category]}</Eyebrow>
            </div>
            <h1 className="font-slk-serif mt-6 text-[clamp(2.5rem,5.5vw,4.75rem)] font-light leading-[1] tracking-[-0.02em]">
              {service.title}
            </h1>
            <p className="mt-8 max-w-xl text-lg font-light leading-relaxed text-[var(--slk-ink)]/80">
              {service.detail.intro}
            </p>

            {/* Phones: the result photo right after the intro, not below all the text. */}
            {service.image && (
              <div className="relative mt-10 aspect-square overflow-hidden rounded-2xl bg-[var(--slk-sand)] lg:hidden">
                <Image src={service.image} alt="" fill sizes="100vw" className="object-cover" />
              </div>
            )}

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
              <div className="relative hidden aspect-square overflow-hidden rounded-2xl bg-[var(--slk-sand)] lg:block">
                <Image src={service.image} alt="" fill sizes="40vw" className="object-cover" />
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
        <div className={`${CONTAINER} py-14 sm:py-20`}>
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
