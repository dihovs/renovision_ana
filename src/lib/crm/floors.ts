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
      above is larger. A SORT KEY, not a storey count — the attic of a
      two-storey house still sorts above its 3rd-floor id.
      Spaced by tens so a half-storey (Semi-Basement, Higher Ground Floor)
      has somewhere to sit without renumbering the building, and so the
      Swift twin can keep these as Int. */
  index: number;
};

/**
 * Ordered bottom-up, the way the building stands.
 *
 * Extended from the reference's own Add Floor list, walked on the device
 * (`../../../Docs/reference/magicplan/workflow-new-project.md`). Everything
 * there is here EXCEPT one entry, deliberately:
 *
 * **"1st Floor" is not in this list and must not be added.** The reference
 * uses the European convention, where "1st" is one storey ABOVE ground. This
 * codebase and its stored rows use the North American one, where that storey
 * is "2nd" — `room_scans.level` already says "2nd" with that meaning. Adding
 * "1st" would give one storey two spellings and split every total that groups
 * by level, which is the exact bug this module exists to end. If the labels
 * ever move to the European reading it is a data migration, not a list edit.
 */
export const FLOOR_LEVELS: readonly FloorLevel[] = [
  { id: "Land survey", label: "Land survey", index: -1000 },
  { id: "Basement 3", label: "Basement • Level 3", index: -30 },
  { id: "Basement 2", label: "Basement • Level 2", index: -20 },
  { id: "Basement", label: "Basement", index: -10 },
  { id: "Semi-Basement", label: "Semi-Basement", index: -5 },
  { id: "Ground", label: "Ground Floor", index: 0 },
  { id: "Higher Ground", label: "Higher Ground Floor", index: 5 },
  { id: "2nd", label: "2nd Floor", index: 10 },
  { id: "3rd", label: "3rd Floor", index: 20 },
  { id: "4th", label: "4th Floor", index: 30 },
  { id: "5th", label: "5th Floor", index: 40 },
  { id: "6th", label: "6th Floor", index: 50 },
  { id: "7th", label: "7th Floor", index: 60 },
  { id: "8th", label: "8th Floor", index: 70 },
  { id: "9th", label: "9th Floor", index: 80 },
  { id: "10th", label: "10th Floor", index: 90 },
  { id: "11th", label: "11th Floor", index: 100 },
  { id: "12th", label: "12th Floor", index: 110 },
  { id: "13th", label: "13th Floor", index: 120 },
  { id: "14th", label: "14th Floor", index: 130 },
  { id: "15th", label: "15th Floor", index: 140 },
  { id: "16th", label: "16th Floor", index: 150 },
  { id: "17th", label: "17th Floor", index: 160 },
  { id: "18th", label: "18th Floor", index: 170 },
  { id: "19th", label: "19th Floor", index: 180 },
  { id: "20th", label: "20th Floor", index: 190 },
  { id: "21st", label: "21st Floor", index: 200 },
  { id: "22nd", label: "22nd Floor", index: 210 },
  { id: "23rd", label: "23rd Floor", index: 220 },
  { id: "24th", label: "24th Floor", index: 230 },
  { id: "25th", label: "25th Floor", index: 240 },
  { id: "26th", label: "26th Floor", index: 250 },
  { id: "27th", label: "27th Floor", index: 260 },
  { id: "28th", label: "28th Floor", index: 270 },
  { id: "29th", label: "29th Floor", index: 280 },
  { id: "30th", label: "30th Floor", index: 290 },
  { id: "31st", label: "31st Floor", index: 300 },
  { id: "32nd", label: "32nd Floor", index: 310 },
  { id: "33rd", label: "33rd Floor", index: 320 },
  { id: "34th", label: "34th Floor", index: 330 },
  { id: "35th", label: "35th Floor", index: 340 },
  { id: "36th", label: "36th Floor", index: 350 },
  { id: "37th", label: "37th Floor", index: 360 },
  { id: "38th", label: "38th Floor", index: 370 },
  { id: "39th", label: "39th Floor", index: 380 },
  { id: "40th", label: "40th Floor", index: 390 },
  { id: "41st", label: "41st Floor", index: 400 },
  { id: "42nd", label: "42nd Floor", index: 410 },
  { id: "43rd", label: "43rd Floor", index: 420 },
  { id: "44th", label: "44th Floor", index: 430 },
  { id: "45th", label: "45th Floor", index: 440 },
  { id: "46th", label: "46th Floor", index: 450 },
  { id: "47th", label: "47th Floor", index: 460 },
  { id: "48th", label: "48th Floor", index: 470 },
  { id: "49th", label: "49th Floor", index: 480 },
  { id: "50th", label: "50th Floor", index: 490 },
  { id: "Attic", label: "Attic", index: 1000 },
  { id: "Roof", label: "Roof", index: 1100 },
];

/** The stored ids in building order — the shape `mergeFloors` and every
    "offer the floors" list consumes. */
export const FLOOR_ORDER: readonly string[] = FLOOR_LEVELS.map((level) => level.id);

/**
 * The storeys nearly every job is on, most-common-first — the short list a
 * floor picker leads with, the rest one tap behind "See more". Ground first
 * because most water starts there; Basement second because this trade lives
 * in basements; 2nd for the storey above. PRESENTATION order, not building
 * order — a subset of `FLOOR_ORDER`, never a sixth spelling.
 */
export const COMMON_FLOOR_IDS: readonly string[] = ["Ground", "Basement", "2nd"];

/**
 * The reference's own "Most common" set, for comparing the two side by side.
 *
 * Theirs is Ground and the storeys above it; every basement is filed under
 * "Other floors". That is an appraiser's ordering — appraisals are about
 * living area, and living area is mostly above grade.
 *
 * It is the wrong ordering for THIS trade, which is why `COMMON_FLOOR_IDS`
 * above leads with Ground and Basement. Kept here so the difference can be
 * tested rather than argued about, and so nobody re-derives it from scratch.
 *
 * Note the absence of "1st" — see the note on `FLOOR_LEVELS`. This is their
 * ordering expressed in OUR vocabulary, not a second vocabulary.
 */
export const REFERENCE_COMMON_FLOOR_IDS: readonly string[] = [
  "Ground",
  "2nd",
  "3rd",
  "4th",
];

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
