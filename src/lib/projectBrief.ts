/**
 * The project brief — what the AI established during the chat, written for the
 * person who has to phone the customer and then drive to the property.
 *
 * Deliberately not the transcript. The full conversation is already forwarded
 * as `customerNotes`; reading twenty exchanges to find out which room it was is
 * exactly the work this replaces. Deliberately not the customer-facing scope
 * summary either: that one is written to be read back to the customer, so it
 * cannot carry "customer sounded unsure about the leak's source".
 *
 * Everything here is model output, so nothing is trusted: lengths are capped,
 * shapes are checked, and anything malformed is dropped rather than stored.
 */

export type BriefFact = { label: string; value: string };

export type ProjectBrief = {
  /** The job on one line, as it would be written on a job sheet. */
  headline: string;
  facts: BriefFact[];
  /** The customer's own words, in their own language. Never translated. */
  customerWords?: string;
  /** What is still unknown and would change the price. */
  openQuestions?: string[];
};

const MAX_FACTS = 24;
const MAX_QUESTIONS = 10;
const MAX_LABEL = 60;
const MAX_VALUE = 400;
const MAX_HEADLINE = 200;
const MAX_WORDS = 2000;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Validate a brief coming off the wire. Returns null when there is nothing
 * usable, so callers can treat "no brief" as one case rather than checking for
 * an object full of empty strings.
 */
export function sanitizeBrief(input: unknown): ProjectBrief | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  const headline = text(raw.headline, MAX_HEADLINE);

  const facts: BriefFact[] = Array.isArray(raw.facts)
    ? raw.facts
        .flatMap((entry) => {
          if (!entry || typeof entry !== "object") return [];
          const fact = entry as Record<string, unknown>;
          const label = text(fact.label, MAX_LABEL);
          const value = text(fact.value, MAX_VALUE);
          // A label with no value is noise on a job sheet — it reads as a
          // question that was asked and answered when it wasn't.
          if (!label || !value) return [];
          return [{ label, value }];
        })
        .slice(0, MAX_FACTS)
    : [];

  const openQuestions: string[] = Array.isArray(raw.openQuestions)
    ? raw.openQuestions
        .map((q) => text(q, MAX_VALUE))
        .filter(Boolean)
        .slice(0, MAX_QUESTIONS)
    : [];

  const customerWords = text(raw.customerWords, MAX_WORDS);

  if (!headline && facts.length === 0 && !customerWords) return null;

  return {
    headline,
    facts,
    ...(customerWords ? { customerWords } : {}),
    ...(openQuestions.length ? { openQuestions } : {}),
  };
}
