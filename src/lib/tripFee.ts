// Handyman trip fee: a real dispatch/mileage charge for driving to the job,
// separate from labour. Owner-confirmed 2026-07-26 (Artush):
// - First FREE_RADIUS_KM (one-way) from the shop is free.
// - Beyond that, billed round-trip at PER_KM_RATE_CENTS. This is a customer-
//   facing rate (covers the tech's time and vehicle cost, not just fuel/
//   depreciation) — deliberately higher than Revenu Québec's $0.73/km
//   reimbursement rate, which only covers the vehicle's own running cost.
// - Heavy traffic scales the whole fee proportionally to how much longer the
//   drive takes right now vs. a normal, no-traffic drive (e.g. a drive that
//   currently takes 50% longer bills 50% more) — objective, from Google Maps'
//   live traffic data, not a flat clock-based rush-hour tax.
export const FREE_RADIUS_KM = 5;
export const PER_KM_RATE_CENTS = 210; // $2.10/km, round-trip, beyond the free radius

// Guards against a bad traffic reading (or a data glitch) turning into a
// runaway multiplier — a drive can never bill as less than "normal" or more
// than double a no-traffic drive.
const MIN_TRAFFIC_MULTIPLIER = 1;
const MAX_TRAFFIC_MULTIPLIER = 2;

export type TripFeeResult = {
  distanceKm: number;
  billableRoundTripKm: number;
  freeFlowMinutes: number;
  trafficMinutes: number;
  trafficMultiplier: number;
  tripFeeCents: number;
};

export function calculateTripFee(input: {
  distanceMeters: number;
  freeFlowSeconds: number;
  trafficSeconds: number;
}): TripFeeResult {
  const distanceKm = input.distanceMeters / 1000;
  const excessOneWayKm = Math.max(0, distanceKm - FREE_RADIUS_KM);
  const billableRoundTripKm = excessOneWayKm * 2;

  const rawMultiplier = input.freeFlowSeconds > 0 ? input.trafficSeconds / input.freeFlowSeconds : 1;
  const trafficMultiplier = Math.min(MAX_TRAFFIC_MULTIPLIER, Math.max(MIN_TRAFFIC_MULTIPLIER, rawMultiplier));

  const baseFeeCents = billableRoundTripKm * PER_KM_RATE_CENTS;
  // Round to the nearest dollar — a clean number, not false cent-precision.
  const tripFeeCents = Math.round((baseFeeCents * trafficMultiplier) / 100) * 100;

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    billableRoundTripKm: Math.round(billableRoundTripKm * 10) / 10,
    freeFlowMinutes: Math.round(input.freeFlowSeconds / 60),
    trafficMinutes: Math.round(input.trafficSeconds / 60),
    trafficMultiplier: Math.round(trafficMultiplier * 100) / 100,
    tripFeeCents,
  };
}
