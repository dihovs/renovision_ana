/**
 * How a length is written down.
 *
 * Every measurement in this codebase is metres. That is the storage fact and
 * it never changes. This module is the only place that turns one into text,
 * because a length that reads `3.81 m` on the phone and `12' 6"` in the PDF
 * is the same wall described two ways, and an adjuster reading both will ask
 * which one is real.
 *
 * The choices offered mirror what a contractor expects to find — metres or
 * centimetres with a decimal count, feet-and-inches or plain inches with a
 * fractional denominator. Quebec insurance work is quoted in feet and inches,
 * so that is the default; metric is reachable, not primary.
 *
 * The Swift twin lives in ios/App/App/Native. Same presets, same rounding,
 * same output — the two are checked against each other by eye and must not
 * be allowed to drift.
 */

const FEET_TO_METRES = 0.3048;
const INCHES_TO_METRES = 0.0254;

export type UnitSystem = "metric" | "feet" | "inches";

/**
 * A way of writing a length. Metric carries which unit and how many decimals;
 * imperial carries the fraction it rounds to — 1 means whole inches, 2 means
 * halves, 4 means quarters.
 */
export type LengthFormat =
  | { system: "metric"; unit: "m" | "cm"; decimals: number }
  | { system: "feet"; denominator: ImperialDenominator; style?: ImperialStyle }
  | { system: "inches"; denominator: ImperialDenominator; style?: ImperialStyle };

export type ImperialDenominator = 1 | 2 | 4 | 8 | 16;

/**
 * Two legitimate ways to write feet and inches, and this repo needs both.
 *
 * `drafting` is `17'-1"` — hyphenated, and whole feet keep their `-0"`. That
 * is what belongs on a dimension line of an architectural drawing, and it is
 * what `FloorPlanGeometry.feetInches` has always drawn.
 *
 * `plain` is `17' 1"`, and whole feet are just `17'`. That is how a
 * measurement reads in a text field, a list row, or a sentence.
 *
 * Keeping both named is the point. The two already existed in this codebase
 * as separate functions that had quietly drifted apart; naming them stops a
 * third from appearing.
 */
export type ImperialStyle = "drafting" | "plain";

/**
 * The presets the units picker offers, per system, in the order shown. The
 * sample is what the picker displays beside each row; it is 2.5 m written
 * that way, so the operator picks by recognising the shape of the number
 * rather than by parsing a description.
 */
export const LENGTH_PRESETS: Record<UnitSystem, LengthFormat[]> = {
  metric: [
    { system: "metric", unit: "m", decimals: 2 },
    { system: "metric", unit: "m", decimals: 3 },
    { system: "metric", unit: "cm", decimals: 0 },
    { system: "metric", unit: "cm", decimals: 1 },
  ],
  feet: [
    { system: "feet", denominator: 1 },
    { system: "feet", denominator: 2 },
    { system: "feet", denominator: 4 },
  ],
  inches: [
    { system: "inches", denominator: 1 },
    { system: "inches", denominator: 2 },
    { system: "inches", denominator: 4 },
  ],
};

/** Feet and whole inches. What this trade quotes in. */
export const DEFAULT_LENGTH_FORMAT: LengthFormat = { system: "feet", denominator: 1 };

/** Two formats are the same setting — used to tick the current row in a picker. */
export function sameFormat(a: LengthFormat, b: LengthFormat): boolean {
  // Metric first and as one condition, so both sides narrow together; a
  // system-inequality guard does not narrow either of them.
  if (a.system === "metric" || b.system === "metric") {
    return (
      a.system === "metric" && b.system === "metric" && a.unit === b.unit && a.decimals === b.decimals
    );
  }
  return a.system === b.system && a.denominator === b.denominator;
}

/**
 * Greatest common divisor, for reducing 2/4 to 1/2. Both arguments are small
 * positive integers here — numerator under 16, denominator at most 16.
 */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * A length as text.
 *
 * Rounding happens once, at the requested precision, and the carry is handled
 * afterwards — so 11 and 15/16 inches asked for to the nearest half becomes
 * `1' 0"`, not `0' 12"`. Getting that wrong produces a measurement that is
 * arithmetically fine and looks like a typo.
 */
export function formatLength(metres: number, format: LengthFormat = DEFAULT_LENGTH_FORMAT): string {
  if (!Number.isFinite(metres)) return "—";

  const negative = metres < 0;
  const size = Math.abs(metres);
  const body = format.system === "metric" ? formatMetric(size, format) : formatImperial(size, format);
  return negative ? `-${body}` : body;
}

function formatMetric(metres: number, format: { unit: "m" | "cm"; decimals: number }): string {
  const value = format.unit === "cm" ? metres * 100 : metres;
  return `${value.toFixed(format.decimals)} ${format.unit}`;
}

function formatImperial(
  metres: number,
  format: { system: "feet" | "inches"; denominator: ImperialDenominator; style?: ImperialStyle },
): string {
  const { denominator } = format;
  const style: ImperialStyle = format.style ?? "plain";

  // Round to the fraction first, in units of 1/denominator inch, so every
  // decision below is integer arithmetic and no carry can be lost to a float.
  const ticks = Math.round((metres / INCHES_TO_METRES) * denominator);
  const wholeInches = Math.floor(ticks / denominator);
  const remainder = ticks % denominator;

  const fraction = fractionText(remainder, denominator);

  if (format.system === "inches") {
    return fraction ? `${wholeInches} ${fraction}"` : `${wholeInches}"`;
  }

  const feet = Math.floor(wholeInches / 12);
  const inches = wholeInches % 12;
  const inchPart = fraction ? `${inches} ${fraction}"` : `${inches}"`;

  // A measurement under a foot reads as inches alone; `0' 8"` is how a form
  // prints, not how anyone speaks or writes on a plan.
  if (feet === 0) return inchPart;

  // The drafting convention keeps its -0" on whole feet, because a dimension
  // line that reads `17'` is ambiguous about whether the inches were measured.
  if (style === "drafting") return `${feet}'-${inchPart}`;

  if (inches === 0 && !fraction) return `${feet}'`;
  return `${feet}' ${inchPart}`;
}

/**
 * The fractional part, reduced. Returns an empty string when there is none.
 *
 * Note the notation: `1' 6 1/2"`, with one inch mark at the end. The reference
 * app writes `1' 6" 1/2"`, with two — that is malformed, and this text ends up
 * in documents an insurer reads, so we write it correctly instead of copying
 * the mistake.
 */
function fractionText(remainder: number, denominator: number): string {
  if (remainder === 0) return "";
  const divisor = gcd(remainder, denominator);
  return `${remainder / divisor}/${denominator / divisor}`;
}

/**
 * The sample a picker row shows.
 *
 * Metric rows all show the same 2.5 m, so the rows differ only in precision
 * and the choice reads as "how many digits". Imperial rows cannot do that —
 * a whole number formatted to quarters is still a whole number, and three
 * identical rows teach nothing. So each imperial row shows a length carrying
 * exactly the fraction that row can express: 18", 18½", 18¼".
 */
const METRIC_SAMPLE_METRES = 2.5;
const IMPERIAL_SAMPLE_INCHES = 18;

export function presetSample(format: LengthFormat): string {
  if (format.system === "metric") return formatLength(METRIC_SAMPLE_METRES, format);
  const inches =
    IMPERIAL_SAMPLE_INCHES + (format.denominator > 1 ? 1 / format.denominator : 0);
  return formatLength(inches * INCHES_TO_METRES, format);
}

/**
 * Read a length a human typed, in METRES.
 *
 * Deliberately permissive, because this is typed one-thumbed on a phone in a
 * basement. Understands the imperial shapes a contractor writes — 12, 12.5,
 * 12'6, 12' 6", 12ft 6in, 12-6, and now fractions like 12' 6 1/2" — plus
 * explicit metric when a unit is given: 3.81m, 381cm, 3810mm.
 *
 * A bare number is FEET, matching how this trade speaks, unless `assume` says
 * otherwise. That default is the one judgement call here and it is the reason
 * the argument exists: when the operator has switched the app to metric, a
 * bare number should mean metres.
 *
 * Returns null when there is no number in there at all.
 */
export function parseLength(input: string, assume: UnitSystem = "feet"): number | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  // Explicit metric always wins over the assumption — a typed unit is a
  // statement, not a preference.
  const metric = /^(-?\d+(?:[.,]\d+)?)\s*(mm|cm|m)$/.exec(text);
  if (metric) {
    const value = Number(metric[1].replace(",", "."));
    if (!Number.isFinite(value)) return null;
    if (metric[2] === "mm") return value / 1000;
    if (metric[2] === "cm") return value / 100;
    return value;
  }

  const imperial = parseImperial(text);
  if (imperial !== null) return imperial;

  // Nothing but a number. Whichever system is in force decides what it means.
  const bare = Number(text.replace(",", "."));
  if (!Number.isFinite(bare)) return null;
  if (assume === "metric") return bare;
  if (assume === "inches") return bare * INCHES_TO_METRES;
  return bare * FEET_TO_METRES;
}

/**
 * The imperial shapes, in metres, or null if this is not one.
 *
 * Split out because there are five of them and inlining the alternation made
 * a regex nobody could check.
 */
function parseImperial(text: string): number | null {
  // Optional feet, optional inches, optional fraction. At least one of the
  // marks must be present, otherwise "12" would match here and steal the
  // bare-number case above.
  const full =
    /^(?:(-?\d+(?:\.\d+)?)\s*(?:'|’|ft|feet))?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|”|in|inch|inches)?)?\s*(?:(\d+)\s*\/\s*(\d+)\s*(?:"|”)?)?$/.exec(
      text,
    );

  if (!full) {
    // The dashed form: 12-6 means twelve feet six inches.
    const dashed = /^(-?\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/.exec(text);
    if (!dashed) return null;
    const feet = Number(dashed[1]);
    const inches = Number(dashed[2]);
    if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
    const total = Math.abs(feet) + inches / 12;
    return (feet < 0 ? -total : total) * FEET_TO_METRES;
  }

  const [, feetText, inchText, numText, denText] = full;
  // All three groups optional means the regex also matches the empty string
  // and a bare number; both must fall through to the caller.
  if (feetText === undefined && inchText === undefined && numText === undefined) return null;
  if (feetText === undefined && numText === undefined && !/['’"”]|ft|in/.test(text)) return null;

  const feet = feetText === undefined ? 0 : Number(feetText);
  const inches = inchText === undefined ? 0 : Number(inchText);
  const numerator = numText === undefined ? 0 : Number(numText);
  const denominator = denText === undefined ? 1 : Number(denText);
  if (![feet, inches, numerator, denominator].every(Number.isFinite)) return null;
  if (denominator === 0) return null;

  const totalFeet = Math.abs(feet) + (inches + numerator / denominator) / 12;
  return (feet < 0 ? -totalFeet : totalFeet) * FEET_TO_METRES;
}
