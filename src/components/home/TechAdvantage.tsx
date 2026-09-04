"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import {
  IconPhone,
  IconClipboard,
  IconCheckCircle,
  IconShield,
} from "@/components/ui/icons";

type TechCard = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
};

export default function TechAdvantage() {
  const { t } = useLanguage();

  const cards: TechCard[] = [
    {
      icon: IconPhone,
      label: t.techAdvantage.app.label,
      desc: t.techAdvantage.app.desc,
    },
    {
      icon: IconClipboard,
      label: t.techAdvantage.dryingLog.label,
      desc: t.techAdvantage.dryingLog.desc,
    },
    {
      icon: IconCheckCircle,
      label: t.techAdvantage.estimate.label,
      desc: t.techAdvantage.estimate.desc,
    },
    {
      icon: IconShield,
      label: t.techAdvantage.opus.label,
      desc: t.techAdvantage.opus.desc,
    },
  ];

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
            {t.techAdvantage.title}
          </h2>
          <p className="mt-3 text-sm text-charcoal/70">
            {t.techAdvantage.subtitle}
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ icon: Icon, label, desc }) => (
            <article
              key={label}
              className="group relative flex flex-col overflow-hidden rounded-2xl bg-brand-blue-light/20 p-7 pl-8 shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl motion-reduce:transform-none motion-reduce:transition-none"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1 bg-brand-green"
              />
              <span className="relative mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green text-white">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="relative font-heading text-base font-bold text-brand-blue">
                {label}
              </h3>
              <p className="relative mt-2 flex-1 text-sm leading-relaxed text-charcoal/75">
                {desc}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}