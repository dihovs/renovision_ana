/**
 * Living area — how much of a building counts as living space.
 *
 * A measurement that decides money. Coverage limits, replacement cost and
 * appraised value are all quoted per square foot of LIVING area, which is a
 * much narrower thing than floor area: a basement can be finished, heated and
 * carpeted and still count zero.
 *
 * The rules follow ANSI Z765, the measuring standard appraisers and carriers
 * actually cite:
 *
 *   - Space needs at least 7 feet (2.134 m) of ceiling height to count. The
 *     threshold is the standard's, not ours.
 *   - Below-grade space is never above-grade living area, however finished it
 *     is. It is reported separately, never folded into one total, because a
 *     figure that silently includes a basement is the single most common way
 *     a living-area number gets challenged.
 *   - Unheated or unenclosed space — garage, balcony, porch — counts zero.
 *
 * Everything below is a DEFAULT, and every room can override its own
 * percentage, because the standard leaves real judgement calls (a converted
 * attic with a dormer, a walk-out basement on a slope) that only the person
 * standing in the building can make.
 */

/**
 * Metres. ANSI Z765's minimum ceiling height: seven feet.
 *
 * DERIVED, not typed. Seven feet is 2.1336 m, and tools that show this
 * setting display it rounded to 2.134 — writing the rounded number into the
 * constant would mean the app compares heights against a threshold four
 * tenths of a millimetre away from the standard it claims to follow.
 * Irrelevant to any real ceiling; not irrelevant to whether the figure can
 * be defended as ANSI Z765.
 */
export const MIN_LIVING_HEIGHT_M = 7 * 0.3048;

export type GradeBand = "above" | "below" | "excluded";

export type RoomTypeRule = {
  id: string;
  label: string;
  /** How much of this room's floor counts, 0–100. */
  percent: number;
  /** Which total it lands in. `excluded` never counts anywhere. */
  band: GradeBand;
  /** Why it is what it is, shown in the UI so nobody has to guess. */
  note?: string;
};

/**
 * The room types a Quebec restoration job actually meets, with their default
 * treatment. Ordered as the picker shows them: the common ones first.
 */
export const ROOM_TYPES: RoomTypeRule[] = [
  { id: "bedroom", label: "Bedroom", percent: 100, band: "above" },
  { id: "living_room", label: "Living room", percent: 100, band: "above" },
  { id: "kitchen", label: "Kitchen", percent: 100, band: "above" },
  { id: "bathroom", label: "Bathroom", percent: 100, band: "above" },
  { id: "dining_room", label: "Dining room", percent: 100, band: "above" },
  { id: "hallway", label: "Hallway", percent: 100, band: "above" },
  { id: "office", label: "Office", percent: 100, band: "above" },
  { id: "laundry", label: "Laundry", percent: 100, band: "above" },
  {
    id: "attic",
    label: "Attic / loft",
    percent: 100,
    band: "above",
    note: "Counts only where the ceiling clears seven feet — check the height before relying on it.",
  },
  {
    id: "basement",
    label: "Basement",
    percent: 0,
    band: "below",
    note: "Below grade never counts as above-grade living area, however finished it is. It is reported on its own line.",
  },
  {
    id: "basement_finished",
    label: "Basement — finished",
    percent: 100,
    band: "below",
    note: "Counts in full toward BELOW-grade area, and still nothing toward above-grade.",
  },
  {
    id: "crawlspace",
    label: "Crawl space",
    percent: 0,
    band: "excluded",
    note: "Under seven feet by definition.",
  },
  {
    id: "garage",
    label: "Garage",
    percent: 0,
    band: "excluded",
    note: "Unheated space is not living area.",
  },
  {
    id: "balcony",
    label: "Balcony / deck",
    percent: 0,
    band: "excluded",
    note: "Not enclosed.",
  },
  {
    id: "porch",
    label: "Porch",
    percent: 0,
    band: "excluded",
    note: "Counts only if enclosed and heated — set a percentage by hand if it is.",
  },
  { id: "storage", label: "Storage", percent: 100, band: "above" },
  {
    id: "utility",
    label: "Utility / mechanical",
    percent: 0,
    band: "excluded",
    note: "Plant rooms and mechanical space are not living area, even when heated.",
  },
  { id: "other", label: "Other", percent: 100, band: "above" },
];

export function roomTypeRule(id: string | null | undefined): RoomTypeRule {
  return ROOM_TYPES.find((type) => type.id === id) ?? ROOM_TYPES[ROOM_TYPES.length - 1];
}

/** The project-level switches. */
export type LivingAreaConfig = {
  /** Measure to the outside of interior partitions rather than the clear
      floor. Off by default: the clear floor is what the standard measures. */
  includeInteriorWalls: boolean;
  /** Metres. Space below this height does not count. */
  minHeightM: number;
};

export const DEFAULT_LIVING_AREA_CONFIG: LivingAreaConfig = {
  includeInteriorWalls: false,
  minHeightM: MIN_LIVING_HEIGHT_M,
};

export type LivingAreaRoom = {
  id: string;
  name: string;
  floorAreaSqm: number;
  ceilingHeightM: number;
  /** The room's type, or null when nobody has said. */
  roomType: string | null;
  /** A hand-set override, 0–100, or null to use the type's default. */
  livingPercent: number | null;
};

export type RoomLivingArea = {
  id: string;
  name: string;
  /** What actually counted, in square metres. */
  countedSqm: number;
  band: GradeBand;
  percentApplied: number;
  /** Set when the room was excluded for being too low, so the UI can say so
      rather than showing a mystery zero. */
  belowMinHeight: boolean;
};

export type LivingAreaTotals = {
  aboveGradeSqm: number;
  belowGradeSqm: number;
  /** Above + below. Kept as its own field rather than left to the caller,
      because "total living area" is a term of art and two callers adding it
      up differently is exactly the drift this module exists to prevent. */
  totalSqm: number;
  excludedSqm: number;
  rooms: RoomLivingArea[];
};

/**
 * Work out what counts, room by room.
 *
 * A room contributes `floor area × percentage` to the band its type belongs
 * to. A ceiling under the minimum takes the room to zero regardless of its
 * percentage — height is a gate, not a discount, because the standard treats
 * a five-foot crawl space as no living area at all rather than as some of it.
 */
export function calculateLivingArea(
  rooms: LivingAreaRoom[],
  config: LivingAreaConfig = DEFAULT_LIVING_AREA_CONFIG,
): LivingAreaTotals {
  const detail: RoomLivingArea[] = rooms.map((room) => {
    const rule = roomTypeRule(room.roomType);
    const percent = room.livingPercent ?? rule.percent;

    // A room with no recorded height is not assumed to fail — an unmeasured
    // ceiling is missing information, and treating missing information as
    // disqualifying would quietly delete real living area.
    const belowMinHeight =
      room.ceilingHeightM > 0 && room.ceilingHeightM < config.minHeightM;

    const counted =
      belowMinHeight || rule.band === "excluded"
        ? 0
        : room.floorAreaSqm * (Math.max(0, Math.min(100, percent)) / 100);

    return {
      id: room.id,
      name: room.name,
      countedSqm: counted,
      band: rule.band,
      percentApplied: belowMinHeight ? 0 : percent,
      belowMinHeight,
    };
  });

  const sum = (band: GradeBand) =>
    detail.filter((room) => room.band === band).reduce((total, room) => total + room.countedSqm, 0);

  const aboveGradeSqm = sum("above");
  const belowGradeSqm = sum("below");

  // What did NOT count, so the difference between floor area and living area
  // is always explainable rather than a gap somebody has to reconcile.
  const countedTotal = detail.reduce((total, room) => total + room.countedSqm, 0);
  const floorTotal = rooms.reduce((total, room) => total + room.floorAreaSqm, 0);

  return {
    aboveGradeSqm,
    belowGradeSqm,
    totalSqm: aboveGradeSqm + belowGradeSqm,
    excludedSqm: Math.max(0, floorTotal - countedTotal),
    rooms: detail,
  };
}

/** The formal definition, for the (i) beside the figure. A number an
    adjuster cannot interrogate is a number they can discount. */
export const LIVING_AREA_DEFINITION =
  "Finished, heated, enclosed floor area with at least seven feet of ceiling height, " +
  "measured per ANSI Z765. Below-grade space is reported separately and never counted " +
  "as above-grade area, however finished it is. Garages, balconies and crawl spaces " +
  "count nothing. Each room's percentage can be set by hand where the standard leaves " +
  "a judgement call.";
