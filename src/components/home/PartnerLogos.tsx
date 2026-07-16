"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";

const PARTNERS = [
  { name: "Desjardins Insurance", file: "desjardins.svg" },
  { name: "Beneva", file: "beneva.svg" },
  { name: "Promutuel Insurance", file: "promutuel.svg" },
  { name: "Intact Insurance", file: "intact.svg" },
  { name: "Belairdirect", file: "belairdirect.svg" },
  { name: "The Personal", file: "thepersonal.svg" },
  { name: "Aviva Canada", file: "aviva.svg" },
  { name: "TD Insurance", file: "td.svg" },
  { name: "Gestion Ajax", file: "gestionajax.png" },
];

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
        // Hovering: ease velocity toward the wheel-driven target, then let the target decay.
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

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("mousemove", onMouseMove);
      if (hoveredCardRef.current) applyHoverStyles(hoveredCardRef.current, false);
    };
  }, []);

  return (
    <section className="border-y border-black/5 bg-white py-14">
      <h2 className="text-center text-sm font-bold uppercase tracking-wide text-charcoal/50">
        {t.partners.title}
      </h2>
      <div
        ref={containerRef}
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => {
          pausedRef.current = false;
          mousePosRef.current = null;
        }}
        data-lenis-prevent
        className="mt-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
      >
        <div ref={trackRef} className="flex w-max gap-8 will-change-transform">
          {track.map((partner, i) => (
            <div
              key={`${partner.name}-${i}`}
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
          ))}
        </div>
      </div>
    </section>
  );
}
