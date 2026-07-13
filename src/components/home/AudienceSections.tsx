"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { IconBuilding, IconShield, IconHome } from "@/components/ui/icons";

export default function AudienceSections() {
  const { t } = useLanguage();

  const cards = [
    { icon: IconBuilding, ...t.audience.propertyManagers },
    { icon: IconShield, ...t.audience.insurance },
    { icon: IconHome, ...t.audience.homeowners },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <h2 className="text-center font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
        {t.audience.title}
      </h2>
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {cards.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="rounded-2xl border border-black/5 bg-white p-7 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue-light text-brand-blue">
              <Icon />
            </div>
            <h3 className="mt-5 font-heading text-lg font-bold text-brand-blue">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-charcoal/75">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
