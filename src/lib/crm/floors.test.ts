import { describe, expect, it } from "vitest";
import {
  COMMON_FLOOR_IDS,
  compareFloorLevels,
  FLOOR_LEVELS,
  FLOOR_ORDER,
  floorIndex,
  REFERENCE_COMMON_FLOOR_IDS,
  parseFloorLevel,
} from "./floors";

/**
 * The floor vocabulary is a data contract, not a UI list: `room_scans.level`
 * stores these exact strings, and every total groups by them. These tests pin
 * the two things that must never drift — the stored spellings and the
 * building order.
 */

describe("the floor vocabulary", () => {
  it("keeps the stored spellings the database already contains", () => {
    // Existing rows say exactly these. Changing or removing an id is a data
    // migration, not an edit to this file — the test is here to make that
    // loud. ADDING a level is fine and expected; the guard is on the five
    // that already exist in the column, not on the length of the list.
    for (const stored of ["Basement", "Ground", "2nd", "3rd", "Attic"]) {
      expect(FLOOR_ORDER, stored).toContain(stored);
    }
  });

  it("refuses a second spelling for one storey", () => {
    // The reference calls the storey above ground "1st"; this codebase and
    // its rows call it "2nd". Holding both would split every total that
    // groups by level — one floor silently becoming two, which is the whole
    // reason this module exists.
    expect(FLOOR_ORDER).not.toContain("1st");
    expect(FLOOR_ORDER).not.toContain("1st Floor");
    // And no id may repeat an index, which is the general form of that bug.
    const indexes = FLOOR_LEVELS.map((l) => l.index);
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it("expresses the reference's common set in OUR vocabulary", () => {
    // Kept so the two orderings can be compared rather than argued about.
    // Every id in it must be a real level — a common list naming a storey
    // the vocabulary does not have is a picker with a dead row.
    for (const id of REFERENCE_COMMON_FLOOR_IDS) {
      expect(FLOOR_ORDER, id).toContain(id);
    }
    // Theirs leads with above-grade storeys; ours puts Basement second,
    // because this trade works in basements. That difference is the point.
    expect(REFERENCE_COMMON_FLOOR_IDS).not.toContain("Basement");
    expect(COMMON_FLOOR_IDS).toContain("Basement");
  });

  it("orders the levels bottom-up by signed index", () => {
    const indexes = FLOOR_LEVELS.map((level) => level.index);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    // Values, not meanings: the contract is the ORDER, and the gaps exist so
    // a half-storey can be inserted without renumbering the building.
    expect(floorIndex("Basement")!).toBeLessThan(floorIndex("Ground")!);
    expect(floorIndex("Ground")).toBe(0);
    expect(floorIndex("Ground")!).toBeLessThan(floorIndex("2nd")!);
    expect(floorIndex("Semi-Basement")!).toBeGreaterThan(floorIndex("Basement")!);
    expect(floorIndex("Semi-Basement")!).toBeLessThan(floorIndex("Ground")!);
  });

  it("parses stored text tolerantly of case and whitespace, and nothing more", () => {
    expect(parseFloorLevel(" basement ")?.id).toBe("Basement");
    expect(parseFloorLevel("GROUND")?.id).toBe("Ground");
    // Abbreviations are NOT guessed at — "Bsmt" as a second spelling of
    // Basement is exactly how one floor becomes two.
    expect(parseFloorLevel("Bsmt")).toBeNull();
    expect(parseFloorLevel("")).toBeNull();
    expect(parseFloorLevel(null)).toBeNull();
  });

  it("leads pickers with the common three, spelled exactly as stored", () => {
    // Presentation order — Ground, then Basement (this trade lives in
    // basements), then 2nd. The pickers show these first with the rest
    // behind "See more".
    expect(COMMON_FLOOR_IDS).toEqual(["Ground", "Basement", "2nd"]);
    // A common id must be a stored id: a spelling here that FLOOR_ORDER
    // does not know would be the one-floor-becomes-two bug reborn.
    for (const id of COMMON_FLOOR_IDS) {
      expect(FLOOR_ORDER).toContain(id);
    }
  });

  it("sorts known levels by building order and unknown text after them", () => {
    const shuffled = ["Attic", "Mezzanine", "Basement", "2nd", "Ground"];
    expect([...shuffled].sort(compareFloorLevels)).toEqual([
      "Basement",
      "Ground",
      "2nd",
      "Attic",
      "Mezzanine",
    ]);
  });
});
