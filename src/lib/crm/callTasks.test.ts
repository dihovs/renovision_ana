import { describe, expect, it } from "vitest";
import {
  CALLING_WINDOW,
  QUEBEC_STATUTORY_HOLIDAYS,
  canDialNow,
  mintCallSid,
  nextDialWindowOpening,
  quebecHolidayOn,
  torontoWall,
  torontoWallToUtc,
  type CallTask,
  type CallTaskClient,
} from "./callTasks";

/**
 * The eligibility rules are the only thing standing between this feature and a
 * regulator, so they are tested harder than anything else in the project.
 *
 * The recurring theme is Toronto's two annual offset changes. Every "is it nine
 * o'clock yet" question in here is asked in UTC, because that is what a cron
 * run actually holds, and the answers differ by an hour depending on the month.
 * A naive `now.getUTCHours() - 4` passes every summer test below and fails
 * every winter one — which is exactly the bug that would put Ana on someone's
 * phone at eight in the morning, five months a year, for years, unnoticed.
 *
 * Reference points used throughout (all verified against the tz database):
 *   EST = UTC-5, EDT = UTC-4
 *   2026-03-08 — spring forward (a Sunday, so never dialable anyway)
 *   2026-11-01 — fall back (also a Sunday)
 *   Mon 2026-03-02 is EST; Mon 2026-03-09 is EDT
 *   Mon 2026-10-26 is EDT; Mon 2026-11-02 is EST
 */

const at = (iso: string) => new Date(iso);

function task(overrides: Partial<CallTask> = {}): CallTask {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    created_at: "2026-07-01T12:00:00Z",
    updated_at: "2026-07-01T12:00:00Z",
    kind: "confirm_visit",
    visit_id: null,
    job_id: null,
    client_id: "22222222-2222-2222-2222-222222222222",
    to_number: "+15145550188",
    locale: "fr",
    payload: {},
    status: "queued",
    not_before: "2026-07-01T12:00:00Z",
    attempts: 0,
    max_attempts: 3,
    last_attempt_at: null,
    call_sid: "task_deadbeef",
    conversation_id: null,
    outcome: null,
    outcome_detail: {},
    completed_at: null,
    error: null,
    ...overrides,
  };
}

const reachable: CallTaskClient = { id: "c1", do_not_call: false };

// A plain Wednesday in July, 14:00 in Toronto. The control case.
const NORMAL = at("2026-07-08T18:00:00Z");

describe("torontoWall", () => {
  it("reads an instant as a Toronto wall clock in winter (EST)", () => {
    const wall = torontoWall(at("2026-03-02T14:00:00Z"));
    expect(wall.dateKey).toBe("2026-03-02");
    expect(wall.hour).toBe(9);
    expect(wall.minutesOfDay).toBe(540);
    expect(wall.weekday).toBe(1); // Monday
  });

  it("reads the same UTC hour an hour later in summer (EDT)", () => {
    const wall = torontoWall(at("2026-07-06T14:00:00Z"));
    expect(wall.hour).toBe(10);
    expect(wall.weekday).toBe(1);
  });

  it("rolls the calendar day back for a late-evening Toronto instant", () => {
    // 2026-07-07T02:00Z is still Monday the 6th, 22:00, in Toronto.
    const wall = torontoWall(at("2026-07-07T02:00:00Z"));
    expect(wall.dateKey).toBe("2026-07-06");
    expect(wall.weekday).toBe(1);
  });

  it("round-trips through torontoWallToUtc on both sides of the spring change", () => {
    for (const iso of ["2026-03-02T14:00:00Z", "2026-03-09T13:00:00Z", "2026-11-02T14:00:00Z"]) {
      const wall = torontoWall(at(iso));
      expect(torontoWallToUtc(wall).toISOString()).toBe(iso.replace("Z", ".000Z"));
    }
  });

  it("settles a wall time that does not exist rather than throwing", () => {
    // 02:30 on 2026-03-08 never happens in Toronto — the clock goes 01:59 EST
    // to 03:00 EDT. Guess-and-correct lands on 01:30 EST. Pinned here because
    // it is behaviour, not an accident, and because nothing in the calling
    // window ever asks for a skipped hour: 09:00, 10:00, 17:00 and 20:00 all
    // exist on every day Toronto has ever had.
    const resolved = torontoWallToUtc({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 });
    const wall = torontoWall(resolved);
    expect(wall.dateKey).toBe("2026-03-08");
    expect(wall.hour).toBe(1);
    expect(wall.minute).toBe(30);
  });
});

describe("the calling window is a named table, not scattered literals", () => {
  it("never opens on Sunday", () => {
    expect(CALLING_WINDOW[0]).toBeNull();
  });

  it("runs 09:00-20:00 Monday to Friday", () => {
    for (const day of [1, 2, 3, 4, 5]) {
      expect(CALLING_WINDOW[day]).toEqual({ open: 540, close: 1200 });
    }
  });

  it("runs 10:00-17:00 on Saturday", () => {
    expect(CALLING_WINDOW[6]).toEqual({ open: 600, close: 1020 });
  });

  it("stays inside the CRTC maximum (09:00-21:30 weekdays, 10:00-18:00 weekends)", () => {
    // The house window is deliberately tighter than the law. If someone widens
    // it past the legal maximum, that is not a preference change.
    for (const day of [1, 2, 3, 4, 5]) {
      const window = CALLING_WINDOW[day]!;
      expect(window.open).toBeGreaterThanOrEqual(9 * 60);
      expect(window.close).toBeLessThanOrEqual(21 * 60 + 30);
    }
    const saturday = CALLING_WINDOW[6]!;
    expect(saturday.open).toBeGreaterThanOrEqual(10 * 60);
    expect(saturday.close).toBeLessThanOrEqual(18 * 60);
  });
});

describe("Quebec statutory holidays", () => {
  const holidayOn = (dateKey: string) =>
    quebecHolidayOn({ year: Number(dateKey.slice(0, 4)), dateKey });

  it("resolves the 2026 table", () => {
    expect(holidayOn("2026-01-01")).toBe("Jour de l'An");
    expect(holidayOn("2026-04-03")).toBe("Vendredi saint");
    expect(holidayOn("2026-04-06")).toBe("Lundi de Pâques");
    expect(holidayOn("2026-05-18")).toBe("Journée nationale des patriotes");
    expect(holidayOn("2026-06-24")).toBe("Fête nationale du Québec");
    expect(holidayOn("2026-07-01")).toBe("Fête du Canada");
    expect(holidayOn("2026-09-07")).toBe("Fête du Travail");
    expect(holidayOn("2026-10-12")).toBe("Action de grâce");
    expect(holidayOn("2026-12-25")).toBe("Noël");
  });

  it("tracks Easter into other years rather than hard-coding dates", () => {
    // Easter Sunday 2027 is 28 March; 2025 was 20 April.
    expect(holidayOn("2027-03-26")).toBe("Vendredi saint");
    expect(holidayOn("2027-03-29")).toBe("Lundi de Pâques");
    expect(holidayOn("2025-04-18")).toBe("Vendredi saint");
    expect(holidayOn("2025-04-21")).toBe("Lundi de Pâques");
  });

  it("puts the patriotes on the Monday BEFORE 25 May, even when the 25th is itself a Monday", () => {
    expect(holidayOn("2026-05-18")).toBe("Journée nationale des patriotes"); // 25 May 2026 is a Monday
    expect(holidayOn("2027-05-24")).toBe("Journée nationale des patriotes"); // 25 May 2027 is a Tuesday
    expect(holidayOn("2026-05-25")).toBeNull();
  });

  it("leaves Boxing Day and 2 January alone — they are not statutory in Quebec", () => {
    expect(holidayOn("2026-12-26")).toBeNull();
    expect(holidayOn("2026-01-02")).toBeNull();
  });

  it("says nothing about an ordinary Wednesday", () => {
    expect(holidayOn("2026-07-08")).toBeNull();
  });

  it("keeps the table small and named", () => {
    expect(QUEBEC_STATUTORY_HOLIDAYS).toHaveLength(9);
    for (const entry of QUEBEC_STATUTORY_HOLIDAYS) expect(entry.name.length).toBeGreaterThan(0);
  });
});

describe("canDialNow — the refusals", () => {
  it("allows a plain weekday afternoon", () => {
    expect(canDialNow(task(), reachable, NORMAL)).toEqual({ ok: true });
  });

  it("refuses anyone on the do-not-call list, whatever else is true", () => {
    const verdict = canDialNow(task(), { id: "c1", do_not_call: true }, NORMAL);
    expect(verdict).toEqual({ ok: false, reason: "do_not_call" });
  });

  it("puts do_not_call ahead of every other refusal", () => {
    // Sunday, on a holiday, out of attempts, already called — still the flag.
    const verdict = canDialNow(
      task({ attempts: 3, last_attempt_at: "2025-12-25T15:00:00Z" }),
      { id: "c1", do_not_call: true },
      at("2025-12-25T15:00:00Z"),
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe("do_not_call");
  });

  it("refuses once attempts are spent", () => {
    const verdict = canDialNow(task({ attempts: 3, max_attempts: 3 }), reachable, NORMAL);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe("attempts_exhausted");
  });

  it("allows the last permitted attempt", () => {
    expect(canDialNow(task({ attempts: 2, max_attempts: 3 }), reachable, NORMAL).ok).toBe(true);
  });

  it("respects a max_attempts the row overrode", () => {
    expect(canDialNow(task({ attempts: 1, max_attempts: 1 }), reachable, NORMAL).ok).toBe(false);
  });

  it("refuses a second attempt on the same Toronto calendar day", () => {
    const verdict = canDialNow(
      task({ last_attempt_at: "2026-07-08T13:30:00Z" }), // 09:30 EDT, same day
      reachable,
      NORMAL,
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe("already_attempted_today");
  });

  it("counts an attempt made against ANOTHER task for the same customer", () => {
    const verdict = canDialNow(
      task({ last_attempt_at: null }),
      { id: "c1", do_not_call: false, last_attempt_at: "2026-07-08T13:30:00Z" },
      NORMAL,
    );
    expect(verdict.ok === false && verdict.reason).toBe("already_attempted_today");
  });

  it("allows the next morning even though only fourteen hours have passed", () => {
    // Monday 19:00 EDT, then Tuesday 09:00 EDT. A 24-hour rule would refuse
    // this; the rule is one call per calendar day, which is what a customer
    // actually experiences.
    const verdict = canDialNow(
      task({ last_attempt_at: "2026-07-06T23:00:00Z" }),
      reachable,
      at("2026-07-07T13:00:00Z"),
    );
    expect(verdict).toEqual({ ok: true });
  });

  it("still refuses when the two attempts land on different UTC days but the same Toronto day", () => {
    // 2026-07-06 19:30 EDT (23:30Z Monday) then 20:30 EDT (00:30Z Tuesday).
    // A UTC-day comparison would call that a new day and allow a second ring.
    const verdict = canDialNow(
      task({ last_attempt_at: "2026-07-06T23:30:00Z" }),
      reachable,
      at("2026-07-07T00:30:00Z"),
    );
    expect(verdict.ok === false && verdict.reason).toBe("already_attempted_today");
  });

  it("ignores an unparseable last_attempt_at rather than blocking forever", () => {
    expect(canDialNow(task({ last_attempt_at: "not a date" }), reachable, NORMAL).ok).toBe(true);
  });

  it("refuses on a statutory holiday even at a perfectly civilised hour", () => {
    // Christmas Day 2026 is a Friday, 14:00 EST.
    const verdict = canDialNow(task(), reachable, at("2026-12-25T19:00:00Z"));
    expect(verdict).toEqual({ ok: false, reason: "statutory_holiday", detail: "Noël" });
  });

  it("names the holiday rather than reporting closed hours", () => {
    const verdict = canDialNow(task(), reachable, at("2026-06-24T18:00:00Z"));
    expect(verdict.ok === false && verdict.detail).toBe("Fête nationale du Québec");
  });

  it("never calls on a Sunday", () => {
    // Sunday 2026-07-12, 14:00 EDT — mid-afternoon and still refused.
    const verdict = canDialNow(task(), reachable, at("2026-07-12T18:00:00Z"));
    expect(verdict.ok === false && verdict.reason).toBe("outside_calling_hours");
  });

  it("tolerates a task with no client record on file", () => {
    expect(canDialNow(task({ client_id: null }), null, NORMAL)).toEqual({ ok: true });
  });
});

describe("canDialNow — the window edges, in Toronto local time", () => {
  it("opens at 09:00 on a weekday and not a minute before", () => {
    expect(canDialNow(task(), reachable, at("2026-07-08T12:59:00Z")).ok).toBe(false); // 08:59
    expect(canDialNow(task(), reachable, at("2026-07-08T13:00:00Z")).ok).toBe(true); // 09:00
  });

  it("closes at 20:00 — the boundary minute is already too late", () => {
    expect(canDialNow(task(), reachable, at("2026-07-08T23:59:00Z")).ok).toBe(true); // 19:59
    expect(canDialNow(task(), reachable, at("2026-07-09T00:00:00Z")).ok).toBe(false); // 20:00
  });

  it("uses the shorter Saturday window", () => {
    // Saturday 2026-07-11 (EDT).
    expect(canDialNow(task(), reachable, at("2026-07-11T13:30:00Z")).ok).toBe(false); // 09:30
    expect(canDialNow(task(), reachable, at("2026-07-11T14:00:00Z")).ok).toBe(true); // 10:00
    expect(canDialNow(task(), reachable, at("2026-07-11T20:59:00Z")).ok).toBe(true); // 16:59
    expect(canDialNow(task(), reachable, at("2026-07-11T21:00:00Z")).ok).toBe(false); // 17:00
  });
});

describe("canDialNow — DST, the bug a UTC comparison hides", () => {
  it("opens at 14:00Z in winter and 13:00Z in summer", () => {
    // Monday 2026-03-02, EST (UTC-5): 09:00 local is 14:00Z.
    expect(canDialNow(task(), reachable, at("2026-03-02T13:00:00Z")).ok).toBe(false); // 08:00 EST
    expect(canDialNow(task(), reachable, at("2026-03-02T14:00:00Z")).ok).toBe(true); // 09:00 EST

    // Monday 2026-03-09, one week later and EDT (UTC-4): 09:00 local is 13:00Z.
    expect(canDialNow(task(), reachable, at("2026-03-09T12:59:00Z")).ok).toBe(false); // 08:59 EDT
    expect(canDialNow(task(), reachable, at("2026-03-09T13:00:00Z")).ok).toBe(true); // 09:00 EDT
  });

  it("shifts back an hour after the November change", () => {
    // Monday 2026-10-26, EDT: 09:00 local is 13:00Z.
    expect(canDialNow(task(), reachable, at("2026-10-26T13:00:00Z")).ok).toBe(true);
    // Monday 2026-11-02, EST: the same 13:00Z is now 08:00 local.
    expect(canDialNow(task(), reachable, at("2026-11-02T13:00:00Z")).ok).toBe(false);
    expect(canDialNow(task(), reachable, at("2026-11-02T14:00:00Z")).ok).toBe(true);
  });

  it("closes at 20:00 local on both sides of the November change", () => {
    // EDT: 20:00 local on Mon 2026-10-26 is 2026-10-27T00:00Z.
    expect(canDialNow(task(), reachable, at("2026-10-26T23:59:00Z")).ok).toBe(true);
    expect(canDialNow(task(), reachable, at("2026-10-27T00:00:00Z")).ok).toBe(false);
    // EST: 20:00 local on Mon 2026-11-02 is 2026-11-03T01:00Z.
    expect(canDialNow(task(), reachable, at("2026-11-03T00:59:00Z")).ok).toBe(true);
    expect(canDialNow(task(), reachable, at("2026-11-03T01:00:00Z")).ok).toBe(false);
  });

  it("keeps the calendar-day rule honest across the fall-back weekend", () => {
    // Saturday 2026-10-31 at 15:00 EDT, then Monday 2026-11-02 at 10:00 EST.
    // Two Toronto days apart, and 43 hours of wall clock over a 25-hour Sunday.
    const verdict = canDialNow(
      task({ last_attempt_at: "2026-10-31T19:00:00Z" }),
      reachable,
      at("2026-11-02T15:00:00Z"),
    );
    expect(verdict).toEqual({ ok: true });
  });

  it("does not let the spring-forward hour create a phantom second call", () => {
    // Attempt at 2026-03-09 09:30 EDT; re-checked at 15:00 EDT the same day.
    const verdict = canDialNow(
      task({ last_attempt_at: "2026-03-09T13:30:00Z" }),
      reachable,
      at("2026-03-09T19:00:00Z"),
    );
    expect(verdict.ok === false && verdict.reason).toBe("already_attempted_today");
  });
});

describe("nextDialWindowOpening", () => {
  const wallOf = (d: Date) => torontoWall(d);

  it("returns now when the window is already open", () => {
    expect(nextDialWindowOpening(NORMAL).toISOString()).toBe(NORMAL.toISOString());
  });

  it("jumps to 09:00 for an overnight instant", () => {
    // Thursday 2026-07-09 at 03:00 EDT.
    const opening = wallOf(nextDialWindowOpening(at("2026-07-09T07:00:00Z")));
    expect(opening.dateKey).toBe("2026-07-09");
    expect(opening.hour).toBe(9);
  });

  it("skips Sunday entirely", () => {
    // Saturday 2026-07-11 at 18:00 EDT — after the 17:00 close.
    const opening = wallOf(nextDialWindowOpening(at("2026-07-11T22:00:00Z")));
    expect(opening.dateKey).toBe("2026-07-13"); // Monday
    expect(opening.hour).toBe(9);
  });

  it("skips a statutory holiday", () => {
    // Christmas Day 2026 is a Friday; Saturday the 26th is not statutory here.
    const opening = wallOf(nextDialWindowOpening(at("2026-12-25T12:00:00Z")));
    expect(opening.dateKey).toBe("2026-12-26");
    expect(opening.hour).toBe(10); // Saturday opens later
  });

  it("skips the rest of today when asked", () => {
    // Mid-Wednesday-afternoon, but the customer has already been called.
    const opening = wallOf(nextDialWindowOpening(NORMAL, true));
    expect(opening.dateKey).toBe("2026-07-09");
    expect(opening.hour).toBe(9);
  });

  it("lands on 09:00 local, not 09:00 UTC-minus-four, in winter", () => {
    const opening = nextDialWindowOpening(at("2026-01-06T06:00:00Z")); // Tue 01:00 EST
    expect(opening.toISOString()).toBe("2026-01-06T14:00:00.000Z");
    expect(wallOf(opening).hour).toBe(9);
  });

  it("always returns an instant that canDialNow accepts", () => {
    for (const iso of [
      "2026-01-01T03:00:00Z", // New Year's Day
      "2026-03-08T08:00:00Z", // spring-forward Sunday
      "2026-07-11T22:00:00Z", // Saturday evening
      "2026-11-01T05:30:00Z", // fall-back Sunday, inside the repeated hour
      "2026-12-25T23:00:00Z", // Christmas night
    ]) {
      const opening = nextDialWindowOpening(at(iso));
      expect(canDialNow(task(), reachable, opening), iso).toEqual({ ok: true });
    }
  });
});

describe("mintCallSid", () => {
  it("is unmistakably ours and never a Twilio SID", () => {
    const sid = mintCallSid();
    expect(sid).toMatch(/^task_[0-9a-f]{32}$/);
    expect(sid.startsWith("CA")).toBe(false);
  });

  it("is unique", () => {
    const seen = new Set(Array.from({ length: 500 }, mintCallSid));
    expect(seen.size).toBe(500);
  });
});
