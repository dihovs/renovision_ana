import { describe, expect, it } from "vitest";
import {
  formatFeetInches,
  makeRectangularRoom,
  parseFeetInches,
  validateDimension,
} from "./manualRoom";
import {
  squareMetersToSquareFeet,
  toFloorPlan,
  totalFloorAreaSquareMeters,
  totalWallLengthMeters,
  wallAreaSquareMeters,
} from "./roomScan";

/**
 * Rooms entered by hand.
 *
 * Two things must hold. The parser has to accept how a contractor actually
 * writes a measurement, because it is typed one-thumbed in a basement. And a
 * typed room has to behave like a scanned one everywhere downstream — the
 * moment it needs its own code path, every feature has to learn about two
 * kinds of room.
 */

describe("parseFeetInches", () => {
  it("reads plain feet", () => {
    expect(parseFeetInches("12")).toBeCloseTo(3.6576, 4);
  });

  it("reads decimal feet", () => {
    expect(parseFeetInches("12.5")).toBeCloseTo(3.81, 4);
  });

  it("reads feet and inches, however they are written", () => {
    const expected = 12.5 * 0.3048;
    for (const written of ["12'6", "12' 6", `12' 6"`, "12ft 6in", "12-6", "12’6”"]) {
      expect(parseFeetInches(written), written).toBeCloseTo(expected, 4);
    }
  });

  it("treats bare feet with a mark as feet", () => {
    expect(parseFeetInches("9'")).toBeCloseTo(2.7432, 4);
  });

  it("returns null for nothing usable", () => {
    for (const junk of ["", "   ", "abc", "'"]) {
      expect(parseFeetInches(junk), junk).toBeNull();
    }
  });
});

describe("formatFeetInches", () => {
  it("round-trips a typed measurement", () => {
    expect(formatFeetInches(parseFeetInches("12' 6")!)).toBe(`12' 6"`);
  });

  it("drops the inches when there are none", () => {
    expect(formatFeetInches(parseFeetInches("9")!)).toBe("9'");
  });
});

describe("validateDimension", () => {
  it("rejects a missing or impossible measurement", () => {
    expect(validateDimension(null)).toMatch(/Enter a measurement/);
    expect(validateDimension(0)).toMatch(/more than zero/);
    expect(validateDimension(-2)).toMatch(/more than zero/);
  });

  it("catches a slipped decimal in both directions", () => {
    expect(validateDimension(0.1)).toMatch(/under a foot/);
    expect(validateDimension(200)).toMatch(/over 195 feet/);
  });

  it("accepts an ordinary room", () => {
    expect(validateDimension(parseFeetInches("12' 6")!)).toBeNull();
  });
});

describe("makeRectangularRoom", () => {
  const room = makeRectangularRoom({ widthMeters: 4, lengthMeters: 3, heightMeters: 2.44 });

  it("builds four walls of the right lengths", () => {
    expect(room.walls).toHaveLength(4);
    const lengths = room.walls.map((w) => w.lengthMeters).sort();
    expect(lengths).toEqual([3, 3, 4, 4]);
  });

  it("reports the floor area it was given", () => {
    expect(totalFloorAreaSquareMeters(room)).toBeCloseTo(12, 6);
  });

  it("gives a perimeter that matches the rectangle", () => {
    expect(totalWallLengthMeters(room)).toBeCloseTo(14, 6);
  });

  it("claims no doors or windows it was never told about", () => {
    // Wall area is priced net of openings, so an invented door is money.
    expect(room.doorCount).toBe(0);
    expect(room.windowCount).toBe(0);
    const { gross, net } = wallAreaSquareMeters(room);
    expect(net).toBeCloseTo(gross, 6);
  });

  it("draws as a closed rectangle on the plan", () => {
    // The same path a scanned room takes. If this ever diverges, a typed
    // room stops working everywhere a scanned one does.
    const plan = toFloorPlan(room);
    expect(plan.segments).toHaveLength(4);
    expect(plan.width).toBeCloseTo(4, 3);
    expect(plan.height).toBeCloseTo(3, 3);
    expect(plan.polygon.length).toBeGreaterThanOrEqual(4);
  });

  it("survives the round trip from what the operator typed", () => {
    const room = makeRectangularRoom({
      widthMeters: parseFeetInches("12' 6")!,
      lengthMeters: parseFeetInches("10")!,
      heightMeters: parseFeetInches("8")!,
    });
    // 12.5 × 10 = 125 sq ft.
    expect(squareMetersToSquareFeet(totalFloorAreaSquareMeters(room))).toBeCloseTo(125, 1);
  });
});
