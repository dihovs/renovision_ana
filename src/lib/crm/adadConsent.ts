import type { CallTaskKind } from "./callTasks";

/**
 * The gate that decides whether an automated call is allowed to be a
 * solicitation.
 *
 * Pure: no clock, no database, no environment. Every input is an argument, so
 * the expiry and withdrawal edges are testable, and the same function can run
 * at queue time and again at dial time without either caller having to
 * reimplement the rule.
 *
 * THE RULE, and why it is this strict:
 *
 * An AI voice placing a call is an ADAD. CRTC Unsolicited Telecommunications
 * Rules Part IV rule 2 forbids a telemarketing call via an ADAD unless express
 * consent has been given, and Telecom Regulatory Policy 2014-155 ¶51–53
 * declined to carve out calls that are only partly promotional — the
 * Commission said it would be impractical to find the point where solicitation
 * becomes the primary purpose, and that businesses should seek consent
 * instead. An existing business relationship does not substitute for it
 * (Part IV rule 1: the ADAD rules apply regardless of DNCL exemptions).
 *
 * Business-to-business does not rescue it either. B2B calls are exempt from
 * Part II, the National DNCL Rules, and from nothing else — the CRTC's own
 * business guidance says calls to business numbers "are only regulated under
 * Part III and Part IV of the UTRs, namely the Telemarketing Rules and the
 * ADAD Rules". Part IV is the one that requires consent.
 *
 * So: an intro call needs a live consent record for that exact number, and the
 * absence of one is a refusal, not a warning.
 */

/**
 * Kinds that promote the business rather than service an appointment the
 * recipient already has with us.
 *
 * A set of one, and it should stay small. Anything added here needs consent
 * before it can be dialled; anything NOT here is asserting it contains no
 * solicitation, directly or indirectly, which is a claim 2014-155 ¶52 says
 * regulators will read sceptically.
 */
const SOLICITING_KINDS: ReadonlySet<CallTaskKind> = new Set<CallTaskKind>(["business_intro"]);

export function requiresExpressConsent(kind: CallTaskKind): boolean {
  return SOLICITING_KINDS.has(kind);
}

/** The fields of a consent row this decision actually depends on. */
export type ConsentRecord = {
  phone: string;
  purpose: string;
  expires_at: string | null;
  withdrawn_at: string | null;
};

export type ConsentRefusal =
  | "no_consent_on_file"
  | "consent_withdrawn"
  | "consent_expired"
  | "on_do_not_call_list";

export type ConsentVerdict = { ok: true } | { ok: false; reason: ConsentRefusal; detail?: string };

/**
 * Is this one record a live authorisation for this number and purpose?
 *
 * Number comparison is exact on the E.164 string. Deliberately not fuzzy: the
 * rule is per-number, and treating +15148399702 and +15148399703 as near
 * enough is the whole failure mode. Callers normalise with `toE164` before
 * they get here.
 */
export function isLive(record: ConsentRecord, phone: string, purpose: string, now: Date): boolean {
  if (record.phone !== phone) return false;
  if (record.purpose !== purpose) return false;
  if (record.withdrawn_at) return false;
  if (record.expires_at && new Date(record.expires_at) <= now) return false;
  return true;
}

/**
 * May we place a soliciting call to this number right now?
 *
 * Ordered so the reason given back is the most durable one available, matching
 * how `canDialNow` reports its refusals: a do-not-call request outranks
 * everything, then withdrawal, then expiry, then simple absence.
 *
 * `onDoNotCallList` is a separate argument rather than something read out of
 * the consent rows because the two lists answer different questions and are
 * kept apart in the schema for the same reason. A number can be on the
 * internal do-not-call list while a stale consent row still exists; the
 * do-not-call request is the later word and wins.
 */
export function checkSolicitationConsent(input: {
  phone: string;
  purpose?: string;
  records: ConsentRecord[];
  onDoNotCallList: boolean;
  now: Date;
}): ConsentVerdict {
  const { phone, records, onDoNotCallList, now } = input;
  const purpose = input.purpose ?? "business_intro";

  if (onDoNotCallList) {
    return { ok: false, reason: "on_do_not_call_list", detail: phone };
  }

  const forThisNumber = records.filter(
    (record) => record.phone === phone && record.purpose === purpose,
  );

  if (forThisNumber.length === 0) {
    return { ok: false, reason: "no_consent_on_file", detail: phone };
  }

  if (forThisNumber.some((record) => isLive(record, phone, purpose, now))) {
    return { ok: true };
  }

  // Something is on file but none of it is live. Which failure it is decides
  // what the office should do next — a withdrawal is final, an expiry is worth
  // asking about again — so it is worth telling them apart. Withdrawal wins
  // when both appear, because a withdrawal is a decision and an expiry is only
  // a date passing.
  if (forThisNumber.some((record) => record.withdrawn_at)) {
    const withdrawn = forThisNumber
      .map((record) => record.withdrawn_at)
      .filter((at): at is string => Boolean(at))
      .sort()
      .at(-1);
    return { ok: false, reason: "consent_withdrawn", detail: withdrawn };
  }

  const latestExpiry = forThisNumber
    .map((record) => record.expires_at)
    .filter((at): at is string => Boolean(at))
    .sort()
    .at(-1);
  return { ok: false, reason: "consent_expired", detail: latestExpiry };
}

/**
 * What to tell the office when a call is refused.
 *
 * Written as instructions rather than as error codes because the person
 * reading them is the person who has to go and fix it, and "no consent on
 * file" without the next step is how a compliance gate turns into something
 * people route around.
 */
export const CONSENT_REFUSAL_MESSAGE: Record<ConsentRefusal, string> = {
  no_consent_on_file:
    "No express consent on file for this number. Ana cannot place an introductory call without it — CRTC rules treat an AI voice as an ADAD, and an introduction is solicitation. Ask them directly (in person, by email, or on a call you record), then record it here. Or just phone them yourself.",
  consent_withdrawn:
    "This number withdrew consent. That is final — do not queue another automated call to it. A personal call from you is a different thing and is unaffected.",
  consent_expired:
    "The consent on file has passed its end date. Ask again before Ana calls; a lapsed consent is the same as none.",
  on_do_not_call_list:
    "This number is on the internal do-not-call list. Nothing automated goes to it, and the entry stays for three years from the request.",
};

/**
 * The wording that has to be true of an introductory call for it to stay
 * within what was consented to.
 *
 * Kept next to the gate rather than only in the prompt so there is one place
 * that states the boundary, and so a future change to Ana's script has to walk
 * past it.
 */
export const INTRO_CALL_BOUNDARY = [
  "Identify the business and the fact that this is an automated assistant, before anything else.",
  "Say why we are calling: an introduction, and permission to send information.",
  "Do not quote a price, name a discount, claim a deadline, or ask for a decision on this call.",
  "Offer to stop calling, and honour it immediately and permanently.",
  "Offer a callback from a person; that is the only next step this call is allowed to produce.",
] as const;
