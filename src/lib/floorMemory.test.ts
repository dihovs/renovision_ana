import { describe, expect, it } from "vitest";
import { mergeFloors, pruneRemembered } from "./floorMemory";

/**
 * Floors that exist before anything has been measured on them.
 *
 * The failure this guards against is the one a user actually hit: add a
 * floor plan, navigate back, and the floor is gone — because a floor was
 * only ever derived from the rooms on it.
 */

const ORDER = ["Basement", "Ground", "2nd", "3rd", "Attic"] as const;

describe("mergeFloors", () => {
  it("keeps a floor that has been created but not yet measured", () => {
    expect(mergeFloors([], ["Basement"], ORDER)).toEqual(["Basement"]);
  });

  it("does not list a floor twice once a room lands on it", () => {
    // The window where both sources name the same floor is the normal case
    // right after the first scan, not an edge case.
    expect(mergeFloors(["Basement"], ["Basement"], ORDER)).toEqual(["Basement"]);
  });

  it("orders storeys by position in the building, not by when they were added", () => {
    expect(mergeFloors(["Attic", "Ground"], ["Basement"], ORDER)).toEqual([
      "Basement",
      "Ground",
      "Attic",
    ]);
  });

  it("keeps an unrecognised storey rather than dropping it", () => {
    // Older scans carry free-typed levels. Losing one here would hide every
    // room on it from the project page.
    const merged = mergeFloors(["Garage", "Ground"], [], ORDER);
    expect(merged).toContain("Garage");
    expect(merged).toContain("Ground");
    expect(merged.indexOf("Ground")).toBeLessThan(merged.indexOf("Garage"));
  });

  it("ignores blank and whitespace-only names", () => {
    expect(mergeFloors(["", "  "], ["Ground"], ORDER)).toEqual(["Ground"]);
  });
});

describe("pruneRemembered", () => {
  it("forgets a floor once the database knows about it", () => {
    expect(pruneRemembered(["Basement"], ["Basement", "Attic"])).toEqual(["Attic"]);
  });

  it("keeps remembering a floor nobody has measured", () => {
    expect(pruneRemembered([], ["Attic"])).toEqual(["Attic"]);
  });
});
