"use client";

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageProvider";
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
          {services.map(({ icon: Icon, href, title, desc }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col rounded-2xl bg-white p-7 shadow-sm ring-1 ring-black/5 transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-green-light text-brand-green">
                <Icon />
              </div>
              <h3 className="mt-5 font-heading text-lg font-bold text-brand-blue">{title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-charcoal/75">{desc}</p>
              <span className="mt-4 text-sm font-bold text-brand-green group-hover:text-brand-green-dark">
                {t.services.learnMore} →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
