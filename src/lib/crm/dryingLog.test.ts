import { describe, expect, it } from "vitest";
import { rankRoomMatches } from "./dryingLog";

/**
 * Matching a spoken room to a scan. (ANA-14)
 *
 * The stakes: a reading filed against the wrong room corrupts a drying log an
 * insurance adjuster may later read. Fail towards asking.
 */
const ROOMS = [
  { id: "a", name: "Salle de bain" },
  { id: "b", name: "Bathroom 2nd floor" },
  { id: "c", name: "Cuisine" },
];

describe("rankRoomMatches", () => {
  it("finds one room through accents and case", () => {
    const match = rankRoomMatches("la cuisine", ROOMS);
    // "la cuisine" ⊇ "cuisine": containment either way counts.
    expect(match.kind).toBe("one");
    if (match.kind === "one") expect(match.room.id).toBe("c");
  });

  it("asks when two rooms both answer to the word", () => {
    const match = rankRoomMatches("salle de bain", [
      { id: "a", name: "Salle de bain" },
      { id: "b", name: "Salle de bain sous-sol" },
    ]);
    expect(match.kind).toBe("many");
  });

  it("says none for a room the project does not have", () => {
    expect(rankRoomMatches("garage", ROOMS).kind).toBe("none");
  });

  it("treats silence as nothing to act on", () => {
    expect(rankRoomMatches("  ", ROOMS).kind).toBe("none");
  });
});
