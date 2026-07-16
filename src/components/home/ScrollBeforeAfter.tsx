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
  const [displayPercent, setDisplayPercent] = useState(0);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Target is the raw scroll-derived progress; displayed value eases toward
    // it every frame instead of snapping 1:1 with scroll. This is what turns
    // a mechanical scroll-tied wipe into something that feels intentional —
    // the same "ease toward a target" pattern used by the partner-logo marquee.
    let target = 0;
    let display = 0;
    let raf = 0;

    const computeTarget = () => {
      const rect = el.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) {
        target = 1;
        return;
      }
      const raw = -rect.top / scrollable;
      target = Math.min(1, Math.max(0, raw));
    };

    const step = () => {
      computeTarget();
      display += (target - display) * (prefersReduced ? 1 : 0.18);
      if (Math.abs(target - display) < 0.0005) display = target;
      setDisplayPercent(Math.round(display * 1000) / 10);
      raf = requestAnimationFrame(step);
    };

    computeTarget();
    display = target;
    raf = requestAnimationFrame(step);

    return () => cancelAnimationFrame(raf);
  }, []);

  const revealPercent = displayPercent;
  const featherPct = 6; // width of the soft blend zone at the wipe edge, in %

  return (
    <div
      ref={wrapperRef}
      data-scroll-hero
      className="relative h-[160vh] bg-white lg:h-[220vh]"
    >
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        {/* Soft radial wash so the section isn't stark flat white — ties the
            photo card to its surroundings instead of floating on a void. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 55% at 78% 45%, rgba(43,92,158,0.07), transparent 70%), radial-gradient(40% 45% at 85% 80%, rgba(78,158,46,0.06), transparent 70%)",
          }}
        />
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 pt-20 sm:px-6 lg:grid-cols-2 lg:pt-16 lg:px-8">
          <div>
            <p className="mb-4 font-label text-xs font-semibold uppercase tracking-[0.25em] text-brand-green">
              {t.hero.eyebrow}
            </p>
            <h1 className="font-heading text-4xl font-semibold leading-[1.15] text-brand-blue sm:text-5xl lg:text-[3.4rem]">
              {t.hero.headlineStart}{" "}
              <em className="italic text-brand-green">{t.hero.headlineAccent}</em>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-charcoal/80">
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
                className="inline-flex items-center justify-center rounded-full border-2 border-brand-blue px-7 py-3.5 text-base font-bold text-brand-blue transition-colors hover:bg-brand-blue-light"
              >
                {t.hero.ctaCall}
              </a>
            </div>
          </div>

          <div>
            {/* Grounding shapes behind the photo card — without these the card
                reads as a UI element dropped on empty white space rather than
                something designed into the layout. Scoped to a wrapper that
                contains only the card, not the caption below it, so the
                offsets peek out around the photo's own edges specifically. */}
            <div className="relative">
              <div
                aria-hidden
                className="absolute -right-4 -top-5 h-[70%] w-[55%] rounded-[2rem] bg-brand-blue-light/70 lg:-right-6 lg:-top-6"
              />
              <div
                aria-hidden
                className="absolute bottom-3 -left-4 h-[38%] w-[40%] rounded-[1.75rem] bg-brand-green-light lg:-left-5"
              />
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-black/5 shadow-[0_30px_60px_-20px_rgba(43,92,158,0.35)]">
              <Image
                src="/images/hero-basement-before-v2.jpg"
                alt="Gutted basement mid-demolition with exposed ceiling joists and debris, before Renovision AnA's renovation"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="object-cover grayscale-[45%] brightness-[0.92] contrast-[1.05]"
              />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  WebkitMaskImage: `linear-gradient(to right, black 0%, black ${Math.max(0, revealPercent - featherPct)}%, transparent ${revealPercent}%)`,
                  maskImage: `linear-gradient(to right, black 0%, black ${Math.max(0, revealPercent - featherPct)}%, transparent ${revealPercent}%)`,
                }}
              >
                <Image
                  src="/images/hero-basement-after-v2.jpg"
                  alt="Finished basement with new plank flooring, painted walls, and recessed lighting, after Renovision AnA's renovation"
                  fill
                  sizes="(min-width: 1024px) 40vw, 90vw"
                  className="object-cover"
                />
              </div>
              <div
                className="absolute inset-y-0 w-px bg-gradient-to-b from-white/0 via-white/90 to-white/0"
                style={{ left: `${revealPercent}%` }}
              />
              <div
                className="absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 shadow-lg ring-1 ring-black/10 backdrop-blur-sm"
                style={{ left: `${revealPercent}%` }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-brand-blue">
                  <path d="M8 7 4 12l4 5M16 7l4 5-4 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-bold uppercase text-white">
                {t.hero.beforeLabel}
              </span>
              <span className="absolute right-3 top-3 rounded-full bg-brand-green px-3 py-1 text-xs font-bold uppercase text-white">
                {t.hero.afterLabel}
              </span>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-charcoal/50">
              Scroll to see the transformation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
