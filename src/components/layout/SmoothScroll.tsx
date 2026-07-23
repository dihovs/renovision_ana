"use client";

import { useEffect } from "react";
import Lenis from "lenis";

export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 0.3,
      easing: (t) => t,
      smoothWheel: true,
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Lenis measures document height once on init. Images, fonts, and the
    // scroll-jacked hero's tall (160vh/220vh) wrapper can all still be
    // resolving layout at that point, which locks scroll to a stale, too-short
    // height — the page appears to "stop" partway down. Re-measuring on any
    // layout size change (and once more after full page load) keeps it correct.
    const resizeObserver = new ResizeObserver(() => lenis.resize());
    resizeObserver.observe(document.body);
    window.addEventListener("load", () => lenis.resize());

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      lenis.destroy();
    };
  }, []);

  return null;
}
