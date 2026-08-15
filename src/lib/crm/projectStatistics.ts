import { MEASURE_DEFINITIONS, type MeasureDefinition } from "./measureDefinitions";

/**
 * The whole property in numbers — every figure a project reports, each one
 * carrying the definition it was computed under.
 *
 * Modelled on the reference's statistics sheet, which is the right idea: one
 * screen, every measurement, an ⓘ on each row. What differs is which figures
 * belong on it, because this is a restoration file rather than an appraisal.
 *
 * Two deliberate departures.
 *
 * **Volume is promoted, not buried.** The reference lists it last, as trivia.
 * Dehumidification is sized from cubic footage, so here it sits with the
 * measurements an estimate is actually built from.
 *
 * **The three ground-surface variants are NOT reproduced.** The reference
 * separates ground surface "with all walls", "with interior walls" and
 * "without walls" — figures that need the THICKNESS of every wall and which
 * side of it belongs to which room. A RoomPlan scan gives wall faces, not
 * wall assemblies; we do not know whether a partition is 2×4 or 2×6, and a
 * scan of one room cannot tell an exterior wall from a shared one. Computing
 * those three numbers would mean inventing a thickness and reporting the
 * result as measured. One honest floor area, defined, beats three fabricated
 * ones — so this reports the area to the scanned wall faces and says so.
 *
 * Platform-neutral on purpose: it takes plain numbers, not a database row or
 * a `SavedScan`, so the same computation serves the API, the report and the
 * phone without any of them reaching into the others.
 */

/** One room's contribution, in metres and square metres throughout. */
export type StatisticsRoom = {
  level: string;
  floorAreaSqm: number;
  perimeterM: number;
  ceilingHeightM: number;
  wallAreaGrossSqm: number;
  wallAreaNetSqm: number;
  doorCount: number;
  windowCount: number;
};

export type StatisticRow = {
  /** Stable key, for looking a row up rather than matching its label. */
  id: string;
  label: string;
  value: number;
  unit: "count" | "m" | "sqm" | "cbm";
  /** The definition behind the figure, where one exists. Counts have none —
      "how many doors" needs no defending. */
  meaning?: MeasureDefinition;
};

export type ProjectStatistics = {
  summary: StatisticRow[];
  measurements: StatisticRow[];
};

/**
 * Every figure for a set of rooms.
 *
 * Sums, never averages. A property's wall area is the sum of its rooms' wall
 * areas; there is no meaningful "average room". Ceiling height is the one
 * exception and it is deliberately absent from the totals — averaging the
 * heights of a basement and a stairwell produces a number that describes
 * neither, and volume is already the figure that height was needed for.
 */
export function projectStatistics(rooms: StatisticsRoom[]): ProjectStatistics {
  const sum = (pick: (room: StatisticsRoom) => number) =>
    rooms.reduce((total, room) => total + (Number.isFinite(pick(room)) ? pick(room) : 0), 0);

  // Distinct floors, not rooms-with-a-level: three rooms on the Ground floor
  // are one floor.
  const floors = new Set(rooms.map((room) => room.level).filter(Boolean)).size;

  return {
    summary: [
      { id: "floors", label: "Floors", value: floors, unit: "count" },
      { id: "rooms", label: "Rooms", value: rooms.length, unit: "count" },
      { id: "doors", label: "Doors", value: sum((r) => r.doorCount), unit: "count" },
      { id: "windows", label: "Windows", value: sum((r) => r.windowCount), unit: "count" },
    ],
    measurements: [
      {
        id: "floorArea",
        label: "Floor area",
        value: sum((r) => r.floorAreaSqm),
        unit: "sqm",
        meaning: MEASURE_DEFINITIONS.floorArea,
      },
      {
        id: "wallAreaGross",
        label: "Wall area (gross)",
        value: sum((r) => r.wallAreaGrossSqm),
        unit: "sqm",
        meaning: MEASURE_DEFINITIONS.wallAreaGross,
      },
      {
        id: "wallAreaNet",
        label: "Wall area (net)",
        value: sum((r) => r.wallAreaNetSqm),
        unit: "sqm",
        meaning: MEASURE_DEFINITIONS.wallAreaNet,
      },
      {
        id: "perimeter",
        label: "Perimeter",
        value: sum((r) => r.perimeterM),
        unit: "m",
        meaning: MEASURE_DEFINITIONS.perimeter,
      },
      {
        id: "volume",
        label: "Volume",
        // Per room, never total floor area × some single height: rooms have
        // different ceilings, and the whole point of the figure is the air in
        // each of them.
        value: sum((r) => r.floorAreaSqm * r.ceilingHeightM),
        unit: "cbm",
        meaning: MEASURE_DEFINITIONS.volume,
      },
    ],
  };
}

const CUBIC_METRES_TO_CUBIC_FEET = 35.3146667;

/** Cubic metres to cubic feet — the unit dehumidifier ratings are published in. */
export function cubicMetersToCubicFeet(cbm: number): number {
  return cbm * CUBIC_METRES_TO_CUBIC_FEET;
}
