"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { IconBuilding, IconShield, IconCheckCircle } from "@/components/ui/icons";

export default function TrustBar() {
  const { t } = useLanguage();

  const items = [
    { icon: IconBuilding, label: t.trustBar.item1 },
    { icon: IconShield, label: t.trustBar.item2 },
    { icon: IconCheckCircle, label: t.trustBar.item3 },
  ];

  return (
    <section className="border-y border-black/5 bg-brand-blue-light/60 py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 sm:flex-row sm:justify-center sm:gap-12 sm:px-6 lg:px-8">
        {items.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2.5 text-brand-blue">
            <Icon className="h-6 w-6 shrink-0 text-brand-green" />
            <span className="text-sm font-semibold">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
