import { describe, expect, it } from "vitest";
import {
  DEFAULT_LENGTH_FORMAT,
  LENGTH_PRESETS,
  formatLength,
  parseLength,
  presetSample,
  sameFormat,
  type LengthFormat,
} from "./units";

/**
 * How a length is written down.
 *
 * Two things have to hold. The text has to be what a contractor would write
 * by hand — because it ends up in a document an adjuster reads, and a
 * malformed measurement is an argument waiting to happen. And the parser has
 * to accept what that same contractor types back, one-thumbed, in a basement.
 */

const M = (feet: number, inches = 0) => (feet + inches / 12) * 0.3048;

describe("formatLength — metric", () => {
  it("writes metres and centimetres at the precision asked for", () => {
    expect(formatLength(2.5, { system: "metric", unit: "m", decimals: 2 })).toBe("2.50 m");
    expect(formatLength(2.5, { system: "metric", unit: "m", decimals: 3 })).toBe("2.500 m");
    expect(formatLength(2.5, { system: "metric", unit: "cm", decimals: 0 })).toBe("250 cm");
    expect(formatLength(2.5, { system: "metric", unit: "cm", decimals: 1 })).toBe("250.0 cm");
  });
});

describe("formatLength — feet and inches", () => {
  it("writes whole feet without a stray zero inches", () => {
    expect(formatLength(M(12))).toBe("12'");
  });

  it("writes feet and inches", () => {
    expect(formatLength(M(12, 6))).toBe(`12' 6"`);
  });

  it("drops the feet entirely under a foot", () => {
    // `0' 8"` is how a form prints, not how anyone writes on a plan.
    expect(formatLength(M(0, 8))).toBe(`8"`);
  });

  it("reduces the fraction rather than printing 2/4", () => {
    expect(formatLength(M(1, 6.5), { system: "feet", denominator: 4 })).toBe(`1' 6 1/2"`);
  });

  it("uses one inch mark, not two", () => {
    // The reference app writes `1' 6" 1/2"`. That is malformed and this text
    // goes to an insurer, so it is written correctly here instead.
    const written = formatLength(M(1, 6.5), { system: "feet", denominator: 2 });
    expect(written).toBe(`1' 6 1/2"`);
    expect(written.match(/"/g)).toHaveLength(1);
  });

  it("rounds to the fraction it was asked for", () => {
    const awkward = M(0, 6.3);
    expect(formatLength(awkward, { system: "feet", denominator: 1 })).toBe(`6"`);
    expect(formatLength(awkward, { system: "feet", denominator: 2 })).toBe(`6 1/2"`);
    expect(formatLength(awkward, { system: "feet", denominator: 4 })).toBe(`6 1/4"`);
  });

  it("carries a rounded-up inch into the next foot", () => {
    // 11 and 15/16 inches, asked for to the nearest half, is a foot. The bug
    // this guards is `0' 12"` — arithmetically fine, and it reads as a typo.
    expect(formatLength(M(0, 11.9375), { system: "feet", denominator: 2 })).toBe(`1'`);
  });

  it("keeps a negative length negative", () => {
    expect(formatLength(-M(3))).toBe("-3'");
  });

  it("says so plainly when there is no number", () => {
    expect(formatLength(Number.NaN)).toBe("—");
    expect(formatLength(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("formatLength — the drafting style", () => {
  const drafting: LengthFormat = { system: "feet", denominator: 2, style: "drafting" };

  it("hyphenates, as a dimension line does", () => {
    expect(formatLength(M(17, 1), drafting)).toBe(`17'-1"`);
  });

  it("keeps the -0\" on whole feet", () => {
    // A dimension line reading `17'` is ambiguous about whether the inches
    // were measured at all. This is what FloorPlanGeometry.feetInches has
    // always drawn, and the plan renderer must keep drawing it.
    expect(formatLength(M(17), drafting)).toBe(`17'-0"`);
  });

  it("still drops the feet under a foot", () => {
    expect(formatLength(M(0, 8), drafting)).toBe(`8"`);
  });

  it("differs from plain only where it should", () => {
    const plain: LengthFormat = { system: "feet", denominator: 2 };
    expect(formatLength(M(17), plain)).toBe(`17'`);
    expect(formatLength(M(17, 1), plain)).toBe(`17' 1"`);
  });
});

describe("formatLength — plain inches", () => {
  it("does not roll up into feet", () => {
    expect(formatLength(M(1, 6), { system: "inches", denominator: 1 })).toBe(`18"`);
    expect(formatLength(M(1, 6.25), { system: "inches", denominator: 4 })).toBe(`18 1/4"`);
  });
});

describe("presetSample", () => {
  it("shows every metric row at the same length, so precision is the only difference", () => {
    expect(LENGTH_PRESETS.metric.map(presetSample)).toEqual([
      "2.50 m",
      "2.500 m",
      "250 cm",
      "250.0 cm",
    ]);
  });

  it("shows each imperial row carrying the fraction that row can express", () => {
    // Three identical rows would teach nothing: a whole number formatted to
    // quarters is still a whole number.
    expect(LENGTH_PRESETS.feet.map(presetSample)).toEqual([`1' 6"`, `1' 6 1/2"`, `1' 6 1/4"`]);
    expect(LENGTH_PRESETS.inches.map(presetSample)).toEqual([`18"`, `18 1/2"`, `18 1/4"`]);
  });
});

describe("sameFormat", () => {
  it("ticks the row that is actually in force", () => {
    expect(sameFormat(DEFAULT_LENGTH_FORMAT, { system: "feet", denominator: 1 })).toBe(true);
    expect(sameFormat(DEFAULT_LENGTH_FORMAT, { system: "feet", denominator: 4 })).toBe(false);
    expect(sameFormat(DEFAULT_LENGTH_FORMAT, { system: "inches", denominator: 1 })).toBe(false);
  });

  it("does not confuse a metric row with an imperial one", () => {
    const metric: LengthFormat = { system: "metric", unit: "m", decimals: 2 };
    expect(sameFormat(metric, { system: "feet", denominator: 2 })).toBe(false);
    expect(sameFormat({ system: "feet", denominator: 2 }, metric)).toBe(false);
    expect(sameFormat(metric, { system: "metric", unit: "cm", decimals: 2 })).toBe(false);
  });
});

describe("parseLength", () => {
  it("reads feet and inches however they are written", () => {
    for (const written of ["12'6", "12' 6", `12' 6"`, "12ft 6in", "12-6"]) {
      expect(parseLength(written), written).toBeCloseTo(M(12, 6), 6);
    }
  });

  it("reads a fraction", () => {
    expect(parseLength(`12' 6 1/2"`)).toBeCloseTo(M(12, 6.5), 6);
    expect(parseLength(`6 1/4"`)).toBeCloseTo(M(0, 6.25), 6);
  });

  it("takes a typed unit as a statement, whatever the app is set to", () => {
    expect(parseLength("3.81m", "feet")).toBeCloseTo(3.81, 6);
    expect(parseLength("381cm", "feet")).toBeCloseTo(3.81, 6);
    expect(parseLength("3810mm", "feet")).toBeCloseTo(3.81, 6);
  });

  it("reads a bare number in whatever system is in force", () => {
    expect(parseLength("12", "feet")).toBeCloseTo(M(12), 6);
    expect(parseLength("12", "metric")).toBeCloseTo(12, 6);
    expect(parseLength("12", "inches")).toBeCloseTo(M(0, 12), 6);
  });

  it("treats a bare number with a foot mark as feet", () => {
    expect(parseLength("9'")).toBeCloseTo(M(9), 6);
  });

  it("returns null for nothing usable", () => {
    for (const junk of ["", "   ", "abc", "'", "1/0"]) {
      expect(parseLength(junk), junk).toBeNull();
    }
  });

  it("round-trips what it wrote", () => {
    for (const format of [...LENGTH_PRESETS.feet, ...LENGTH_PRESETS.inches]) {
      const metres = M(8, 3.25);
      const written = formatLength(metres, format);
      const read = parseLength(written, format.system);
      expect(read, `${written} via ${JSON.stringify(format)}`).not.toBeNull();
      // Back within the precision it was written at — a quarter inch is the
      // coarsest of these, so half of that is the tolerance.
      expect(Math.abs(read! - metres), written).toBeLessThan(0.0254 / 2);
    }
  });
});
