"use client";

import type { ComponentType } from "react";
import Image from "next/image";
import GroundedImage from "@/components/ui/GroundedImage";
import Link from "@/components/ui/LocaleLink";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/i18n/LanguageProvider";
import { getAreasForService } from "@/lib/serviceAreas";
import { useChat } from "@/components/chat/ChatProvider";
import CtaBand from "@/components/home/CtaBand";
import TrustBar from "@/components/home/TrustBar";
import { IconCheckCircle } from "@/components/ui/icons";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";
import type { FaqItem } from "@/lib/serviceFaq";

export type ServiceStep = { title: string; desc: string };
export type ServiceIncludedItem = { title: string; desc: string };

/**
 * An optional photo for a service page. `caption` lives here (rather than in a
 * shared translation table) so it travels with the per-locale copy object and
 * gets translated alongside everything else on the page.
 *
 * Captions are load-bearing, not decoration: where an image is a concept or
 * illustration rather than a photo of a job we actually completed, the caption
 * is where that gets said. See the `-concept` vs `-real` split in
 * public/images.
 */
export type ServiceMediaItem = { src: string; alt: string; caption: string };

/**
 * Local context for a service — what this work actually involves in Laval and
 * greater Montreal specifically, rather than copy that would read identically
 * for a contractor in Ontario or Ohio.
 *
 * Every claim here has to trace back to something already established and
 * sourced elsewhere in the repo: the housing-stock facts in serviceAreas.ts
 * (Ville de Laval municipal histories, StatCan 2021), or the citations inside
 * the blog posts. `readMore` points at the post carrying those citations, so
 * the detail lives in one place instead of being restated and drifting.
 */
export type ServiceLocalContext = {
  heading: string;
  paragraphs: string[];
  readMore?: { label: string; href: string };
};

export type ServiceDetailCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  media?: ServiceMediaItem[];
  /** Disclosure shown once under the photo grid — e.g. flagging that the
   *  images illustrate the process rather than depicting a specific job. */
  mediaNote?: string;
  processTitle: string;
  processIntro: string;
  processSteps: ServiceStep[];
  includesTitle: string;
  includesIntro: string;
  includes: ServiceIncludedItem[];
  localContext?: ServiceLocalContext;
  /**
   * Optional Q&A. When a page supplies this, its server component must emit
   * the matching FAQPage schema from the SAME source — see serviceFaq.ts.
   * Markup that doesn't match visible text is a rich-result violation, not a
   * clever shortcut.
   */
  faq?: FaqItem[];
};

export default function ServiceDetailContent({
  icon: Icon,
  copy,
}: {
  icon: ComponentType<{ className?: string }>;
  copy: ServiceDetailCopy;
}) {
  const { t, locale } = useLanguage();
  const { openChat } = useChat();
  // Read the current path rather than taking it as a prop, so none of the
  // eight service pages that render this component need to pass anything.
  const pathname = usePathname();
  const areas = getAreasForService(pathname ?? "");

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green-light text-brand-green">
            <Icon className="h-7 w-7" />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-brand-green-dark">
            {copy.eyebrow}
          </p>
          <h1 className="mt-3 font-heading text-4xl font-extrabold text-brand-blue sm:text-5xl">
            {copy.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-charcoal/75">{copy.intro}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={openChat}
              className="cursor-pointer rounded-full uppercase tracking-[0.08em] bg-brand-green px-7 py-3.5 font-heading font-bold text-white shadow-sm transition-colors hover:bg-brand-green-dark"
            >
              {t.ctaBand.ctaEstimate}
            </button>
            <a
              href={`tel:${SITE_PHONE_TEL}`}
              className="rounded-full uppercase tracking-[0.08em] border-2 border-brand-blue px-7 py-3.5 text-center font-heading font-bold text-brand-blue transition-colors hover:bg-brand-blue-light"
            >
              {t.ctaBand.ctaCall} · {SITE_PHONE}
            </a>
          </div>
        </div>

        {/* Optional photos. Omitted entirely by pages that don't define
            `media`, so service pages without photography render exactly as
            they did before rather than leaving an empty gap. */}
        {copy.media && copy.media.length > 0 && (
          <div
            className={`mx-auto mt-14 grid max-w-5xl gap-6 ${
              copy.media.length > 1 ? "sm:grid-cols-2" : "max-w-3xl"
            }`}
          >
            {copy.media.map((item) => (
              <figure key={item.src}>
                {/* A lone feature image gets the hero's grounding shapes; a
                    pair does not — the shapes would collide in the gap between
                    them and read as clutter rather than depth. */}
                {copy.media!.length === 1 ? (
                  <GroundedImage
                    src={item.src}
                    alt={item.alt}
                    sizes="(min-width: 640px) 45vw, 90vw"
                  />
                ) : (
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-black/5 shadow-[0_20px_60px_-25px_rgba(43,92,158,0.45)]">
                    <Image
                      src={item.src}
                      alt={item.alt}
                      fill
                      sizes="(min-width: 640px) 45vw, 90vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <figcaption className="mt-2.5 text-center text-xs text-charcoal/55">
                  {item.caption}
                </figcaption>
              </figure>
            ))}
            {copy.mediaNote && (
              <p className="col-span-full text-center text-[11px] italic text-charcoal/40">
                {copy.mediaNote}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="bg-brand-blue-light/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
              {copy.processTitle}
            </h2>
            <p className="mt-3 text-sm text-charcoal/70">{copy.processIntro}</p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {copy.processSteps.map((step, i) => (
              <div key={step.title} className="relative text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue text-lg font-bold text-white">
                  {i + 1}
                </div>
                <h3 className="mt-4 font-heading text-base font-bold text-brand-blue">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-charcoal/75">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
            {copy.includesTitle}
          </h2>
          <p className="mt-3 text-charcoal/70">{copy.includesIntro}</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {copy.includes.map((item) => (
            <div key={item.title} className="flex gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <IconCheckCircle className="h-6 w-6 shrink-0 text-brand-green" />
              <div>
                <h3 className="font-heading text-base font-bold text-brand-blue">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-charcoal/75">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Editorial section, set apart from the rest of the page by air rather
          than by a border. The heading is near-white instead of brand blue:
          #2b5c9e on this background sits around 2.4:1, which fails contrast
          for large text and reads muddy — the accent stays on the link, where
          it has a job. The opening paragraph is set a step larger and brighter
          because it carries the point of the section; the rest recede. */}
      {copy.localContext && (
        <section className="bg-charcoal-dark py-24 text-white sm:py-32">
          <div className="mx-auto max-w-[44rem] px-6 lg:px-8">
            <h2 className="font-heading text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-[2.75rem]">
              {copy.localContext.heading}
            </h2>
            <div className="mt-8 space-y-6 sm:mt-10 sm:space-y-7">
              {copy.localContext.paragraphs.map((paragraph, i) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className={
                    i === 0
                      ? "text-lg leading-[1.6] text-white/90 sm:text-xl"
                      : "text-base leading-[1.7] text-white/60 sm:text-[1.0625rem]"
                  }
                >
                  {paragraph}
                </p>
              ))}
            </div>
            {copy.localContext.readMore && (
              <Link
                href={copy.localContext.readMore.href}
                className="group mt-10 inline-flex items-center gap-1.5 text-base text-brand-green transition-colors hover:text-brand-green-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green sm:mt-12"
              >
                {copy.localContext.readMore.label}
                <span
                  aria-hidden
                  className="text-lg leading-none transition-transform duration-200 motion-safe:group-hover:translate-x-1"
                >
                  &rsaquo;
                </span>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Q&A sits after the local context and before the area links: someone
          who has read this far is deciding whether to call, and these are the
          questions that decide it. Same markup as the area pages' FAQ so the
          two read as one site. The strings come from serviceFaq.ts, which is
          also what the page's FAQPage schema is built from. */}
      {copy.faq && copy.faq.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
            {locale === "fr" ? "Questions fréquentes" : "Frequently asked questions"}
          </h2>
          <dl className="mt-8 space-y-6">
            {copy.faq.map((item) => (
              <div
                key={item.question}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5"
              >
                <dt className="font-heading text-base font-bold text-brand-blue">
                  {item.question}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-charcoal/75">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Reciprocal half of the service/location linking: the area pages
          already point here, this points back. Only the areas that actually
          list this service are shown — derived from the same data, so the
          two directions stay in step and neither becomes link-everything-to-
          everything. Renders nothing when no area lists the service. */}
      {areas.length > 0 && (
        <section className="border-t border-black/5 bg-brand-blue-light/20 py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-heading text-lg font-bold text-brand-blue">
              {locale === "fr"
                ? "Ce service, secteur par secteur"
                : "This service, area by area"}
            </h2>
            <p className="mt-1.5 text-sm text-charcoal/70">
              {locale === "fr"
                ? "Ce que le parc immobilier de chaque secteur implique pour ce type de travaux."
                : "What each sector's housing stock means for this kind of work."}
            </p>
            <ul className="mt-5 flex flex-wrap gap-2.5">
              {areas.map((area) => (
                <li key={area.slug}>
                  <Link
                    href={`/service-areas/${area.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue/15 bg-white px-4 py-2 text-sm font-semibold text-brand-blue transition-colors hover:border-brand-blue hover:bg-brand-blue hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
                  >
                    {locale === "fr" ? area.fr.name : area.en.name}
                    <span aria-hidden>&rarr;</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Insured / warranty / insurer-network line, immediately before the ask.
          It used to render on the homepage only, which is the wrong page for
          it: someone arriving on a service page from search decides here and
          never sees the homepage at all. Same component, same strings — this
          is a placement fix, not a new claim, and every line of it is backed
          by the Sécurité et garantie page. */}
      <TrustBar />

      <CtaBand />
    </>
  );
}
