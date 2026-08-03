import { describe, expect, it } from "vitest";
import { detectOptOut, optOutLine } from "./optOut";
import { findSolicitation } from "./solicitation";

/**
 * B6 — the branch that matters more than the errand.
 *
 * Recognised broadly on purpose: a wrongly-honoured opt-out costs one phone
 * call, a missed one costs the customer.
 */

describe("recognising a request to stop calling", () => {
  const refusals = [
    "Arrêtez de m'appeler s'il vous plaît.",
    "Ne me rappelez plus jamais.",
    "Ne m'appelez plus.",
    "Enlevez-moi de votre liste.",
    "Retirez-moi de vos appels, là.",
    "Je ne veux plus d'appels de vous autres.",
    "Laissez-moi tranquille.",
    "Je ne veux pas parler à un robot.",
    "C'est du harcèlement, ça.",
    "Stop calling me.",
    "Quit calling this number.",
    "Don't call me again.",
    "Don't call here.",
    "Never call me again.",
    "Take me off your list.",
    "Please remove me from your call list.",
    "Leave me alone.",
    "I don't want to talk to a robot.",
    "This is harassment.",
  ];

  for (const text of refusals) {
    it(`fires on: "${text}"`, () => {
      expect(detectOptOut(text)).toBe(true);
    });
  }
});

describe("what is not a refusal", () => {
  const keep = [
    "Oui, ça tient toujours pour demain.",
    "Rappelez-moi plutôt après cinq heures.",
    // A scheduling preference, not a refusal. Suppressing this customer's
    // appointment confirmations would help nobody.
    "Ne m'appelez pas avant neuf heures demain.",
    "Don't call me before nine, I'm at work.",
    "Can you call me back this afternoon instead?",
    "I'm driving right now, sorry.",
    "",
  ];

  for (const text of keep) {
    it(`does not fire on: "${text || "(silence)"}"`, () => {
      expect(detectOptOut(text)).toBe(false);
    });
  }
});

describe("what Ana is allowed to say about it", () => {
  it("promises the removal only when the write actually landed", () => {
    expect(optOutLine("fr", "recorded")).toContain("vous ne recevrez plus d'appels");
    expect(optOutLine("en", "recorded")).toContain("won't be getting any more calls");
  });

  it("never claims a removal that did not happen", () => {
    for (const result of ["unavailable", "no_contact"] as const) {
      for (const locale of ["fr", "en"] as const) {
        const line = optOutLine(locale, result);
        expect(line).not.toContain("tout de suite");
        expect(line).not.toContain("right now");
        // Still apologises and still promises the request goes somewhere.
        expect(line.toLowerCase()).toMatch(/excuse|sorry/);
      }
    }
  });

  it("never argues, in any variant", () => {
    for (const result of ["recorded", "unavailable", "no_contact"] as const) {
      for (const locale of ["fr", "en"] as const) {
        const line = optOutLine(locale, result);
        expect(line).not.toMatch(/\bmais\b|\bbut\b|pourquoi|why/i);
        expect(line).not.toContain("?");
        expect(findSolicitation(line, { scope: "outbound" })).toBeNull();
      }
    }
  });
});
