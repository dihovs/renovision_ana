"use client";

import { createContext, useContext, useMemo } from "react";
import { Locale, TranslationShape, translations } from "./translations";

type LanguageContextValue = {
  locale: Locale;
  t: TranslationShape;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Route-driven, not state-driven.
 *
 * The locale is decided by the URL — French at the unprefixed root, English
 * under `/en` — and handed down from the server layout, so the markup a
 * crawler receives is already in the right language and `<html lang>` matches
 * it. There is no `setLocale` and no localStorage: the language toggle is a
 * real link to the counterpart URL, which is also what makes the alternate
 * discoverable. Anything remembered locally could only ever contradict the URL.
 */
export function LanguageProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, t: translations[locale] }), [locale]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
