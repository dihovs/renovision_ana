"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import Image from "next/image";

export default function AppNarrative() {
  const { t } = useLanguage();

  return (
    <section className="bg-charcoal-dark py-24 text-white sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-xl">
            <h2 className="font-heading text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-[2.75rem]">
              {t.appNarrative.title}
            </h2>
            <div className="mt-6 space-y-5">
              {t.appNarrative.paragraphs.map((paragraph, i) => (
                <p
                  key={i}
                  className={
                    i === 0
                      ? "text-lg leading-[1.6] text-white/90 sm:text-xl"
                      : "text-base leading-[1.7] text-white/60 sm:text-[1.0625rem]"
                  }
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.6)]">
            <Image
              src="/images/hero-basement-banner.jpg"
              alt="Renovision AnA mobile app showing project progress"
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}