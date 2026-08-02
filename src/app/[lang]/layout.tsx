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

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
            <Footer />
            <ChatWidget />
          </ChatProvider>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
