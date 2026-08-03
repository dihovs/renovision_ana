import type { Metadata } from "next";
import { Poppins, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "../globals.css";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { locales } from "@/i18n/translations";
import { HREFLANG, OG_LOCALE, toLocale } from "@/i18n/routing";
import { ChatProvider } from "@/components/chat/ChatProvider";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ChatWidget from "@/components/chat/ChatWidget";
import LocalBusinessSchema from "@/components/seo/LocalBusinessSchema";
import { localeUrl } from "@/lib/seo";
import { SITE_URL } from "@/lib/constants";

/**
 * `display: "optional"` on both fonts, and it is the site's single biggest
 * mobile performance lever — measured, not guessed.
 *
 * The default (`swap`) paints headlines in the fallback font and repaints
 * them when the webfont arrives. Chrome records that second, larger paint as
 * a new LCP candidate, so every page's LCP was the *font swap*, not the first
 * paint: ~2s of pure "element render delay" on mobile (h1 on service pages,
 * even the hero image on home — the swap reflows its container). Blocking
 * .woff2 in Lighthouse collapsed the gap, which is the proof.
 *
 * `optional` means: if the font isn't ready within ~100ms of first paint, this
 * pageview keeps the fallback and there is no repaint, ever. The fallback is
 * next/font's metrics-adjusted one, so it is dimensionally identical — no
 * shift, just system glyphs — and the files are preloaded from our own
 * origin, so on ordinary connections the brand fonts still make first paint.
 * A slow first visit reads instantly in the fallback and gets Poppins from
 * the cache on every navigation after. That trade is the Google-recommended
 * one for text-LCP pages, and it is the right one for a site whose visitors
 * are standing in a flooded basement on a phone.
 */
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
  display: "optional",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "optional",
});

/**
 * Root layout for the public site, and the only place `<html lang>` is set for
 * it. It sits under `[lang]` precisely so the attribute can be right: the
 * previous version served `lang="fr"` on every URL and mutated it client-side
 * after mount, which left an English reader with French-declared markup.
 */
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

// Only `fr` and `en` exist. proxy.ts already guarantees it, but without this
// an invented prefix that somehow slipped past would be rendered on demand as
// French rather than 404ing.
export const dynamicParams = false;

// The English strings are this site's own prior copy, restored from the commit
// that switched the whole tree to French-only metadata (69557d8). Nothing here
// is newly written: the English half has always existed, it just had no URL.
const ROOT_COPY = {
  fr: {
    title: "Renovision AnA | Rénovation et restauration de dégâts d'eau",
    description:
      "Renovision AnA réalise rénovations intérieures, restauration après dégât d'eau et réfections de cuisines et salles de bain à Laval et dans le grand Montréal.",
    ogDescription:
      "Rénovations intérieures, restauration après dégât d'eau et réfections de cuisines et salles de bain à Laval et dans le grand Montréal.",
  },
  en: {
    title: "Renovision AnA | Renovation & Water Damage Restoration",
    description:
      "Renovision AnA provides general renovations, water damage repair and restoration, and kitchen & bathroom remodeling for property managers, insurers, and homeowners.",
    ogDescription:
      "General renovations, water damage repair and restoration, and kitchen & bathroom remodeling for property managers, insurers, and homeowners.",
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const locale = toLocale((await params).lang);
  const copy = ROOT_COPY[locale];
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: copy.title, template: "%s | Renovision AnA" },
    description: copy.description,
    alternates: {
      canonical: localeUrl(locale),
      languages: {
        [HREFLANG.fr]: localeUrl("fr"),
        [HREFLANG.en]: localeUrl("en"),
        "x-default": localeUrl("fr"),
      },
    },
    openGraph: {
      title: copy.title,
      description: copy.ogDescription,
      url: localeUrl(locale),
      siteName: "Renovision AnA",
      locale: OG_LOCALE[locale],
      alternateLocale: OG_LOCALE[locale === "fr" ? "en" : "fr"],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.ogDescription,
    },
    // Search Console ownership. The token is not a secret — it is printed
    // into every page's <head> by design — but it is env-shaped anyway so
    // connecting GSC is a Vercel env var and a redeploy, not a code change.
    // Absent, nothing renders and nothing breaks: the owner has not created
    // the Search Console property yet, and an empty content="" tag would be
    // worse than none.
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
      : {}),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const locale = toLocale((await params).lang);

  return (
    <html
      lang={locale}
      className={`${poppins.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-charcoal font-body">
        <LocalBusinessSchema />
        <LanguageProvider locale={locale}>
          <ChatProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer year={currentYear()} />
            <ChatWidget />
          </ChatProvider>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}

/**
 * The copyright year, picked on the server so the client never disagrees.
 *
 * Outside the component body because reading the clock during render is
 * impure. These pages prerender, so this is the year as of the last build or
 * revalidation — briefly stale after a New Year, but identical on both sides
 * of hydration, which is what actually matters for a copyright line.
 */
function currentYear(): number {
  return new Date().getFullYear();
}
