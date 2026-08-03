/**
 * A `tel:` link, styled as an unambiguous button.
 *
 * This is the OWNER placing a call — not Ana. Tapping it hands the number to
 * whatever dialer the device already has (the owner's own phone, or the
 * desktop's default calling app) and the call rides on the owner's own line,
 * under his own caller ID. Nothing here reaches Twilio, ElevenLabs, or the
 * outbound call queue — that machinery exists specifically so a human never
 * has to place these calls, and this button exists for the moments a human
 * wants to anyway.
 *
 * No backend, no new credentials, nothing to misconfigure: nowhere else in
 * the admin does a click place a real phone call, so this is the one control
 * that needs zero ambiguity about what it does.
 */

export default function CallButton({
  phone,
  label,
  className = "",
}: {
  /** Any format — digits are stripped for the tel: URI, the label keeps the original. */
  phone: string;
  /** Defaults to "Call {phone}"; pass a shorter label where space is tight. */
  label?: string;
  className?: string;
}) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return null;

  return (
    <a
      href={`tel:${digits}`}
      // Green, filled, uppercase — the same treatment LeadPipeline already
      // uses for its call action, kept identical on purpose so "Call" reads
      // the same everywhere in the admin rather than inventing a second style.
      className={`inline-flex items-center gap-1.5 rounded-full uppercase tracking-[0.08em] bg-brand-green px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-green-dark ${className}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
      {label ?? `Call ${phone}`}
    </a>
  );
}
