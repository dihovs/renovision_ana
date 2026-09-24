import type { Metadata } from "next";
import "../../globals.css";
import "../slk.css";
import { serif, sans } from "../fonts";
import ScrollRestore from "@/components/slk/ScrollRestore";

export const metadata: Metadata = {
  title: {
    default: "Clinique Esthétique SLK",
    template: "%s | Clinique Esthétique SLK",
  },
  description: "Clinique Esthétique SLK — facials & esthetics in Laval.",
};

/** English root layout. See src/app/slk/(fr)/layout.tsx for why this is split in two. */
export default function SlkEnLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} h-full antialiased`}>
      <body
        className="slk-site min-h-full flex flex-col bg-[var(--slk-bone)] text-[var(--slk-ink)]"
        style={{ fontFamily: "var(--font-slk-sans)" }}
      >
        <ScrollRestore />
        {children}
      </body>
    </html>
  );
}
