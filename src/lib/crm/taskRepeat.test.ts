import { describe, expect, it } from "vitest";
import { nextDueDate } from "./tasks";

describe("repeating tasks", () => {
  it("move by one period from their own due date", () => {
    expect(nextDueDate("2026-11-04", "daily", "2026-11-10")).toBe("2026-11-05");
    expect(nextDueDate("2026-11-04", "weekly", "2026-11-10")).toBe("2026-11-11");
    expect(nextDueDate("2026-11-04", "monthly", "2026-11-10")).toBe("2026-12-04");
  });

  it("start from today when they had no date", () => {
    expect(nextDueDate(null, "weekly", "2026-11-04")).toBe("2026-11-11");
  });

  it("a month-end task stays at month end", () => {
    expect(nextDueDate("2026-01-31", "monthly", "2026-01-31")).toBe("2026-02-28");
    expect(nextDueDate("2026-12-15", "monthly", "2026-12-15")).toBe("2027-01-15");
  });

  it("a one-off has no next", () => {
    expect(nextDueDate("2026-11-04", "none", "2026-11-04")).toBeNull();
  });
});
