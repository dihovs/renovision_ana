import { listClients } from "./clients";
import { clientDisplayName, clientPersonName, primaryPhone } from "./types";
import type { PhoneContact } from "./types";

/**
 * Turning a name spoken on a phone call into a client record.
 *
 * The owner says "call Madame Tremblay and confirm her visit tomorrow". By the
 * time that reaches here it has been through speech recognition, so what
 * arrives is unaccented, sometimes mangled ("Trombley"), sometimes only half a
 * name, and sometimes a company rather than a person.
 *
 * The one thing this module must never do is guess. Dialling the wrong customer
 * and telling them about someone else's appointment is a worse outcome than any
 * amount of "which Tremblay did you mean?", so every decision here is tuned to
 * fail towards asking. That is why the confident answer needs both a score
 * above a threshold AND a clear gap to the runner-up: a lone high score means
 * "this is probably her", but a high score with another one right behind it
 * means nothing at all.
 *
 * `resolveContact` is the only function that touches the database. Everything
 * that decides anything is pure and lives in `rankMatches`, so the matching can
 * be tested against hand-written rows without Supabase.
 */

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * Titles the owner says out loud that are not part of anybody's name.
 *
 * Both languages and both the spelled-out and abbreviated forms, because ASR
 * transcribes "Madame" as often as "Mme" and the dot is gone by the time we
 * look. Stripping is guarded (see `nameTokens`): if a name is nothing but
 * honorifics the tokens are kept, so a company literally called "Madame" or a
 * surname the list happens to collide with cannot be erased into nothing.
 */
const HONORIFICS = new Set([
  // French
  "m", "mme", "mlle", "madame", "mademoiselle", "monsieur", "messieurs",
  "docteur", "docteure", "dr", "dre", "me", "maitre",
  // English
  "mr", "mister", "mrs", "ms", "miss", "madam", "maam", "sir", "doctor",
]);

/**
 * Legal suffixes on Quebec company names.
 *
 * The CRM row says "Gestion Ajax Inc."; nobody says "Inc." on the phone. Left
 * in, the missing token drags the score down on every incorporated client.
 */
const COMPANY_SUFFIXES = new Set([
  "inc", "ltee", "ltd", "limited", "limitee", "enr", "senc", "sencrl", "srl",
  "corp", "co", "cie", "llc", "lp",
]);

/**
 * Lowercase, unaccented, punctuation-free.
 *
 * The accent fold is the important half: the CRM holds "Lévesque" because
 * somebody typed it properly, and the transcript holds "levesque" because ASR
 * does not punctuate. Apostrophes close up rather than split, so "D'Amour" and
 * a transcript's "Damour" land on the same string; hyphens split, so
 * "Marie-Claude" matches a caller who says only "Marie".
 */
export function normaliseName(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A name reduced to the words worth comparing.
 *
 * `dropCompanySuffixes` is only set for company names — "Co" is a plausible
 * surname fragment and stripping it from people would be a bug looking for a
 * place to happen.
 */
export function nameTokens(text: string, dropCompanySuffixes = false): string[] {
  const all = normaliseName(text).split(" ").filter(Boolean);
  if (all.length === 0) return [];

  const noise = (token: string) =>
    HONORIFICS.has(token) || (dropCompanySuffixes && COMPANY_SUFFIXES.has(token));

  const kept = all.filter((token) => !noise(token));
  // Everything was noise: the "name" is a bare "Madame". Better to compare it
  // literally than to compare an empty list against every client on file.
  return kept.length > 0 ? kept : all;
}

// ---------------------------------------------------------------------------
// String similarity
// ---------------------------------------------------------------------------

/** Classic dynamic-programming edit distance, two rows instead of a matrix. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Edit distance rescaled to 0..1 against the longer string. */
export function levenshteinSimilarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(a, b) / longest;
}

/**
 * Jaro-Winkler: built for short strings, with a bonus for a shared prefix.
 *
 * The prefix bonus is the reason it is here. Speech recognition gets the start
 * of a word right far more often than the end — "Tremblay" comes back as
 * "Trombley" or "Tremblais", never as "Xremblay" — so weighting the head of the
 * string is a fair model of how these names actually break.
 */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i += 1) {
    const from = Math.max(0, i - window);
    const to = Math.min(b.length - 1, i + window);
    for (let j = from; j <= to; j += 1) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = true;
      bMatched[j] = true;
      matches += 1;
      break;
    }
  }
  if (matches === 0) return 0;

  // Matched characters that appear in a different order on each side; each
  // such pair counts as half a transposition, per the original definition.
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k += 1;
    if (a[i] !== b[k]) transpositions += 1;
    k += 1;
  }

  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  while (prefix < 4 && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix += 1;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * How alike two single name-words are, 0..1.
 *
 * The mean of Jaro-Winkler and rescaled edit distance, and the blend is
 * deliberate: Jaro-Winkler alone is far too generous with Quebec surnames,
 * because its prefix bonus rewards exactly what these names have in common.
 * "Lavigne" against "Lavoie" scores 0.89 on Jaro-Winkler — indistinguishable
 * from the genuine ASR slip "Trombley" against "Tremblay" at 0.87, and those
 * two must land on opposite sides of any usable threshold. Edit distance
 * separates them (0.57 against 0.75) because it charges full price for the
 * divergence in the middle of the word that the prefix bonus forgives.
 * Averaging keeps Jaro-Winkler's tolerance for a mangled tail while letting
 * edit distance veto a name that merely starts the same way.
 */
export function nameSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  return (jaroWinkler(a, b) + levenshteinSimilarity(a, b)) / 2;
}

// ---------------------------------------------------------------------------
// Scoring a whole name
// ---------------------------------------------------------------------------

/**
 * Every word the owner said has to land on a word the client actually has.
 *
 * Without this, a perfect surname carries a wrong given name over the line:
 * "Marie Tremblay" against the record "Marc Tremblay" averages out to 0.86,
 * comfortably matched, and Marc gets a phone call about Marie's appointment.
 * Marie and Marc are 0.72 alike, so a floor of 0.75 on each aligned pair rules
 * that out while leaving room for the tail-end damage ASR actually does
 * ("Mari" for Marie is 0.88).
 *
 * It applies only to words that found a partner. A name the owner said that
 * has no counterpart left to align with — "Marie Tremblay" against a record
 * holding nothing but "Tremblay" — is handled by the length penalty instead,
 * because a thin record is not the same thing as a contradicted one.
 */
export const MIN_TOKEN_SIMILARITY = 0.75;

/**
 * Compare two bags of name-words, ignoring order.
 *
 * Order-free because the owner says "Tremblay, Marie" as readily as "Marie
 * Tremblay", and because ASR drops one of the two often enough to matter. The
 * words are paired off best-first, the pair scores are averaged, and the
 * leftovers are charged for.
 *
 * The two leftover rates differ by design, and the asymmetry is the whole
 * subtlety here. Words on the client's record that the owner did not say cost
 * very little (0.10) — "call Tremblay" is ordinary shorthand, not a
 * disagreement. Words the owner said with nothing to pair against cost three
 * times as much (0.30), because he described someone the record does not
 * account for. Charging nothing for either would score a bare surname a flat
 * 1.0 against a full name, which overstates what was actually confirmed and
 * would let a partial record outrank the complete one it belongs to.
 */
export function tokenSetScore(spoken: string[], candidate: string[]): number {
  if (spoken.length === 0 || candidate.length === 0) return 0;

  // Greedy best-first pairing. Optimal assignment would be the textbook answer,
  // but names run to two or three words and greedy is identical at that size.
  const pairs: { i: number; j: number; sim: number }[] = [];
  for (let i = 0; i < spoken.length; i += 1) {
    for (let j = 0; j < candidate.length; j += 1) {
      pairs.push({ i, j, sim: nameSimilarity(spoken[i], candidate[j]) });
    }
  }
  pairs.sort((a, b) => b.sim - a.sim);

  const usedSpoken = new Set<number>();
  const usedCandidate = new Set<number>();
  let total = 0;
  for (const pair of pairs) {
    if (usedSpoken.has(pair.i) || usedCandidate.has(pair.j)) continue;
    // One contradicted word is enough to disqualify the whole client.
    if (pair.sim < MIN_TOKEN_SIMILARITY) return 0;
    usedSpoken.add(pair.i);
    usedCandidate.add(pair.j);
    total += pair.sim;
  }

  const aligned = usedSpoken.size;
  const longest = Math.max(spoken.length, candidate.length);
  const penalty =
    1 -
    (0.1 * (candidate.length - aligned)) / longest -
    (0.3 * (spoken.length - aligned)) / longest;

  return (total / aligned) * penalty;
}

/**
 * The minimum score a client needs before it is a candidate at all.
 *
 * 0.75, set by the surname pairs that bracket it. Above it must sit the
 * transcription failures that are the same person: "Trombley" heard against the
 * record for Marie Tremblay scores 0.77, "Tremblais" for her scores 0.81. Below
 * it must fall the near misses that are somebody else: "Gagné" against Marie
 * Gagnon lands on 0.74.
 *
 * Three points is all that separates those, and no threshold can widen the gap,
 * because Quebec surnames really are that close. "Boucher" against a record for
 * Bouchard scores 0.79 and will be offered as a match; that is the honest limit
 * of comparing eight characters, not a bug to tune away. Names further apart
 * than these never reach the threshold at all — "Lavigne" against Lavoie and
 * "Tremblay" against Trudel are rejected outright by the per-word floor, which
 * they fail at 0.73 and 0.58.
 *
 * So the threshold is not carrying the safety on its own. The per-word floor
 * stops a wrong given name, and the margin rule below withholds a confident
 * answer whenever anybody else is anywhere near.
 */
export const MATCH_THRESHOLD = 0.75;

/**
 * How far ahead of the runner-up the winner has to be to be answered as fact.
 *
 * 0.12. Two clients called Tremblay, with only the surname spoken, score
 * identically — nothing distinguishes them and the gap is exactly zero, which
 * is the case this rule exists for. A record that genuinely explains more of
 * what was said pulls clear by more than this: a full "Marie Tremblay" beats a
 * bare "Tremblay" record by 0.15, because the second one leaves a word
 * unaccounted for.
 *
 * Raising it costs a clarifying question. Lowering it costs a phone call to the
 * wrong customer, telling them about somebody else's appointment. Those are not
 * comparable costs, so the number sits well above the noise rather than close
 * to it.
 */
export const AMBIGUITY_MARGIN = 0.12;

/**
 * How many alternatives are worth offering.
 *
 * Four. This is read aloud on a phone call, and a list longer than that is not
 * a question the owner can answer — at which point the useful reply is "I have
 * several, which one?" rather than an inventory.
 */
export const MAX_AMBIGUOUS = 4;

/** The fields matching needs. Any `Client` row satisfies it. */
export type MatchableClient = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  phones?: PhoneContact[] | null;
};

export type ContactMatch = {
  clientId: string;
  /** How the rest of the app writes this client's name. */
  displayName: string;
  /** The person behind a company name, when the client has both. */
  personName: string | null;
  /**
   * The number to dial, or null when there is none on file. Null is not a
   * reason to hide the client: the owner asked for her by name, and "I have
   * her but there's no number on the record" is the answer he needs.
   */
  phone: string | null;
  /** Whether the name was recognised as the person or as the business. */
  matchedOn: "person" | "company";
  /** 0..1, rounded for legibility. Not a probability, just a ranking. */
  score: number;
};

export type ResolveResult =
  | { kind: "none" }
  | { kind: "one"; match: ContactMatch }
  /** Best first, capped at MAX_AMBIGUOUS. Ana must ask, not pick. */
  | { kind: "ambiguous"; matches: ContactMatch[] };

function scoreClient(
  spoken: string[],
  client: MatchableClient,
): { score: number; matchedOn: "person" | "company" } {
  const person = nameTokens(
    [client.first_name ?? "", client.last_name ?? ""].join(" "),
  );
  const company = nameTokens(client.company_name ?? "", true);

  const personScore = tokenSetScore(spoken, person);
  const companyScore = tokenSetScore(spoken, company);

  // A client can be both a business and a person on the phone. Whichever name
  // the owner actually used is the one that decides the score.
  return companyScore > personScore
    ? { score: companyScore, matchedOn: "company" }
    : { score: personScore, matchedOn: "person" };
}

function toMatch(
  client: MatchableClient,
  score: number,
  matchedOn: "person" | "company",
): ContactMatch {
  const named = {
    first_name: client.first_name ?? null,
    last_name: client.last_name ?? null,
    company_name: client.company_name ?? null,
  };
  return {
    clientId: client.id,
    displayName: clientDisplayName(named),
    personName: clientPersonName(named),
    phone: primaryPhone({ phones: client.phones ?? [] }),
    matchedOn,
    score: Math.round(score * 1000) / 1000,
  };
}

/**
 * The whole decision, with no database in it.
 *
 * Ranking is on name alone. It is tempting to break a tie towards the client
 * who has a phone number on file, but that is guessing dressed up as
 * helpfulness — the owner would hear one confident name and never learn there
 * was a second Tremblay.
 */
export function rankMatches(spokenName: string, clients: MatchableClient[]): ResolveResult {
  const spoken = nameTokens(spokenName);
  if (spoken.length === 0) return { kind: "none" };

  const scored = clients
    .map((client) => ({ client, ...scoreClient(spoken, client) }))
    .filter((row) => row.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { kind: "none" };

  const [top, runnerUp] = scored;
  if (!runnerUp || top.score - runnerUp.score >= AMBIGUITY_MARGIN) {
    return { kind: "one", match: toMatch(top.client, top.score, top.matchedOn) };
  }

  return {
    kind: "ambiguous",
    matches: scored
      .slice(0, MAX_AMBIGUOUS)
      .map((row) => toMatch(row.client, row.score, row.matchedOn)),
  };
}

// ---------------------------------------------------------------------------
// The database half
// ---------------------------------------------------------------------------

/**
 * Ceiling on how many clients are pulled in to match against.
 *
 * The whole book is fetched and scored in memory rather than filtered in
 * Postgres, because the entire problem is names that do not match literally:
 * an `ilike '%trombley%'` returns nothing at all for the caller we are trying
 * hardest to find. Scoring a few hundred short strings is microseconds, and
 * this is one round trip on a live call where a second query would be audible.
 *
 * The limit is a real ceiling: past 1000 active clients the least recently
 * touched become unfindable by voice, and this needs to become a Postgres-side
 * trigram search instead.
 */
const MAX_CLIENTS_SCANNED = 1000;

/**
 * Resolve a spoken name against the CRM.
 *
 * Throws whatever `listClients` throws — a missing table or an unconfigured
 * database is a real fault and should surface as one, not be flattened into
 * "no such client", which would have the owner believing a customer had been
 * deleted.
 */
export async function resolveContact(spokenName: string): Promise<ResolveResult> {
  if (!spokenName.trim()) return { kind: "none" };
  const clients = await listClients({ limit: MAX_CLIENTS_SCANNED });
  return rankMatches(spokenName, clients);
}
