import { describe, expect, it } from "vitest";
import { arrivalWindow } from "./dispatch";

/**
 * The one line of a dispatch a crew member actually acts on.
 *
 * It is worth a test of its own for two reasons. Meta rejects a parameter
 * containing a newline or a run of spaces, so a badly formatted window is not a
 * cosmetic problem — it is a message that never sends. And a date-only column
 * formatted in the wrong zone reads as the day before in Montreal, which is a
 * crew standing outside a house twenty-four hours early.
 */

const NOW = new Date("2026-08-30T12:00:00Z");

function visit(startsAt: string, endsAt: string | null = null, extra: Partial<{ allDay: boolean; completedAt: string | null }> = {}) {
  return { startsAt, endsAt, allDay: false, completedAt: null, ...extra };
}

describe("arrivalWindow", () => {
  it("reads the next visit as a day and a range", () => {
    const line = arrivalWindow(
      [visit("2026-09-01T12:00:00Z", "2026-09-01T14:00:00Z")],
      null,
      "en",
      NOW,
    );
    expect(line).toContain("Tuesday");
    // 12:00 UTC is 08:00 in Montreal — the business's own clock, not the server's.
    expect(line).toMatch(/8:00/);
    expect(line).toMatch(/10:00/);
  });

  it("answers in French when the crew member is francophone", () => {
    const line = arrivalWindow([visit("2026-09-01T12:00:00Z")], null, "fr", NOW);
    expect(line).toContain("mardi");
  });

  it("skips a visit that is already done", () => {
    const line = arrivalWindow(
      [
        visit("2026-09-01T12:00:00Z", null, { completedAt: "2026-09-01T15:00:00Z" }),
        visit("2026-09-04T13:00:00Z"),
      ],
      null,
      "en",
      NOW,
    );
    expect(line).toContain("Friday");
  });

  it("takes the earliest upcoming visit, not the first in the array", () => {
    const line = arrivalWindow(
      [visit("2026-09-10T12:00:00Z"), visit("2026-09-02T12:00:00Z")],
      null,
      "en",
      NOW,
    );
    expect(line).toContain("Wednesday");
  });

  it("gives the day alone for an all-day visit", () => {
    const line = arrivalWindow(
      [visit("2026-09-01T12:00:00Z", null, { allDay: true })],
      null,
      "en",
      NOW,
    );
    expect(line).not.toMatch(/\d:\d\d/);
  });

  it("falls back to the job's start date, in Montreal's zone", () => {
    // Parsed carelessly this renders as 31 August — the day before the job.
    const line = arrivalWindow([], "2026-09-01", "en", NOW);
    expect(line).toContain("September 1");
  });

  it("says so rather than inventing a time when nothing is booked", () => {
    expect(arrivalWindow([], null, "fr", NOW)).toBe("à confirmer");
    expect(arrivalWindow([], null, "en", NOW)).toBe("to be confirmed");
  });

  it("never returns something Meta would reject", () => {
    const line = arrivalWindow([visit("2026-09-01T12:00:00Z", "2026-09-01T14:00:00Z")], null, "fr", NOW);
    expect(line).not.toMatch(/[\r\n\t]/);
    expect(line).not.toMatch(/\s{2,}/);
  });
});
