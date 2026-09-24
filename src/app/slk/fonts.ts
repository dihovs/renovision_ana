import { Fraunces, Work_Sans } from "next/font/google";

export const serif = Fraunces({
  variable: "--font-slk-serif",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  display: "optional",
});

export const sans = Work_Sans({
  variable: "--font-slk-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "optional",
});
