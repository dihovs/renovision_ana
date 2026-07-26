"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { GESTION_AJAX_URL } from "@/lib/constants";

const PARTNERS = [
  { name: "Desjardins Insurance", file: "desjardins.svg" },
  { name: "Beneva", file: "beneva.svg" },
  { name: "Promutuel Insurance", file: "promutuel.svg" },
  { name: "Intact Insurance", file: "intact.svg" },
  { name: "Belairdirect", file: "belairdirect.svg" },
  { name: "The Personal", file: "thepersonal.svg" },
  { name: "Aviva Canada", file: "aviva.svg" },
  { name: "TD Insurance", file: "td.svg" },
  { name: "Gestion Ajax", file: "gestionajax.png", url: GESTION_AJAX_URL },
];

// How long the carousel stays paused after the last touch before auto-scroll
// resumes on its own.
const TOUCH_RESUME_DELAY_MS = 5500;
// Minimum finger movement (px) before we commit to a swipe direction — avoids
// a barely-moved tap being read as a tiny, jittery drag.
const TOUCH_DIRECTION_THRESHOLD = 6;

export default function PartnerLogos() {
  const { t } = useLanguage();
  const track = [...PARTNERS, ...PARTNERS];

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const halfWidthRef = useRef(0);
  // Two-stage smoothing: wheel ticks add "energy" to a target, which itself
  // decays slowly; the actual velocity eases toward that target every frame
  // instead of snapping to it. This avoids the sawtooth stutter you get from
  // discrete mouse-wheel events (large, infrequent deltas) driving motion directly.
  const wheelTargetRef = useRef(0);
  const wheelVelocityRef = useRef(0);
  // Native CSS :hover only re-evaluates on actual mouse movement — when a card
  // slides under a stationary cursor (which is exactly what this marquee does),
  // :hover stays stuck on whatever card was last under a real mouse move. So
  // hover state is instead driven from cursor position every frame.
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const hoveredCardRef = useRef<HTMLElement | null>(null);

  // Once a real touch happens, ignore mouse enter/leave — touchscreens fire
  // synthetic "ghost" mouse events after a tap that has no matching mouseleave,
  // which would otherwise leave the carousel paused forever.
  const isTouchRef = useRef(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef(0);
  const touchStartOffsetRef = useRef(0);
  const touchDirectionRef = useRef<"horizontal" | "vertical" | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showSwipeHint, setShowSwipeHint] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const autoSpeed = prefersReduced ? 0 : 0.6; // auto-scroll px/frame
    const targetDecay = 0.94; // how fast wheel "energy" fades once you stop scrolling
    const easeFactor = 0.12; // how quickly actual velocity chases the target (lower = smoother)
    const maxWheelTarget = 32; // cap px/frame so a big scroll tick can't teleport the track

    const measure = () => {
      halfWidthRef.current = el.scrollWidth / 2;
    };
    measure();
    window.addEventListener("resize", measure);

    const wrap = () => {
      const half = halfWidthRef.current || 1;
      if (offsetRef.current >= half) offsetRef.current -= half;
      if (offsetRef.current < 0) offsetRef.current += half;
    };

    // Styles applied directly via JS rather than a toggled CSS class — the
    // card's own `transition` class still animates these smoothly, but setting
    // real values here sidesteps relying on any particular CSS variant syntax.
    const applyHoverStyles = (card: HTMLElement, hovered: boolean) => {
      const img = card.querySelector("img") as HTMLElement | null;
      if (hovered) {
        card.style.transform = "translateY(-4px) scale(1.1)";
        card.style.boxShadow = "0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)";
        card.style.borderColor = "rgba(43,92,158,0.15)";
        card.style.zIndex = "10";
        if (img) {
          img.style.filter = "grayscale(0)";
          img.style.opacity = "1";
        }
      } else {
        card.style.transform = "";
        card.style.boxShadow = "";
        card.style.borderColor = "";
        card.style.zIndex = "";
        if (img) {
          img.style.filter = "";
          img.style.opacity = "";
        }
      }
    };

    const updateHoveredCard = () => {
      const pos = mousePosRef.current;
      let next: HTMLElement | null = null;
      if (pos && pausedRef.current) {
        const hit = document.elementFromPoint(pos.x, pos.y);
        next = (hit?.closest("[data-partner-card]") as HTMLElement) ?? null;
      }
      if (next !== hoveredCardRef.current) {
        if (hoveredCardRef.current) applyHoverStyles(hoveredCardRef.current, false);
        if (next) applyHoverStyles(next, true);
        hoveredCardRef.current = next;
      }
    };

    let raf = 0;
    const step = () => {
      if (pausedRef.current) {
        // Hovering/dragging: ease velocity toward the wheel-driven target, then let the target decay.
        wheelVelocityRef.current += (wheelTargetRef.current - wheelVelocityRef.current) * easeFactor;
        wheelTargetRef.current *= targetDecay;
        if (Math.abs(wheelTargetRef.current) < 0.01) wheelTargetRef.current = 0;
        if (Math.abs(wheelVelocityRef.current) < 0.01) wheelVelocityRef.current = 0;
        offsetRef.current += wheelVelocityRef.current;
      } else {
        offsetRef.current += autoSpeed;
        wheelTargetRef.current = 0;
        wheelVelocityRef.current = 0;
      }
      wrap();
      el.style.transform = `translateX(${-offsetRef.current}px)`;
      updateHoveredCard();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    // While hovering, the wheel scrubs the logos instead of scrolling the page.
    // Repeated ticks stack into the target above, which the actual velocity eases toward.
    const onWheel = (e: WheelEvent) => {
      if (!pausedRef.current) return;
      e.preventDefault();
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      wheelTargetRef.current = Math.max(
        -maxWheelTarget,
        Math.min(maxWheelTarget, wheelTargetRef.current + delta * 0.12),
      );
    };
    container.addEventListener("wheel", onWheel, { passive: false });

    const onMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    container.addEventListener("mousemove", onMouseMove);

    const clearResumeTimer = () => {
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
    };
    const scheduleResume = () => {
      clearResumeTimer();
      resumeTimerRef.current = setTimeout(() => {
        pausedRef.current = false;
      }, TOUCH_RESUME_DELAY_MS);
    };

    // Touch: a finger down does NOT pause anything by itself — a touch that
    // starts on the carousel is very often just the start of a normal page
    // scroll (the visitor's thumb happening to land here), and that must
    // keep scrolling uninterrupted. Only once the gesture is confirmed
    // horizontal (an actual swipe on the logos) do we pause and take over;
    // a confirmed-vertical gesture is left alone entirely, start to finish.
    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      isTouchRef.current = true;
      touchStartXRef.current = touch.clientX;
      touchStartYRef.current = touch.clientY;
      touchStartOffsetRef.current = offsetRef.current;
      touchDirectionRef.current = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchStartXRef.current == null) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - touchStartXRef.current;
      const dy = touch.clientY - touchStartYRef.current;

      if (touchDirectionRef.current === null) {
        if (Math.abs(dx) < TOUCH_DIRECTION_THRESHOLD && Math.abs(dy) < TOUCH_DIRECTION_THRESHOLD) return;
        touchDirectionRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
        if (touchDirectionRef.current === "horizontal") {
          // Only now is this a deliberate swipe on the logos — pause and
          // start dragging from here.
          pausedRef.current = true;
          wheelTargetRef.current = 0;
          wheelVelocityRef.current = 0;
          clearResumeTimer();
          setShowSwipeHint(false);
        }
      }

      if (touchDirectionRef.current === "horizontal") {
        // Swiping the logos — take over from the page (which otherwise has
        // nothing to scroll here anyway).
        e.preventDefault();
        offsetRef.current = touchStartOffsetRef.current - dx;
      }
      // If the gesture reads as vertical, do nothing here so the page keeps
      // scrolling natively underneath — the carousel was never paused.
    };

    const onTouchEnd = () => {
      touchStartXRef.current = null;
      // Only schedule a resume if this gesture actually paused the carousel.
      if (touchDirectionRef.current === "horizontal") scheduleResume();
      touchDirectionRef.current = null;
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    container.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      clearResumeTimer();
      window.removeEventListener("resize", measure);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
      if (hoveredCardRef.current) applyHoverStyles(hoveredCardRef.current, false);
    };
  }, []);

  // One-time, subtle hint on load that the strip is swipeable on mobile —
  // fades in briefly, then fades back out (or disappears the moment someone
  // actually touches it).
  useEffect(() => {
    const showTimer = setTimeout(() => setShowSwipeHint(true), 700);
    const hideTimer = setTimeout(() => setShowSwipeHint(false), 3200);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <section className="border-y border-black/5 bg-white py-14">
      <h2 className="text-center text-sm font-bold uppercase tracking-wide text-charcoal/50">
        {t.partners.title}
      </h2>
      <div
        ref={containerRef}
        onMouseEnter={() => {
          if (isTouchRef.current) return;
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          if (isTouchRef.current) return;
          pausedRef.current = false;
          mousePosRef.current = null;
        }}
        data-lenis-prevent
        style={{ touchAction: "pan-y" }}
        className="relative mt-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
      >
        <div ref={trackRef} className="flex w-max items-start gap-8 will-change-transform">
          {track.map((partner, i) =>
            partner.url ? (
              <div key={`${partner.name}-${i}`} className="flex w-44 shrink-0 flex-col items-center gap-1">
                <PartnerLogoCard partner={partner} />
                <a
                  href={partner.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-brand-blue hover:underline"
                >
                  {partner.name}
                </a>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-green/80">
                  {t.partners.primePartner}
                </span>
              </div>
            ) : (
              <PartnerLogoCard key={`${partner.name}-${i}`} partner={partner} />
            ),
          )}
        </div>

        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-1 transition-opacity duration-700 ease-out sm:hidden ${
            showSwipeHint ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-charcoal/60 text-white shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 6l6 6-6 6M9 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </section>
  );
}

function PartnerLogoCard({ partner }: { partner: { name: string; file: string } }) {
  return (
    <div
      data-partner-card
      className="relative flex h-20 w-44 shrink-0 items-center justify-center rounded-xl border border-black/5 bg-white px-6 py-4 transition-all duration-300 ease-out"
    >
      <Image
        src={`/images/partners/${partner.file}`}
        alt={partner.name}
        width={160}
        height={60}
        className="h-full w-full object-contain grayscale opacity-70 transition-[filter,opacity] duration-300"
      />
    </div>
  );
}
