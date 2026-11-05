import { describe, expect, it } from "vitest";
import { clockedMinutes, formatMinutes, isoDay, shopDay, weekBounds } from "./timeClock";

describe("the clock's arithmetic", () => {
  it("rounds to whole minutes and never records zero", () => {
    expect(clockedMinutes("2026-11-04T08:00:00Z", "2026-11-04T11:30:20Z")).toBe(210);
    expect(clockedMinutes("2026-11-04T08:00:00Z", "2026-11-04T08:00:05Z")).toBe(1);
  });

  it("weeks start on Monday", () => {
    const { start, end } = weekBounds(new Date(2026, 10, 4, 15)); // Wed 4 Nov 2026
    expect(isoDay(start)).toBe("2026-11-02");
    expect(isoDay(end)).toBe("2026-11-09");
    expect(isoDay(weekBounds(new Date(2026, 10, 8, 23)).start)).toBe("2026-11-02"); // Sunday
    expect(isoDay(weekBounds(new Date(2026, 10, 9, 0, 30)).start)).toBe("2026-11-09"); // Monday
  });

  it("an evening in Montréal is still today, though UTC says tomorrow", () => {
    expect(shopDay(new Date("2026-11-05T01:30:00Z"))).toBe("2026-11-04");
  });

  it("reads like a timesheet", () => {
    expect(formatMinutes(450)).toBe("7 h 30");
    expect(formatMinutes(45)).toBe("45 min");
  });
});
