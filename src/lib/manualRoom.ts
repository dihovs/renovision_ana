import type { RoomScanResult } from "@/lib/roomScan";

/**
 * A room entered by hand, when no camera will do.
 *
 * The fallback that matters more than it sounds. LiDAR needs a phone that has
 * it; the corner modes need enough light and texture for ARKit to track. A
 * gutted basement at 8pm with the power off has neither, and that is a normal
 * Tuesday on a water-damage job. A tape measure and two numbers always work.
 *
 * Produces the same `RoomScanResult` shape the scanner returns, so everything
 * downstream — the plan, the areas, the affected-area editor, the totals —
 * treats a typed room exactly like a scanned one. The alternative was a
 * second kind of room with its own code path through the whole app.
 */

const FEET_TO_METRES = 0.3048;

/**
 * Parse a length the way a contractor writes one.
 *
 * Accepts 12, 12.5, 12'6, 12' 6", 12ft 6in, 12-6 — all meaning twelve feet
 * six inches except the decimal, which means twelve and a half feet. Returns
 * METRES, or null when there is no number in there at all.
 *
 * Deliberately permissive: this is typed with one thumb, on a phone, in a
 * basement. Rejecting "12' 6" for having a space would be its own bug.
 */
export function parseFeetInches(input: string): number | null {
  const text = input.trim();
  if (!text) return null;

  // Feet-and-inches, in any of the ways people write it.
  const both =
    /^(-?\d+(?:\.\d+)?)\s*(?:'|’|ft|feet|f)\s*(\d+(?:\.\d+)?)?\s*(?:"|”|in|inch|inches)?$/i.exec(
      text,
    ) ?? /^(-?\d+(?:\.\d+)?)\s*[- ]\s*(\d+(?:\.\d+)?)$/.exec(text);

  if (both) {
    const feet = Number(both[1]);
    const inches = both[2] === undefined ? 0 : Number(both[2]);
    if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
    // Negative feet with positive inches would otherwise add rather than
    // subtract; a negative length is rejected by the caller anyway.
    const total = Math.abs(feet) + inches / 12;
    return (feet < 0 ? -total : total) * FEET_TO_METRES;
  }

  // A digit is required. Without this, stripping the mark off a bare "'"
  // leaves an empty string, and Number("") is 0 — a zero-length wall that
  // reads as a real measurement rather than a typo.
  const bare = text.replace(/\s*(?:'|’|ft|feet)\s*$/i, "");
  if (!/\d/.test(bare)) return null;
  const plain = Number(bare);
  return Number.isFinite(plain) ? plain * FEET_TO_METRES : null;
}

/** Metres back to the "12' 6"" a plan is labelled with. */
export function formatFeetInches(metres: number): string {
  const totalInches = Math.round((metres / FEET_TO_METRES) * 12);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return inches === 0 ? `${feet}'` : `${feet}' ${inches}"`;
}

/**
 * A rectangular room from its dimensions.
 *
 * Walls are described the way RoomPlan describes them — a midpoint on the
 * floor plane and the direction the wall runs in — because that is what
 * `toFloorPlan` reads. Centred on the origin, since nothing downstream cares
 * where a room sits in world space; the plan normalises to its own bounds.
 */
export function makeRectangularRoom(options: {
  widthMeters: number;
  lengthMeters: number;
  heightMeters: number;
}): RoomScanResult {
  const { widthMeters: w, lengthMeters: l, heightMeters: h } = options;

  return {
    walls: [
      // The two running across, at the near and far edges.
      { lengthMeters: w, heightMeters: h, centerX: 0, centerZ: -l / 2, axisX: 1, axisZ: 0 },
      { lengthMeters: w, heightMeters: h, centerX: 0, centerZ: l / 2, axisX: 1, axisZ: 0 },
      // The two running up the sides.
      { lengthMeters: l, heightMeters: h, centerX: -w / 2, centerZ: 0, axisX: 0, axisZ: 1 },
      { lengthMeters: l, heightMeters: h, centerX: w / 2, centerZ: 0, axisX: 0, axisZ: 1 },
    ],
    floors: [{ areaSquareMeters: w * l }],
    // A typed room records no openings. Claiming a door we were not told
    // about would put a hole in a wall the operator never described — and
    // wall area is priced net of openings, so an invented door is money.
    doors: [],
    windows: [],
    openings: [],
    doorCount: 0,
    windowCount: 0,
    openingCount: 0,
    stairCount: 0,
  };
}

const INCHES_TO_METRES = 0.0254;

/**
 * The seven openings a water-damage estimate actually meets, with builders'
 * stock sizes. The TypeScript twin of `PlanEditing.OpeningKind` in
 * ios/App/App/Native/PlanEditing.swift — same names, same inches — because
 * the geometry maths in this repo is deliberately duplicated in two
 * languages, and a width that drifted between them would price the same door
 * two ways.
 *
 * Widths and heights are CONVENTIONS, not measurements, stated in inches and
 * derived. The width times the height is what the net wall area deducts, so
 * a wrong number here is money.
 */
export const OPENING_PRESETS = {
  doorSingle: { widthMeters: 32 * INCHES_TO_METRES, heightMeters: 80 * INCHES_TO_METRES, list: "doors" },
  doorDouble: { widthMeters: 60 * INCHES_TO_METRES, heightMeters: 80 * INCHES_TO_METRES, list: "doors" },
  doorSliding: { widthMeters: 72 * INCHES_TO_METRES, heightMeters: 80 * INCHES_TO_METRES, list: "doors" },
  /** A cased opening — a doorless passage. Filed with the connective
      openings, because that is what it is. */
  doorCased: { widthMeters: 48 * INCHES_TO_METRES, heightMeters: 80 * INCHES_TO_METRES, list: "openings" },
  windowStandard: { widthMeters: 36 * INCHES_TO_METRES, heightMeters: 48 * INCHES_TO_METRES, list: "windows" },
  windowWide: { widthMeters: 60 * INCHES_TO_METRES, heightMeters: 48 * INCHES_TO_METRES, list: "windows" },
  windowSmall: { widthMeters: 24 * INCHES_TO_METRES, heightMeters: 24 * INCHES_TO_METRES, list: "windows" },
} as const;

export type OpeningPreset = keyof typeof OPENING_PRESETS;

/**
 * A typed room, with an opening cut into one of its walls.
 *
 * The twin of `ScanGeometry.surfaces(for:polygon:ceilingHeight:)`: the
 * opening is synthesized into the same centre-plus-axis surface a RoomPlan
 * detection stores, positioned along the host wall from its start, so the
 * renderer cuts it into the wall and `wallAreaSquareMeters` deducts it with
 * no new code path anywhere.
 *
 * Returns a new room; the one passed in is untouched.
 */
export function withOpening(
  room: RoomScanResult,
  options: {
    wall: number;
    preset: OpeningPreset;
    /** Metres from the wall's start to the near jamb. Centred when omitted. */
    offsetMeters?: number;
  },
): RoomScanResult {
  const host = room.walls[options.wall];
  if (!host) return room;

  const spec = OPENING_PRESETS[options.preset];
  const width = spec.widthMeters;
  const offset = options.offsetMeters ?? (host.lengthMeters - width) / 2;

  // The wall's start is its centre walked back half its length; the opening's
  // centre is then `offset + width / 2` along the same axis.
  const along = offset + width / 2 - host.lengthMeters / 2;
  const surface = {
    widthMeters: width,
    // A 6'8" door in a lower room must not deduct wall that does not exist.
    heightMeters: Math.min(spec.heightMeters, host.heightMeters),
    centerX: host.centerX + host.axisX * along,
    centerZ: host.centerZ + host.axisZ * along,
    axisX: host.axisX,
    axisZ: host.axisZ,
  };

  const next: RoomScanResult = {
    ...room,
    doors: [...room.doors],
    windows: [...room.windows],
    openings: [...(room.openings ?? [])],
  };
  if (spec.list === "doors") next.doors.push(surface);
  else if (spec.list === "windows") next.windows.push(surface);
  else next.openings!.push(surface);
  next.doorCount = next.doors.length;
  next.windowCount = next.windows.length;
  next.openingCount = next.openings!.length;
  return next;
}

/** The bounds of what can be typed. Wide enough for a mechanical room and a
    warehouse bay, tight enough that a slipped decimal is caught here rather
    than in an estimate. */
export const MIN_DIMENSION_M = 0.3;
export const MAX_DIMENSION_M = 60;

export function validateDimension(metres: number | null): string | null {
  if (metres === null) return "Enter a measurement, like 12' 6\".";
  if (!Number.isFinite(metres) || metres <= 0) return "That has to be more than zero.";
  if (metres < MIN_DIMENSION_M) return "That is under a foot — check the number.";
  if (metres > MAX_DIMENSION_M) return "That is over 195 feet — check the number.";
  return null;
}
