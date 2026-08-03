import { NextResponse, type NextRequest } from "next/server";
import { isUnlocalizedPath } from "@/i18n/routing";

/**
 * Locale routing for the marketing tree.
 *
 * `proxy.ts`, not `middleware.ts`: on Next 16 the middleware file convention is
 * deprecated and renamed to proxy, and the App Router has no `i18n` config key
 * — sub-path locales are `app/[lang]/` plus this interceptor.
 *
 * Three rules, in order:
 *
 *  1. Private and token surfaces (`/admin`, `/api`, `/hub`, `/q`, `/i`) are
 *     left completely alone. They live outside `[lang]` and must keep working
 *     at their current unprefixed paths.
 *  2. `/en/...` already matches `[lang]` as written, so it passes through.
 *  3. Everything else is French and is *rewritten* — never redirected — onto
 *     `/fr/...`. The browser and every crawler keep seeing the unprefixed URL
 *     they have always seen.
 *
 * There is deliberately no `Accept-Language` sniffing. Silently sending an
 * English-preferring browser to the English site is exactly what Bill 96's
 * "at least as favourable" clause targets: French is the default and the user
 * chooses English explicitly, via the header toggle.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isUnlocalizedPath(pathname)) return;

  // `/fr/...` is never a public URL here. Anything that reaches it — a
  // hand-typed guess, a stray backlink — is folded onto the canonical
  // unprefixed path so the two can never compete as duplicates.
  if (pathname === "/fr" || pathname.startsWith("/fr/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }

  if (pathname === "/en" || pathname.startsWith("/en/")) return;

  const url = request.nextUrl.clone();
  url.pathname = `/fr${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Everything except Next's own internals and anything that looks like a
  // file — `/favicon.ico`, `/icon.png`, `/sitemap.xml`, `/robots.txt`,
  // `/llms.txt`, `/images/*`. Locale routing only ever needs page requests,
  // and no marketing slug contains a dot.
  matcher: ["/((?!_next/|.*\\.).*)"],
};
