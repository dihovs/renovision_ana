"use client";

import { useState } from "react";
import { tapFeedback } from "@/lib/haptics";
import {
  makeRectangularRoom,
  parseFeetInches,
  validateDimension,
} from "@/lib/manualRoom";
import {
  squareMetersToSquareFeet,
  totalFloorAreaSquareMeters,
  type RoomScanResult,
} from "@/lib/roomScan";

/**
 * A room from a tape measure.
 *
 * Feet and inches, because that is what the price book is written in and
 * what is printed on the tape in the operator's hand. Metres exist only
 * below this line.
 *
 * The live square-foot readout is the whole point of the layout: a slipped
 * decimal shows up as an absurd area immediately, which is the cheapest
 * error check available and it costs the operator no extra taps.
 */
export default function ManualRoomEntry({
  defaultHeight = "8",
  onCancel,
  onDone,
}: {
  defaultHeight?: string;
  onCancel: () => void;
  /** Hands back a RoomScanResult, identical in shape to a scanned room, so
      everything downstream treats the two the same. */
  onDone: (result: RoomScanResult) => void;
}) {
  const [width, setWidth] = useState("");
  const [length, setLength] = useState("");
  const [height, setHeight] = useState(defaultHeight);
  const [touched, setTouched] = useState(false);

  const w = parseFeetInches(width);
  const l = parseFeetInches(length);
  const h = parseFeetInches(height);

  const errors = {
    width: validateDimension(w),
    length: validateDimension(l),
    height: validateDimension(h),
  };
  const ready = !errors.width && !errors.length && !errors.height;

  const preview =
    w !== null && l !== null && w > 0 && l > 0
      ? Math.round(squareMetersToSquareFeet(w * l))
      : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 cursor-pointer bg-black/45"
      />

      <div className="relative max-h-[92vh] overflow-y-auto rounded-t-3xl bg-[#f7f7f8] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
        <div className="mx-auto h-1 w-9 rounded-full bg-black/15" />
        <h2 className="mt-3 text-center font-heading text-base font-bold text-charcoal">
          Enter the dimensions
        </h2>
        <p className="mx-auto mt-1 max-w-xs text-center text-xs leading-snug text-charcoal/50">
          For a square or rectangular room. Feet and inches — type{" "}
          <span className="font-semibold text-charcoal/70">12&apos; 6</span> or{" "}
          <span className="font-semibold text-charcoal/70">12.5</span>.
        </p>

        <div className="mt-4 space-y-3">
          <Field
            id="room-width"
            label="Width"
            value={width}
            onChange={setWidth}
            error={touched ? errors.width : null}
            placeholder="12' 6"
          />
          <Field
            id="room-length"
            label="Length"
            value={length}
            onChange={setLength}
            error={touched ? errors.length : null}
            placeholder="10'"
          />
          <Field
            id="room-height"
            label="Ceiling height"
            value={height}
            onChange={setHeight}
            error={touched ? errors.height : null}
            placeholder="8'"
          />
        </div>

        <div className="mt-4 rounded-2xl bg-charcoal-dark px-4 py-3 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wide text-white/45">
            Floor area
          </span>
          <p className="font-heading text-2xl font-bold tabular-nums text-white">
            {preview === null ? "—" : preview.toLocaleString("en-CA")}
            <span className="ml-1 text-xs font-semibold text-white/50">sq ft</span>
          </p>
        </div>

        <p className="mt-2 text-center text-[11px] leading-snug text-charcoal/45">
          No doors or windows are assumed. Wall area is priced net of
          openings, so nothing is deducted that you did not measure.
        </p>

        <button
          type="button"
          onClick={() => {
            setTouched(true);
            if (!ready || w === null || l === null || h === null) {
              tapFeedback();
              return;
            }
            tapFeedback("medium");
            onDone(
              makeRectangularRoom({ widthMeters: w, lengthMeters: l, heightMeters: h }),
            );
          }}
          className="mt-4 w-full cursor-pointer rounded-2xl bg-brand-blue py-3.5 text-base font-bold text-white shadow-lg shadow-brand-blue/25 active:scale-[0.98] disabled:opacity-40"
        >
          Add this room
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 h-12 w-full cursor-pointer rounded-2xl bg-white text-sm font-bold text-charcoal/60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  placeholder: string;
}) {
  const preview = parseFeetInches(value);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wide text-charcoal/45">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        // Not type="number": feet-and-inches has quotes and spaces in it, and
        // a number input silently refuses them.
        inputMode="decimal"
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        className={`mt-1.5 w-full rounded-xl border bg-white px-3 py-3 text-charcoal outline-none transition-colors placeholder:text-charcoal/25 focus:ring-2 ${
          error
            ? "border-red-300 focus:border-red-400 focus:ring-red-200/40"
            : "border-black/10 focus:border-brand-blue focus:ring-brand-blue/15"
        }`}
      />
      {error ? (
        <p role="alert" className="mt-1 text-[11px] font-medium text-red-600">
          {error}
        </p>
      ) : (
        preview !== null && (
          <p className="mt-1 text-[11px] tabular-nums text-charcoal/35">
            {preview.toFixed(2)} m
          </p>
        )
      )}
    </div>
  );
}
