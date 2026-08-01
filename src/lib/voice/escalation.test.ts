import { describe, expect, it } from "vitest";
import { shouldEscalate, similarity } from "./escalation";

describe("similarity", () => {
  it("scores identical questions as 1", () => {
    expect(similarity("how much to redo the kitchen floor", "how much to redo the kitchen floor")).toBe(1);
  });

  it("scores unrelated questions as 0", () => {
    expect(similarity("how much for a new deck", "when can someone visit")).toBe(0);
  });

  it("scores same-room follow-ups below the escalation threshold", () => {
    // The doc-comment case: {much, kitchen, floor} vs {much, bathroom, floor}
    // share 2 of 4 distinct words -> 0.5, under the 0.55 threshold.
    expect(similarity("how much for the kitchen floor", "how much for the bathroom floor")).toBeCloseTo(0.5);
  });

  it("folds accents so French repeats match across spellings", () => {
    expect(similarity("Combien ça coûte pour la salle de bain", "combien ca coute salle bain")).toBe(1);
  });

  it("returns 0 when either side has no content words", () => {
    expect(similarity("the of and", "how much for the kitchen floor")).toBe(0);
    expect(similarity("", "anything at all")).toBe(0);
  });
});

describe("shouldEscalate", () => {
  const KITCHEN = "how much to redo the kitchen floor";

  it("stays escalated for the rest of the call", () => {
    const verdict = shouldEscalate("anything", [], { alreadyEscalated: true });
    expect(verdict).toEqual({ escalate: true, repeatCount: 0, reason: "already escalated" });
  });

  it("escalates immediately on explicit frustration, English and French", () => {
    const en = shouldEscalate("That's not what I asked, how much for the roof?", []);
    expect(en.escalate).toBe(true);
    expect(en.repeatCount).toBe(1);

    const fr = shouldEscalate("Je répète, combien pour la toiture?", []);
    expect(fr.escalate).toBe(true);
  });

  it("does not escalate on fragments like 'Quoi?' or 'What?'", () => {
    expect(shouldEscalate("Quoi?", [KITCHEN, KITCHEN]).escalate).toBe(false);
    expect(shouldEscalate("What?", [KITCHEN, KITCHEN]).escalate).toBe(false);
  });

  it("waits for the default two repeats before escalating", () => {
    const first = shouldEscalate(KITCHEN, [KITCHEN]);
    expect(first.escalate).toBe(false);
    expect(first.repeatCount).toBe(1);

    const second = shouldEscalate(KITCHEN, [KITCHEN, KITCHEN]);
    expect(second.escalate).toBe(true);
    expect(second.repeatCount).toBe(2);
    expect(second.reason).toBe("caller has asked this 3 times");
  });

  it("honours a lower repeatsBeforeEscalating", () => {
    expect(shouldEscalate(KITCHEN, [KITCHEN], { repeatsBeforeEscalating: 1 }).escalate).toBe(true);
  });

  it("does not count a different-room question as a repeat", () => {
    const verdict = shouldEscalate(
      "how much for the bathroom floor",
      ["how much for the kitchen floor"],
      { repeatsBeforeEscalating: 1 },
    );
    expect(verdict.escalate).toBe(false);
    expect(verdict.repeatCount).toBe(0);
  });

  it("false-positives on words containing a marker substring (known trade-off)", () => {
    // DOCUMENTS CURRENT BEHAVIOR: the marker "again," normalises to "again"
    // and matching is by substring, so "against" triggers the frustration
    // path on a first, perfectly calm turn. The stated design accepts cheap
    // wrong-direction failures (an unnecessary Sonnet turn), but a
    // word-boundary match would avoid this one.
    const verdict = shouldEscalate("It is leaning against the wall and we want it fixed", []);
    expect(verdict.escalate).toBe(true);
    expect(verdict.reason).toContain("again");
  });
});
