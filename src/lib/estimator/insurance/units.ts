// The ONE place metric measurements become the price book's imperial units.
// Every measurement in this app is metric internally; every rate in the price
// book is per sq ft / linear ft / sq yd. A second conversion site is a
// four-percent error nobody can find — the same discipline PlanTransform
// enforces for plan metres to canvas points. (Estimator-Spec.md §3.4)

const SQM_PER_SQFT = 0.09290304;
const M_PER_FT = 0.3048;

export function sqmToSqFt(sqm: number): number {
  return sqm / SQM_PER_SQFT;
}

export function mToLinFt(m: number): number {
  return m / M_PER_FT;
}

export function sqmToSqYd(sqm: number): number {
  return sqm / (SQM_PER_SQFT * 9);
}

/** Quantities print with two decimals, the way the reference documents do
    (88,20 P2 · 64,33 PL). Round once, at the end of a derivation — never
    between steps. */
export function roundQuantity(value: number): number {
  return Math.round(value * 100) / 100;
}
