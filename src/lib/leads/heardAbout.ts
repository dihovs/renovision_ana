/**
 * "How did you hear about us?" — the channels a referrer cannot see.
 *
 * WHY ASK AT ALL when src/lib/attribution.ts already records where the visit
 * came from: because that module can only see the web. A plumber who sends work
 * across, an adjuster who names us, a neighbour who watched a truck outside for
 * a week — none of those leave a `document.referrer`, and for a restoration
 * business they are the relationships worth knowing about and feeding. If a
 * plumber sends five jobs a year, nothing in the system currently knows he
 * exists.
 *
 * WHY ONLY WHEN ATTRIBUTION IS EMPTY. Asking someone who arrived on
 * `organic_google` where they heard of us adds a field to earn an answer we
 * already have, more accurately, without asking. Every field on a form costs
 * completions, and this one is on the path of somebody with water coming
 * through a ceiling. See shouldAskHeardAbout().
 *
 * SELF-REPORTED ANSWERS ARE NOT MEASUREMENT, and the two columns must not be
 * averaged together. People say "Google" when they clicked a Facebook ad and
 * "a friend" when the friend sent them a link. `source` is the reliable record
 * of online arrival; this is testimony about the offline half. They answer
 * different questions.
 *
 * The values are shared rather than duplicated per form because the contact
 * page has asked this since 0016 and the admin pipeline renders the labels from
 * a third list — three copies of one vocabulary, which is how a "plumber" on
 * one form and a "plombier" on another end up as two rows in the same report.
 */

export type HeardAboutValue =
  | "google"
  | "referral"
  | "plumber"
  | "insurance_broker"
  | "social"
  | "neighbourhood"
  | "other";

export const HEARD_ABOUT_VALUES: HeardAboutValue[] = [
  "google",
  "referral",
  "plumber",
  "insurance_broker",
  "social",
  "neighbourhood",
  "other",
];

/**
 * Ordered as offered. `google` sits first because it is the honest answer most
 * often, and burying it makes people pick something else to be done with the
 * field; `other` is last because it is the escape hatch, not a suggestion.
 */
export const HEARD_ABOUT_OPTIONS: Record<HeardAboutValue, { en: string; fr: string }> = {
  google: { en: "Google or another search", fr: "Google ou une autre recherche" },
  referral: { en: "A friend or family member", fr: "Un ami ou un membre de la famille" },
  plumber: { en: "A plumber or another trade", fr: "Un plombier ou un autre corps de métier" },
  insurance_broker: {
    en: "My insurance broker or adjuster",
    fr: "Mon courtier ou expert en sinistre",
  },
  social: { en: "Facebook or Instagram", fr: "Facebook ou Instagram" },
  neighbourhood: { en: "Saw your work or your truck nearby", fr: "J'ai vu vos travaux ou votre camion" },
  other: { en: "Somewhere else", fr: "Ailleurs" },
};

/** Anything off the list is dropped rather than stored as free text. */
export function isHeardAboutValue(value: unknown): value is HeardAboutValue {
  return typeof value === "string" && (HEARD_ABOUT_VALUES as string[]).includes(value);
}

/**
 * Should the form bother asking?
 *
 * Only when the browser learned nothing. A source of `chat` with no token, or
 * no source at all, means the visitor typed the address or arrived somewhere
 * the referrer did not survive — exactly the case where the answer is worth a
 * field. Anything carrying a token (`chat:organic_google`) already knows.
 */
export function shouldAskHeardAbout(source: string | null | undefined): boolean {
  if (!source) return true;
  return !source.includes(":");
}
