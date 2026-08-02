import type { Metadata } from "next";
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
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${poppins.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-charcoal font-body">
        <LocalBusinessSchema />
        <LanguageProvider locale={DEFAULT_LOCALE}>
          <ChatProvider>
            <ChromeGate>
              <Header />
            </ChromeGate>
            <main className="flex-1">{children}</main>
            <ChromeGate>
              <Footer />
              <ChatWidget />
            </ChromeGate>
          </ChatProvider>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
