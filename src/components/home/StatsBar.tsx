"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { IconCalendar, IconCheckCircle, IconHome, IconMapPin } from "@/components/ui/icons";

export default function StatsBar() {
  const { t } = useLanguage();

  const stats = [
    { icon: IconCalendar, ...t.stats.years },
    { icon: IconHome, ...t.stats.projects },
    { icon: IconCheckCircle, ...t.stats.satisfaction },
    { icon: IconMapPin, ...t.stats.emergency },
  ];

  return (
    <section className="bg-charcoal-dark py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 lg:grid-cols-4">
          {/* Slow-drifting Quebec-blue / brand-green glow behind the stats.
              Scoped to this card only; painted first so real content (below,
              given a stacking context via z-10) always sits above it. */}
          <div
            aria-hidden
            className="animate-drift pointer-events-none absolute inset-0 -z-0"
            style={{
              background:
                "radial-gradient(45% 60% at 15% 20%, rgba(0,61,165,0.35), transparent 65%), radial-gradient(40% 55% at 85% 80%, rgba(78,158,46,0.28), transparent 65%)",
            }}
          />
          {stats.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="relative z-10 flex flex-col items-center gap-2 bg-charcoal-dark-light/80 px-6 py-8 text-center"
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
