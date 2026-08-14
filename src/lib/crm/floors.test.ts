import { describe, expect, it } from "vitest";
import {
  compareFloorLevels,
  FLOOR_LEVELS,
  FLOOR_ORDER,
  floorIndex,
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
    // Existing rows say exactly this. Changing an id is a data migration,
    // not an edit to this file — the test is here to make that loud.
    expect(FLOOR_ORDER).toEqual(["Basement", "Ground", "2nd", "3rd", "Attic"]);
  });

  it("orders the levels bottom-up by signed index", () => {
    const indexes = FLOOR_LEVELS.map((level) => level.index);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    expect(floorIndex("Basement")).toBe(-1);
    expect(floorIndex("Ground")).toBe(0);
    expect(floorIndex("2nd")).toBe(1);
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
