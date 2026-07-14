"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import FeatureCard from "@/components/ui/FeatureCard";
import {
  IconDroplet,
  IconTiles,
  IconKitchen,
  IconHammer,
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
    { icon: IconBrush, href: "/services/repairs", ...t.services.items.repairs },
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

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
