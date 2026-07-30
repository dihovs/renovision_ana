"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { PAGE_SNAP, PAGE_SNAP_EXCLUDED_PREFIXES } from "@/lib/experiments";

/**
 * Page-by-page scroll snapping, applied automatically to every page.
 *
 * Rather than hand-wrapping sections in each of ~15 page files, this walks the
 * top-level children of <main> once per route and tags each one. The rule it
 * applies is the whole point:
 *
 *   - a section that FITS on screen becomes a snap point and is stretched to a
 *     full viewport, so the scroll comes to rest on one section at a time
 *   - a section TALLER than the screen is exempted entirely
 *
 * That second rule is what makes mandatory snapping safe on text-heavy pages.
 * Without it, a section you cannot fit on screen becomes a trap: the snap keeps
 * pulling you back to its top and its lower half is unreachable. The service
 * pages, blog posts and the privacy policy all have sections like that.
 *
 * The tagging is the same on every device; how much the tags DO differs by
 * screen size in globals.css. Phones get a light proximity nudge only, because
 * mandatory snapping plus iOS momentum skipped whole exempt sections.
 *
 * Heights are measured BEFORE any class is applied — once a section has
 * min-height: 100svh it would always measure as tall enough, and every section
 * would look like it fits.
 */
export default function SnapSections() {
  const pathname = usePathname();

  useEffect(() => {
    if (!PAGE_SNAP) return;
    if (PAGE_SNAP_EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return;
    // Snapping moves the viewport on the visitor's behalf, which is precisely
    // what this preference asks us not to do.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const main = document.querySelector("main");
    if (!main) return;

    const sections = Array.from(main.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    );
    const html = document.documentElement;

    const apply = () => {
      // Clear first so a resize re-decides from natural heights rather than
      // from heights we previously forced.
      for (const el of sections) el.classList.remove("snap-page", "snap-free");

      // Measure everything before touching anything, for the same reason.
      const viewport = window.innerHeight;
      const fits = sections.map((el) => el.getBoundingClientRect().height <= viewport * 0.98);

      sections.forEach((el, i) => {
        el.classList.add(fits[i] ? "snap-page" : "snap-free");
      });
      html.classList.add("snap-pages");
    };

    apply();

    // Re-decide when the viewport changes: a section that fitted in landscape
    // may not fit in portrait, and vice versa.
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(apply, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      html.classList.remove("snap-pages");
      for (const el of sections) el.classList.remove("snap-page", "snap-free");
    };
  }, [pathname]);

  return null;
}
