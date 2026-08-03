import { describe, expect, it } from "vitest";
import { SITE_EMAIL, SITE_PHONE } from "@/lib/constants";
import {
  hasSpokenOutboundDisclosure,
  OUTBOUND_DISCLOSURE,
  OUTBOUND_DISCLOSURE_VERSION,
  outboundDisclosure,
  outboundOpening,
  outboundSystemPrompt,
  SPOKEN_COMPANY,
  type OutboundKind,
} from "./agent";
import { findSolicitation } from "./solicitation";

/**
 * The opening is the only part of an outbound call that is fixed by law rather
 * than by taste, so it is the only part with a test that reads like a
 * checklist. Docs/Voice-Outbound-Compliance.md §10C(9) is the checklist.
 */

const KINDS: OutboundKind[] = ["confirm_visit", "crew_on_way", "schedule_change"];

const payload = {
  contact_name: "madame Tremblay",
  when: "demain matin à neuf heures",
  eta: "dans une trentaine de minutes",
  previous_when: "de demain matin",
  new_when: "à jeudi après-midi",
};

describe("the mandatory opening", () => {
  for (const kind of KINDS) {
    for (const locale of ["fr", "en"] as const) {
      it(`carries every required element for ${kind} in ${locale}`, () => {
        const opening = outboundOpening(kind, payload, locale);

        // (a) the business name — spelled the way TTS can say it.
        expect(opening).toContain(SPOKEN_COMPANY[locale]);
        // (c) a contact route: the number AND an email.
        expect(opening).toContain(SITE_PHONE);
        expect(opening).toContain(SITE_EMAIL);
        // (d) automated assistant, not a person.
        expect(hasSpokenOutboundDisclosure(opening)).toBe(true);
        // (e) transcribed, and (f) processed partly outside Quebec.
        expect(opening).toContain(OUTBOUND_DISCLOSURE[locale].transcription);
        // (f) the right to stop at any time.
        expect(opening).toContain(OUTBOUND_DISCLOSURE[locale].withdrawal);
        // (b) the purpose, and the one question she came to ask.
        expect(opening).toContain(payload.contact_name);
        expect(opening.trim().endsWith("?")).toBe(true);
      });
    }
  }

  it("does not solicit anything", () => {
    for (const kind of KINDS) {
      for (const locale of ["fr", "en"] as const) {
        expect(findSolicitation(outboundOpening(kind, payload, locale), { scope: "outbound" })).toBeNull();
      }
    }
  });

  it("still identifies the business when the errand has no facts at all", () => {
    const opening = outboundOpening("confirm_visit", {}, "fr");
    expect(opening).toContain(SPOKEN_COMPANY.fr);
    expect(opening).toContain(SITE_PHONE);
    expect(hasSpokenOutboundDisclosure(opening)).toBe(true);
  });

  it("is versioned, so a complaint can be answered with what was actually said", () => {
    expect(OUTBOUND_DISCLOSURE_VERSION).toBeTruthy();
  });

  it("keeps the disclosure as data rather than prose welded into the prompt", () => {
    // CRTC 2026-132 is mid-review of these exact rules. Changing the wording
    // must be an edit to one constant, not a rewrite of a prompt.
    expect(outboundDisclosure("fr")).toContain(OUTBOUND_DISCLOSURE.fr.automated);
    expect(outboundDisclosure("en")).toContain(OUTBOUND_DISCLOSURE.en.contact);
  });
});

describe("hasSpokenOutboundDisclosure", () => {
  it("recognises the identification in either language", () => {
    expect(hasSpokenOutboundDisclosure(OUTBOUND_DISCLOSURE.fr.automated)).toBe(true);
    expect(hasSpokenOutboundDisclosure(OUTBOUND_DISCLOSURE.en.automated)).toBe(true);
  });

  it("is not fooled by the receptionist's greeting", () => {
    expect(hasSpokenOutboundDisclosure("Réno-vision é-enne-é, bonjour! Je suis Ana.")).toBe(false);
    expect(hasSpokenOutboundDisclosure("")).toBe(false);
  });
});

describe("the outbound system prompt", () => {
  it("is not the receptionist prompt", () => {
    const prompt = outboundSystemPrompt("confirm_visit", payload, "fr");
    // The receptionist's central instruction is actively wrong here.
    expect(prompt).not.toContain("THE ORDER MATTERS");
    expect(prompt).toContain("You are PLACING a call");
  });

  it("forbids solicitation in words as well as in code", () => {
    const prompt = outboundSystemPrompt("confirm_visit", payload, "fr");
    expect(prompt).toContain("YOU ARE NOT SELLING ANYTHING");
    expect(prompt).toContain("YOU DO NOT QUOTE PRICES");
  });

  it("never lets her claim to be a person", () => {
    expect(outboundSystemPrompt("confirm_visit", payload, "en")).toContain(
      "the answer is always no, you are not a person",
    );
  });

  it("refuses to let her book a reschedule herself", () => {
    const prompt = outboundSystemPrompt("confirm_visit", payload, "fr");
    expect(prompt).toContain("you do not control the calendar");
    expect(prompt).toContain("repeat their own words back");
  });

  it("carries the errand's own facts, and only in spoken form", () => {
    const prompt = outboundSystemPrompt("crew_on_way", payload, "fr");
    expect(prompt).toContain("dans une trentaine de minutes");
  });

  it("adds the sixty-second re-identification only when the call has run long", () => {
    const short = outboundSystemPrompt("confirm_visit", payload, "fr");
    const long = outboundSystemPrompt("confirm_visit", payload, "fr", { pastOneMinute: true });
    expect(short).not.toContain("THIS CALL HAS RUN PAST A MINUTE");
    expect(long).toContain("THIS CALL HAS RUN PAST A MINUTE");
    expect(long).toContain(OUTBOUND_DISCLOSURE.fr.reidentification);
  });

  it("tells her the opening was already said, word for word", () => {
    const prompt = outboundSystemPrompt("confirm_visit", payload, "en");
    expect(prompt).toContain(outboundOpening("confirm_visit", payload, "en"));
  });
});
