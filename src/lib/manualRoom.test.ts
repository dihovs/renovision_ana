import { describe, expect, it } from "vitest";
import {
  OPENING_PRESETS,
  formatFeetInches,
  makeRectangularRoom,
  parseFeetInches,
  validateDimension,
  withOpening,
} from "./manualRoom";
import {
  baseboardLengthMeters,
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

describe("withOpening", () => {
  // The ORD-05 premise made right: a room nobody scanned can still carry the
  // door and window every real room has, so its paint figure stops being
  // systematically high by exactly those openings.
  const bare = makeRectangularRoom({ widthMeters: 4, lengthMeters: 3, heightMeters: 2.44 });
  const withDoor = withOpening(bare, { wall: 0, preset: "doorSingle" });
  const furnished = withOpening(withDoor, { wall: 1, preset: "windowStandard" });

  it("drops net wall area below gross by exactly the openings placed", () => {
    const { gross, net } = wallAreaSquareMeters(furnished);
    const door = OPENING_PRESETS.doorSingle;
    const window = OPENING_PRESETS.windowStandard;
    const deducted =
      door.widthMeters * door.heightMeters + window.widthMeters * window.heightMeters;
    expect(net).toBeLessThan(gross);
    expect(gross - net).toBeCloseTo(deducted, 6);
  });

  it("counts what it placed, and nothing else moves", () => {
    expect(furnished.doorCount).toBe(1);
    expect(furnished.windowCount).toBe(1);
    // Floor and perimeter are wall facts, not opening facts.
    expect(totalFloorAreaSquareMeters(furnished)).toBeCloseTo(12, 6);
    expect(totalWallLengthMeters(furnished)).toBeCloseTo(14, 6);
  });

  it("leaves the room it was given untouched", () => {
    expect(bare.doorCount).toBe(0);
    const { gross, net } = wallAreaSquareMeters(bare);
    expect(net).toBeCloseTo(gross, 6);
  });

  it("sits the opening inside its host wall on the drawn plan", () => {
    const plan = toFloorPlan(furnished);
    expect(plan.openings).toHaveLength(2);
    for (const opening of plan.openings) {
      // Every opening endpoint lies on some wall segment — the cut stays in
      // a wall through the shared rotation and shift.
      for (const p of [
        { x: opening.x1, y: opening.y1 },
        { x: opening.x2, y: opening.y2 },
      ]) {
        const onAWall = plan.segments.some((s) => {
          const lengthSq = (s.x2 - s.x1) ** 2 + (s.y2 - s.y1) ** 2;
          if (lengthSq === 0) return false;
          const t = ((p.x - s.x1) * (s.x2 - s.x1) + (p.y - s.y1) * (s.y2 - s.y1)) / lengthSq;
          if (t < -0.001 || t > 1.001) return false;
          const px = s.x1 + t * (s.x2 - s.x1);
          const py = s.y1 + t * (s.y2 - s.y1);
          return Math.hypot(p.x - px, p.y - py) < 0.01;
        });
        expect(onAWall).toBe(true);
      }
    }
  });

  it("clamps a tall door to a low ceiling rather than deducting phantom wall", () => {
    const crawl = withOpening(
      makeRectangularRoom({ widthMeters: 4, lengthMeters: 3, heightMeters: 1.8 }),
      { wall: 0, preset: "doorSingle" },
    );
    const { gross, net } = wallAreaSquareMeters(crawl);
    // The deduction is width × the 1.8 m the wall actually has, not the
    // door's nominal 6'8".
    expect(gross - net).toBeCloseTo(OPENING_PRESETS.doorSingle.widthMeters * 1.8, 6);
  });
});

describe("sill height", () => {
  /**
   * The one number separating a door from a window. It is not bookkeeping:
   * an elevation cannot place a window without it, and a water line at 18"
   * either crosses a sill or does not — which decides whether that window
   * is in the claim.
   */
  it("puts every door on the floor and every window above it", () => {
    for (const kind of ["doorSingle", "doorDouble", "doorSliding", "doorCased"] as const) {
      expect(OPENING_PRESETS[kind].sillMeters, kind).toBe(0);
    }
    for (const kind of ["windowStandard", "windowWide", "windowSmall"] as const) {
      expect(OPENING_PRESETS[kind].sillMeters, kind).toBeGreaterThan(0);
    }
  });

  it("sits the basement hopper highest, because it is at grade", () => {
    expect(OPENING_PRESETS.windowSmall.sillMeters).toBeGreaterThan(
      OPENING_PRESETS.windowStandard.sillMeters,
    );
    // And the wide one lowest of the three — it is a picture window.
    expect(OPENING_PRESETS.windowWide.sillMeters).toBeLessThan(
      OPENING_PRESETS.windowStandard.sillMeters,
    );
  });

  it("deducts the full opening when the wall is tall enough to hold it", () => {
    const room = withOpening(
      makeRectangularRoom({ widthMeters: 4, lengthMeters: 3, heightMeters: 2.44 }),
      { wall: 0, preset: "windowStandard" },
    );
    const spec = OPENING_PRESETS.windowStandard;
    const { gross, net } = wallAreaSquareMeters(room);
    expect(gross - net).toBeCloseTo(spec.widthMeters * spec.heightMeters, 6);
  });

  it("clips a window to the ceiling rather than deducting wall that is not there", () => {
    // Sill 36", height 48" — the head wants 84", the wall only has 78".
    const low = 78 * 0.0254;
    const room = withOpening(
      makeRectangularRoom({ widthMeters: 4, lengthMeters: 3, heightMeters: low }),
      { wall: 0, preset: "windowStandard" },
    );
    const spec = OPENING_PRESETS.windowStandard;
    const { gross, net } = wallAreaSquareMeters(room);
    expect(gross - net).toBeCloseTo(spec.widthMeters * (low - spec.sillMeters), 6);
  });

  it("deducts nothing for a window whose sill is above the ceiling", () => {
    // A 6' hopper sill in a 5' crawl space. The old maths, which ignored the
    // sill, would have deducted the whole window from a wall it never touches.
    const crawl = withOpening(
      makeRectangularRoom({ widthMeters: 4, lengthMeters: 3, heightMeters: 60 * 0.0254 }),
      { wall: 0, preset: "windowSmall" },
    );
    const { gross, net } = wallAreaSquareMeters(crawl);
    expect(net).toBeCloseTo(gross, 6);
  });
});

describe("baseboardLengthMeters", () => {
  /**
   * The figure trim is actually priced on. Trim does not cross a doorway,
   * so the perimeter over-states it by exactly the doors — and on a room
   * with two of them that is most of a metre, charged per linear foot.
   */
  const bare = makeRectangularRoom({ widthMeters: 4, lengthMeters: 3, heightMeters: 2.44 });

  it("equals the perimeter when there is nothing to walk through", () => {
    expect(baseboardLengthMeters(bare)).toBeCloseTo(14, 6);
  });

  it("takes out a door", () => {
    const withDoor = withOpening(bare, { wall: 0, preset: "doorSingle" });
    expect(baseboardLengthMeters(withDoor)).toBeCloseTo(
      14 - OPENING_PRESETS.doorSingle.widthMeters,
      6,
    );
  });

  it("takes out a cased opening too — you walk through it", () => {
    const cased = withOpening(bare, { wall: 1, preset: "doorCased" });
    expect(baseboardLengthMeters(cased)).toBeCloseTo(
      14 - OPENING_PRESETS.doorCased.widthMeters,
      6,
    );
  });

  it("leaves a window alone — trim runs under it", () => {
    const withWindow = withOpening(bare, { wall: 2, preset: "windowStandard" });
    expect(baseboardLengthMeters(withWindow)).toBeCloseTo(14, 6);
    // And the perimeter is unchanged either way.
    expect(totalWallLengthMeters(withWindow)).toBeCloseTo(14, 6);
  });

  it("is always shorter than the perimeter once a door exists", () => {
    const busy = withOpening(withOpening(bare, { wall: 0, preset: "doorSingle" }), {
      wall: 1,
      preset: "doorDouble",
    });
    expect(baseboardLengthMeters(busy)).toBeLessThan(totalWallLengthMeters(busy));
  });

  it("never goes negative on a bad scan", () => {
    // A door reported wider than the room it sits in. Nonsense in, zero out —
    // not a negative length that reaches a price.
    const broken = withOpening(
      makeRectangularRoom({ widthMeters: 0.4, lengthMeters: 0.4, heightMeters: 2.44 }),
      { wall: 0, preset: "doorSliding" },
    );
    expect(baseboardLengthMeters(broken)).toBeGreaterThanOrEqual(0);
  });
});
