import { describe, expect, it } from "vitest";
import {
  findSolicitation,
  safeRedirectLine,
  solicitationFlag,
  type SolicitationScope,
} from "./solicitation";

/**
 * The line between "a call about your appointment" and ADAD telemarketing.
 *
 * Every case below is a sentence a model could plausibly produce, not a
 * synthetic token — the guardrail is worth nothing if it only catches text
 * written to be caught.
 */

function hit(text: string, scope: SolicitationScope = "outbound") {
  return findSolicitation(text, { scope });
}

describe("the no-solicitation deny-list, outbound", () => {
  const blocked: Array<[string, string]> = [
    ["FR, an amount", "Ça vous coûterait environ deux mille dollars pour la salle de bain."],
    ["FR, a quote", "Je peux vous envoyer une soumission cette semaine si vous voulez."],
    ["FR, a promotion", "On a un rabais de vingt pour cent ce mois-ci."],
    ["FR, asking for a decision", "Voulez-vous qu'on procède avec les travaux?"],
    ["FR, a signature", "Il faudrait juste signer le contrat avant vendredi."],
    ["EN, an amount", "It would be around two thousand dollars for the bathroom."],
    ["EN, a quote", "I can send you a quote this week if you like."],
    ["EN, a promotion", "We have a special offer running this month."],
    ["EN, asking for a decision", "Would you like to go ahead with the work?"],
    ["EN, a price", "Our rates start lower than that, actually."],
  ];

  for (const [label, text] of blocked) {
    it(`catches ${label}`, () => {
      expect(hit(text)).not.toBeNull();
    });
  }

  const allowed = [
    "Parfait, c'est noté. On vous voit demain à neuf heures alors. Bonne journée!",
    "L'équipe est en route, elle devrait arriver dans une trentaine de minutes.",
    "Jeudi avant-midi, c'est noté. Quelqu'un va vous rappeler pour confirmer l'heure.",
    "No problem. I can't go over the file with anyone else, but is there a good time to reach her?",
    "The crew is running about thirty minutes behind — sorry about that.",
    "Oh, je m'excuse — j'ai dû composer le mauvais numéro. Bonne journée!",
  ];

  for (const text of allowed) {
    it(`lets an ordinary errand line through: "${text.slice(0, 40)}…"`, () => {
      expect(hit(text)).toBeNull();
    });
  }

  it("says which rule fired and on what", () => {
    const result = hit("We have a special offer this month.");
    expect(result?.rule).toBe("promotion");
    expect(result?.matched.toLowerCase()).toContain("special offer");
  });
});

describe("the same deny-list, inbound", () => {
  /**
   * Narrower on purpose. The inbound receptionist is *supposed* to talk about
   * quotes and point people at the estimator; flagging every one of those calls
   * would produce a review queue nobody reads, which is the same as no
   * guardrail at all.
   */
  it("still catches an amount of money, which she has no way to know", () => {
    expect(hit("Ça tourne autour de trois mille dollars.", "inbound")).not.toBeNull();
    expect(hit("That runs about three thousand dollars.", "inbound")).not.toBeNull();
  });

  it("still catches a promotion, because there is never one", () => {
    expect(hit("On a un rabais ce mois-ci.", "inbound")).not.toBeNull();
  });

  it("does not flag the receptionist doing her actual job", () => {
    expect(
      hit(
        "Je n'ai pas les prix, mais notre estimateur peut vous faire une soumission après la visite.",
        "inbound",
      ),
    ).toBeNull();
    expect(
      hit("I don't have the pricing, but our estimator can quote it after a visit.", "inbound"),
    ).toBeNull();
  });
});

describe("the line Ana says instead", () => {
  /**
   * The replacement has to survive its own check. If it did not, a blocked turn
   * would be replaced by another blocked turn and the guardrail would either
   * loop or leak — and this test is the reason safeRedirectLine() says "les
   * chiffres" and "a firm number" rather than the obvious words.
   */
  it("is not itself a solicitation, in either language", () => {
    expect(hit(safeRedirectLine("fr"))).toBeNull();
    expect(hit(safeRedirectLine("en"))).toBeNull();
    expect(hit(safeRedirectLine("fr"), "inbound")).toBeNull();
    expect(hit(safeRedirectLine("en"), "inbound")).toBeNull();
  });

  it("still answers the question it is replacing", () => {
    expect(safeRedirectLine("fr")).toContain("estimateur");
    expect(safeRedirectLine("en")).toContain("estimator");
  });
});

describe("the transcript flag", () => {
  it("records the scope, the rule and the token", () => {
    const found = hit("We have a special offer this month.");
    expect(found).not.toBeNull();
    expect(solicitationFlag(found!, "outbound")).toBe("solicitation:outbound:promotion:special offer");
  });
});

describe("empty input", () => {
  it("is not a hit", () => {
    expect(hit("")).toBeNull();
  });
});
