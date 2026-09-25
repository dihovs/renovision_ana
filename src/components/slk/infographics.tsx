"use client";

import { useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { copy, type Locale } from "@/content/slk/copy";
import { EASE } from "./motion";

/** Starts once, when the element is well into the viewport; immediately shown under reduced motion. */
function useShown<T extends Element>() {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduce = useReducedMotion();
  return { ref, shown: inView || !!reduce, reduce: !!reduce };
}

function dayRange(min: number, max: number, unit: string, approx?: boolean) {
  return min === max ? `${approx ? "≈ " : ""}${max} ${unit}` : `${min}–${max} ${unit}`;
}

/**
 * Typical recovery per treatment, in days. One series, one hue: the solid
 * segment is the typical minimum, the lighter tail the "depends on the
 * person" range (so identity never rides on color alone, the legend and the
 * direct value label both spell it out). Bars grow in on scroll; hover or
 * focus a bar for its tooltip; screen readers get the table.
 */
export function RecoveryChart({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const c = t.expect.chart;
  const unit = t.ui.dayUnit;
  const AXIS = 8;
  const ticks = Array.from({ length: AXIS + 1 }, (_, d) => d);
  const { ref, shown } = useShown<HTMLElement>();
  const [active, setActive] = useState<number | null>(null);

  return (
    <figure ref={ref} className="rounded-2xl border border-[var(--slk-line)] bg-[var(--slk-bone)] p-6 sm:p-8">
      <figcaption className="font-slk-serif text-2xl leading-tight">{c.title}</figcaption>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--slk-ink)]/70" aria-hidden="true">
        <span className="flex items-center gap-2">
          <span className="h-2 w-5 rounded-full bg-[var(--slk-clay)]" />
          {c.baseNote}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-5 rounded-full bg-[var(--slk-clay)]/35" />
          {c.rangeNote}
        </span>
      </div>

      <div className="mt-8 space-y-7" aria-hidden="true">
        {c.rows.map((r, i) => {
          const value = dayRange(r.min, r.max, unit, r.approx);
          return (
            <div key={r.label}>
              <div className="mb-2 flex items-baseline justify-between gap-4 text-sm">
                <span>{r.label}</span>
                <span className="tabular-nums text-[var(--slk-ink)]/70">{value}</span>
              </div>
              <div
                className="relative h-2.5 rounded-full bg-[var(--slk-sand)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--slk-clay)]/40"
                tabIndex={0}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <motion.div
                  className="absolute inset-y-0 left-0 flex origin-left gap-[2px]"
                  style={{ width: `${(r.max / AXIS) * 100}%` }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: shown ? 1 : 0 }}
                  transition={{ duration: 1.4, ease: EASE, delay: 0.2 + i * 0.25 }}
                >
                  <span className="h-full rounded-full bg-[var(--slk-clay)]" style={{ flex: r.min }} />
                  {r.max > r.min && (
                    <span className="h-full rounded-full bg-[var(--slk-clay)]/35" style={{ flex: r.max - r.min }} />
                  )}
                </motion.div>
                {active === i && (
                  <span
                    className="pointer-events-none absolute bottom-full mb-3 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--slk-ink)] px-3 py-2 text-xs text-[var(--slk-paper)]"
                    style={{ left: `${(r.max / AXIS) * 100}%` }}
                  >
                    {r.label} · {value}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <div className="relative h-4">
          {ticks.map((d) => (
            <span
              key={d}
              className="absolute top-0 -translate-x-1/2 text-[10px] tabular-nums text-[var(--slk-ink)]/60"
              style={{ left: `${(d / AXIS) * 100}%` }}
            >
              {t.ui.dayShort}
              {d}
            </span>
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>{c.title}</caption>
        <tbody>
          {c.rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{dayRange(r.min, r.max, unit, r.approx)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-6 text-xs leading-relaxed text-[var(--slk-ink)]/65">{c.caption}</p>
    </figure>
  );
}

/**
 * The Beauty Pot's four technologies as four arcs of one ring, drawn in
 * reading order around "1 séance". Labels sit in the four corners, where a
 * square frame has the most room outside the circle.
 */
export function ModalitiesRing({ modalities, center }: { modalities: string[]; center: string }) {
  const { ref, shown } = useShown<HTMLDivElement>();
  const C = 150;
  const R = 96;
  const GAP = 8;
  const point = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${C + R * Math.cos(a)} ${C + R * Math.sin(a)}`;
  };
  const arc = (mid: number) => `M ${point(mid - 45 + GAP / 2)} A ${R} ${R} 0 0 1 ${point(mid + 45 - GAP / 2)}`;
  // Clockwise from top-left, so 01→04 reads like the page.
  const corners = ["left-0 top-0", "right-0 top-0 text-right", "right-0 bottom-0 text-right", "left-0 bottom-0"];

  return (
    <div ref={ref} className="relative mx-auto aspect-square w-full max-w-[26rem]">
      <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--slk-line-dark)" strokeWidth={1} />
        <circle cx={C} cy={C} r={R - 26} fill="none" stroke="var(--slk-line-dark)" strokeWidth={1} />
        {modalities.map((m, i) => (
          <motion.path
            key={m}
            d={arc(-135 + i * 90)}
            fill="none"
            stroke="var(--slk-clay-soft)"
            strokeWidth={6}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: shown ? 1 : 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.2 + i * 0.35 }}
          />
        ))}
      </svg>

      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center text-center"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={shown ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.9, ease: EASE, delay: 1.6 }}
      >
        <p className="font-slk-serif text-4xl font-light">{center}</p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[var(--slk-paper)]/60">
          {modalities.length} technologies
        </p>
      </motion.div>

      <ol>
        {modalities.map((m, i) => (
          <motion.li
            key={m}
            className={`absolute ${corners[i]}`}
            initial={{ opacity: 0, y: 8 }}
            animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.55 + i * 0.35 }}
          >
            <span className="text-xs text-[var(--slk-clay-soft)]">{String(i + 1).padStart(2, "0")}</span>
            <p className="font-slk-serif text-lg font-light leading-tight sm:text-xl">{m}</p>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

/** Four booking steps joined by a line that draws itself — across on desktop, down on mobile. */
export function JourneySteps({ locale }: { locale: Locale }) {
  const steps = copy[locale].journey.steps;
  const { ref, shown } = useShown<HTMLOListElement>();

  return (
    <ol ref={ref} className="relative grid gap-12 lg:grid-cols-4 lg:gap-10">
      <span aria-hidden="true" className="absolute left-0 right-0 top-5 hidden h-px bg-[var(--slk-line)] lg:block">
        <motion.span
          className="block h-full origin-left bg-[var(--slk-clay)]"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: shown ? 1 : 0 }}
          transition={{ duration: 1.8, ease: EASE, delay: 0.2 }}
        />
      </span>
      <span aria-hidden="true" className="absolute bottom-0 left-5 top-0 w-px bg-[var(--slk-line)] lg:hidden">
        <motion.span
          className="block h-full w-full origin-top bg-[var(--slk-clay)]"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: shown ? 1 : 0 }}
          transition={{ duration: 1.8, ease: EASE, delay: 0.2 }}
        />
      </span>

      {steps.map((s, i) => (
        <li key={s.title} className="relative pl-16 lg:pl-0">
          <motion.span
            className="font-slk-serif absolute left-0 top-0 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--slk-clay)] bg-[var(--slk-paper)] text-lg text-[var(--slk-clay)] lg:relative"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={shown ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.3 + i * 0.35 }}
          >
            {String(i + 1).padStart(2, "0")}
          </motion.span>
          <motion.div
            className="lg:mt-8"
            initial={{ opacity: 0, y: 12 }}
            animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.45 + i * 0.35 }}
          >
            <p className="font-slk-serif text-2xl font-light leading-tight">{s.title}</p>
            <p className="mt-3 text-sm font-light leading-relaxed text-[var(--slk-ink)]/75">{s.text}</p>
          </motion.div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Day-by-day recovery for one treatment: day 0 is the session, then the
 * sourced recovery window (solid to its minimum, lighter to its maximum).
 */
export function DayTimeline({
  locale,
  recovery,
}: {
  locale: Locale;
  recovery: { min: number; max: number; label: string };
}) {
  const ui = copy[locale].ui;
  const axisMax = recovery.max + 2;
  const days = Array.from({ length: axisMax + 1 }, (_, d) => d);
  const { ref, shown } = useShown<HTMLElement>();
  const value = dayRange(recovery.min, recovery.max, ui.dayUnit, recovery.min === recovery.max);

  return (
    <figure ref={ref} className="mt-12 rounded-2xl border border-[var(--slk-line)] bg-[var(--slk-paper)] p-6 sm:p-8">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--slk-ink)]/65">{ui.recoveryTitle}</span>
        <span className="font-slk-serif text-2xl text-[var(--slk-clay)]">
          {recovery.label} · {value}
        </span>
      </figcaption>

      <div className="relative mx-2 mt-10 h-14" aria-hidden="true">
        <span className="absolute left-0 right-0 top-[7px] h-px bg-[var(--slk-line)]" />
        <motion.span
          className="absolute left-0 top-[4px] flex h-[7px] origin-left gap-[2px]"
          style={{ width: `${(recovery.max / axisMax) * 100}%` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: shown ? 1 : 0 }}
          transition={{ duration: 1.6, ease: EASE, delay: 0.3 }}
        >
          <span className="h-full rounded-full bg-[var(--slk-clay)]" style={{ flex: recovery.min }} />
          {recovery.max > recovery.min && (
            <span className="h-full rounded-full bg-[var(--slk-clay)]/35" style={{ flex: recovery.max - recovery.min }} />
          )}
        </motion.span>

        {days.map((d) => {
          const inWindow = d > 0 && d <= recovery.max;
          return (
            <motion.span
              key={d}
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${(d / axisMax) * 100}%` }}
              initial={{ opacity: 0, y: 6 }}
              animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.2 + d * 0.09 }}
            >
              <span
                className={`h-[15px] w-[15px] rounded-full border-2 ${
                  d === 0
                    ? "border-[var(--slk-clay)] bg-[var(--slk-clay)]"
                    : inWindow
                      ? "border-[var(--slk-clay)] bg-[var(--slk-paper)]"
                      : "border-[var(--slk-ink)]/20 bg-[var(--slk-paper)]"
                }`}
              />
              <span className="mt-2 whitespace-nowrap text-[10px] tabular-nums text-[var(--slk-ink)]/60">
                {d === 0 ? ui.sessionLabel : `${ui.dayShort}${d}`}
              </span>
            </motion.span>
          );
        })}
      </div>
    </figure>
  );
}
