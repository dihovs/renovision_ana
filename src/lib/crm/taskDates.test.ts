import { describe, expect, it } from "vitest";
import { describeDue, parseTaskInput } from "./taskDates";

/**
 * A Thursday, chosen so weekday arithmetic has somewhere to wrap in both
 * directions, and mid-month so "aug 14" is in the past and "aug 20" is not.
 */
const THURSDAY = "2026-08-13";

describe("parseTaskInput", () => {
  it("keeps a plain note whole", () => {
    expect(parseTaskInput("order the membrane", THURSDAY)).toEqual({
      body: "order the membrane",
      dueDate: null,
    });
  });

  it("reads a weekday introduced by a preposition", () => {
    expect(parseTaskInput("order the membrane for thursday", THURSDAY)).toEqual({
      body: "order the membrane",
      dueDate: "2026-08-20",
    });
  });

  it("treats today's weekday as the next one, not today", () => {
    // Said on a Thursday, "Thursday" is the one coming. Today is half spent.
    expect(parseTaskInput("call the adjuster for thursday", THURSDAY).dueDate).toBe("2026-08-20");
  });

  it("wraps to the following week", () => {
    expect(parseTaskInput("invoice Gestion Ajax for monday", THURSDAY).dueDate).toBe("2026-08-17");
  });

  it("does NOT read a weekday that is part of a name", () => {
    // The failure this whole gate exists for: "Monday Plumbing" is a company.
    expect(parseTaskInput("call Monday Plumbing about the leak monday", THURSDAY)).toEqual({
      body: "call Monday Plumbing about the leak monday",
      dueDate: null,
    });
  });

  it("still reads today and tomorrow without a preposition", () => {
    expect(parseTaskInput("pick up the dehumidifier tomorrow", THURSDAY)).toEqual({
      body: "pick up the dehumidifier",
      dueDate: "2026-08-14",
    });
    expect(parseTaskInput("send the quote today", THURSDAY).dueDate).toBe(THURSDAY);
  });

  it("reads an ISO date without a preposition", () => {
    expect(parseTaskInput("renew the insurance 2026-09-01", THURSDAY)).toEqual({
      body: "renew the insurance",
      dueDate: "2026-09-01",
    });
  });

  it("rejects an ISO date that is not a real day", () => {
    expect(parseTaskInput("check this 2026-02-31", THURSDAY).dueDate).toBeNull();
  });

  it("reads month-and-day in either order", () => {
    expect(parseTaskInput("deposit for aug 20", THURSDAY).dueDate).toBe("2026-08-20");
    expect(parseTaskInput("depot pour 20 aout", THURSDAY).dueDate).toBe("2026-08-20");
  });

  it("rolls a month-day that has already passed into next year", () => {
    // Typed on 13 August, "aug 1" means next August, not twelve days ago.
    expect(parseTaskInput("annual review for aug 1", THURSDAY).dueDate).toBe("2027-08-01");
  });

  it("accepts an explicit year", () => {
    expect(parseTaskInput("renew the plates for march 3 2027", THURSDAY).dueDate).toBe("2027-03-03");
  });

  it("accepts an ordinal day", () => {
    expect(parseTaskInput("call back for august 20th", THURSDAY).dueDate).toBe("2026-08-20");
  });

  it("understands French", () => {
    expect(parseTaskInput("commander la membrane pour jeudi", THURSDAY)).toEqual({
      body: "commander la membrane",
      dueDate: "2026-08-20",
    });
    expect(parseTaskInput("rappeler le client demain", THURSDAY).dueDate).toBe("2026-08-14");
    expect(parseTaskInput("finir le rapport aujourd'hui", THURSDAY).dueDate).toBe(THURSDAY);
  });

  it("folds accents, because the phone keyboard drops them", () => {
    expect(parseTaskInput("livraison pour 20 aout", THURSDAY).dueDate).toBe("2026-08-20");
    expect(parseTaskInput("livraison pour 20 août", THURSDAY).dueDate).toBe("2026-08-20");
  });

  it("reads 'next thursday' as the next one, not the one after", () => {
    // Skipping a week here would be the kind of wrong nobody notices until
    // they miss the delivery.
    expect(parseTaskInput("delivery for next thursday", THURSDAY).dueDate).toBe("2026-08-20");
    expect(parseTaskInput("livraison pour jeudi prochain", THURSDAY).dueDate).toBe("2026-08-20");
  });

  it("never returns an empty body", () => {
    // "thursday" alone is a task called Thursday. Saving a date with no note
    // would put a blank row on the list, and the column rejects it anyway.
    expect(parseTaskInput("thursday", THURSDAY)).toEqual({ body: "thursday", dueDate: null });
    expect(parseTaskInput("for thursday", THURSDAY)).toEqual({
      body: "for thursday",
      dueDate: null,
    });
  });

  it("trims the punctuation the preposition leaves behind", () => {
    expect(parseTaskInput("order the trim - for monday", THURSDAY)).toEqual({
      body: "order the trim",
      dueDate: "2026-08-17",
    });
  });

  it("handles empty and whitespace input", () => {
    expect(parseTaskInput("", THURSDAY)).toEqual({ body: "", dueDate: null });
    expect(parseTaskInput("   ", THURSDAY)).toEqual({ body: "", dueDate: null });
  });

  it("prefers the longest match", () => {
    // "14 august" must win over the bare "august", which would otherwise leave
    // a stray "14" on the end of the note.
    expect(parseTaskInput("membrane for 14 august", THURSDAY)).toEqual({
      body: "membrane",
      dueDate: "2026-08-14",
    });
  });
});

describe("describeDue", () => {
  it("names today and tomorrow", () => {
    expect(describeDue(THURSDAY, THURSDAY).label).toBe("Today");
    expect(describeDue("2026-08-14", THURSDAY).label).toBe("Tomorrow");
  });

  it("flags anything earlier as overdue", () => {
    expect(describeDue("2026-08-12", THURSDAY)).toEqual({ label: "Overdue", overdue: true });
  });

  it("uses the weekday within the week and a date beyond it", () => {
    expect(describeDue("2026-08-17", THURSDAY).label).toBe("Monday");
    expect(describeDue("2026-09-30", THURSDAY).label).toMatch(/Sep/);
  });

  it("answers in French when asked", () => {
    expect(describeDue(THURSDAY, THURSDAY, "fr").label).toBe("Aujourd'hui");
    expect(describeDue("2026-08-12", THURSDAY, "fr").overdue).toBe(true);
  });

  it("is not overdue on the due date itself", () => {
    // The one off-by-one that matters: a task due today must not read red.
    expect(describeDue(THURSDAY, THURSDAY).overdue).toBe(false);
  });
});
