import { describe, expect, it } from "vitest";
import { totalUnitDays, unitDays, type EquipmentPlacement } from "./dryingLog";

/**
 * Billable unit-days.
 *
 * This is money, in both directions. Under-count and the job absorbs rental
 * it paid for; over-count and an adjuster finds it, which costs more than the
 * difference because it puts every other figure in the file in doubt.
 */

const at = (iso: string) => new Date(iso);

function placement(
  inService: string,
  outOfService: string | null,
  quantity = 1,
): Pick<EquipmentPlacement, "quantity" | "in_service_at" | "out_of_service_at"> {
  return { quantity, in_service_at: inService, out_of_service_at: outOfService };
}

describe("unitDays", () => {
  it("counts both the day it arrived and the day it left", () => {
    // Delivered Monday, collected Wednesday is three days, not two. This is
    // the convention the trade bills on and the one an adjuster expects.
    expect(
      unitDays(placement("2026-08-10T09:00:00Z", "2026-08-12T16:00:00Z"), at("2026-08-20T00:00:00Z")),
    ).toBe(3);
  });

  it("counts a same-day in and out as one day", () => {
    // Not zero: the machine was delivered, ran, and was collected.
    expect(
      unitDays(placement("2026-08-10T08:00:00Z", "2026-08-10T16:00:00Z"), at("2026-08-20T00:00:00Z")),
    ).toBe(1);
  });

  it("multiplies by how many units were placed", () => {
    expect(
      unitDays(placement("2026-08-10T09:00:00Z", "2026-08-12T16:00:00Z", 4), at("2026-08-20T00:00:00Z")),
    ).toBe(12);
  });

  it("counts still-running equipment up to today", () => {
    // A live job must show a running total, not zero.
    expect(unitDays(placement("2026-08-10T09:00:00Z", null), at("2026-08-13T10:00:00Z"))).toBe(4);
  });

  it("returns zero rather than a negative for an impossible window", () => {
    // The database constraint refuses this, but a wrong sign leaking into a
    // total would silently reduce the whole invoice.
    expect(
      unitDays(placement("2026-08-12T09:00:00Z", "2026-08-10T09:00:00Z"), at("2026-08-20T00:00:00Z")),
    ).toBe(0);
  });

  it("returns zero for an unparseable date instead of NaN", () => {
    // NaN would propagate through the total and render as "NaN days".
    expect(unitDays(placement("not a date", null), at("2026-08-13T00:00:00Z"))).toBe(0);
  });
});

describe("totalUnitDays", () => {
  it("adds up a mixed fleet, running and collected", () => {
    const fleet = [
      { ...placement("2026-08-10T09:00:00Z", "2026-08-12T16:00:00Z", 3) },
      { ...placement("2026-08-11T09:00:00Z", null, 1) },
    ] as EquipmentPlacement[];
    // 3 units x 3 days = 9, plus 1 unit x 3 days (11th to 13th) = 3.
    expect(totalUnitDays(fleet, at("2026-08-13T12:00:00Z"))).toBe(12);
  });

  it("is zero for a job with no equipment", () => {
    expect(totalUnitDays([], at("2026-08-13T00:00:00Z"))).toBe(0);
  });
});
