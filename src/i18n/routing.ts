import { locales, type Locale } from "./translations";

/**
 * Where each language lives in the URL.
 *
 * French is the unprefixed root — `/services/water-damage` stays French — and
 * English sits one directory deeper under `/en`. Not `/fr` + `/en`: every URL
 * already indexed keeps working untouched, so there is no mass 301 and no
 * link-equity reset on the area pages and blog posts. It is also the most
 * defensible shape under Bill 96, which requires French on terms at least as
 * favourable as any other language.
 *
 * The route tree itself is `src/app/[lang]/`, so `/en/...` matches as written
 * and the unprefixed French paths are rewritten onto `/fr/...` by `src/proxy.ts`
 * without the browser ever seeing the prefix.
 */
export const DEFAULT_LOCALE: Locale = "fr";

const PREFIX: Record<Locale, string> = { fr: "", en: "/en" };

/**
 * Regioned on purpose. Bare `en` invites Google to serve these pages to UK
 * searchers, and bare `fr` to France — this business works in Laval.
 */
export const HREFLANG: Record<Locale, string> = { fr: "fr-CA", en: "en-CA" };

/** og:locale / og:locale:alternate values, which use `_` rather than `-`. */
export const OG_LOCALE: Record<Locale, string> = { fr: "fr_CA", en: "en_CA" };

/**
 * Route trees deliberately left out of the bilingual marketing site: the
 * private, authenticated and token surfaces, plus the root-level generated
 * image route. They keep serving at their current unprefixed paths and never
 * gain an `/en` twin.
 *
 * ADD EVERY NEW TOP-LEVEL NON-MARKETING ROUTE HERE. Omission is silent and
 * total: the proxy rewrites the path onto `/fr/...`, nothing matches under
 * `[lang]`, and the route 404s with no error anywhere to explain it. `/crew`
 * was written after this list and hit exactly that — every crew link a
 * subcontractor tapped would have been dead. The guard test in
 * `routing.test.ts` walks `src/app/` and fails when a top-level route exists
 * that is neither `[lang]` nor listed here, so the next one cannot slip
 * through the same way.
 */
export const UNLOCALIZED_PREFIXES = [
  "/admin",
  "/api",
  "/hub",
  "/q",
  "/i",
  // Per-job crew links. Token surface, mobile-only, never translated as a
  // route — the page itself is bilingual from the token's own locale.
  "/crew",
  "/opengraph-image",
] as const;

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (locales as readonly string[]).includes(value);
}

/** Narrows a raw `[lang]` route param, falling back to the default locale. */
export function toLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function isUnlocalizedPath(pathname: string): boolean {
  return UNLOCALIZED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** The public path for a locale-independent route, e.g. `/en/services`. */
export function localePath(locale: Locale, path = "/"): string {
  const rest = path === "/" ? "" : path;
  return `${PREFIX[locale]}${rest}` || "/";
}

/**
 * Inverse of `localePath`. Strips `/fr` as well as `/en` so it gives the same
 * answer whether it is handed a browser-visible path (`/services`) or the
 * internally rewritten one (`/fr/services`).
 */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  for (const locale of locales) {
    const prefix = `/${locale}`;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return { locale, path: pathname.slice(prefix.length) || "/" };
    }
  }
  return { locale: DEFAULT_LOCALE, path: pathname || "/" };
}

/**
 * Rewrites an in-app `href` for the current locale, leaving the query string
 * and hash alone. External, protocol-relative, `tel:` and `mailto:` hrefs are
 * returned untouched.
 */
export function localizeHref(locale: Locale, href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const [, path, suffix = ""] = href.match(/^([^?#]*)([?#].*)?$/) ?? [];
  if (path === undefined) return href;
  return `${localePath(locale, path || "/")}${suffix}`;
}
