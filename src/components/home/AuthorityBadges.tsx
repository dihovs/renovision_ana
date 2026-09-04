"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import {
  IconShield,
  IconCheckCircle,
  IconBuilding,
  IconMapPin,
} from "@/components/ui/icons";

/** Google star rating icon. */
function IconStar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

type BadgeCard = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  /** Optional large stat number to display prominently. */
  stat?: string;
};

export default function AuthorityBadges() {
  const { t } = useLanguage();

  const badges: BadgeCard[] = [
    {
      icon: IconStar,
      label: t.authority.reviews.label,
      stat: t.authority.reviews.stat,
      desc: t.authority.reviews.desc,
    },
    {
      icon: IconBuilding,
      label: t.authority.insurerNetwork.label,
      desc: t.authority.insurerNetwork.desc,
    },
    {
      icon: IconShield,
      label: t.authority.warranty.label,
      desc: t.authority.warranty.desc,
    },
    {
      icon: IconMapPin,
      label: t.authority.local.label,
      desc: t.authority.local.desc,
    },
  ];

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
            {t.authority.title}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-charcoal/70">
            {t.authority.subtitle}
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {badges.map(({ icon: Icon, label, desc, stat }) => (
            <article
              key={label}
              className="group relative flex flex-col overflow-hidden rounded-2xl bg-brand-blue-light/20 p-7 pl-8 shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl motion-reduce:transform-none motion-reduce:transition-none"
            >
              {/* Oversized watermark matching AudienceSections. */}
              <Icon
                aria-hidden
                className="pointer-events-none absolute -right-4 -top-4 h-32 w-32 text-brand-blue/[0.05] transition-colors duration-300 group-hover:text-brand-blue/[0.09]"
              />

              {/* Accent rule. */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1 bg-brand-green"
              />

              {/* Icon chip. */}
              <span className="relative mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue text-white">
                <Icon className="h-5 w-5" />
              </span>

              <h3 className="relative font-heading text-lg font-bold leading-snug text-brand-blue">
                {label}
              </h3>

              {stat && (
                <p className="relative mt-1 font-heading text-2xl font-extrabold text-brand-green">
                  {stat}
                </p>
              )}

              <p className="relative mt-2 flex-1 text-sm leading-relaxed text-charcoal/70">
                {desc}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}