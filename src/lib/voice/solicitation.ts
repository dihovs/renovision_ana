/**
 * The no-solicitation guardrail, as code rather than as a hope.
 *
 * Docs/Voice-Outbound-Compliance.md §10D(14)–(15) is the source. Under the
 * CRTC's Unsolicited Telecommunications Rules a synthesized voice placing a
 * call is an ADAD. Non-solicitation calls to an existing customer are allowed
 * without express consent; the moment one *solicits* — a price, a promotion, a
 * request for a decision — it becomes ADAD telemarketing, which an existing
 * business relationship does not authorise. The whole outbound feature sits on
 * the right side of that line, and one chatty sentence moves it.
 *
 * §10D(15) asks for three layers, and this file is the second:
 *   (a) the prompt forbids it              — outboundSystemPrompt() in agent.ts
 *   (b) a check on generated text          — here, before anything is spoken
 *   (c) a flag on the stored transcript    — CallTurn.flagged, set by the route
 *
 * ONE IMPLEMENTATION, TWO SCOPES. The inbound receptionist's oldest rule —
 * "you do not quote prices" — is the same rule as (a), so it is enforced by the
 * same function rather than by a second one that drifts. What differs is what
 * happens on a hit, and that is the route's decision, not this module's:
 *
 *   - Outbound text is BLOCKED. Ana is buffered, not streamed, precisely so
 *     that a hit can be swapped for safeRedirectLine() before the caller hears
 *     a syllable of it.
 *   - Inbound text is only FLAGGED. Inbound streams token-by-token — the words
 *     are already on their way to the caller by the time a reply is complete,
 *     so there is nothing left to block — and changing that would change the
 *     one thing about the inbound path that must not change. The flag is what
 *     §10D(15)(c) actually asks for, and what §H(41)'s monthly transcript
 *     review reads.
 *
 * The scopes also differ in width, deliberately. `price` and `promotion` are
 * wrong in either direction and are checked in both. `quote` and `commitment`
 * are only wrong outbound: an inbound caller who asks what a bathroom costs is
 * *supposed* to hear the word "soumission" and be pointed at the estimator,
 * whereas an outbound errand that reaches the word at all has left its errand.
 * Flagging every inbound call would produce a review queue nobody reads, which
 * is the same as no guardrail.
 */

export type SolicitationScope = "inbound" | "outbound";

export type SolicitationRule = "price" | "promotion" | "quote" | "commitment";

export type SolicitationHit = {
  rule: SolicitationRule;
  /** The exact substring that tripped it — goes on the transcript flag. */
  matched: string;
};

type Pattern = { rule: SolicitationRule; scopes: SolicitationScope[]; re: RegExp };

/**
 * Kept narrow on purpose. A deny-list that fires on ordinary speech gets
 * switched off within a week, so every entry here has to be a token Ana has no
 * legitimate reason to say on any call, in either direction.
 *
 * Notably absent: bare numbers. "Une trentaine de minutes" is the entire point
 * of a crew_on_way errand, and "environ trente" cannot be told apart from a
 * price without currency context. Currency context is therefore what is
 * matched, not arithmetic.
 *
 * Also absent: French "sale". It means dirty, and this is a water-damage
 * restoration company.
 */
const PATTERNS: Pattern[] = [
  // ---- price: an amount of money, in any shape -----------------------------
  { rule: "price", scopes: ["inbound", "outbound"], re: /\$/ },
  {
    rule: "price",
    scopes: ["inbound", "outbound"],
    re: /\b(dollars?|piastres?|euros?)\b/i,
  },
  // "cent" is French for a hundred, so only the English money sense is matched.
  { rule: "price", scopes: ["inbound", "outbound"], re: /\b\d+\s*cents\b/i },

  // ---- promotion: nothing is ever on offer ---------------------------------
  {
    rule: "promotion",
    scopes: ["inbound", "outbound"],
    re: /\b(rabais|promotion|promo|aubaine|solde|escompte|discounts?|coupon)\b/i,
  },
  {
    rule: "promotion",
    scopes: ["inbound", "outbound"],
    re: /\b(offre\s+(?:spéciale|speciale|limitée|limitee)|prix\s+spécial|special\s+offer|limited\s+time|free\s+estimate|estimation\s+gratuite)\b/i,
  },

  // ---- quote: outbound has no errand that involves a figure ----------------
  // There is deliberately no `quote_followup` kind in 0018_call_tasks.sql; if
  // Ana reaches for the vocabulary, she has wandered off the errand.
  {
    rule: "quote",
    scopes: ["outbound"],
    // "montant" is deliberately absent: safeRedirectLine() below has to be able
    // to say "un montant ferme" — promising a real figure from a human is the
    // compliant way to refuse, and blocking the refusal would leave nothing to
    // say. An actual amount trips the `price` rules above instead.
    re: /\b(soumission|devis|estimation|tarifs?|coûte?ra?|coute?ra?|prix|facturer|budget)\b/i,
  },
  {
    rule: "quote",
    scopes: ["outbound"],
    re: /\b(quotes?|quoted|pricing|prices?|rates?|charges?|costs?|fees?|invoices?)\b/i,
  },

  // ---- commitment: never ask for a decision or a signature -----------------
  {
    rule: "commitment",
    scopes: ["outbound"],
    re: /\b(on\s+procède|on\s+procede|procéder|proceder|aller\s+de\s+l'avant|je\s+vous\s+inscris|signer|signature|contrats?)\b/i,
  },
  {
    rule: "commitment",
    scopes: ["outbound"],
    re: /\b(go\s+ahead|move\s+forward|sign\s+(?:up|off|the)|shall\s+i\s+book|book\s+you\s+in)\b/i,
  },
];

/**
 * The first thing in `text` that must not be spoken, or null.
 *
 * Returns the first hit rather than all of them: the caller either blocks the
 * turn or flags it, and both are decided by whether there was one.
 */
export function findSolicitation(
  text: string,
  options: { scope: SolicitationScope },
): SolicitationHit | null {
  if (!text) return null;

  for (const pattern of PATTERNS) {
    if (!pattern.scopes.includes(options.scope)) continue;
    const match = pattern.re.exec(text);
    if (match) return { rule: pattern.rule, matched: match[0] };
  }
  return null;
}

/**
 * What Ana says instead, when a generated turn is blocked outbound.
 *
 * This is branch B5c of Docs/Voice-Outbound-Conversation.md word for word, and
 * it is the right substitution for every rule here rather than only for
 * `price`: whatever the model was about to offer, the honest answer is that she
 * does not have it and the estimator will call. It ends the subject in one
 * sentence, which is also what §10D(14) asks for.
 *
 * It must itself pass findSolicitation() — there is a test that says so, and it
 * is the reason this line says "les chiffres" and "a firm number" rather than
 * the obvious words.
 */
export function safeRedirectLine(locale: "fr" | "en"): string {
  return locale === "fr"
    ? "Je n'ai pas les chiffres devant moi, mais notre estimateur peut vous donner un montant ferme. Je lui fais le message."
    : "I don't have the figures in front of me, but our estimator can give you a firm number. I'll pass the question on.";
}

/** The transcript flag written by whichever route caught it. */
export function solicitationFlag(hit: SolicitationHit, scope: SolicitationScope): string {
  return `solicitation:${scope}:${hit.rule}:${hit.matched.trim().toLowerCase()}`;
}
