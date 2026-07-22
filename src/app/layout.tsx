import type { Metadata } from "next";
import { Poppins, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { ChatProvider } from "@/components/chat/ChatProvider";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SmoothScroll from "@/components/layout/SmoothScroll";
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Renovision AnA | Renovation & Water Damage Restoration",
    template: "%s | Renovision AnA",
  },
  description:
    "Renovision AnA provides general renovations, water damage repair and restoration, and kitchen & bathroom remodeling for property managers, insurers, and homeowners.",
  openGraph: {
    title: "Renovision AnA | Renovation & Water Damage Restoration",
    description:
      "General renovations, water damage repair and restoration, and kitchen & bathroom remodeling for property managers, insurers, and homeowners.",
    url: SITE_URL,
    siteName: "Renovision AnA",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Renovision AnA | Renovation & Water Damage Restoration",
    description:
      "General renovations, water damage repair and restoration, and kitchen & bathroom remodeling for property managers, insurers, and homeowners.",
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
        <SmoothScroll />
        <LanguageProvider>
          <ChatProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <ChatWidget />
          </ChatProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
