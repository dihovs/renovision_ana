/**
 * Detecting that the cheap model isn't landing.
 *
 * The rule from the spec: when a caller asks essentially the same question a
 * second or third time, Haiku's answer isn't working — switch to Sonnet and try
 * harder. Not token counts, not call duration: repetition.
 *
 * Deliberately deterministic and local. The obvious alternative is to ask a
 * model "is this a repeat?", but that adds a network round trip to the middle
 * of a live phone call to answer a question that string comparison answers well
 * enough. On a call, 300ms of silence is expensive and being slightly wrong
 * about escalation is cheap — so this trades accuracy for latency on purpose.
 *
 * What it will get wrong, stated plainly:
 *  - A caller who legitimately asks two similar-but-different questions
 *    ("how much for the kitchen floor" / "how much for the bathroom floor")
 *    scores high on shared words and may escalate early. The cost is a slightly
 *    more expensive turn, so the failure is cheap and in the right direction.
 *  - A caller who rephrases completely ("how much" → "what's that going to run
 *    me") shares almost no content words and will NOT be caught by similarity.
 *    That is what the frustration markers below are for.
 *  - Very short turns ("what?", "hein?") are handled separately, because two
 *    words can be identical without being a repeated question.
 */

/**
 * Words carrying no topic signal. Both languages, because a Quebec caller
 * switches mid-sentence and a French-only list would make "combien ça coûte"
 * and "how much does it cost" look like different topics when they are the
 * same question asked twice.
 */
const STOPWORDS = new Set([
  // French
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "a", "à", "au",
  "aux", "ce", "ça", "cet", "cette", "je", "tu", "il", "elle", "on", "nous",
  "vous", "ils", "elles", "me", "te", "se", "mon", "ma", "mes", "ton", "ta",
  "votre", "vos", "que", "qui", "quoi", "est", "sont", "être", "avoir", "fait",
  "pour", "avec", "dans", "sur", "pas", "ne", "plus", "mais", "si", "en", "y",
  "par", "comme", "tout", "tous", "bien", "aussi", "alors", "donc", "là",
  // English
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "for", "with",
  "is", "are", "was", "were", "be", "been", "it", "this", "that", "i", "you",
  "we", "they", "he", "she", "my", "your", "our", "do", "does", "did", "can",
  "could", "would", "will", "just", "so", "but", "if", "not", "no", "yes",
  "there", "here", "what", "how", "when", "where", "who", "why",
]);

/**
 * Phrases that mean "you did not answer me" regardless of topic.
 *
 * These matter more than similarity: a caller who rephrases entirely shares no
 * words with their first attempt, so word overlap will never catch them — but
 * "that's not what I asked" catches it on the first try.
 */
const FRUSTRATION_MARKERS = [
  // French
  "non je", "c'est pas ça", "ce n'est pas ça", "pas ce que", "je répète",
  "je repete", "vous comprenez pas", "tu comprends pas", "je viens de dire",
  "comme j'ai dit", "encore une fois", "vous m'écoutez", "écoutez moi",
  "je vous ai dit", "je te l'ai dit",
  // English
  "no i", "that's not what", "thats not what", "not what i asked",
  "i already said", "i just said", "like i said", "you're not listening",
  "youre not listening", "you don't understand", "you dont understand",
  "listen to me", "i repeat", "again,", "as i said",
];

/** Strip accents, punctuation and case so "coûte" and "coute" match. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    // Combining marks: this is what folds é→e, ç→c, à→a.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Content words only — the topic of the sentence with the grammar removed. */
function contentWords(text: string): Set<string> {
  return new Set(
    normalise(text)
      .split(" ")
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

/**
 * Jaccard similarity: shared words over total distinct words.
 *
 * Chosen over edit distance because it ignores word order, and a caller
 * re-asking a question almost never uses the same order twice.
 */
export function similarity(a: string, b: string): number {
  const wordsA = contentWords(a);
  const wordsB = contentWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let shared = 0;
  for (const word of wordsA) if (wordsB.has(word)) shared += 1;

  const union = wordsA.size + wordsB.size - shared;
  return union === 0 ? 0 : shared / union;
}

/**
 * 0.55 rather than a rounder number, from the shape of the failure on each
 * side: too low and every follow-up about the same room counts as a repeat;
 * too high and only near-verbatim repetition is caught, which is the one case
 * a caller rarely produces. Two questions about the same topic typically land
 * around 0.3–0.45; a genuine re-ask lands above 0.6.
 */
const SIMILARITY_THRESHOLD = 0.55;

/** Below this, a turn is a fragment ("what?") rather than a question. */
const MIN_CONTENT_WORDS = 2;

export type EscalationVerdict = {
  escalate: boolean;
  /** How many times this turn appears to repeat something already asked. */
  repeatCount: number;
  reason: string | null;
};

/**
 * Decide whether this turn should be answered by the stronger model.
 *
 * `priorCallerTurns` is every previous thing the caller said, oldest first.
 * Escalation is sticky in the caller: once escalated, the caller stays on the
 * better model for the rest of the call. Dropping back to Haiku after one good
 * Sonnet answer would re-create the exact frustration that triggered it.
 */
export function shouldEscalate(
  currentTurn: string,
  priorCallerTurns: string[],
  options: { alreadyEscalated?: boolean; repeatsBeforeEscalating?: number } = {},
): EscalationVerdict {
  if (options.alreadyEscalated) {
    return { escalate: true, repeatCount: 0, reason: "already escalated" };
  }

  const threshold = options.repeatsBeforeEscalating ?? 2;
  const normalised = normalise(currentTurn);

  // Explicit frustration short-circuits everything. "That's not what I asked"
  // is the caller telling us directly, and waiting for a second occurrence
  // before believing them is exactly the wrong instinct.
  const marker = FRUSTRATION_MARKERS.find((phrase) => normalised.includes(normalise(phrase)));
  if (marker) {
    return {
      escalate: true,
      repeatCount: 1,
      reason: `caller signalled the answer missed ("${marker}")`,
    };
  }

  if (contentWords(currentTurn).size < MIN_CONTENT_WORDS) {
    // "Quoi?" is a request to repeat, not a repeated question. Escalating on it
    // would fire on every bad phone line in Laval.
    return { escalate: false, repeatCount: 0, reason: null };
  }

  const repeats = priorCallerTurns.filter(
    (turn) => similarity(currentTurn, turn) >= SIMILARITY_THRESHOLD,
  ).length;

  if (repeats >= threshold) {
    return {
      escalate: true,
      repeatCount: repeats,
      reason: `caller has asked this ${repeats + 1} times`,
    };
  }

  return { escalate: false, repeatCount: repeats, reason: null };
}
