"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/i18n/LanguageProvider";
import { HREFLANG, isUnlocalizedPath, localePath, splitLocale } from "@/i18n/routing";

/**
 * Two real links, not a state setter.
 *
 * Each one points at the same page in the other language, preserving the
 * current path — `/services/flooring` ⇄ `/en/services/flooring`. That link is
 * what lets a crawler discover the alternate at all, so it has to be a genuine
 * `<a href>` rather than a button that mutates client state.
 *
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
  const { locale } = useLanguage();
  const pathname = usePathname() ?? "/";

  // /admin and the token pages have no counterpart URL to link to, so there is
  // nothing honest for this control to do there.
  if (isUnlocalizedPath(pathname)) return null;

  // The locale comes from the route param above; only the path is needed here,
  // and `splitLocale` strips either prefix so it reads the same whether the
  // hook hands back the browser path or the internally rewritten one.
  const { path } = splitLocale(pathname);

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
        <Link
          key={code}
          href={localePath(code, path)}
          hrefLang={HREFLANG[code]}
          aria-current={locale === code ? "true" : undefined}
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
        </Link>
      ))}
    </div>
  );
}
