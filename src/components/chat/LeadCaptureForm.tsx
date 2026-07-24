"use client";

import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { isValidEmail, isValidPhone } from "./chatLogic";

export default function LeadCaptureForm({
  onSubmit,
  onSkip,
}: {
  onSubmit: (data: {
    name: string;
    phone: string;
    email: string;
    address?: string;
    marketingConsent: boolean;
  }) => void;
  onSkip: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 1 && isValidPhone(phone) && isValidEmail(email);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim() || undefined,
        marketingConsent,
      });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-base outline-none focus:border-brand-blue";

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 border-t border-black/10 bg-brand-blue-light/40 p-3">
      <p className="text-sm font-semibold text-charcoal">{t.chat.leadCapture.intro}</p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.chat.leadCapture.name}
        className={inputClass}
      />
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder={t.chat.leadCapture.phone}
        className={inputClass}
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t.chat.leadCapture.email}
        className={inputClass}
      />
      <input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder={t.chat.leadCapture.address}
        className={inputClass}
      />
      <label className="flex cursor-pointer items-start gap-2 text-xs leading-snug text-charcoal/70">
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={(e) => setMarketingConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-green"
        />
        <span>{t.chat.leadCapture.consent}</span>
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="flex-1 cursor-pointer rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "..." : t.chat.leadCapture.submit}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="cursor-pointer text-xs font-semibold text-charcoal/50 hover:text-charcoal"
        >
          {t.chat.leadCapture.later}
        </button>
      </div>
    </form>
  );
}
