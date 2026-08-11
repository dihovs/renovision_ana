import type { Metadata, Viewport } from "next";
import { Poppins, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "../globals.css";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { DEFAULT_LOCALE } from "@/i18n/routing";
import { ChatProvider } from "@/components/chat/ChatProvider";
import ChromeGate from "@/components/layout/ChromeGate";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ChatWidget from "@/components/chat/ChatWidget";
import LocalBusinessSchema from "@/components/seo/LocalBusinessSchema";
import { SITE_URL } from "@/lib/constants";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
  // Same display strategy as the marketing layout: the swap repaint was the
  // site's LCP; `optional` removes it. See src/app/[lang]/layout.tsx.
  display: "optional",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  // Same display strategy as the marketing layout: the swap repaint was the
  // site's LCP; `optional` removes it. See src/app/[lang]/layout.tsx.
  display: "optional",
});

/**
 * Root layout for the internal surfaces: /admin plus the /hub, /q and /i token
 * pages. They sit outside `[lang]` on purpose — they are private or
 * link-credentialed, have no counterpart URL in the other language, and must
 * keep working at exactly the paths they use today. This file is the previous
 * single root layout, unchanged apart from the locale now being passed
 * explicitly instead of held in client state.
 *
 * French throughout: these documents are customer-facing and French-first.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Renovision AnA | Rénovation et restauration de dégâts d'eau",
    template: "%s | Renovision AnA",
  },
  description:
    "Renovision AnA réalise rénovations intérieures, restauration après dégât d'eau et réfections de cuisines et salles de bain à Laval et dans le grand Montréal.",
  openGraph: {
    title: "Renovision AnA | Rénovation et restauration de dégâts d'eau",
    description:
      "Rénovations intérieures, restauration après dégât d'eau et réfections de cuisines et salles de bain à Laval et dans le grand Montréal.",
    url: SITE_URL,
    siteName: "Renovision AnA",
    locale: "fr_CA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Renovision AnA | Rénovation et restauration de dégâts d'eau",
    description:
      "Rénovations intérieures, restauration après dégât d'eau et réfections de cuisines et salles de bain à Laval et dans le grand Montréal.",
  },
};

/**
 * Locked to 1x on purpose. These pages run inside the native shell as well as
 * a browser tab, and a tool meant to feel like an app doesn't pinch-zoom its
 * own chrome — this also removes the auto-zoom trigger at the source, on top
 * of the 16px form-control floor in globals.css.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${poppins.variable} ${jakarta.variable} h-full antialiased [overscroll-behavior:none]`}
    >
      <body className="min-h-full flex flex-col bg-white text-charcoal font-body [overscroll-behavior:none]">
        <LocalBusinessSchema />
        <LanguageProvider locale={DEFAULT_LOCALE}>
          <ChatProvider>
            <ChromeGate>
              <Header />
            </ChromeGate>
            <main className="flex-1">{children}</main>
            <ChromeGate>
              <Footer year={currentYear()} />
              <ChatWidget />
            </ChromeGate>
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
 * impure. These pages prerender with a one-week revalidate, so this is the
 * year as of the last build or revalidation — briefly stale after a New Year,
 * but identical on both sides of hydration, which is what actually matters
 * for a copyright line.
 */
function currentYear(): number {
  return new Date().getFullYear();
}
