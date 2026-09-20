import { Playfair_Display, Inter } from "next/font/google";

export const playfair = Playfair_Display({
  variable: "--font-slk-serif",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "optional",
});

export const inter = Inter({
  variable: "--font-slk-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "optional",
});
