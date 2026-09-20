import type { Locale } from "./copy";

/** Builds an in-app href under /slk for the given locale. `path` starts with "/". */
export function slkPath(locale: Locale, path: string): string {
  const base = locale === "fr" ? "/slk" : "/slk/en";
  if (path === "/") return base;
  return `${base}${path}`;
}

/** The counterpart URL in the other locale, for the language toggle. */
export function slkCounterpart(locale: Locale, currentPath: string): string {
  const rest = currentPath.replace(/^\/slk(\/en)?/, "") || "/";
  return slkPath(locale === "fr" ? "en" : "fr", rest);
}
