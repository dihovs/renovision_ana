"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";
import type { Locale } from "@/content/slk/copy";

/** The one easing curve the whole site moves on — a soft, decelerating settle. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Fades and lifts its children into place the first time they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Counts a figure up from zero when it scrolls into view. Server-renders the
 * final value, so crawlers and no-JS readers get the real number.
 */
export function CountUp({
  to,
  kind,
  locale,
  dayUnit,
  className,
}: {
  to: number;
  kind: "minutes" | "days";
  locale: Locale;
  dayUnit: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(to);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, to, { duration: 1.8, ease: EASE, onUpdate: setValue });
    return () => controls.stop();
  }, [inView, reduce, to]);

  let text: string;
  if (kind === "days") {
    text = `${Math.round(value)} ${dayUnit}`;
  } else if (locale === "fr") {
    const total = Math.round(value);
    text = `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, "0")}`;
  } else {
    text = `${(value / 60).toFixed(1)} h`;
  }

  return (
    <span ref={ref} className={className}>
      ≈&nbsp;<span className="tabular-nums">{text}</span>
    </span>
  );
}

/** Hero headline: words rise out of their own line box, one after another; the accent phrase stays italic clay. */
export function HeroTitle({ title, accent }: { title: string; accent: string }) {
  const reduce = useReducedMotion();
  const i = title.indexOf(accent);
  const parts =
    i < 0
      ? [{ text: title, accent: false }]
      : [
          { text: title.slice(0, i), accent: false },
          { text: accent, accent: true },
          { text: title.slice(i + accent.length), accent: false },
        ];
  const words = parts.flatMap((p) =>
    p.text
      .split(" ")
      .filter(Boolean)
      .map((w) => ({ w, accent: p.accent })),
  );

  return (
    <>
      {words.map(({ w, accent: isAccent }, n) => (
        <Fragment key={n}>
          {/* The space stays outside the inline-block: trailing whitespace inside one is trimmed. */}
          {n > 0 && " "}
          <span className="inline-block overflow-hidden pb-[0.12em] align-bottom">
            <motion.span
              className={`inline-block ${isAccent ? "font-light italic text-[var(--slk-clay)]" : ""}`}
              initial={reduce ? false : { y: "110%" }}
              animate={{ y: "0%" }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.15 + n * 0.08 }}
            >
              {w}
            </motion.span>
          </span>
        </Fragment>
      ))}
    </>
  );
}

/** Curtain reveal for the hero arch: a bone-colored panel lifts away while the photo settles from a slight zoom. */
export function CurtainReveal({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <>
      <motion.div
        className="absolute inset-0"
        initial={reduce ? false : { scale: 1.18 }}
        animate={{ scale: 1 }}
        transition={{ duration: 2, ease: EASE, delay: 0.2 }}
      >
        {children}
      </motion.div>
      {!reduce && (
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 z-10 bg-[var(--slk-bone)]"
          initial={{ y: "0%" }}
          animate={{ y: "-101%" }}
          transition={{ duration: 1.4, ease: EASE, delay: 0.25 }}
        />
      )}
    </>
  );
}
