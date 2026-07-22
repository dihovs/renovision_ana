"use client";

import { useLanguage } from "@/i18n/LanguageProvider";

export default function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLanguage();

  return (
    <div
      className={`inline-flex items-center rounded-full border border-brand-blue/20 bg-white p-0.5 text-sm font-semibold ${className}`}
      role="group"
      aria-label="Language selector"
    >
      {(["fr", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`rounded-full px-2.5 py-1 uppercase transition-colors cursor-pointer ${
            locale === code
              ? "bg-brand-blue text-white"
              : "text-brand-blue hover:bg-brand-blue-light"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
