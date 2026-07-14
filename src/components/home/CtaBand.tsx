"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

export default function CtaBand() {
  const { t } = useLanguage();
  const { openChat } = useChat();

  return (
    <section className="bg-navy py-16">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 text-center sm:px-6 lg:flex-row lg:justify-between lg:text-left lg:px-8">
        <div>
          <h2 className="font-heading text-3xl font-bold text-white sm:text-4xl">
            {t.ctaBand.title}
          </h2>
          <p className="mt-3 max-w-xl text-white/70">{t.ctaBand.subtitle}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={openChat}
            className="rounded-full bg-brand-green px-7 py-3.5 font-heading font-bold text-white transition-colors hover:bg-brand-green-dark"
          >
            {t.ctaBand.ctaEstimate}
          </button>
          <a
            href={`tel:${SITE_PHONE_TEL}`}
            className="rounded-full border-2 border-white/40 px-7 py-3.5 text-center font-heading font-bold text-white transition-colors hover:border-white hover:bg-white/10"
          >
            {t.ctaBand.ctaCall} · {SITE_PHONE}
          </a>
        </div>
      </div>
    </section>
  );
}
