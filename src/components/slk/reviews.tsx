"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useInView, useReducedMotion } from "motion/react";
import { business, copy, type Locale, type Review } from "@/content/slk/copy";

const AUTOPLAY_MS = 6500;
/** Reviews longer than this get clamped with a "read more" toggle. */
const CLAMP_AT = 240;

function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export function Stars({ rating, label, size = 14 }: { rating: number; label: string; size?: number }) {
  return (
    <span role="img" aria-label={label} className="flex gap-0.5 text-[var(--slk-clay)]">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M10 1.8l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L10 14.2 5 17l1.2-5.6L2 7.6l5.6-.6L10 1.8z"
            fill={i < Math.round(rating) ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

function ReviewCard({ review, locale }: { review: Review; locale: Locale }) {
  const t = copy[locale].reviews;
  const [open, setOpen] = useState(false);
  const long = review.text.length > CLAMP_AT;

  return (
    <figure className="flex h-full flex-col rounded-2xl border border-[var(--slk-line)] bg-[var(--slk-paper)] p-7 sm:p-8">
      <div className="flex items-center justify-between">
        <Stars rating={review.rating} label={fill(t.starsLabel, { n: review.rating })} />
        <a
          href={business.googleMaps}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-[var(--slk-line)] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-[var(--slk-ink)]/55 transition hover:border-[var(--slk-clay)] hover:text-[var(--slk-clay)]"
        >
          {t.badge}
        </a>
      </div>
      <span aria-hidden="true" className="font-slk-serif mt-5 block h-8 text-6xl leading-none text-[var(--slk-clay)]/70">
        “
      </span>
      <blockquote
        className={`font-slk-serif mt-2 text-xl font-light leading-snug text-[var(--slk-ink)]/90 ${
          long && !open ? "line-clamp-6" : ""
        }`}
      >
        {review.text}
      </blockquote>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-3 self-start py-1 text-xs uppercase tracking-[0.18em] text-[var(--slk-clay)] underline-offset-4 hover:underline"
        >
          {open ? t.readLess : t.readMore}
        </button>
      )}
      <figcaption className="mt-auto flex items-center gap-3 pt-7">
        {review.avatar ? (
          <Image
            src={review.avatar}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-[var(--slk-paper)]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="font-slk-serif flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--slk-sand)] text-lg text-[var(--slk-clay-deep)]"
          >
            {review.author.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <span className="text-sm text-[var(--slk-ink)]">{review.author}</span>
      </figcaption>
    </figure>
  );
}

function ArrowButton({ dir, label, onClick }: { dir: "prev" | "next"; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--slk-ink)]/20 text-[var(--slk-ink)] transition hover:border-[var(--slk-clay)] hover:bg-[var(--slk-clay)] hover:text-[var(--slk-paper)]"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className={dir === "prev" ? "rotate-180" : ""}>
        <path d="M3 9h12m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/**
 * Swipeable review carousel. Native scroll-snap does the moving (so touch,
 * trackpad and keyboard scrolling all just work); the buttons, dots and
 * autoplay only ever call scrollTo. Autoplay pauses on hover, focus, touch,
 * when off-screen, when the tab is hidden, and never runs under reduced motion.
 */
export function ReviewsCarousel({ locale, reviews }: { locale: Locale; reviews: Review[] }) {
  const t = copy[locale].reviews;
  const trackRef = useRef<HTMLUListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-20% 0px -20% 0px" });
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = reviews.length;
  // Scroll stops the layout can actually reach: with 3 cards visible, 5
  // reviews give 3 stops, not 5. Starts at one per review (the phone layout)
  // and is re-measured whenever the track resizes.
  const [stops, setStops] = useState(total);

  const slideStep = useCallback(() => {
    const track = trackRef.current;
    const first = track?.children[0] as HTMLElement | undefined;
    if (!track || !first) return 0;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return first.offsetWidth + gap;
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const ro = new ResizeObserver(() => {
      const step = slideStep();
      if (!step) return;
      const perView = Math.max(1, Math.round((track.clientWidth + 1) / step));
      const next = Math.max(1, total - perView + 1);
      setStops(next);
      setActive((a) => Math.min(a, next - 1));
    });
    ro.observe(track);
    return () => ro.disconnect();
  }, [slideStep, total]);

  const goTo = useCallback(
    (i: number) => {
      const track = trackRef.current;
      if (!track) return;
      const maxScroll = track.scrollWidth - track.clientWidth;
      const target = Math.min(((i + stops) % stops) * slideStep(), maxScroll);
      track.scrollTo({ left: target, behavior: reduce ? "auto" : "smooth" });
    },
    [reduce, slideStep, stops],
  );

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const step = slideStep();
    if (!step) return;
    // The last stop sits at max scroll, which may be short of a whole step.
    const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
    setActive(atEnd ? stops - 1 : Math.min(Math.round(track.scrollLeft / step), stops - 1));
  };

  const running = !reduce && !paused && inView && stops > 1;
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => goTo(active + 1), AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [running, active, goTo]);

  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={t.title}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <ul
        ref={trackRef}
        onScroll={onScroll}
        className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:scroll-px-8 sm:gap-6 sm:px-8"
      >
        {reviews.map((r, i) => (
          <li
            key={r.author}
            role="group"
            aria-roledescription="slide"
            aria-label={fill(t.slideLabel, { n: i + 1, total })}
            className="w-[86%] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
          >
            <ReviewCard review={r} locale={locale} />
          </li>
        ))}
      </ul>

      {stops > 1 && (
        <div className="mt-8 flex items-center justify-between gap-6">
          {/* Dots double as the autoplay timer: the active one fills while it waits. */}
          <div className="flex flex-wrap items-center gap-2">
            {Array.from({ length: stops }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={fill(t.slideLabel, { n: i + 1, total: stops })}
                aria-current={i === active}
                className="flex h-11 items-center"
              >
                <span
                  className={`relative block h-1.5 overflow-hidden rounded-full transition-all duration-500 ${
                    i === active ? "w-10 bg-[var(--slk-clay)]/25" : "w-1.5 bg-[var(--slk-ink)]/20"
                  }`}
                >
                  {i === active && (
                    <span
                      key={`${active}-${running}`}
                      // Running: fills over the autoplay delay. Paused: shown solid.
                      className={`absolute inset-y-0 left-0 bg-[var(--slk-clay)] ${running ? "slk-review-timer" : "w-full"}`}
                      style={running ? { animationDuration: `${AUTOPLAY_MS}ms` } : undefined}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
          <div className="hidden gap-3 sm:flex">
            <ArrowButton dir="prev" label={t.prev} onClick={() => goTo(active - 1)} />
            <ArrowButton dir="next" label={t.next} onClick={() => goTo(active + 1)} />
          </div>
        </div>
      )}
    </div>
  );
}
