import { describe, expect, it } from "vitest";
import {
  calculateLivingArea,
  roomTypeRule,
  DEFAULT_LIVING_AREA_CONFIG,
  MIN_LIVING_HEIGHT_M,
  ROOM_TYPES,
  type LivingAreaRoom,
} from "./livingArea";

/**
 * Living area decides money — coverage limits and appraised value are quoted
 * per square foot of it. The failure that matters is a figure that looks
 * plausible and is wrong, because that one survives review and then loses an
 * argument with an adjuster.
 */

const room = (over: Partial<LivingAreaRoom> = {}): LivingAreaRoom => ({
  id: "r1",
  name: "Room",
  floorAreaSqm: 20,
  ceilingHeightM: 2.5,
  roomType: "bedroom",
  livingPercent: null,
  ...over,
});

describe("the seven-foot rule", () => {
  it("uses ANSI Z765's threshold exactly", () => {
    // Seven feet. Not "about seven" — the standard is cited by name in
    // appraisals and the number has to match it.
    expect(MIN_LIVING_HEIGHT_M).toBeCloseTo(7 * 0.3048, 4);
    expect(DEFAULT_LIVING_AREA_CONFIG.minHeightM).toBe(MIN_LIVING_HEIGHT_M);
  });

  it("takes a low room to zero rather than discounting it", () => {
    // Height is a gate, not a slider: a five-foot crawl space is no living
    // area at all, not 70% of some.
    const result = calculateLivingArea([room({ ceilingHeightM: 1.5 })]);
    expect(result.aboveGradeSqm).toBe(0);
    expect(result.rooms[0].belowMinHeight).toBe(true);
    expect(result.rooms[0].percentApplied).toBe(0);
  });

  it("counts a room exactly at the threshold", () => {
    const result = calculateLivingArea([room({ ceilingHeightM: MIN_LIVING_HEIGHT_M })]);
    expect(result.aboveGradeSqm).toBeCloseTo(20, 6);
  });

  it("does not punish a room whose height was never measured", () => {
    // Missing information is not disqualifying information. Treating an
    // unmeasured ceiling as a failure would quietly delete real living area.
    const result = calculateLivingArea([room({ ceilingHeightM: 0 })]);
    expect(result.aboveGradeSqm).toBeCloseTo(20, 6);
    expect(result.rooms[0].belowMinHeight).toBe(false);
  });
});

describe("grade bands", () => {
  it("never folds a basement into above-grade area", () => {
    // The single most common way a living-area figure gets challenged.
    const result = calculateLivingArea([
      room({ id: "a", floorAreaSqm: 100, roomType: "bedroom" }),
      room({ id: "b", floorAreaSqm: 80, roomType: "basement_finished" }),
    ]);
    expect(result.aboveGradeSqm).toBeCloseTo(100, 6);
    expect(result.belowGradeSqm).toBeCloseTo(80, 6);
    expect(result.totalSqm).toBeCloseTo(180, 6);
  });

  it("counts an unfinished basement as nothing, in either band", () => {
    const result = calculateLivingArea([room({ roomType: "basement" })]);
    expect(result.aboveGradeSqm).toBe(0);
    expect(result.belowGradeSqm).toBe(0);
  });

  it("excludes unheated and unenclosed space", () => {
    for (const type of ["garage", "balcony", "crawlspace"]) {
      const result = calculateLivingArea([room({ roomType: type })]);
      expect(result.totalSqm, type).toBe(0);
      expect(result.rooms[0].band, type).toBe("excluded");
    }
  });
});

describe("overrides", () => {
  it("lets a hand-set percentage beat the type default", () => {
    // A walk-out basement, a converted porch — the standard leaves real
    // judgement calls to the person in the building.
    const result = calculateLivingArea([
      room({ floorAreaSqm: 50, roomType: "porch", livingPercent: 100 }),
    ]);
    // Still excluded by band: a percentage cannot promote unenclosed space
    // into living area on its own.
    expect(result.totalSqm).toBe(0);

    const partial = calculateLivingArea([
      room({ floorAreaSqm: 50, roomType: "bedroom", livingPercent: 50 }),
    ]);
    expect(partial.aboveGradeSqm).toBeCloseTo(25, 6);
  });

  it("clamps a nonsense percentage instead of trusting it", () => {
    const high = calculateLivingArea([room({ floorAreaSqm: 40, livingPercent: 400 })]);
    expect(high.aboveGradeSqm).toBeCloseTo(40, 6);
    const low = calculateLivingArea([room({ floorAreaSqm: 40, livingPercent: -20 })]);
    expect(low.aboveGradeSqm).toBe(0);
  });

  it("falls back to the type default when no override is set", () => {
    const result = calculateLivingArea([room({ roomType: "bedroom", livingPercent: null })]);
    expect(result.rooms[0].percentApplied).toBe(100);
  });
});

describe("what did not count", () => {
  it("accounts for every square metre, so the gap is explainable", () => {
    // Floor area minus living area must never be a mystery an adjuster has
    // to reconcile on their own.
    const rooms = [
      room({ id: "a", floorAreaSqm: 100, roomType: "bedroom" }),
      room({ id: "b", floorAreaSqm: 30, roomType: "garage" }),
      room({ id: "c", floorAreaSqm: 20, roomType: "bedroom", livingPercent: 50 }),
    ];
    const result = calculateLivingArea(rooms);
    const floorTotal = rooms.reduce((sum, r) => sum + r.floorAreaSqm, 0);
    expect(result.totalSqm + result.excludedSqm).toBeCloseTo(floorTotal, 6);
    expect(result.excludedSqm).toBeCloseTo(40, 6); // the garage, plus half of c
  });

  it("handles a property with nothing measured yet", () => {
    const result = calculateLivingArea([]);
    expect(result).toMatchObject({ aboveGradeSqm: 0, belowGradeSqm: 0, totalSqm: 0 });
    expect(result.rooms).toEqual([]);
  });
});

describe("the room type table", () => {
  it("gives an unknown type a defined fallback rather than crashing", () => {
    // Old rows, or a type deleted from the table, must still measure.
    const rule = roomTypeRule("something-nobody-defined");
    expect(rule.id).toBe("other");
    expect(rule.percent).toBe(100);
  });

  it("has a unique id for every type", () => {
    const ids = ROOM_TYPES.map((type) => type.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("explains every type that counts nothing", () => {
    // A zero with no reason beside it reads as a bug, and somebody will
    // "fix" it by overriding the percentage.
    for (const type of ROOM_TYPES.filter((t) => t.percent === 0 || t.band === "excluded")) {
      expect(type.note, type.label).toBeTruthy();
    }
  });
});
