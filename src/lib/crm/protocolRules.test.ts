import { describe, expect, it } from "vitest";

import {
  MONITORING,
  checksFor,
  evaluate,
  outstanding,
  type ProtocolCheck,
  type StoredCheck,
} from "./protocolRules";

const ids = (checks: ProtocolCheck[]) => checks.map((c) => c.id);

describe("checksFor", () => {
  it("gives water on a floor the subfloor and room-below checks", () => {
    const got = ids(checksFor("water", "floor"));
    expect(got).toContain("water.subfloor");
    expect(got).toContain("water.below");
    // Cavity and the far face are wall problems and must not appear here.
    expect(got).not.toContain("water.cavity");
    expect(got).not.toContain("water.otherface");
  });

  it("gives water on a wall the cavity and far-face checks instead", () => {
    const got = ids(checksFor("water", "wall"));
    expect(got).toContain("water.cavity");
    expect(got).toContain("water.otherface");
    expect(got).toContain("water.wick");
    expect(got).not.toContain("water.subfloor");
  });

  it("finds the extent before responding to it", () => {
    // Order is part of the rule: a checklist that asks for the response
    // before the extent is one people scroll past.
    const got = ids(checksFor("water", "floor"));
    expect(got.indexOf("water.extent")).toBeLessThan(got.indexOf("water.reading"));
    expect(got.indexOf("water.source")).toBeLessThan(got.indexOf("water.extent"));
  });

  it("adds PPE and removal only once the category is 2 or 3", () => {
    expect(ids(checksFor("water", "floor"))).not.toContain("water.ppe");
    expect(ids(checksFor("water", "floor", { waterCategory: 1 }))).not.toContain("water.ppe");
    expect(ids(checksFor("water", "floor", { waterCategory: 2 }))).toContain("water.ppe");
    const cat3 = ids(checksFor("water", "floor", { waterCategory: 3 }));
    expect(cat3).toContain("water.ppe");
    expect(cat3).toContain("water.remove");
  });

  it("puts safety checks first even when their own table does not", () => {
    expect(ids(checksFor("mould", "wall"))[0]).toBe("mould.containment");
    expect(ids(checksFor("impact", "wall"))[0]).toBe("impact.services");
  });

  it("marks the safety checks as safety", () => {
    const containment = checksFor("mould", "wall").find((c) => c.id === "mould.containment");
    const services = checksFor("impact", "wall").find((c) => c.id === "impact.services");
    expect(containment?.safety).toBe(true);
    expect(services?.safety).toBe(true);
  });

  it("adds the water checks to a fire loss that was extinguished with water", () => {
    const dry = ids(checksFor("fire", "floor"));
    expect(dry).not.toContain("water.baseboard");

    const wet = ids(checksFor("fire", "floor", { fireAlsoWet: true }));
    expect(wet).toContain("fire.smokeline");
    expect(wet).toContain("water.baseboard");
    // The fire is why anybody is here, so its checks lead.
    expect(wet.indexOf("fire.smokeline")).toBeLessThan(wet.indexOf("water.baseboard"));
  });

  it("does not duplicate a check shared by both fire and water", () => {
    const wet = ids(checksFor("fire", "wall", { fireAlsoWet: true }));
    expect(new Set(wet).size).toBe(wet.length);
  });

  it("returns nothing for 'other'", () => {
    // The operator has already said this does not fit a category; inventing
    // checks would be guessing at work we cannot name.
    expect(checksFor("other", "floor")).toEqual([]);
  });

  it("never returns two checks with the same id", () => {
    for (const cause of ["water", "fire", "mould", "impact"] as const) {
      for (const surface of ["floor", "wall"] as const) {
        for (const ctx of [{}, { waterCategory: 3 as const }, { fireAlsoWet: true }]) {
          const got = ids(checksFor(cause, surface, ctx));
          expect(new Set(got).size, `${cause}/${surface}`).toBe(got.length);
        }
      }
    }
  });
});

describe("evaluate", () => {
  const today = "2026-08-22";

  it("ticks a derived check off the record, with no stored row", () => {
    const checks = checksFor("water", "floor");
    const states = evaluate(checks, { readingOnRoom: true }, [], today);
    const reading = states.find((s) => s.check.id === "water.reading");
    expect(reading?.status).toBe("done");
    expect(reading?.bySystem).toBe(true);
  });

  it("re-opens a derived check when the record behind it disappears", () => {
    // The whole reason derived completion is never stored: deleting the
    // reading has to un-tick the check, or the list and the job drift.
    const checks = checksFor("water", "floor");
    const withReading = evaluate(checks, { readingOnRoom: true }, [], today);
    const without = evaluate(checks, {}, [], today);
    expect(withReading.find((s) => s.check.id === "water.reading")?.status).toBe("done");
    expect(without.find((s) => s.check.id === "water.reading")?.status).toBe("open");
  });

  it("ignores a stored row that claims a derived check is done", () => {
    const checks = checksFor("water", "floor");
    const lying: StoredCheck[] = [{ checkId: "water.reading", status: "done" }];
    const states = evaluate(checks, {}, lying, today);
    expect(states.find((s) => s.check.id === "water.reading")?.status).toBe("open");
  });

  it("takes an explicit check from its stored row and keeps the reason", () => {
    const checks = checksFor("water", "floor");
    const stored: StoredCheck[] = [
      {
        checkId: "water.subfloor",
        status: "not_applicable",
        reason: "Not accessible without lifting finished hardwood",
      },
    ];
    const states = evaluate(checks, {}, stored, today);
    const subfloor = states.find((s) => s.check.id === "water.subfloor");
    expect(subfloor?.status).toBe("not_applicable");
    expect(subfloor?.reason).toBe("Not accessible without lifting finished hardwood");
    expect(subfloor?.bySystem).toBe(false);
  });

  it("resets a daily check when the stored row is for another day", () => {
    const yesterday: StoredCheck[] = [
      { checkId: "monitor.running", status: "done", appliesOn: "2026-08-21" },
    ];
    expect(
      evaluate(MONITORING, {}, yesterday, today).find((s) => s.check.id === "monitor.running")
        ?.status,
    ).toBe("open");
    expect(
      evaluate(
        MONITORING,
        {},
        [{ checkId: "monitor.running", status: "done", appliesOn: today }],
        today,
      ).find((s) => s.check.id === "monitor.running")?.status,
    ).toBe("done");
  });

  it("satisfies the daily reading from a reading taken today", () => {
    const states = evaluate(MONITORING, { readingOnRoomToday: true }, [], today);
    expect(states.find((s) => s.check.id === "monitor.daily")?.status).toBe("done");
  });

  it("returns one state per check, in the same order", () => {
    const checks = checksFor("water", "wall");
    const states = evaluate(checks, {}, [], today);
    expect(states.map((s) => s.check.id)).toEqual(ids(checks));
  });
});

describe("outstanding", () => {
  const today = "2026-08-22";

  it("names only what is still open", () => {
    const checks = checksFor("mould", "wall");
    const stored: StoredCheck[] = [{ checkId: "mould.containment", status: "done" }];
    const open = outstanding(evaluate(checks, { photoOnArea: true }, stored, today));
    const openIds = open.map((s) => s.check.id);
    expect(openIds).not.toContain("mould.containment");
    expect(openIds).not.toContain("mould.extent");
    expect(openIds).toContain("mould.source");
  });

  it("counts a dismissed check as settled, not outstanding", () => {
    // "No room below" is an answer, not an omission — and it is a fact the
    // report can print.
    const checks = checksFor("water", "floor");
    const stored: StoredCheck[] = [
      { checkId: "water.below", status: "not_applicable", reason: "No room below" },
    ];
    const open = outstanding(evaluate(checks, {}, stored, today)).map((s) => s.check.id);
    expect(open).not.toContain("water.below");
  });

  it("is empty when everything is settled", () => {
    const checks = checksFor("impact", "wall");
    const stored: StoredCheck[] = [
      { checkId: "impact.services", status: "done" },
      { checkId: "impact.structure", status: "done" },
    ];
    expect(outstanding(evaluate(checks, { photoOnArea: true }, stored, today))).toEqual([]);
  });
});
