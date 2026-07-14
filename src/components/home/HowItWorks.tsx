"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { IconClipboard, IconCalendar, IconCheckCircle, IconFlag } from "@/components/ui/icons";

export default function HowItWorks() {
  const { t } = useLanguage();

  const steps = [
    { icon: IconClipboard, ...t.howItWorks.steps.inspection },
    { icon: IconCalendar, ...t.howItWorks.steps.estimate },
    { icon: IconCheckCircle, ...t.howItWorks.steps.approval },
    { icon: IconFlag, ...t.howItWorks.steps.completion },
  ];

  return (
    <section className="bg-charcoal-dark py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-white sm:text-4xl">
            {t.howItWorks.title}
          </h2>
          <p className="mt-3 text-white/70">{t.howItWorks.subtitle}</p>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="relative text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-green text-white">
                <Icon className="h-7 w-7" />
              </div>
              <span className="mt-3 block text-xs font-bold uppercase tracking-wide text-brand-green-soft">
                {t.howItWorks.stepLabel} {i + 1}
              </span>
              <h3 className="mt-1 font-heading text-lg font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
