"use client";

import Link from "@/components/ui/LocaleLink";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import CtaBand from "@/components/home/CtaBand";
import { IconCheckCircle, IconMapPin } from "@/components/ui/icons";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";
import type { ServiceArea } from "@/lib/serviceAreas";

export default function ServiceAreaContent({ area }: { area: ServiceArea }) {
  const { t, locale } = useLanguage();
  const { openChat } = useChat();
  const copy = locale === "fr" ? area.fr : area.en;

  const labels =
    locale === "fr"
      ? {
          eyebrow: "Secteur desservi",
          contextHeading: `À propos de ${copy.name}`,
          servicesHeading: `Nos services à ${copy.name}`,
          servicesIntro:
            "Les services que nous réalisons le plus souvent dans ce secteur, selon le type de bâtiment qu'on y trouve.",
          faqHeading: "Questions fréquentes",
          sourcesLabel: "Contexte local tiré de",
          backLink: "Tous les secteurs desservis",
        }
      : {
          eyebrow: "Service area",
          contextHeading: `About ${copy.name}`,
          servicesHeading: `Our services in ${copy.name}`,
          servicesIntro:
            "The services we carry out most often in this sector, based on the kind of buildings actually here.",
          faqHeading: "Frequently asked questions",
          sourcesLabel: "Local context sourced from",
          backLink: "All service areas",
        };

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green-light text-brand-green">
            <IconMapPin className="h-7 w-7" />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-brand-green">
            {labels.eyebrow}
          </p>
          {/* The H1 carries the full service tagline, not just the bare
              borough name — "Chomedey" alone tells Google nothing about what
              the page offers. The name stays visually dominant; the tagline
              renders as a smaller second line inside the same heading. */}
          <h1 className="mt-3 font-heading font-extrabold text-brand-blue">
            <span className="block text-4xl sm:text-5xl">{copy.name}</span>
            <span className="mt-4 block text-xl font-bold leading-snug text-brand-blue/80 sm:text-2xl">
              {copy.tagline}
            </span>
          </h1>
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
      </section>

      <section className="bg-brand-blue-light/40 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
            {labels.contextHeading}
          </h2>
          <div className="mt-6 space-y-4">
            {copy.context.map((paragraph, i) => (
              <p key={i} className="text-base leading-relaxed text-charcoal/80">
                {paragraph}
              </p>
            ))}
          </div>

          {area.sources.length > 0 && (
            <p className="mt-6 text-xs leading-relaxed text-charcoal/50">
              {labels.sourcesLabel}{" "}
              {area.sources.map((source, i) => (
                <span key={source.url}>
                  {i > 0 && ", "}
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-brand-blue"
                  >
                    {source.label}
                  </a>
                </span>
              ))}
              .
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
          {copy.whatThisMeansHeading}
        </h2>
        <div className="mt-8 space-y-5">
          {copy.whatThisMeans.map((paragraph, i) => (
            <div key={i} className="flex gap-4">
              <IconCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" />
              <p className="text-base leading-relaxed text-charcoal/80">{paragraph}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-blue-light/40 py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
              {labels.servicesHeading}
            </h2>
            <p className="mt-3 text-charcoal/70">{labels.servicesIntro}</p>
          </div>
          {/* Internal links point only at services genuinely relevant to this
              sector's housing stock — not every service on every area page. */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {area.relatedServices.map((service) => (
              <Link
                key={service.href}
                href={service.href}
                className="group flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition-all hover:shadow-md hover:ring-brand-blue/20"
              >
                <span className="font-heading text-base font-bold text-brand-blue">
                  {locale === "fr" ? service.labelFr : service.labelEn}
                </span>
                <span
                  aria-hidden
                  className="text-brand-green transition-transform group-hover:translate-x-1"
                >
                  &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
          {labels.faqHeading}
        </h2>
        <dl className="mt-8 space-y-6">
          {copy.faq.map((item) => (
            <div key={item.question} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <dt className="font-heading text-base font-bold text-brand-blue">{item.question}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-charcoal/75">{item.answer}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-10">
          <Link href="/service-areas" className="text-sm font-semibold text-brand-blue hover:underline">
            &larr; {labels.backLink}
          </Link>
        </p>
      </section>

      <CtaBand />
    </>
  );
}
