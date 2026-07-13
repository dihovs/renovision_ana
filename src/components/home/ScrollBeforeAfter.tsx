"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import { SITE_PHONE_TEL } from "@/lib/constants";

export default function ScrollBeforeAfter() {
  const { t } = useLanguage();
  const { openChat } = useChat();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let ticking = false;

    const update = () => {
      ticking = false;
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) {
        setProgress(1);
        return;
      }
      const raw = -rect.top / scrollable;
      setProgress(Math.min(1, Math.max(0, raw)));
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const revealPercent = Math.round(progress * 100);

  return (
    <div ref={wrapperRef} className="relative h-[220vh] bg-navy">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 pt-20 sm:px-6 lg:grid-cols-2 lg:pt-16 lg:px-8">
          <div>
            <p className="mb-4 font-label text-xs font-semibold uppercase tracking-[0.25em] text-brand-green-soft">
              {t.hero.eyebrow}
            </p>
            <h1 className="font-heading text-4xl font-semibold leading-[1.15] text-white sm:text-5xl lg:text-[3.4rem]">
              {t.hero.headlineStart}{" "}
              <em className="italic text-brand-green-soft">{t.hero.headlineAccent}</em>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              {t.hero.subheadline}
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={openChat}
                className="inline-flex cursor-pointer items-center justify-center rounded-full bg-brand-green px-7 py-3.5 text-base font-bold text-white shadow-md transition-colors hover:bg-brand-green-dark"
              >
                {t.hero.ctaEstimate}
              </button>
              <a
                href={`tel:${SITE_PHONE_TEL}`}
                className="inline-flex items-center justify-center rounded-full border border-white/40 px-7 py-3.5 text-base font-bold text-white transition-colors hover:border-white hover:bg-white/10"
              >
                {t.hero.ctaCall}
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
              <Image
                src="/images/placeholder-before.svg"
                alt="Kitchen before Renovision Ana's water damage restoration work"
                fill
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="object-cover"
              />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - revealPercent}% 0 0)` }}
              >
                <Image
                  src="/images/placeholder-after.svg"
                  alt="Renovated kitchen after Renovision Ana's remodeling work"
                  fill
                  sizes="(min-width: 1024px) 40vw, 90vw"
                  className="object-cover"
                />
              </div>
              <div
                className="absolute inset-y-0 w-1 bg-white shadow-[0_0_0_2px_rgba(43,92,158,0.4)]"
                style={{ left: `${revealPercent}%` }}
              />
              <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-bold uppercase text-white">
                {t.hero.beforeLabel}
              </span>
              <span className="absolute right-3 top-3 rounded-full bg-brand-green px-3 py-1 text-xs font-bold uppercase text-white">
                {t.hero.afterLabel}
              </span>
            </div>
            <p className="mt-3 text-center text-xs text-white/40">
              Scroll to see the transformation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
