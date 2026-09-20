"use client";

import { useEffect } from "react";

const KEY = "slk-scroll-y";

/**
 * Mounted once per page. The language toggle (Header.tsx) is a real link to
 * a different route/page — a full navigation, which the browser resets to
 * scroll 0 for. This restores the scroll position the toggle stashed right
 * before navigating, so switching FR/EN keeps you on the same section
 * instead of dropping back to the top.
 */
export default function ScrollRestore() {
  useEffect(() => {
    const stored = sessionStorage.getItem(KEY);
    if (!stored) return;
    sessionStorage.removeItem(KEY);
    const y = Number(stored);
    if (!Number.isFinite(y)) return;
    // Two rAFs: one for layout to settle after hydration, one to apply the
    // scroll after that layout pass is actually painted.
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
  }, []);
  return null;
}

/** Called by the language toggle right before it navigates. */
export function stashScrollPosition() {
  sessionStorage.setItem(KEY, String(window.scrollY));
}
