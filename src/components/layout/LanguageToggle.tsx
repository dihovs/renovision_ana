"use client";

import { useLanguage } from "@/i18n/LanguageProvider";

/**
 * `transparent` is for when this sits on the header over the full-bleed hero.
 * The default solid-white pill reads as an opaque chip stuck to a photo, so
 * over the hero it switches to a hairline outline with a frosted fill and the
 * selected language inverts to white-on-transparent instead of blue-on-white.
 */
export default function LanguageToggle({
  className = "",
  transparent = false,
}: {
  className?: string;
  transparent?: boolean;
}) {
  const { locale, setLocale } = useLanguage();

  return (
    <div
      className={`inline-flex items-center rounded-full border p-0.5 text-sm font-semibold transition-colors ${
        transparent
          ? "border-white/35 bg-white/10 backdrop-blur-sm"
          : "border-brand-blue/20 bg-white"
      } ${className}`}
      role="group"
      aria-label="Language selector"
    >
      {(["fr", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`cursor-pointer rounded-full px-2.5 py-1 uppercase transition-colors ${
            locale === code
              ? transparent
                ? "bg-white/90 text-brand-blue"
                : "bg-brand-blue text-white"
              : transparent
                ? "text-white/75 hover:bg-white/15 hover:text-white"
                : "text-brand-blue hover:bg-brand-blue-light"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
