import type { Metadata } from "next";
import "../../globals.css";
import "../slk.css";
import { playfair, inter } from "../fonts";

export const metadata: Metadata = {
  title: {
    default: "Clinique Esthétique SLK",
    template: "%s | Clinique Esthétique SLK",
  },
  description: "Clinique Esthétique SLK — soins du visage et esthétique à Laval.",
};

/**
 * Own root layout for the French branch of /slk (route group `(fr)`, no URL
 * segment). A sibling root layout lives at src/app/slk/en/layout.tsx with
 * lang="en" — split this way, rather than one shared layout, so `<html
 * lang>` is correct per branch instead of hardcoded.
 */
export default function SlkFrLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${playfair.variable} ${inter.variable} h-full antialiased`}>
      <body
        className="min-h-full flex flex-col bg-[var(--slk-cream)] text-[var(--slk-charcoal)]"
        style={{ fontFamily: "var(--font-slk-sans)" }}
      >
        {children}
      </body>
    </html>
  );
}
