import { describe, expect, it } from "vitest";
import { looksLikeVoicemail } from "./voicemail";

/**
 * The asymmetry this is tuned around: a missed mailbox leaves a slightly odd
 * message on a machine, while a false positive hangs up on a real customer
 * mid-sentence. Every "does not fire" case below is worth more than every
 * "fires" case.
 */

const opening = { turnIndex: 0 };

describe("answering-machine greetings", () => {
  const machines = [
    "Bonjour, vous avez rejoint la boîte vocale de Julie Tremblay. Laissez un message après le bip.",
    "Je ne suis pas disponible pour le moment, laissez-moi un message et je vous rappellerai.",
    "Vous êtes bien à la messagerie du 514-555-0188.",
    "Hi, you've reached Julie. Please leave a message after the tone.",
    "I'm not available right now. Record your message when you hear the beep.",
    "The person you are calling is not available to take your call. Please leave your message.",
  ];

  for (const text of machines) {
    it(`fires on: "${text.slice(0, 45)}…"`, () => {
      const verdict = looksLikeVoicemail(text, opening);
      expect(verdict.voicemail).toBe(true);
      if (verdict.voicemail) expect(verdict.reason).toBeTruthy();
    });
  }
});

describe("a person answering the phone", () => {
  const humans = [
    "Allô?",
    "Oui bonjour?",
    "Oui, c'est moi.",
    "Bonjour, Julie à l'appareil.",
    "Hello?",
    "Yes, speaking.",
    "Sorry, I'm not available tomorrow — can we move it?",
    "Je ne suis pas disponible jeudi, est-ce qu'on peut déplacer ça?",
    "",
  ];

  for (const text of humans) {
    it(`does not fire on: "${text || "(silence)"}"`, () => {
      expect(looksLikeVoicemail(text, opening).voicemail).toBe(false);
    });
  }
});

describe("only the opening of the call may be judged", () => {
  const greeting = "Laissez un message après le bip.";

  it("fires on the first turn", () => {
    expect(looksLikeVoicemail(greeting, { turnIndex: 0 }).voicemail).toBe(true);
  });

  it("still fires on the second", () => {
    expect(looksLikeVoicemail(greeting, { turnIndex: 1 }).voicemail).toBe(true);
  });

  it("refuses to fire once a conversation is under way", () => {
    // A voicemail greeting is the opening of a call and never turn nine. By
    // then the same phrase is a person telling Ana how to reach them.
    expect(looksLikeVoicemail(greeting, { turnIndex: 2 }).voicemail).toBe(false);
    expect(looksLikeVoicemail(greeting, { turnIndex: 9 }).voicemail).toBe(false);
  });
});
