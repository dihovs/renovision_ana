"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";

export default function ScrollBeforeAfter() {
  const { t } = useLanguage();
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
    <section className="relative overflow-hidden bg-white py-14 sm:py-16">
      {/* Soft brand wash so the section isn't a flat white void between two
          darker neighbours. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, rgba(43,92,158,0.05) 0%, transparent 35%, transparent 65%, rgba(78,158,46,0.05) 100%), radial-gradient(55% 50% at 50% 40%, rgba(43,92,158,0.06), transparent 70%)",
        }}
      />
      <div className="relative mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
            {t.beforeAfter.title}
          </h2>
          <p className="mt-3 text-charcoal/70">{t.beforeAfter.subtitle}</p>
        </div>

        <div className="mt-12">
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
              className="relative aspect-[16/10] w-full touch-none select-none overflow-hidden rounded-2xl border border-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.15),0_30px_60px_-20px_rgba(43,92,158,0.35)]"
            >
              <Image
                src="/images/hero-basement-before-v2.jpg"
                alt="Gutted basement mid-demolition with exposed ceiling joists and debris, before Renovision AnA's renovation"
                fill
                sizes="(min-width: 1024px) 55vw, 92vw"
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
                  sizes="(min-width: 1024px) 55vw, 92vw"
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
              {/* The masked overlay is the FINISHED room and it reveals from
                  the LEFT, so the left badge must say "after" and the right
                  badge "before". These were inverted for months — on the
                  page's single most persuasive asset. */}
              <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-brand-green px-3 py-1 text-xs font-bold uppercase text-white">
                {t.hero.afterLabel}
              </span>
              <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-bold uppercase text-white">
                {t.hero.beforeLabel}
              </span>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-charcoal/50">{t.hero.dragHint}</p>
        </div>
      </div>
    </section>
  );
}
