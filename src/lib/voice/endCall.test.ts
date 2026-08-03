import { describe, expect, it } from "vitest";
import {
  detectCallerGoodbye,
  detectWrongNumber,
  hasCallbackNumber,
  isSignOff,
} from "./endCall";

/**
 * The asymmetry these are tuned around, and it runs the opposite way to
 * voicemail.ts: a call that lingers a few seconds costs nothing, while a call
 * that hangs up on somebody who was still talking costs the lead. Every "does
 * not fire" case below is worth more than every "fires" case.
 */

describe("the caller has said goodbye", () => {
  const goodbyes = [
    "Merci, bonne journée!",
    "Parfait. Bonne soirée!",
    "Ok, au revoir.",
    "Bye!",
    "Merci beaucoup, à bientôt.",
    "Je dois y aller, désolé.",
    "Faut que j'y aille.",
    "Je vous laisse, merci.",
    "C'est tout, merci.",
    "Thanks, have a great day!",
    "Goodbye.",
    "I have to go, sorry.",
    "I'll let you go. Take care.",
    "That's all, thanks.",
  ];

  for (const text of goodbyes) {
    it(`fires on: "${text}"`, () => {
      expect(detectCallerGoodbye(text)).toBe(true);
    });
  }
});

describe("the caller is still talking", () => {
  const notEndings = [
    // Silence is never an ending — the route's own no-speech branch owns it.
    "",
    "   ",
    // A pause rendered as a filler word.
    "Euh...",
    "Ok.",
    "Oui.",
    "Hmm, laissez-moi réfléchir.",
    // A question is a conversation, whatever else is in the sentence.
    "Bonne journée — ah, est-ce que je peux avoir votre numéro?",
    "Have a good day — actually, can I ask one more thing?",
    // The catching-yourself-on-the-way-out sentences, which people really say.
    "Bonne journée. Ah non attendez, j'ai oublié quelque chose.",
    "Bye — wait, one more thing.",
    "Au revoir... en fait, non, j'ai une autre question.",
    "Avant de raccrocher, j'aimerais savoir une chose.",
    // A goodbye buried inside a paragraph is a clause, not an ending.
    "Bonne journée à vous aussi, mais je voulais juste préciser que le dégât d'eau est dans le sous-sol et que ça dure depuis trois jours maintenant.",
    // Says nothing about leaving.
    "Le plancher du salon est complètement trempé.",
    "The basement flooded last night and there's about two inches of water.",
  ];

  for (const text of notEndings) {
    it(`does not fire on: "${(text.trim() || "(silence)").slice(0, 50)}"`, () => {
      expect(detectCallerGoodbye(text)).toBe(false);
    });
  }
});

describe("Ana's own reply is a finished sign-off", () => {
  it("recognises the closing both prompts ask for", () => {
    expect(isSignOff("Parfait, c'est noté. On vous voit demain. Bonne journée!")).toBe(true);
    expect(isSignOff("Perfect, that's noted. Have a great day!")).toBe(true);
    expect(isSignOff("Merci, au revoir.")).toBe(true);
  });

  it("does not treat a farewell with a question after it as a closing", () => {
    // The prompt says "do not add a question after the closing". When she does
    // it anyway, the call is still going.
    expect(isSignOff("Bonne journée — est-ce que neuf heures tient toujours?")).toBe(false);
  });

  it("does not fire mid-errand", () => {
    expect(isSignOff("Je note ça et notre estimateur va vous rappeler.")).toBe(false);
    expect(isSignOff("D'accord, je comprends.")).toBe(false);
    expect(isSignOff("")).toBe(false);
  });

  it("will not read a hang-up request out of her own text", () => {
    // Narrower than detectCallerGoodbye on purpose: Ana never says "I have to
    // go", and quoting the customer back must not end the call.
    expect(isSignOff("Vous me dites que vous devez y aller, pas de problème.")).toBe(false);
    expect(isSignOff("You said you have to go — no problem at all.")).toBe(false);
  });
});

describe("wrong number", () => {
  const wrong = [
    "Vous avez le mauvais numéro.",
    "Non, ce n'est pas le bon numéro.",
    "Je pense que vous vous êtes trompé.",
    "Il n'y a personne de ce nom ici.",
    "Sorry, wrong number.",
    "You've got the wrong person.",
    "There's no one here by that name.",
    "Never heard of them.",
  ];

  for (const text of wrong) {
    it(`fires on: "${text}"`, () => {
      expect(detectWrongNumber(text)).toBe(true);
    });
  }

  const notWrong = [
    "",
    "Oui, c'est moi.",
    "C'est le bon numéro, oui.",
    "Mon numéro a changé, c'est maintenant le 514-555-0188.",
    "Yes, speaking.",
    "That's the right number.",
  ];

  for (const text of notWrong) {
    it(`does not fire on: "${text || "(silence)"}"`, () => {
      expect(detectWrongNumber(text)).toBe(false);
    });
  }
});

describe("has the intake got a callback number", () => {
  it("finds a number however the transcriber rendered it", () => {
    expect(hasCallbackNumber(["C'est le 514-555-0188."])).toBe(true);
    expect(hasCallbackNumber(["My number is (450) 555 0199"])).toBe(true);
    expect(hasCallbackNumber(["5799903077"])).toBe(true);
    expect(hasCallbackNumber(["you can reach me at +1 514 555 0188"])).toBe(true);
    expect(hasCallbackNumber(["j'ai un dégât d'eau", "oui, 438.555.0123"])).toBe(true);
  });

  it("is not fooled by the other numbers people say on an intake call", () => {
    expect(hasCallbackNumber([])).toBe(false);
    expect(hasCallbackNumber(["La salle de bain fait environ 10 pieds par 12."])).toBe(false);
    expect(hasCallbackNumber(["Ça dure depuis le 3 mars 2026."])).toBe(false);
    expect(hasCallbackNumber(["I live at 1234 rue Principale, Laval H7X 1Y2."])).toBe(false);
  });
});
