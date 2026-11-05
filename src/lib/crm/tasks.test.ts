import { describe, expect, it } from "vitest";
import { rankTaskMatches, type OwnerTask } from "./tasks";

/**
 * Matching a spoken sentence to an open task. (ANA-10)
 *
 * The stakes: ticking off the wrong task un-remembers something the owner
 * still had to do. So the property under test is the same one contactMatch
 * holds — every ambiguity is a question, never a guess.
 */

function task(id: string, body: string): OwnerTask {
  return { id, created_at: "2026-08-31T00:00:00Z", body, due_date: null, done_at: null, source: "voice", call_sid: null };
}

const TASKS = [
  task("a", "Call the adjuster about the Fleury claim"),
  task("b", "Order the grey tile for Tremblay"),
  task("c", "Send the Tremblay invoice"),
];

describe("rankTaskMatches", () => {
  it("finds the one task that contains every meaningful word", () => {
    const match = rankTaskMatches("the adjuster call", TASKS);
    expect(match.kind).toBe("one");
    if (match.kind === "one") expect(match.task.id).toBe("a");
  });

  it("asks when two tasks both fit — never guesses between Tremblay tasks", () => {
    const match = rankTaskMatches("the Tremblay one", TASKS);
    expect(match.kind).toBe("many");
    if (match.kind === "many") expect(match.tasks.map((t) => t.id).sort()).toEqual(["b", "c"]);
  });

  it("offers the nearest tasks when nothing contains every word, but as a question", () => {
    const match = rankTaskMatches("tile order for the Fleury place", TASKS);
    expect(match.kind).toBe("many");
  });

  it("says none when nothing matches at all", () => {
    expect(rankTaskMatches("the dentist appointment", TASKS).kind).toBe("none");
  });

  it("hears through accents — 'Dégât' matches 'degat'", () => {
    const list = [task("x", "Photos du dégât d'eau chez Tremblay")];
    expect(rankTaskMatches("les photos du degat", list).kind).toBe("one");
  });

  it("treats empty speech as nothing to act on", () => {
    expect(rankTaskMatches("", TASKS).kind).toBe("none");
    expect(rankTaskMatches("le et de", TASKS).kind).toBe("none");
  });
});
