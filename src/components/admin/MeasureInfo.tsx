"use client";

import type { MeasureDefinition } from "@/lib/crm/measureDefinitions";

/**
 * The definition behind a figure, as a small centred alert.
 *
 * One button, no other controls: a definition is read-only reference, never
 * a settings entry point. This is the web half of the native `DefinedFigure`
 * (Theme.swift) — same definitions, same one-tap-away contract, because a
 * figure that can state its meaning on the phone but not in the office is
 * only half defensible.
 */
export default function MeasureInfo({
  meaning,
  onClose,
}: {
  meaning: MeasureDefinition;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-pointer bg-black/40"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={meaning.title}
        className="relative w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl"
      >
        <h3 className="text-center font-heading text-base font-bold text-charcoal">
          {meaning.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-charcoal/70">{meaning.definition}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 h-11 w-full cursor-pointer rounded-xl bg-brand-blue text-sm font-bold text-white active:bg-brand-blue/90"
        >
          OK
        </button>
      </div>
    </div>
  );
}
