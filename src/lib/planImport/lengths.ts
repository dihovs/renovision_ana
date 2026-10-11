/**
 * Lengths as a drawn plan prints them, in metres.
 *
 * A plan sold or drawn in North America writes `18'-8"`, `18-8`, `18' 8"` or
 * `9'-10 1/2"`; a European one writes `5.69` or `5,69 m`. The importer only
 * ever reads these off a picture, through a model that copies the label as
 * printed — so the parsing is done here, in code, rather than asking the
 * model to do arithmetic it will occasionally get wrong.
 */
const FOOT = 0.3048;

export function parseLength(raw: string): number | null {
  const text = raw
    .trim()
    .toLowerCase()
    .replace(/[’′]/g, "'")
    .replace(/[”″]/g, '"')
    .replace(/,/g, ".");
  if (!text) return null;

  const metric = text.match(/^(\d+(?:\.\d+)?)\s*(mm|cm|m)$/);
  if (metric) {
    const value = Number(metric[1]);
    return value * ({ mm: 0.001, cm: 0.01, m: 1 } as const)[metric[2] as "mm" | "cm" | "m"];
  }

  // 18'-8", 18' 8", 18'8, 18', 18 ft 8 in, 9'-10 1/2"
  const imperial = text.match(
    /^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*-?\s*(?:(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?\s*(?:"|in|inches)?)?$/,
  );
  if (imperial) {
    const feet = Number(imperial[1]);
    let inches = imperial[2] ? Number(imperial[2]) : 0;
    if (imperial[3] && imperial[4] && Number(imperial[4]) !== 0) {
      inches += Number(imperial[3]) / Number(imperial[4]);
    }
    return (feet + inches / 12) * FOOT;
  }

  // The plan-book dash: 18-8 is eighteen feet eight inches.
  const dashed = text.match(/^(\d+)-(\d+(?:\.\d+)?)$/);
  if (dashed) return (Number(dashed[1]) + Number(dashed[2]) / 12) * FOOT;

  // Inches alone: 32", 32 in.
  const inchesOnly = text.match(/^(\d+(?:\.\d+)?)\s*(?:"|in|inches)$/);
  if (inchesOnly) return (Number(inchesOnly[1]) / 12) * FOOT;

  // A bare number: metres if it has a decimal and is room-sized, otherwise
  // nothing — a lone "12" could be feet or metres and guessing is how a
  // bedroom comes out three times too big.
  const bare = text.match(/^(\d+\.\d+)$/);
  if (bare) {
    const value = Number(bare[1]);
    return value > 0.3 && value < 40 ? value : null;
  }
  return null;
}

/** "18-8 x 19-4", "18'-8\" X 19'-4\"", "5.69 × 5.89 m" → the two lengths. */
export function parsePrintedSize(raw: string | null | undefined): [number, number] | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const parts = cleaned.split(/\s*(?:x|×|by)\s*/i);
  if (parts.length !== 2) return null;
  // "5.69 x 5.89 m": the unit printed once, at the end, belongs to both.
  const unit = parts[1].match(/\s*(mm|cm|m)$/i)?.[1] ?? "";
  const first = parseLength(/[a-z'"]$/i.test(parts[0]) ? parts[0] : parts[0] + unit);
  const second = parseLength(parts[1]);
  if (first === null || second === null || first <= 0 || second <= 0) return null;
  return [first, second];
}
