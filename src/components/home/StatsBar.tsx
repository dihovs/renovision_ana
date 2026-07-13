"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { IconCalendar, IconCheckCircle, IconHome, IconShield } from "@/components/ui/icons";

export default function StatsBar() {
  const { t } = useLanguage();

  const stats = [
    { icon: IconCalendar, ...t.stats.years },
    { icon: IconHome, ...t.stats.projects },
    { icon: IconCheckCircle, ...t.stats.satisfaction },
    { icon: IconShield, ...t.stats.emergency },
  ];

  return (
    <section className="bg-navy py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 lg:grid-cols-4">
          {stats.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 bg-navy-light/80 px-6 py-8 text-center"
            >
              <Icon className="h-6 w-6 text-brand-green-soft" />
              <span className="font-heading text-3xl font-semibold text-white">{value}</span>
              <span className="font-label text-xs font-medium uppercase tracking-wider text-white/60">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
