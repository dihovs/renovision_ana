"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import { REVIEW_COUNT_DISPLAY_THRESHOLD, SITE_PHONE_TEL } from "@/lib/constants";

export default function ScrollBeforeAfter({
  overallRating,
  reviewCount,
}: {
  overallRating?: number | null;
  reviewCount?: number | null;
}) {
  const { t } = useLanguage();
  const { openChat } = useChat();
  const frameRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const targetRef = useRef(50);
  const displayRef = useRef(50);
  const rafRef = useRef(0);
  const loopRunningRef = useRef(false);
  const [displayPercent, setDisplayPercent] = useState(50);

  // The easing loop only runs while the handle is actually catching up to the
  // drag target, then stops itself. A perpetual rAF loop would burn battery on
  // mobile for a slider that's sitting still most of the time.
  const ensureEasingLoop = () => {
    if (loopRunningRef.current) return;
    loopRunningRef.current = true;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const easeFactor = prefersReduced ? 1 : 0.22;

    const step = () => {
      const target = targetRef.current;
      let display = displayRef.current;
      display += (target - display) * easeFactor;
      if (Math.abs(target - display) < 0.05) display = target;
      displayRef.current = display;
      setDisplayPercent(Math.round(display * 10) / 10);

      if (display !== target) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        loopRunningRef.current = false;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const updateFromClientX = (clientX: number) => {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    targetRef.current = Math.min(100, Math.max(0, pct));
    ensureEasingLoop();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    // Some browsers throw if the pointerId isn't from a live capture-eligible
    // session (e.g. certain synthetic or edge-case inputs) — dragging still
    // works via move/up without capture, so this is just belt-and-suspenders.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    updateFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const revealPercent = displayPercent;
  const featherPct = 6; // width of the soft blend zone at the wipe edge, in %

  return (
    <div className="relative overflow-hidden bg-white">
      {/* Soft whole-section wash (white to a faint blue/green tint) plus two
          tighter radial washes behind the photo card — together they keep
          the section from reading as a flat white void without introducing
          any new colours outside the brand palette. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, rgba(43,92,158,0.05) 0%, transparent 35%, transparent 65%, rgba(78,158,46,0.05) 100%), radial-gradient(60% 55% at 78% 45%, rgba(43,92,158,0.07), transparent 70%), radial-gradient(40% 45% at 85% 80%, rgba(78,158,46,0.06), transparent 70%)",
        }}
      />
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-20 lg:px-8">
        <div className="lg:-translate-y-3">
          <p className="mb-4 font-label text-xs font-semibold uppercase tracking-[0.25em] text-brand-green">
            {t.hero.eyebrow}
          </p>
          <h1 className="font-heading leading-[1.1] text-brand-blue">
            <span className="text-3xl font-medium sm:text-4xl lg:text-[2.75rem]">
              {t.hero.headlineStart}{" "}
            </span>
            <em className="block text-4xl font-extrabold italic text-brand-green sm:text-5xl lg:text-[3.75rem]">
              {t.hero.headlineAccent}
            </em>
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

          {/* Quiet credibility signal — deliberately small and muted so it
              supports the CTAs above without competing with them. Uses the
              real, live-pulled Google rating when configured; otherwise
              falls back to the already-established "Licensed & insured"
              trust-bar claim rather than inventing a number. */}
          <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-charcoal/60">
            {overallRating != null ? (
              <>
                <span className="flex text-brand-green" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2L4.6 17.8l1.3-6-4.6-4.1 6.1-.6L10 1.5Z" />
                    </svg>
                  ))}
                </span>
                {reviewCount != null && reviewCount >= REVIEW_COUNT_DISPLAY_THRESHOLD
                  ? t.testimonials.overallRatingLabel(overallRating.toFixed(1), reviewCount)
                  : t.testimonials.overallRatingOnlyLabel(overallRating.toFixed(1))}
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-brand-green">
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
                {t.trustBar.item3}
              </>
            )}
          </div>
        </div>

        <div className="lg:ml-[-3rem] lg:translate-y-3">
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
            <div
              ref={frameRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="relative aspect-[4/3] w-full touch-none select-none overflow-hidden rounded-2xl border border-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.15),0_30px_60px_-20px_rgba(43,92,158,0.35)]"
            >
              <Image
                src="/images/hero-basement-before-v2.jpg"
                alt="Gutted basement mid-demolition with exposed ceiling joists and debris, before Renovision AnA's renovation"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="pointer-events-none object-cover grayscale-[45%] brightness-[0.92] contrast-[1.05]"
              />
              <div
                className="pointer-events-none absolute inset-0 overflow-hidden"
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
                className="pointer-events-none absolute inset-y-0 w-px bg-gradient-to-b from-white/0 via-white/90 to-white/0"
                style={{ left: `${revealPercent}%` }}
              />
              <div
                className="pointer-events-none absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg ring-1 ring-black/10 backdrop-blur-sm"
                style={{ left: `${revealPercent}%` }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-brand-blue">
                  <path d="M8 7 4 12l4 5M16 7l4 5-4 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-bold uppercase text-white">
                {t.hero.beforeLabel}
              </span>
              <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-brand-green px-3 py-1 text-xs font-bold uppercase text-white">
                {t.hero.afterLabel}
              </span>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-charcoal/50">{t.hero.dragHint}</p>
        </div>
      </div>
    </div>
  );
}
