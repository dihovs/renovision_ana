/**
 * Feature flags for design experiments being trialled live.
 * Flip a flag and the experiment is fully off — no other edits needed.
 */

/**
 * Page-by-page scroll snapping: the scroll comes to rest on one full section at
 * a time. Applied automatically to every page by SnapSections, which measures
 * each section and exempts any that are taller than the viewport.
 *
 * NOTE: this is why the site no longer uses Lenis smooth scroll. Lenis rewrites
 * the scroll offset every frame, which leaves the browser's snap engine no
 * settled scroll to snap after — the two cannot both be enabled. Lenis was
 * already configured near-linear (duration 0.3, easing t => t) so it was adding
 * very little, and removing it also restored native scroll events, which it had
 * been silently swallowing.
 */
export const PAGE_SNAP = true;

/**
 * Routes that never snap. The admin CRM is a data tool — snapping a list of
 * leads to viewport-sized chunks would fight the way it is read.
 */
export const PAGE_SNAP_EXCLUDED_PREFIXES = ["/admin"];
