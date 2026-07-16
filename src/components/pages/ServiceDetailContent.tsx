"use client";

import type { ComponentType } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import CtaBand from "@/components/home/CtaBand";
import { IconCheckCircle } from "@/components/ui/icons";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

export type ServiceStep = { title: string; desc: string };
export type ServiceIncludedItem = { title: string; desc: string };

export type ServiceDetailCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  processTitle: string;
  processIntro: string;
  processSteps: ServiceStep[];
  includesTitle: string;
  includesIntro: string;
  includes: ServiceIncludedItem[];
};

export default function ServiceDetailContent({
  icon: Icon,
  copy,
}: {
  icon: ComponentType<{ className?: string }>;
  copy: ServiceDetailCopy;
}) {
  const { t } = useLanguage();
  const { openChat } = useChat();

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green-light text-brand-green">
            <Icon className="h-7 w-7" />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-brand-green">
            {copy.eyebrow}
          </p>
          <h1 className="mt-3 font-heading text-4xl font-extrabold text-brand-blue sm:text-5xl">
            {copy.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-charcoal/75">{copy.intro}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={openChat}
              className="cursor-pointer rounded-full bg-brand-green px-7 py-3.5 font-heading font-bold text-white shadow-sm transition-colors hover:bg-brand-green-dark"
            >
              {t.ctaBand.ctaEstimate}
            </button>
            <a
              href={`tel:${SITE_PHONE_TEL}`}
              className="rounded-full border-2 border-brand-blue px-7 py-3.5 text-center font-heading font-bold text-brand-blue transition-colors hover:bg-brand-blue-light"
            >
              {t.ctaBand.ctaCall} · {SITE_PHONE}
            </a>
          </div>
        </div>
      </section>

      <section className="bg-brand-blue-light/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
              {copy.processTitle}
            </h2>
            <p className="mt-3 text-sm text-charcoal/60">{copy.processIntro}</p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {copy.processSteps.map((step, i) => (
              <div key={step.title} className="relative text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue text-lg font-bold text-white">
                  {i + 1}
                </div>
                <h3 className="mt-4 font-heading text-base font-bold text-brand-blue">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-charcoal/75">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
            {copy.includesTitle}
          </h2>
          <p className="mt-3 text-charcoal/70">{copy.includesIntro}</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {copy.includes.map((item) => (
            <div key={item.title} className="flex gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <IconCheckCircle className="h-6 w-6 shrink-0 text-brand-green" />
              <div>
                <h3 className="font-heading text-base font-bold text-brand-blue">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-charcoal/75">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CtaBand />
    </>
  );
}
