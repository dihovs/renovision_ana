import { describe, expect, it } from "vitest";
import { detectLocale } from "./locale";

/**
 * The cases here are taken from real calls in the ElevenLabs history, not
 * invented: the first two transcripts both open with the caller having to ask
 * for their own language ("Do you speak English ?", "Change the language."),
 * which is what the greeting's language offer and these tests exist to fix.
 */
describe("detectLocale", () => {
  describe("answering the greeting's language question", () => {
    it("takes a one-word answer, which the frequency heuristic cannot see", () => {
      expect(detectLocale("English", "fr")).toBe("en");
      expect(detectLocale("Français", "en")).toBe("fr");
    });

    it("reads the language named, not the language it was named in", () => {
      // A francophone asking for English says "anglais".
      expect(detectLocale("anglais", "fr")).toBe("en");
      expect(detectLocale("french please", "en")).toBe("fr");
    });

    it("handles the phrasings real callers used", () => {
      expect(detectLocale("Do you speak English ?", "fr")).toBe("en");
      expect(detectLocale("en français svp", "en")).toBe("fr");
      expect(detectLocale("I prefer English", "fr")).toBe("en");
    });

    it("ignores accents being dropped, as ASR often does", () => {
      expect(detectLocale("francais", "en")).toBe("fr");
    });
  });

  describe("naming both languages is not a choice", () => {
    it("falls through to word frequency rather than matching the first one seen", () => {
      // Names English first but is plainly a French sentence asking for French.
      expect(detectLocale("Je parle anglais mais je préfère le français", "en")).toBe("fr");
    });
  });

  describe("ordinary speech", () => {
    it("switches on a clear margin of function words", () => {
      expect(detectLocale("Yes, we're located in Laval and I want to redo my basement", "fr")).toBe("en");
      expect(detectLocale("Oui bonjour, j'ai un dégât d'eau dans le sous-sol", "en")).toBe("fr");
    });

    it("holds the current language when the evidence is thin", () => {
      // One borrowed word must not flip a call. Renovation vocabulary is full
      // of them, which is why the heuristic scores function words instead.
      expect(detectLocale("drywall", "fr")).toBe("fr");
      expect(detectLocale("gyproc", "en")).toBe("en");
      expect(detectLocale("2932", "fr")).toBe("fr");
    });

    it("does not treat a passing mention of a language as a request", () => {
      // Over the short-utterance limit, so frequency decides — and this is
      // unmistakably an English sentence.
      expect(
        detectLocale("The contractor I had before only spoke English to me the whole time", "en"),
      ).toBe("en");
    });
  });
});
