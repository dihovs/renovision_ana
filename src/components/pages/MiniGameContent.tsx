"use client";

import Image from "next/image";
import Link from "@/components/ui/LocaleLink";
import { track } from "@vercel/analytics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { tapFeedback } from "@/lib/haptics";
import { SITE_PHONE_TEL } from "@/lib/constants";

type HazardType = "pipe" | "crack" | "overflow" | "window" | "valve" | "puddle" | "stain";

const HAZARD_TYPES: HazardType[] = ["pipe", "crack", "overflow", "window", "valve", "puddle", "stain"];

type Hazard = {
  id: number;
  type: HazardType;
  xPct: number;
  yPct: number;
  bornAt: number;
};

type GameStatus = "idle" | "playing" | "won" | "lost";

// Survive this long with the water bar below 100 to win.
const GAME_DURATION_MS = 50_000;
// Water rises on its own even with nothing on screen — a still room still
// slowly floods — plus a per-active-hazard rate so ignoring leaks is what
// actually kills a run.
const BASE_RISE_PER_MS = 100 / 65_000;
const HAZARD_RISE_PER_MS = 100 / 9_000;
// Spawn cadence tightens as the round goes on and again across replays, the
// arcade "score chase" the brief asked for. Floored so it never becomes
// unplayable.
const SPAWN_INTERVAL_START_MS = 1700;
const SPAWN_INTERVAL_FLOOR_MS = 550;
const SPAWN_RAMP_PER_MS = 0.012;
const SPAWN_RAMP_PER_REPLAY_MS = 90;
// A hazard nobody seals in time keeps costing water but is capped so the
// board doesn't silently fill with icons forever.
const MAX_ACTIVE_HAZARDS = 6;

let hazardSeq = 0;

function randomPosition() {
  // Keep hazards inside the visible room, off the window/pipe furniture.
  return {
    xPct: 8 + Math.random() * 84,
    yPct: 18 + Math.random() * 62,
  };
}

function HazardIcon({ type }: { type: HazardType }) {
  // Flat, single-color-plus-accent icons matching the site's existing SVG
  // illustration technique — drawn inline rather than as separate public
  // files since there are only a handful and they're purely decorative UI,
  // not content assets reused elsewhere.
  switch (type) {
    case "pipe":
      return (
        <svg viewBox="0 0 48 48" fill="none">
          <rect x="6" y="18" width="36" height="10" rx="3" fill="#8a7a66" />
          <path d="M24 30 v6" stroke="#2b5c9e" strokeWidth="4" strokeLinecap="round" />
          <circle cx="24" cy="40" r="4" fill="#2b5c9e" />
        </svg>
      );
    case "crack":
      return (
        <svg viewBox="0 0 48 48" fill="none">
          <rect x="6" y="6" width="36" height="36" rx="4" fill="#e3ecf7" stroke="#b7c7de" strokeWidth="2" />
          <path d="M16 8 L24 22 L18 26 L30 40" stroke="#b45309" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "overflow":
      return (
        <svg viewBox="0 0 48 48" fill="none">
          <rect x="8" y="14" width="32" height="14" rx="4" fill="#dce8f9" stroke="#2b5c9e" strokeWidth="2" />
          <path d="M10 28 q14 12 28 0" stroke="#2b5c9e" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M24 30 v10" stroke="#2b5c9e" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "window":
      return (
        <svg viewBox="0 0 48 48" fill="none">
          <rect x="8" y="6" width="32" height="28" fill="#ffffff" stroke="#2b5c9e" strokeWidth="3" />
          <line x1="24" y1="6" x2="24" y2="34" stroke="#2b5c9e" strokeWidth="2" />
          <path d="M20 38 q4 4 0 8 M28 38 q4 4 0 8" stroke="#2b5c9e" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "valve":
      return (
        <svg viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="20" r="9" fill="none" stroke="#6f6151" strokeWidth="4" />
          <line x1="24" y1="8" x2="24" y2="4" stroke="#6f6151" strokeWidth="4" strokeLinecap="round" />
          <line x1="24" y1="36" x2="24" y2="46" stroke="#6f6151" strokeWidth="4" strokeLinecap="round" />
          <path d="M14 40 q10 8 20 0" stroke="#b45309" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "puddle":
      return (
        <svg viewBox="0 0 48 48" fill="none">
          <ellipse cx="24" cy="34" rx="18" ry="7" fill="#2b5c9e" opacity="0.75" />
          <path d="M24 8 q10 14 10 20 a10 10 0 1 1 -20 0 q0 -6 10 -20" fill="#2b5c9e" />
        </svg>
      );
    case "stain":
    default:
      return (
        <svg viewBox="0 0 48 48" fill="none">
          <rect x="6" y="6" width="36" height="36" rx="4" fill="#eaf1fb" stroke="#c7d5e8" strokeWidth="2" />
          <ellipse cx="24" cy="24" rx="12" ry="9" fill="#8a7a66" opacity="0.55" />
          <ellipse cx="24" cy="24" rx="6" ry="4.5" fill="#6f6151" opacity="0.6" />
        </svg>
      );
  }
}

export default function MiniGameContent() {
  const { t } = useLanguage();

  const [status, setStatus] = useState<GameStatus>("idle");
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [waterDisplay, setWaterDisplay] = useState(0);
  const [timeLeftDisplay, setTimeLeftDisplay] = useState(GAME_DURATION_MS);
  const [score, setScore] = useState(0);
  const [sealedCount, setSealedCount] = useState(0);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const waterRef = useRef(0);
  const startedAtRef = useRef(0);
  const lastTickRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const scoreRef = useRef(0);
  const sealedRef = useRef(0);
  const hazardsRef = useRef<Hazard[]>([]);
  const rafRef = useRef(0);
  const statusRef = useRef<GameStatus>("idle");
  const replayCountRef = useRef(0);
  // Holds the current tick function so the rAF loop can recurse without
  // referencing the `tick` const from inside its own initializer.
  const tickRef = useRef<(now: number) => void>(() => {});

  // Lazy initializer, not an effect: reading localStorage inside an effect
  // means an extra render just to apply the stored value, which the lint
  // rule (and React's own guidance) flags. This component never renders on
  // the server with a real best score anyway, so there is no hydration
  // mismatch to worry about.
  const [best, setBest] = useState(() => {
    if (typeof window === "undefined") return 0;
    try {
      return Number(window.localStorage.getItem("miniGameBestScore")) || 0;
    } catch {
      return 0;
    }
  });

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const endGame = useCallback(
    (won: boolean) => {
      statusRef.current = won ? "won" : "lost";
      setStatus(won ? "won" : "lost");
      cancelAnimationFrame(rafRef.current);
      setHazards([]);
      hazardsRef.current = [];
      const finalScore = scoreRef.current;
      setBest((prevBest) => {
        const nextBest = Math.max(prevBest, finalScore);
        try {
          window.localStorage.setItem("miniGameBestScore", String(nextBest));
        } catch {
          // ignore
        }
        return nextBest;
      });
      track("game_complete", { game: "60_seconds_to_dry", result: won ? "win" : "lose", score: finalScore });
    },
    [],
  );

  const tick = useCallback(
    (now: number) => {
      if (statusRef.current !== "playing") return;
      // Clamped: if the tab was backgrounded (rAF pauses while hidden), the
      // next frame's delta can be seconds long, and an unclamped rise would
      // instant-flood the room the moment the player comes back rather than
      // just picking the countdown up where it left off.
      const dt = lastTickRef.current ? Math.min(200, now - lastTickRef.current) : 0;
      lastTickRef.current = now;

      const activeHazards = hazardsRef.current.length;
      const rise = dt * (BASE_RISE_PER_MS + activeHazards * HAZARD_RISE_PER_MS);
      waterRef.current = Math.min(100, waterRef.current + rise);
      setWaterDisplay(waterRef.current);

      const elapsed = now - startedAtRef.current;
      const remaining = Math.max(0, GAME_DURATION_MS - elapsed);
      setTimeLeftDisplay(remaining);

      if (waterRef.current >= 100) {
        endGame(false);
        return;
      }
      if (remaining <= 0) {
        endGame(true);
        return;
      }

      const spawnInterval = Math.max(
        SPAWN_INTERVAL_FLOOR_MS,
        SPAWN_INTERVAL_START_MS - elapsed * SPAWN_RAMP_PER_MS - replayCountRef.current * SPAWN_RAMP_PER_REPLAY_MS,
      );
      if (now - lastSpawnRef.current >= spawnInterval && hazardsRef.current.length < MAX_ACTIVE_HAZARDS) {
        lastSpawnRef.current = now;
        const { xPct, yPct } = randomPosition();
        const hazard: Hazard = {
          id: ++hazardSeq,
          type: HAZARD_TYPES[Math.floor(Math.random() * HAZARD_TYPES.length)],
          xPct,
          yPct,
          bornAt: now,
        };
        hazardsRef.current = [...hazardsRef.current, hazard];
        setHazards(hazardsRef.current);
      }

      rafRef.current = requestAnimationFrame((next) => tickRef.current(next));
    },
    [endGame],
  );

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const startGame = useCallback(() => {
    waterRef.current = 0;
    scoreRef.current = 0;
    sealedRef.current = 0;
    hazardsRef.current = [];
    lastTickRef.current = 0;
    lastSpawnRef.current = performance.now();
    startedAtRef.current = performance.now();
    statusRef.current = "playing";

    setWaterDisplay(0);
    setScore(0);
    setSealedCount(0);
    setHazards([]);
    setTimeLeftDisplay(GAME_DURATION_MS);
    setShareMessage(null);
    setStatus("playing");

    track("game_start", { game: "60_seconds_to_dry", replay: replayCountRef.current });
    replayCountRef.current += 1;

    rafRef.current = requestAnimationFrame((next) => tickRef.current(next));
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const sealHazard = (id: number) => {
    if (statusRef.current !== "playing") return;
    if (!hazardsRef.current.some((h) => h.id === id)) return;
    hazardsRef.current = hazardsRef.current.filter((h) => h.id !== id);
    setHazards(hazardsRef.current);
    sealedRef.current += 1;
    setSealedCount(sealedRef.current);
    scoreRef.current += 10;
    setScore(scoreRef.current);
    tapFeedback("light");
  };

  const handleCtaClick = (which: "estimate" | "call" | "share") => {
    track("cta_click", { game: "60_seconds_to_dry", cta: which });
  };

  const handleShare = async () => {
    const text = t.miniGame.shareText.replace("{score}", String(score));
    handleCtaClick("share");
    if (navigator.share) {
      try {
        await navigator.share({ text, title: t.miniGame.title });
        return;
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareMessage(t.miniGame.shareCopied);
    } catch {
      // clipboard unavailable — silently no-op, nothing else we can do.
    }
  };

  const waterPct = Math.min(100, waterDisplay);
  const secondsLeft = Math.ceil(timeLeftDisplay / 1000);

  return (
    <section className="relative overflow-hidden bg-charcoal-dark py-14 sm:py-16">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="font-heading text-3xl font-bold text-white sm:text-4xl">{t.miniGame.title}</h1>
          <p className="mt-3 text-white/70">{t.miniGame.subtitle}</p>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white p-3 shadow-2xl sm:p-5">
          {status === "playing" && (
            <div className="mb-3 grid grid-cols-3 gap-2 text-center text-sm font-semibold text-charcoal">
              <div>
                <div className="text-xs uppercase tracking-wide text-charcoal/50">{t.miniGame.timeLabel}</div>
                <div>{secondsLeft}s</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-charcoal/50">{t.miniGame.scoreLabel}</div>
                <div>{score}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-charcoal/50">{t.miniGame.bestLabel}</div>
                <div>{best}</div>
              </div>
            </div>
          )}

          {status === "playing" && (
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                <span>{t.miniGame.waterLabel}</span>
                <span>{Math.round(waterPct)}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-brand-blue-light">
                <div
                  className={`h-full rounded-full bg-brand-blue ${waterPct > 80 ? "bg-red-600" : ""}`}
                  style={{ width: `${waterPct}%`, transition: prefersReducedMotion ? "none" : "width 120ms linear" }}
                />
              </div>
            </div>
          )}

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-black/5">
            <Image
              src="/images/mini-game-room.svg"
              alt=""
              aria-hidden
              fill
              sizes="(min-width: 1024px) 700px, 92vw"
              className="pointer-events-none object-cover"
              priority
            />

            {/* Rising water overlay, clipped to the floor area of the room illustration. */}
            {status === "playing" && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 bg-brand-blue/55"
                style={{
                  height: `${waterPct * 0.72}%`,
                  transition: prefersReducedMotion ? "none" : "height 120ms linear",
                }}
              />
            )}

            {status === "playing" &&
              hazards.map((hazard) => (
                <button
                  key={hazard.id}
                  type="button"
                  onClick={() => sealHazard(hazard.id)}
                  aria-label={t.miniGame.hazardTypes[hazard.type]}
                  className="absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-lg ring-2 ring-amber-500 active:scale-90"
                  style={{
                    left: `${hazard.xPct}%`,
                    top: `${hazard.yPct}%`,
                    animation: prefersReducedMotion ? undefined : "mini-game-pop 180ms ease-out",
                  }}
                >
                  <span className="h-8 w-8">
                    <HazardIcon type={hazard.type} />
                  </span>
                </button>
              ))}

            {status !== "playing" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-charcoal-dark/70 p-6 text-center backdrop-blur-sm">
                {status === "idle" && (
                  <>
                    <p className="max-w-sm text-sm text-white/90">{t.miniGame.instructions}</p>
                    <button
                      type="button"
                      onClick={startGame}
                      className="rounded-full bg-brand-green px-8 py-3 font-heading font-bold text-white shadow-lg transition hover:bg-brand-green-dark"
                    >
                      {t.miniGame.startButton}
                    </button>
                  </>
                )}

                {(status === "won" || status === "lost") && (
                  <>
                    <h2 className="font-heading text-2xl font-bold text-white">
                      {status === "won" ? t.miniGame.winTitle : t.miniGame.loseTitle}
                    </h2>
                    <p className="max-w-sm text-sm text-white/80">
                      {status === "won" ? t.miniGame.winSubtitle : t.miniGame.loseSubtitle}
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {t.miniGame.scoreResult
                        .replace("{count}", String(sealedCount))
                        .replace("{score}", String(score))}
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={startGame}
                        className="rounded-full bg-brand-green px-6 py-2.5 font-heading font-bold text-white shadow-lg transition hover:bg-brand-green-dark"
                      >
                        {t.miniGame.restartButton}
                      </button>
                      <button
                        type="button"
                        onClick={handleShare}
                        className="rounded-full border border-white/40 bg-white/10 px-6 py-2.5 font-heading font-bold text-white transition hover:bg-white/20"
                      >
                        {t.miniGame.shareButton}
                      </button>
                    </div>
                    {shareMessage && <p className="text-xs text-white/70">{shareMessage}</p>}

                    <div className="mt-2 flex flex-wrap items-center justify-center gap-3 border-t border-white/15 pt-4">
                      <Link
                        href="/estimation"
                        onClick={() => handleCtaClick("estimate")}
                        className="rounded-full bg-brand-blue px-6 py-2.5 font-heading font-bold text-white shadow-lg transition hover:bg-brand-blue-dark"
                      >
                        {t.miniGame.ctaEstimate}
                      </Link>
                      <a
                        href={`tel:${SITE_PHONE_TEL}`}
                        onClick={() => handleCtaClick("call")}
                        className="rounded-full border border-white/40 px-6 py-2.5 font-heading font-bold text-white transition hover:bg-white/10"
                      >
                        {t.miniGame.ctaCall}
                      </a>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes mini-game-pop {
          from {
            transform: translate(-50%, -50%) scale(0.4);
            opacity: 0;
          }
          to {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </section>
  );
}
