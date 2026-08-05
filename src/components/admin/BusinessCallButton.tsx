"use client";

import { useState, useTransition } from "react";
import { SITE_PHONE } from "@/lib/constants";

/**
 * Call somebody from the BUSINESS number.
 *
 * Sits beside CallButton rather than replacing it, because the two do
 * genuinely different things and which one is right depends on who is being
 * called:
 *
 *   - CallButton (`tel:`) dials from the phone in his hand. Instant, free, and
 *     it shows his personal number — fine for a supplier, wrong for a customer
 *     who will then have his mobile forever.
 *   - This one rings his phone first and bridges. Costs a Twilio leg and takes
 *     a few seconds, and the customer sees the company number.
 *
 * So the label says which number the customer will see, not "call" — the whole
 * reason to take the slower path is the caller ID, and a button that does not
 * say so is a button he has to remember the difference for.
 *
 * The pending state matters more here than on an ordinary form. Nothing
 * visible happens when this succeeds — the feedback is his own phone ringing a
 * second or two later — so without a state change the button looks broken and
 * gets pressed again, which places a second call.
 */
export default function BusinessCallButton({
  phone,
  action,
  className = "",
}: {
  phone: string;
  action: (phone: string) => Promise<string | null>;
  className?: string;
}) {
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
          // Long enough to read, short enough that the button is ready again
          // before he needs it for the next call.
          setTimeout(() => setRinging(false), 8000);
        }
      } catch {
        setError("Something went wrong placing the call.");
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={place}
        disabled={pending}
        title={`Rings your phone first, then dials ${phone}. They see ${SITE_PHONE}.`}
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-brand-green/40 bg-white px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] text-brand-green transition-colors hover:bg-brand-green/[0.08] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden
        >
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
        {pending ? "Connecting…" : "Call as business"}
      </button>
      {(ringing || error) && (
        <span
          aria-live="polite"
          className={`text-[11px] leading-snug ${error ? "text-red-600" : "text-charcoal/55"}`}
        >
          {error ?? "Answer your phone — we'll connect you."}
        </span>
      )}
    </span>
  );
}
