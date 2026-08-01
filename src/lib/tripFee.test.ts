import { describe, expect, it } from "vitest";
import { calculateTripFee, FREE_RADIUS_KM, PER_KM_RATE_CENTS } from "./tripFee";

// Baseline drive fixture: no traffic (traffic time == free-flow time).
function drive(distanceMeters: number, freeFlowSeconds = 600, trafficSeconds = freeFlowSeconds) {
  return calculateTripFee({ distanceMeters, freeFlowSeconds, trafficSeconds });
}

describe("calculateTripFee", () => {
  it("charges nothing inside the free radius", () => {
    expect(FREE_RADIUS_KM).toBe(5);
    expect(drive(4000).tripFeeCents).toBe(0);
    expect(drive(5000).tripFeeCents).toBe(0); // exactly at the boundary
    expect(drive(5000).billableRoundTripKm).toBe(0);
  });

  it("bills the excess distance round-trip at $2.10/km", () => {
    expect(PER_KM_RATE_CENTS).toBe(210);
    // 10 km one-way: 5 km excess x 2 = 10 billable km x 210 = $21.00.
    const result = drive(10_000);
    expect(result.billableRoundTripKm).toBe(10);
    expect(result.tripFeeCents).toBe(2100);
  });

  it("scales the fee by live traffic delay", () => {
    // Drive takes 50% longer than free flow -> fee x 1.5: 2100 x 1.5 = 3150,
    // rounded to the nearest dollar -> $32.00 (31.5 rounds up).
    const result = calculateTripFee({ distanceMeters: 10_000, freeFlowSeconds: 600, trafficSeconds: 900 });
    expect(result.trafficMultiplier).toBe(1.5);
    expect(result.tripFeeCents).toBe(3200);
  });

  it("never bills less than a no-traffic drive", () => {
    const result = calculateTripFee({ distanceMeters: 10_000, freeFlowSeconds: 600, trafficSeconds: 300 });
    expect(result.trafficMultiplier).toBe(1);
    expect(result.tripFeeCents).toBe(2100);
  });

  it("caps the multiplier at 2x however bad the reading is", () => {
    const result = calculateTripFee({ distanceMeters: 10_000, freeFlowSeconds: 600, trafficSeconds: 6000 });
    expect(result.trafficMultiplier).toBe(2);
    expect(result.tripFeeCents).toBe(4200);
  });

  it("treats a zero free-flow reading as normal traffic instead of dividing by zero", () => {
    const result = calculateTripFee({ distanceMeters: 10_000, freeFlowSeconds: 0, trafficSeconds: 900 });
    expect(result.trafficMultiplier).toBe(1);
    expect(result.tripFeeCents).toBe(2100);
  });

  it("rounds the fee to a whole dollar", () => {
    // 6.543 km -> 1.543 km excess x 2 = 3.086 km x 210 = 648.06 cents -> $6.00.
    const result = drive(6543);
    expect(result.tripFeeCents).toBe(600);
    expect(result.tripFeeCents % 100).toBe(0);
  });

  it("reports human-readable rounded figures", () => {
    const result = calculateTripFee({ distanceMeters: 6543, freeFlowSeconds: 610, trafficSeconds: 921 });
    expect(result.distanceKm).toBe(6.5);
    expect(result.billableRoundTripKm).toBe(3.1);
    expect(result.freeFlowMinutes).toBe(10);
    expect(result.trafficMinutes).toBe(15);
  });
});
