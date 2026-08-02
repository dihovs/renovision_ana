import { describe, expect, it } from "vitest";
import {
  AMBIGUITY_MARGIN,
  MATCH_THRESHOLD,
  jaroWinkler,
  levenshtein,
  nameSimilarity,
  nameTokens,
  normaliseName,
  rankMatches,
  tokenSetScore,
  type MatchableClient,
} from "./contactMatch";
import type { PhoneContact } from "./types";

/** A phone the way the CRM stores one. */
function phone(number: string): PhoneContact {
  return { number, type: "mobile", primary: true, smsAllowed: false };
}

/** The book Ana is matching against in most of these tests. */
const MARIE: MatchableClient = {
  id: "marie",
  first_name: "Marie",
  last_name: "Tremblay",
  phones: [phone("514-555-0101")],
};

const TRUDEL: MatchableClient = {
  id: "trudel",
  first_name: "Josée",
  last_name: "Trudel",
  phones: [phone("514-555-0102")],
};

const AJAX: MatchableClient = {
  id: "ajax",
  first_name: "Marc",
  last_name: "Bélanger",
  company_name: "Gestion Ajax Inc.",
  phones: [phone("450-555-0199")],
};

const BOOK = [MARIE, TRUDEL, AJAX];

/** Narrow a result to `one`, failing with a readable message when it is not. */
function expectOne(result: ReturnType<typeof rankMatches>) {
  expect(result.kind, JSON.stringify(result)).toBe("one");
  if (result.kind !== "one") throw new Error("unreachable");
  return result.match;
}

describe("normaliseName", () => {
  it("folds the accents a transcript will never have", () => {
    expect(normaliseName("Lévesque")).toBe("levesque");
    expect(normaliseName("Bélanger-Côté")).toBe("belanger cote");
  });

  it("closes up apostrophes but splits hyphens", () => {
    // "D'Amour" and a transcript's "Damour" have to land on one string, while
    // "Marie-Claude" has to become two words so half of it can still match.
    expect(normaliseName("D'Amour")).toBe("damour");
    expect(normaliseName("Marie-Claude")).toBe("marie claude");
  });
});

describe("nameTokens", () => {
  it("drops honorifics the owner says out loud", () => {
    expect(nameTokens("Madame Tremblay")).toEqual(["tremblay"]);
    expect(nameTokens("Monsieur Marc Bélanger")).toEqual(["marc", "belanger"]);
    expect(nameTokens("Mrs. Tremblay")).toEqual(["tremblay"]);
  });

  it("drops company suffixes, but only for companies", () => {
    expect(nameTokens("Gestion Ajax Inc.", true)).toEqual(["gestion", "ajax"]);
    // "Co" is a plausible fragment of somebody's surname; a person keeps it.
    expect(nameTokens("Co Nguyen")).toEqual(["co", "nguyen"]);
  });

  it("keeps a name that is nothing but honorifics rather than emptying it", () => {
    // Otherwise a bare "Madame" would compare an empty token list against every
    // client on file and match all of them equally.
    expect(nameTokens("Madame")).toEqual(["madame"]);
  });
});

describe("string similarity", () => {
  it("measures edit distance and prefix similarity as expected", () => {
    expect(levenshtein("tremblay", "trombley")).toBe(2);
    expect(jaroWinkler("tremblay", "tremblay")).toBe(1);
    expect(jaroWinkler("tremblay", "gagnon")).toBe(0);
  });

  it("blends the two so a shared prefix alone is not enough", () => {
    // Jaro-Winkler rates Lavigne/Lavoie (0.89) above the genuine ASR slip
    // Trombley/Tremblay (0.87) — the prefix bonus rewards what these names have
    // in common. Edit distance charges for the divergence in the middle, and
    // the average puts them back on the right sides of each other.
    expect(jaroWinkler("lavigne", "lavoie")).toBeGreaterThan(jaroWinkler("tremblay", "trombley"));
    expect(nameSimilarity("lavigne", "lavoie")).toBeLessThan(nameSimilarity("tremblay", "trombley"));
  });

  it("scores identical words as exactly 1", () => {
    expect(nameSimilarity("tremblay", "tremblay")).toBe(1);
  });
});

describe("tokenSetScore", () => {
  it("ignores the order the two names were said in", () => {
    expect(tokenSetScore(["tremblay", "marie"], ["marie", "tremblay"])).toBe(1);
  });

  it("charges more for a word the owner said than for one he left out", () => {
    // "Tremblay" against the record "Marie Tremblay" is ordinary shorthand.
    // "Marie Tremblay" against a record holding only "Tremblay" leaves a name
    // the record cannot account for, which is weaker evidence.
    const shorthand = tokenSetScore(["tremblay"], ["marie", "tremblay"]);
    const unaccounted = tokenSetScore(["marie", "tremblay"], ["tremblay"]);
    expect(shorthand).toBeGreaterThan(unaccounted);
    expect(unaccounted).toBeGreaterThan(MATCH_THRESHOLD);
  });

  it("refuses a client outright when one spoken word is contradicted", () => {
    // Not merely a low score: Marie and Marc are 0.72 alike and the shared
    // surname would otherwise average them up to 0.86 and dial the wrong man.
    expect(tokenSetScore(["marie", "tremblay"], ["marc", "tremblay"])).toBe(0);
  });
});

describe("rankMatches", () => {
  it("resolves a name said in full", () => {
    const match = expectOne(rankMatches("Marie Tremblay", BOOK));
    expect(match.clientId).toBe("marie");
    expect(match.score).toBe(1);
    expect(match.phone).toBe("514-555-0101");
  });

  it("resolves a name the transcript stripped of its accents", () => {
    const levesque: MatchableClient = {
      id: "levesque",
      first_name: "Anne",
      last_name: "Lévesque",
      phones: [phone("418-555-0144")],
    };
    const match = expectOne(rankMatches("Anne Levesque", [...BOOK, levesque]));
    expect(match.clientId).toBe("levesque");
    expect(match.score).toBe(1);
  });

  it("ignores the honorific in front of the name", () => {
    expect(expectOne(rankMatches("Madame Tremblay", BOOK)).clientId).toBe("marie");
    expect(expectOne(rankMatches("Monsieur Marc Bélanger", BOOK)).clientId).toBe("ajax");
  });

  it("still finds the client when speech recognition mangles the surname", () => {
    // The two shapes this actually takes: a vowel swapped in the middle, and a
    // phonetic ending. Both are Marie Tremblay and both have to survive.
    for (const heard of ["Trombley", "Madame Tremblais"]) {
      const match = expectOne(rankMatches(heard, BOOK));
      expect(match.clientId, heard).toBe("marie");
      expect(match.score, heard).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
    }
  });

  // The test that matters most. Two Tremblays and a surname is not a question
  // this module is allowed to answer — silently picking one dials a customer
  // and tells them about somebody else's appointment.
  it("reports two same-surname clients as ambiguous instead of guessing", () => {
    const marc: MatchableClient = {
      id: "marc",
      first_name: "Marc",
      last_name: "Tremblay",
      phones: [phone("514-555-0202")],
    };
    const result = rankMatches("Madame Tremblay", [...BOOK, marc]);

    expect(result.kind).toBe("ambiguous");
    if (result.kind !== "ambiguous") throw new Error("unreachable");
    expect(result.matches.map((m) => m.clientId).sort()).toEqual(["marc", "marie"]);
    // Nothing in the utterance separates them, so nothing in the scores does
    // either. "Madame" is not treated as a hint towards Marie: it is a title,
    // not evidence, and half the Marcs in Laval have a wife who answers.
    expect(result.matches[0].score - result.matches[1].score).toBeLessThan(AMBIGUITY_MARGIN);
  });

  it("stays ambiguous when a second record is merely close, not identical", () => {
    // A duplicate entered with a different spelling. It scores lower than the
    // exact record but not far enough lower to be dismissed, and choosing
    // between them is the owner's call.
    const misspelt: MatchableClient = {
      id: "misspelt",
      first_name: "Marie",
      last_name: "Trembley",
      phones: [phone("514-555-0303")],
    };
    const result = rankMatches("Tremblay", [...BOOK, misspelt]);
    expect(result.kind).toBe("ambiguous");
    if (result.kind !== "ambiguous") throw new Error("unreachable");
    expect(result.matches[0].clientId).toBe("marie");
    expect(result.matches[1].clientId).toBe("misspelt");
  });

  it("caps how many alternatives it offers", () => {
    const crowd: MatchableClient[] = ["Anne", "Bruno", "Chantal", "Denis", "Élise"].map(
      (first, i) => ({ id: `t${i}`, first_name: first, last_name: "Tremblay", phones: [] }),
    );
    const result = rankMatches("Tremblay", crowd);
    expect(result.kind).toBe("ambiguous");
    if (result.kind !== "ambiguous") throw new Error("unreachable");
    // Five identical-scoring Tremblays read out on a phone call is not a
    // question anyone can answer; the caller gets four and asks differently.
    expect(result.matches).toHaveLength(4);
  });

  it("resolves a first name on its own", () => {
    expect(expectOne(rankMatches("Josée", BOOK)).clientId).toBe("trudel");
  });

  it("resolves a name said back to front", () => {
    expect(expectOne(rankMatches("Tremblay, Marie", BOOK)).clientId).toBe("marie");
  });

  it("resolves a client that is a business rather than a person", () => {
    // Said without the "Inc.", because nobody says "Inc." out loud.
    const match = expectOne(rankMatches("Gestion Ajax", BOOK));
    expect(match.clientId).toBe("ajax");
    expect(match.matchedOn).toBe("company");
    // The company is the display name; the person behind it comes separately so
    // Ana can say "Gestion Ajax — Marc Bélanger" without reformatting anything.
    expect(match.displayName).toBe("Gestion Ajax Inc.");
    expect(match.personName).toBe("Marc Bélanger");
  });

  it("matches the person at a business by their own name", () => {
    const match = expectOne(rankMatches("Bélanger", BOOK));
    expect(match.clientId).toBe("ajax");
    expect(match.matchedOn).toBe("person");
  });

  it("returns nothing when nobody on file is that name", () => {
    expect(rankMatches("Madame Cardinal", BOOK)).toEqual({ kind: "none" });
    expect(rankMatches("", BOOK)).toEqual({ kind: "none" });
    expect(rankMatches("Tremblay", [])).toEqual({ kind: "none" });
  });

  // The threshold's other side, and the pair that fixes where it sits.
  // Lavigne/Lavoie (0.73) and Gagné/Gagnon (0.74) are real Quebec surnames that
  // look like ones on file but belong to different people; they sit only three
  // points under the genuine ASR damage the matcher has to forgive. Loosen the
  // threshold to catch more transcription noise and these start dialling the
  // wrong customer. Lavallée/Lavoie (0.65) is the comfortable case.
  it("does not match a name that is merely similar to one on file", () => {
    const lavoie: MatchableClient = {
      id: "lavoie",
      first_name: "Josée",
      last_name: "Lavoie",
      phones: [phone("514-555-0155")],
    };
    const gagnon: MatchableClient = {
      id: "gagnon",
      first_name: "Marie",
      last_name: "Gagnon",
      phones: [phone("514-555-0166")],
    };
    const book = [...BOOK, lavoie, gagnon];

    for (const heard of ["Madame Lavigne", "Madame Gagné", "Madame Lavallée"]) {
      expect(rankMatches(heard, book), heard).toEqual({ kind: "none" });
    }
  });

  it("does forgive a surname the transcript simply cut short", () => {
    // The other side of the same coin, kept honest: "Tremble" is not a
    // different surname, it is Tremblay with the ending lost, and treating it
    // as a stranger would make the matcher useless on a bad line.
    expect(expectOne(rankMatches("Monsieur Tremble", BOOK)).clientId).toBe("marie");
  });

  it("returns a client with no number on file, with the number as null", () => {
    // Dropping her would report "no such client", which is a lie — she exists,
    // she just cannot be dialled, and that is what the owner needs told.
    const noPhone: MatchableClient = {
      id: "nophone",
      first_name: "Chantal",
      last_name: "Ouellet",
      phones: [],
    };
    const match = expectOne(rankMatches("Chantal Ouellet", [...BOOK, noPhone]));
    expect(match.clientId).toBe("nophone");
    expect(match.phone).toBeNull();
  });

  it("does not let a missing phone number change the ranking", () => {
    // Preferring the dialable Tremblay would be guessing dressed up as
    // helpfulness: the owner would hear one confident name and never learn
    // there was a second.
    const marcNoPhone: MatchableClient = {
      id: "marc",
      first_name: "Marc",
      last_name: "Tremblay",
      phones: [],
    };
    const result = rankMatches("Tremblay", [MARIE, marcNoPhone]);
    expect(result.kind).toBe("ambiguous");
  });
});
