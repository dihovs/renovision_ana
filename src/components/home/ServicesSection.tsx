"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import FeatureCard from "@/components/ui/FeatureCard";
import {
  IconDroplet,
  IconTiles,
  IconKitchen,
  IconHammer,
  IconDrywall,
  IconWrench,
  IconStairs,
  IconBrush,
} from "@/components/ui/icons";

export default function ServicesSection() {
  const { t } = useLanguage();

  const services = [
    { icon: IconDroplet, href: "/services/water-damage", ...t.services.items.waterDamage },
    { icon: IconTiles, href: "/services/flooring", ...t.services.items.flooring },
    { icon: IconKitchen, href: "/services/kitchen-bath", ...t.services.items.kitchenBath },
    { icon: IconHammer, href: "/services/renovations", ...t.services.items.interior },
    { icon: IconStairs, href: "/services/basements", ...t.services.items.basements },
    { icon: IconDrywall, href: "/services/drywall", ...t.services.items.drywall },
    { icon: IconBrush, href: "/services/painting", ...t.services.items.painting },
    { icon: IconWrench, href: "/services/repairs", ...t.services.items.repairs },
  ];

  return (
    <section className="bg-brand-blue-light/40 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
            {t.services.title}
          </h2>
          <p className="mt-3 text-charcoal/70">{t.services.subtitle}</p>
        </div>

        {/* 2 or 4 columns, never 3: there are eight services, and eight
            divides evenly by 2 and 4 but leaves an orphan card in a
            three-column row. */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {services.map(({ icon, href, title, desc }) => (
            <FeatureCard
              key={href}
              icon={icon}
              href={href}
              title={title}
              desc={desc}
              footer={`${t.services.learnMore} →`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
