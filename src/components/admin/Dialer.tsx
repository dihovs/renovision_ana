"use client";

import { useState, useTransition } from "react";
import { SITE_PHONE } from "@/lib/constants";
import { formatDialed, sanitisePasted } from "@/lib/phone";

/**
 * Call any number from the business line.
 *
 * The counterpart to BusinessCallButton, which needs a client row to hang off.
 * Plenty of the calls a contractor makes are to people who are not in the CRM
 * and should not be added to it just to be phoned once — an inspector, a
 * supplier's back office, somebody returning a missed call from a number on a
 * screen. Making him create a client record first would be the tool getting in
 * the way of the work.
 */
export default function Dialer({
  action,
  ringsAt,
}: {
  action: (phone: string) => Promise<string | null>;
  /** The phone that will ring, so he knows before pressing. */
  ringsAt: string | null;
}) {
  const [phone, setPhone] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ringing, setRinging] = useState(false);

  function place() {
    setError(null);
    setRinging(false);
    startTransition(async () => {
      try {
        const message = await action(phone);
        if (message) setError(message);
        else {
          setRinging(true);
          setPhone("");
          setTimeout(() => setRinging(false), 8000);
        }
      } catch {
        setError("Something went wrong placing the call.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="font-heading text-sm font-bold text-charcoal">Call from the business line</h2>
      <p className="mt-0.5 text-xs leading-relaxed text-charcoal/55">
        We ring {ringsAt ?? "your phone"} first, then connect you. They see {SITE_PHONE} — your
        mobile number is never shown.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (phone.trim() && !pending) place();
        }}
        className="mt-3 flex flex-wrap items-center gap-2"
      >
        <input
          type="tel"
          // Sanitised on the way in and formatted on the way out, the same as
          // the softphone keypad and the new-text form. Pasting a number
          // copied from an email — "+1 (514) 555-0188", "514.555.0188" — used
          // to arrive here verbatim and reach the call handler unnormalised,
          // because this was the one dial input that never got `lib/phone`.
          value={formatDialed(phone)}
          onChange={(event) => setPhone(sanitisePasted(event.target.value))}
          placeholder="(514) 555-0188"
          // inputMode so a phone keyboard opens on the number pad rather than
          // the alphabet — he is standing on a job site as often as at a desk.
          inputMode="tel"
          className="w-48 rounded-lg border border-black/10 px-3 py-2 text-sm text-charcoal outline-none placeholder:text-charcoal/30 focus:border-charcoal/30"
        />
        <button
          type="submit"
          disabled={pending || !phone.trim()}
          className="cursor-pointer rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Connecting…" : "Call"}
        </button>
      </form>

      {(ringing || error) && (
        <p
          aria-live="polite"
          className={`mt-2 text-xs leading-snug ${error ? "text-red-600" : "text-charcoal/60"}`}
        >
          {error ?? "Answer your phone — we'll connect you."}
        </p>
      )}
    </section>
  );
}
