/**
 * The floor vocabulary — one list, one order, one spelling.
 *
 * `room_scans.level` is a text label, and every total, floor plan and report
 * groups by it. The list used to be hard-coded in four places across two
 * languages, so adding a storey meant four edits and a typo meant one floor
 * silently split into two. This module is the only place the list lives on
 * the web; the Swift capture flow (`CaptureFlow.swift`) still carries its own
 * copy and is deliberately not edited from here — its consumption of this
 * vocabulary is an integration-time change.
 *
 * BACKWARD COMPATIBILITY IS THE CONSTRAINT. Existing rows say "Basement",
 * "Ground", "2nd" — the `id` strings below ARE those stored values and must
 * never change. Renaming what the operator sees is what `label` is for.
 */

export type FloorLevel = {
  /** The stored text value in `room_scans.level`. Never change these:
      the database already says "Basement", "Ground", "2nd". */
  id: string;
  /** What the UI shows. Identical to `id` today, because the column predates
      this module — but a future rename edits this field and no data. */
  label: string;
  /** Signed storey index: below grade is negative, ground is 0, each storey
      above adds one. A SORT KEY, not a storey count — the attic of a
      two-storey house still sorts above its 3rd-floor id. */
  index: number;
};

/** Ordered bottom-up, the way the building stands. */
export const FLOOR_LEVELS: readonly FloorLevel[] = [
  { id: "Basement", label: "Basement", index: -1 },
  { id: "Ground", label: "Ground", index: 0 },
  { id: "2nd", label: "2nd", index: 1 },
  { id: "3rd", label: "3rd", index: 2 },
  { id: "Attic", label: "Attic", index: 3 },
];

/** The stored ids in building order — the shape `mergeFloors` and every
    "offer the floors" list consumes. */
export const FLOOR_ORDER: readonly string[] = FLOOR_LEVELS.map((level) => level.id);

/**
 * Find the level a stored text value names, or null for text this vocabulary
 * does not know. Tolerant of case and whitespace — those are typos — but
 * deliberately NOT of abbreviations ("Bsmt"): guessing at spellings is how
 * one floor becomes two, which is the bug this module exists to end.
 */
export function parseFloorLevel(stored: string | null | undefined): FloorLevel | null {
  const text = (stored ?? "").trim().toLowerCase();
  if (!text) return null;
  return FLOOR_LEVELS.find((level) => level.id.toLowerCase() === text) ?? null;
}

/** The signed index of a stored level, or null when the text is unknown. */
export function floorIndex(stored: string | null | undefined): number | null {
  return parseFloorLevel(stored)?.index ?? null;
}

/**
 * Sort comparator for stored level texts: known levels in building order,
 * unknown ones after them (alphabetically, so the order is at least
 * deterministic). An unknown level is still shown — a row that exists is a
 * row that appears — it just cannot claim a place in the building.
 */
export function compareFloorLevels(a: string, b: string): number {
  const ai = floorIndex(a);
  const bi = floorIndex(b);
  if (ai === null && bi === null) return a.localeCompare(b);
  if (ai === null) return 1;
  if (bi === null) return -1;
  return ai - bi;
}
