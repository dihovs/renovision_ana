"use client";

import Link from "@/components/ui/LocaleLink";
import { useLanguage } from "@/i18n/LanguageProvider";
import CtaBand from "@/components/home/CtaBand";
import { IconMapPin } from "@/components/ui/icons";
import { serviceAreas } from "@/lib/serviceAreas";

export default function ServiceAreasIndexContent() {
  const { locale } = useLanguage();

  const labels =
    locale === "fr"
      ? {
          eyebrow: "Secteurs desservis",
          title: "Où nous travaillons",
          intro:
            "Nous desservons Laval et le Grand Montréal. Ces pages détaillent les secteurs où nous travaillons le plus, et ce que le parc immobilier de chacun implique concrètement pour vos travaux.",
          note: "Vous ne voyez pas votre secteur ? Nous desservons l'ensemble de Laval et du Grand Montréal — appelez-nous ou demandez une estimation.",
        }
      : {
          eyebrow: "Service areas",
          title: "Where we work",
          intro:
            "We serve Laval and greater Montreal. These pages cover the sectors we work in most, and what each one's housing stock actually means for your project.",
          note: "Don't see your area? We serve all of Laval and greater Montreal — call us or request an estimate.",
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
          <h1 className="mt-3 font-heading text-4xl font-extrabold text-brand-blue sm:text-5xl">
            {labels.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-charcoal/75">{labels.intro}</p>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-5 sm:grid-cols-2">
          {serviceAreas.map((area) => {
            const copy = locale === "fr" ? area.fr : area.en;
            return (
              <Link
                key={area.slug}
                href={`/service-areas/${area.slug}`}
                className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 transition-all hover:shadow-md hover:ring-brand-blue/20"
              >
                <h2 className="font-heading text-xl font-bold text-brand-blue">{copy.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">{copy.tagline}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-green">
                  {locale === "fr" ? "En savoir plus" : "Learn more"}
                  <span aria-hidden className="transition-transform group-hover:translate-x-1">
                    &rarr;
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-charcoal/60">{labels.note}</p>
      </section>

      <CtaBand />
    </>
  );
}
