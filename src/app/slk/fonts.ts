import { Cormorant_Garamond, Work_Sans } from "next/font/google";

// Cormorant's 300 is too hairline for body-adjacent sizes, so it isn't
// loaded: `font-light` on serif text resolves to the nearest loaded weight (400).
export const serif = Cormorant_Garamond({
  variable: "--font-slk-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "optional",
});

export const sans = Work_Sans({
  variable: "--font-slk-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "optional",
});
