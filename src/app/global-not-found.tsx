/* eslint-disable @next/next/no-html-link-for-pages --
 * `next/link` needs the App Router context, and this page is rendered outside
 * normal app rendering by design (see the comment on the component). A plain
 * `<a>` is the only thing guaranteed to work here, and a full page load is the
 * correct behaviour anyway — the visitor is leaving a URL that does not exist.
 */
import type { Metadata } from "next";
import { Poppins, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SITE_PHONE, SITE_PHONE_TEL, SITE_URL } from "@/lib/constants";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

/**
 * The 404 for URLs that match no route at all.
 *
 * It has to be `global-not-found` rather than a plain `not-found.tsx`: the
 * marketing tree and the internal tree each own a root layout, and the
 * marketing one sits under a dynamic `[lang]` segment, which are the two
 * situations the Next docs give for this convention — there is no single
 * layout for an ordinary 404 page to render inside. Enabled by
 * `experimental.globalNotFound` in next.config.ts.
 *
 * Because Next skips normal rendering here, this file has to bring its own
 * `<html>`, styles and fonts, and it gets no locale from the URL. Bilingual
 * for the same reason the token not-found pages are (see
 * src/app/(internal)/hub/[token]/not-found.tsx): a URL that matches nothing
 * tells us nothing about which language its visitor reads.
 *
 * Placeholder wording — a branded 404 is its own backlog item (SEO audit B12).
 */
export const metadata: Metadata = {
  // Set here as well as in the layouts: this page is rendered outside them, so
  // it inherits nothing and would otherwise resolve image URLs to localhost.
  metadataBase: new URL(SITE_URL),
  title: "Page introuvable — Page not found | Renovision AnA",
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="fr" className={`${poppins.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full bg-white text-charcoal font-body">
        <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
          <p className="font-heading text-sm font-bold uppercase tracking-[0.18em] text-brand-green">
            404
          </p>
          <h1 className="mt-3 font-heading text-3xl font-extrabold text-brand-blue sm:text-4xl">
            Page introuvable — Page not found
          </h1>
          <p className="mt-4 leading-relaxed text-charcoal/70">
            Cette adresse ne correspond à aucune page. This address doesn&apos;t match any page.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/"
              className="rounded-full uppercase tracking-[0.08em] bg-brand-green px-7 py-3 font-heading font-bold text-white transition-colors hover:bg-brand-green-dark"
            >
              Accueil
            </a>
            <a
              href="/en"
              className="rounded-full uppercase tracking-[0.08em] border-2 border-brand-blue px-7 py-3 font-heading font-bold text-brand-blue transition-colors hover:bg-brand-blue-light"
            >
              Home
            </a>
          </div>
          <a
            href={`tel:${SITE_PHONE_TEL}`}
            className="mt-6 text-sm font-semibold text-brand-blue hover:underline"
          >
            {SITE_PHONE}
          </a>
        </main>
      </body>
    </html>
  );
}
