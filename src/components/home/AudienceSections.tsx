"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { IconBuilding, IconShield, IconHome } from "@/components/ui/icons";

type AudienceCard = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  /** The work this client type actually calls us for. Real service pages, so
   *  the differentiator is concrete and the homepage links down into them. */
  services: { label: string; href: string }[];
};

export default function AudienceSections() {
  const { t, locale } = useLanguage();
  const fr = locale === "fr";

  const cards: AudienceCard[] = [
    {
      icon: IconBuilding,
      ...t.audience.propertyManagers,
      services: [
        { label: fr ? "Dégât d'eau" : "Water damage", href: "/services/water-damage" },
        { label: fr ? "Peinture" : "Painting", href: "/services/painting" },
        { label: fr ? "Petites réparations" : "Small repairs", href: "/services/repairs" },
      ],
    },
    {
      icon: IconShield,
      ...t.audience.insurance,
      services: [
        { label: fr ? "Dégât d'eau" : "Water damage", href: "/services/water-damage" },
        { label: fr ? "Gypse" : "Drywall", href: "/services/drywall" },
        { label: fr ? "Planchers" : "Flooring", href: "/services/flooring" },
      ],
    },
    {
      icon: IconHome,
      ...t.audience.homeowners,
      services: [
        { label: fr ? "Cuisine et salle de bain" : "Kitchen & bath", href: "/services/kitchen-bath" },
        { label: fr ? "Sous-sol" : "Basements", href: "/services/basements" },
        { label: fr ? "Rénovations" : "Renovations", href: "/services/renovations" },
      ],
    },
  ];

  return (
    <section className="bg-brand-blue-light/25 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
            {t.audience.title}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-charcoal/70">{t.audience.subtitle}</p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {cards.map(({ icon: Icon, title, desc, services }) => (
            <article
              key={title}
              className="group relative flex flex-col overflow-hidden rounded-2xl bg-white p-7 pl-8 shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl motion-reduce:transform-none motion-reduce:transition-none"
            >
              {/* Oversized watermark bleeding off the corner, replacing the
                  tinted icon chip. It carries the card's identity at a glance
                  without competing with the type for attention. */}
              <Icon
                aria-hidden
                className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 text-brand-blue/[0.06] transition-colors duration-300 group-hover:text-brand-blue/[0.10]"
              />

              {/* Accent rule that fills top-to-bottom on hover — the one moving
                  part, so the motion reads as deliberate rather than scattered. */}
              <span
                aria-hidden
                className="absolute left-0 top-0 w-1 bg-brand-green transition-[height] duration-500 ease-out h-10 group-hover:h-full motion-reduce:h-full motion-reduce:transition-none"
              />

              <h3 className="relative font-heading text-xl font-bold leading-snug text-brand-blue">
                {title}
              </h3>
              <p className="relative mt-3 flex-1 text-sm leading-relaxed text-charcoal/75">{desc}</p>

              <div className="relative mt-6 border-t border-black/5 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-charcoal/40">
                  {t.audience.commonWork}
                </p>
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {services.map((service) => (
                    <li key={service.href}>
                      <Link
                        href={service.href}
                        className="inline-block rounded-full bg-brand-blue-light/70 px-3 py-1 text-xs font-semibold text-brand-blue transition-colors hover:bg-brand-blue hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
                      >
                        {service.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
