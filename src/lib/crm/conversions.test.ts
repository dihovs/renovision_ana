import { describe, expect, it } from "vitest";
import {
  ARRIVAL_WINDOW,
  ConversionRefused,
  conversionError,
  isConversionRefused,
  isDuplicateKey,
  isMissingColumn,
  nextWorkingDay,
  nextWorkingDayWindow,
  refuse,
} from "./conversions";

/**
 * The pure half of the conversion chain: the default the one-click scheduler
 * books, and the error vocabulary every hop shares.
 *
 * The scheduling tests are wall-clock tests. Adding a day's worth of
 * milliseconds to an instant is right for ten months of the year, and the two
 * weeks where it is wrong are the two weeks a crew turns up an hour early.
 */

// Toronto is UTC-4 in August, UTC-5 in January, and switches on the second
// Sunday in March — 8 March 2026.
const FRIDAY_AUGUST = new Date("2026-08-07T16:00:00Z"); // Fri 7 Aug, 12:00 EDT
const SATURDAY_AUGUST = new Date("2026-08-08T16:00:00Z");
const SUNDAY_AUGUST = new Date("2026-08-02T16:00:00Z");
const FRIDAY_BEFORE_DST = new Date("2026-03-06T17:00:00Z"); // Fri 6 Mar, 12:00 EST

describe("nextWorkingDay", () => {
  it("skips the weekend from a Friday", () => {
    expect(nextWorkingDay(FRIDAY_AUGUST)).toEqual({ year: 2026, month: 8, day: 10 });
  });

  it("skips the weekend from a Saturday", () => {
    expect(nextWorkingDay(SATURDAY_AUGUST)).toEqual({ year: 2026, month: 8, day: 10 });
  });

  it("skips the weekend from a Sunday", () => {
    expect(nextWorkingDay(SUNDAY_AUGUST)).toEqual({ year: 2026, month: 8, day: 3 });
  });

  it("is tomorrow, never today — 'next working day' said on a Tuesday morning is Wednesday", () => {
    const tuesdayMorning = new Date("2026-08-04T11:00:00Z"); // 07:00 EDT
    expect(nextWorkingDay(tuesdayMorning)).toEqual({ year: 2026, month: 8, day: 5 });
  });

  it("rolls the month and the year over", () => {
    // Thursday 31 December 2026 → Friday 1 January 2027. A statutory holiday,
    // and deliberately not skipped: see the comment on nextWorkingDay.
    expect(nextWorkingDay(new Date("2026-12-31T17:00:00Z"))).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
  });

  it("reads the Toronto date, not the UTC one — a Friday evening is not yet Saturday here", () => {
    // 23:00 EDT on Friday 7 August is already Saturday 02:00 in UTC. Reading
    // the UTC date would call it a Saturday and skip a day.
    expect(nextWorkingDay(new Date("2026-08-08T03:00:00Z"))).toEqual({
      year: 2026,
      month: 8,
      day: 10,
    });
  });
});

describe("nextWorkingDayWindow", () => {
  it("books the standard morning arrival window", () => {
    const window = nextWorkingDayWindow(FRIDAY_AUGUST);
    // 08:00 and 12:00 EDT on Monday 10 August.
    expect(window.startsAt).toBe("2026-08-10T12:00:00.000Z");
    expect(window.endsAt).toBe("2026-08-10T16:00:00.000Z");
  });

  it("crosses the spring clock change without moving the wall time", () => {
    // Friday 6 March is EST; the Monday it lands on is EDT. The instant has to
    // shift by an hour so that BOTH read 08:00 on a Toronto clock.
    const window = nextWorkingDayWindow(FRIDAY_BEFORE_DST);
    expect(window.startsAt).toBe("2026-03-09T12:00:00.000Z");

    const wall = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(window.startsAt));
    expect(wall).toBe("08:00");
  });

  it("is a window, not an appointment", () => {
    const window = nextWorkingDayWindow(FRIDAY_AUGUST);
    const hours =
      (new Date(window.endsAt).getTime() - new Date(window.startsAt).getTime()) / 3_600_000;
    expect(hours).toBe(ARRIVAL_WINDOW.endHour - ARRIVAL_WINDOW.startHour);
    expect(hours).toBeGreaterThan(1);
  });
});

describe("ConversionRefused", () => {
  it("carries its reason and its sentence", () => {
    const err = new ConversionRefused("already_converted", "Quote already became job #1042.");
    expect(err.refusal).toBe("already_converted");
    expect(err.message).toBe("Quote already became job #1042.");
    expect(isConversionRefused(err)).toBe(true);
    expect(isConversionRefused(new Error("boom"))).toBe(false);
  });

  it("refuse() throws it", () => {
    expect(() => refuse("nothing_to_bill", "There is nothing to bill.")).toThrow(ConversionRefused);
  });
});

describe("conversionError", () => {
  it("passes a refusal's own words straight through", () => {
    let thrown: unknown;
    try {
      refuse("wrong_status", "Job #12 was cancelled.");
    } catch (err) {
      thrown = err;
    }
    expect(conversionError(thrown, "Could not do the thing.")).toEqual({
      error: "Job #12 was cancelled.",
    });
  });

  it("falls back to something readable when the failure has no message", () => {
    expect(conversionError({}, "Could not create the invoice.")).toEqual({
      error: "Could not create the invoice.",
    });
  });
});

describe("isDuplicateKey", () => {
  it("recognises a unique violation by code and by message", () => {
    expect(isDuplicateKey({ code: "23505", message: "duplicate key value" })).toBe(true);
    expect(isDuplicateKey({ message: 'duplicate key value violates unique constraint "x"' })).toBe(
      true,
    );
  });

  it("does not mistake anything else for one", () => {
    expect(isDuplicateKey({ code: "42P01", message: "relation does not exist" })).toBe(false);
    expect(isDuplicateKey(null)).toBe(false);
    expect(isDuplicateKey("23505")).toBe(false);
  });
});

describe("isMissingColumn", () => {
  it("recognises a schema one migration behind", () => {
    expect(
      isMissingColumn({
        code: "PGRST204",
        message: "Could not find the 'lead_id' column of 'clients' in the schema cache",
      }),
    ).toBe(true);
    expect(isMissingColumn({ code: "42703" })).toBe(true);
  });

  it("does not swallow a missing table, which means something else entirely", () => {
    expect(isMissingColumn({ code: "PGRST205", message: "Could not find the table" })).toBe(false);
  });
});
