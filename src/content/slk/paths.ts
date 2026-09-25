import { copy, type Locale } from "./copy";

/** Builds an in-app href under /slk for the given locale. `path` starts with "/". */
export function slkPath(locale: Locale, path: string): string {
  const base = locale === "fr" ? "/slk" : "/slk/en";
  if (path === "/") return base;
  return `${base}${path}`;
}

/** Page segments whose name differs between locales. */
const PAGE_SEGMENTS: Record<Locale, string[]> = { fr: ["a-propos"], en: ["about"] };

/** The counterpart URL in the other locale, for the language toggle. */
export function slkCounterpart(locale: Locale, currentPath: string): string {
  const target: Locale = locale === "fr" ? "en" : "fr";
  const rest = currentPath.replace(/^\/slk(\/en)?/, "") || "/";
  const parts = rest.split("/");

  const page = PAGE_SEGMENTS[locale].indexOf(parts[1]);
  if (page !== -1) parts[1] = PAGE_SEGMENTS[target][page];

  // Service slugs are translated; both locales list services in the same order.
  if (parts[1] === "services" && parts[2]) {
    const i = copy[locale].services.findIndex((s) => s.slug === parts[2]);
    parts[2] = i === -1 ? "" : copy[target].services[i].slug;
  }

  return slkPath(target, parts.join("/").replace(/\/$/, "") || "/");
}
