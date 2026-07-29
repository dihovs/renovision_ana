"use client";

import { usePathname } from "next/navigation";

/**
 * Hides the marketing chrome on internal tools.
 *
 * /admin lives under the root layout, so without this it inherits the public
 * nav, footer and chat launcher — a customer-facing sales widget floating over
 * your own lead list, and a language toggle for a page only you read.
 *
 * A route group with its own root layout would be the textbook fix, but that
 * means relocating every existing page. This is the smaller change.
 */
export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <>{children}</>;
}
