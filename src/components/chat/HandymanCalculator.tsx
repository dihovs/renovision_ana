"use client";

import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { calculateHandymanEstimate, formatCents } from "@/lib/estimator/calculate";
import { isValidPostalCode } from "./chatLogic";

export type TripFeeOutcome = {
  postalCode: string;
  cents: number;
  billableRoundTripKm: number;
  trafficMinutes: number;
  trafficMultiplier: number;
} | null;

type TripFeeStatus = "idle" | "loading" | "success" | "free" | "error" | "not_configured";

type TripFeeApiResponse =
  | {
      ok: true;
      distanceKm: number;
      billableRoundTripKm: number;
      trafficMinutes: number;
      trafficMultiplier: number;
      tripFeeCents: number;
    }
  | { ok: false; reason: string };

export default function HandymanCalculator({
  onCalculate,
}: {
  onCalculate: (hours: number, tripFee: TripFeeOutcome) => void;
}) {
  const { t } = useLanguage();
  const [hours, setHours] = useState(2);
  const [postalCode, setPostalCode] = useState("");
  const [tripFeeStatus, setTripFeeStatus] = useState<TripFeeStatus>("idle");
  const [tripFeeResult, setTripFeeResult] = useState<Extract<TripFeeApiResponse, { ok: true }> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const calc = calculateHandymanEstimate(hours);

  const step = (delta: number) => {
    setHours((h) => Math.max(0.5, Math.round((h + delta) * 10) / 10));
  };

  // Looks up the trip fee for the entered postal code and returns the outcome
  // directly (not just via state) so callers don't have to race React's state
  // update timing.
  async function runTripFeeCheck(): Promise<TripFeeOutcome> {
    if (!isValidPostalCode(postalCode)) {
      setTripFeeStatus("error");
      return null;
    }
    setTripFeeStatus("loading");
    try {
      const res = await fetch("/api/trip-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postalCode: postalCode.trim() }),
      });
      const data = (await res.json()) as TripFeeApiResponse;

      if (!data.ok) {
        setTripFeeStatus(data.reason === "not_configured" ? "not_configured" : "error");
        return null;
      }

      setTripFeeResult(data);
      setTripFeeStatus(data.tripFeeCents > 0 ? "success" : "free");
      return {
        postalCode: postalCode.trim(),
        cents: data.tripFeeCents,
        billableRoundTripKm: data.billableRoundTripKm,
        trafficMinutes: data.trafficMinutes,
        trafficMultiplier: data.trafficMultiplier,
      };
    } catch {
      setTripFeeStatus("error");
      return null;
    }
  }

  async function handleGetEstimate() {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Not checked yet this round — run it now so we always have an answer
      // (or a clear failure) before finalizing the estimate.
      if (tripFeeStatus === "idle" || tripFeeStatus === "loading") {
        onCalculate(hours, await runTripFeeCheck());
        return;
      }
      const tripFee: TripFeeOutcome = tripFeeResult
        ? {
            postalCode: postalCode.trim(),
            cents: tripFeeResult.tripFeeCents,
            billableRoundTripKm: tripFeeResult.billableRoundTripKm,
            trafficMinutes: tripFeeResult.trafficMinutes,
            trafficMultiplier: tripFeeResult.trafficMultiplier,
          }
        : null;
      onCalculate(hours, tripFee);
    } finally {
      setSubmitting(false);
    }
  }

  const canGetEstimate = isValidPostalCode(postalCode) && !submitting;

  return (
    <div className="rounded-xl border border-brand-blue/20 bg-white p-3">
      <p className="text-xs font-bold text-charcoal/70">{t.chat.handyman.postalCodeLabel}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="text"
          value={postalCode}
          onChange={(e) => {
            setPostalCode(e.target.value);
            setTripFeeStatus("idle");
            setTripFeeResult(null);
          }}
          placeholder={t.chat.handyman.postalCodePlaceholder}
          className="w-28 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-1.5 text-sm uppercase outline-none focus:border-brand-blue"
        />
        <button
          type="button"
          onClick={() => void runTripFeeCheck()}
          disabled={!isValidPostalCode(postalCode) || tripFeeStatus === "loading"}
          className="cursor-pointer rounded-lg border border-brand-blue/30 px-3 py-1.5 text-xs font-bold text-brand-blue hover:bg-brand-blue-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          {tripFeeStatus === "loading" ? t.chat.handyman.checking : t.chat.handyman.checkTripFee}
        </button>
      </div>

      {tripFeeStatus === "success" && tripFeeResult && (
        <p className="mt-1.5 text-[11px] leading-snug text-charcoal/60">
          {t.chat.handyman.tripFeeLabel}: <strong>{formatCents(tripFeeResult.tripFeeCents)}</strong> (~
          {tripFeeResult.trafficMinutes} {t.chat.handyman.minDriveSuffix})
          {tripFeeResult.trafficMultiplier > 1 ? ` — ${t.chat.handyman.tripFeeTrafficNote}` : ""}
        </p>
      )}
      {tripFeeStatus === "free" && <p className="mt-1.5 text-[11px] text-brand-green">{t.chat.handyman.tripFeeFree}</p>}
      {tripFeeStatus === "error" && <p className="mt-1.5 text-[11px] text-red-600">{t.chat.handyman.tripFeeError}</p>}
      {tripFeeStatus === "not_configured" && (
        <p className="mt-1.5 text-[11px] text-charcoal/50">{t.chat.handyman.tripFeeNotConfigured}</p>
      )}

      <div className="mt-3 border-t border-black/5 pt-3">
        <p className="text-xs font-bold text-charcoal/70">{t.chat.handyman.hoursLabel}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-0.5)}
            aria-label="-0.5"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/10 text-lg font-bold text-brand-blue hover:bg-brand-blue-light"
          >
            −
          </button>
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(Math.max(0.5, Number(e.target.value) || 0.5))}
            className="w-16 rounded-lg border border-black/10 bg-black/[0.02] px-2 py-1.5 text-center text-sm outline-none focus:border-brand-blue"
          />
          <button
            type="button"
            onClick={() => step(0.5)}
            aria-label="+0.5"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/10 text-lg font-bold text-brand-blue hover:bg-brand-blue-light"
          >
            +
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-charcoal/50">{t.chat.handyman.minimumNote}</p>
      </div>

      <div className="mt-2.5 rounded-lg bg-brand-blue-light/50 px-3 py-2.5">
        <p className="text-[11px] text-charcoal/60">{t.chat.handyman.labourLabel}</p>
        <p className="text-lg font-bold text-brand-blue">{formatCents(calc.labourCents)}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-charcoal/50">{t.chat.handyman.materialsNote}</p>
      </div>

      <button
        type="button"
        onClick={() => void handleGetEstimate()}
        disabled={!canGetEstimate}
        className="mt-3 w-full cursor-pointer rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t.chat.handyman.calculate}
      </button>
    </div>
  );
}
