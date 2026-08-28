/**
 * "Is this call over?" — the pure half of hanging up.
 *
 * WHY THIS IS OURS TO DECIDE, again. `end_call` is an ElevenLabs *system tool*,
 * and with a Custom LLM configured every system tool is handed to the LLM and
 * the LLM chooses when to invoke it — ElevenLabs does not run it itself.
 * Enabling "End conversation" in the dashboard and stopping there does exactly
 * nothing, which is the same trap that pinned the conversation language to
 * French for a week before `language_detection` was emitted from the chat route
 * by hand, and the same one `voicemail_detection` fell into after it. Third
 * time; same shape.
 *
 * So the route emits the tool call, and this decides when.
 *
 * HEURISTICS RATHER THAN THE MODEL'S JUDGEMENT, for the reasons voicemail.ts
 * gives: the route only forwards tool calls it constructs itself, and a pure
 * function is testable in a way a prompt instruction is not.
 *
 * THE ASYMMETRY IS THE OPPOSITE OF VOICEMAIL'S, AND SHARPER. A call that
 * lingers a few extra seconds costs nothing anybody notices. A call that hangs
 * up on a customer who was mid-thought is the worst thing this agent can do to
 * a lead. So every detector here is deliberately hard to trip:
 *
 *   1. A question mark disqualifies the utterance outright. Somebody asking
 *      something is not somebody leaving.
 *   2. Anything longer than a breath is not a goodbye. A real farewell is
 *      "merci, bonne journée" — if there are fifteen words in it, the goodbye
 *      is a preamble to something else.
 *   3. An explicit not-done-yet list ("attendez", "avant de", "one more
 *      thing") vetoes the whole utterance, because "bonne journée — ah non
 *      attendez" is a sentence people actually say.
 *
 * None of this decides on silence. A caller who pauses says nothing, and
 * nothing matches.
 */

/** Longer than this and the goodbye is a clause inside something else. */
const MAX_FAREWELL_WORDS = 14;

/**
 * The veto list. Any of these anywhere in the utterance and it is not an
 * ending, whatever else it contains — these are the words people use to catch
 * themselves on the way out.
 */
const NOT_DONE_YET: RegExp[] = [
  /\battend(?:ez|s|e)\b/i,
  /\bwait\b/i,
  /\bavant\s+(?:de|que|d')/i,
  /\bbefore\s+(?:you|we|i)\b/i,
  /\bune?\s+(?:autre\s+|derni[èe]re\s+|petite\s+)?(?:question|chose)\b/i,
  /\ban(?:other)?\s+question\b/i,
  /\bone\s+(?:more|last)\s+thing\b/i,
  /\ben\s+fait\b/i,
  /\bactually\b/i,
  /\bpar\s+contre\b/i,
  /\boh\s*,?\s*(?:et|and)\b/i,
];

/**
 * A goodbye, or a request to get off the phone.
 *
 * Bilingual, and "bye" sits in the shared column on purpose — in Laval it ends
 * French calls at least as often as English ones.
 */
const GOODBYE_PATTERNS: RegExp[] = [
  // ---- French -------------------------------------------------------------
  /\bbonne\s+(?:journ[ée]e|soir[ée]e|fin\s+de\s+journ[ée]e)\b/i,
  /\bau\s+revoir\b/i,
  // No leading \b: an accented "à" is not a word character to JavaScript, so
  // the boundary would never match after a space. Anchored on whitespace or
  // the start of the utterance instead.
  /(?:^|\s)[àa]\s+(?:bient[ôo]t|la\s+prochaine|plus\s+tard|demain)\b/i,
  /\bje\s+(?:dois|doit)\s+(?:y\s+aller|partir|vous\s+laisser|raccrocher)\b/i,
  /\b(?:il\s+)?faut\s+que\s+j['’]y\s+aille\b/i,
  /\bje\s+vous\s+laisse\b/i,
  /\bje\s+raccroche\b/i,
  /\b(?:vous\s+pouvez|on\s+peut)\s+raccrocher\b/i,
  // End-anchored, unlike the rest: "c'est tout" is an ending only when the
  // sentence actually stops there. "C'est tout ce que je sais pour l'instant"
  // is somebody still answering questions.
  /\bc['’]est\s+(?:tout|beau|correct)(?:\s*,?\s*merci(?:\s+beaucoup)?)?\s*[.!]*$/i,

  // ---- English ------------------------------------------------------------
  /\bgood\s?bye\b/i,
  /\bbye\b/i,
  /\bhave\s+a\s+(?:good|great|nice|lovely)\s+(?:day|evening|night|one)\b/i,
  /\btake\s+care\b/i,
  /\bi\s+(?:have\s+to|need\s+to|got\s?ta|got\s+to|must)\s+(?:go|run)\b/i,
  /\bi['’]?ll\s+let\s+you\s+go\b/i,
  /\b(?:i['’]?m\s+going\s+to|you\s+can|let['’]?s)\s+hang\s+up\b/i,
  /\bthat['’]?s\s+(?:it|all)(?:\s*,?\s*(?:then|for\s+now|thanks?|thank\s+you))?\s*[.!]*$/i,
];

function tooLongToBeAGoodbye(text: string): boolean {
  return text.split(/\s+/).filter(Boolean).length > MAX_FAREWELL_WORDS;
}

/**
 * The person on the other end has signalled that the call is over — either a
 * plain goodbye or an outright "I have to go".
 *
 * Used on both sides of the line, with different company: outbound acts on it
 * directly (§B, "the customer asks to hang up"), inbound only acts on it once
 * the callback number is already in hand. See hasCallbackNumber().
 */
export function detectCallerGoodbye(text: string): boolean {
  const spoken = (text ?? "").trim();
  if (!spoken) return false;
  if (spoken.includes("?")) return false;
  if (tooLongToBeAGoodbye(spoken)) return false;
  if (NOT_DONE_YET.some((re) => re.test(spoken))) return false;
  return GOODBYE_PATTERNS.some((re) => re.test(spoken));
}

/**
 * Ana's own reply is a finished sign-off.
 *
 * Both system prompts end with the same instruction — thank them, say what
 * happens next, wish them a good day, and do not add a question after it — so
 * the farewell is the reliable marker that she considers the errand done. The
 * question-mark check is what separates "Parfait, bonne journée!" from "Bonne
 * journée — est-ce que neuf heures tient toujours?", and it is doing real work:
 * the second one is still a conversation.
 *
 * Deliberately narrower than detectCallerGoodbye(): Ana never says "I have to
 * go", and reading a hang-up request out of her own text would let the model
 * end a call by quoting the customer back at them.
 */
const SIGN_OFF_PATTERNS: RegExp[] = [
  /\bbonne\s+(?:journ[ée]e|soir[ée]e|fin\s+de\s+journ[ée]e)\b/i,
  /\bau\s+revoir\b/i,
  /(?:^|\s)[àa]\s+(?:bient[ôo]t|la\s+prochaine)\b/i,
  /\bhave\s+a\s+(?:good|great|nice|lovely)\s+(?:day|evening|night|one)\b/i,
  /\bgood\s?bye\b/i,
  /\btake\s+care\b/i,
];

export function isSignOff(text: string): boolean {
  const said = (text ?? "").trim();
  if (!said) return false;
  if (said.includes("?")) return false;
  return SIGN_OFF_PATTERNS.some((re) => re.test(said));
}

/**
 * Branch B7 — they are not who we dialled.
 *
 * Only ever run against an outbound call. Matched on the phrases that say it
 * outright: a wrong number is one of the few things a stranger states plainly,
 * and guessing at it from vaguer signals would mean hanging up on a customer
 * who merely sounded confused.
 */
const WRONG_NUMBER_PATTERNS: RegExp[] = [
  // ---- French -------------------------------------------------------------
  /\b(?:mauvais|pas\s+le\s+bon)\s+num[ée]ro\b/i,
  /\bvous\s+(?:vous\s+)?(?:[êe]tes|avez)\s+tromp[ée]/i,
  /\bce\s+n['’]est\s+pas\s+(?:mon|le\s+bon)\s+num[ée]ro\b/i,
  /\bil\s+n['’]y\s+a\s+(?:personne|aucun[e]?)\s+(?:de\s+ce\s+nom|qui\s+s['’]appelle|ici\s+de\s+ce\s+nom)/i,
  /\bvous\s+avez\s+fait\s+(?:un|le)\s+mauvais\b/i,

  // ---- English ------------------------------------------------------------
  /\bwrong\s+(?:number|person)\b/i,
  /\byou['’]?ve\s+got\s+the\s+wrong\b/i,
  /\b(?:no\s+one|nobody|no-one)\s+(?:here\s+)?(?:by|with)\s+that\s+name\b/i,
  /\bthere['’]?s\s+no\s+(?:such\s+person|one\s+here\s+by)\b/i,
  /\bnever\s+heard\s+of\s+(?:them|her|him)\b/i,
];

export function detectWrongNumber(text: string): boolean {
  const spoken = (text ?? "").trim();
  if (!spoken) return false;
  return WRONG_NUMBER_PATTERNS.some((re) => re.test(spoken));
}

/**
 * Can we reach this person again after hanging up?
 *
 * THE GATE THAT MAKES THE INBOUND HANG-UP SAFE. "Merci, bonne journée" from a
 * caller we can call back is a finished call; the same words from someone three
 * turns in, when we have no way to reach them, is a lead we would be throwing
 * away by hanging up on it.
 *
 * IT USED TO ASK THE WRONG QUESTION, and that is the bug this now fixes.
 * Reported 28 Aug 2026: "customer is saying bye, and Ana just keeps the line
 * open" — on a per-minute meter. The gate tested only whether the caller had
 * *recited* a number out loud, which almost nobody does when they are calling
 * from the very number they would give you. So on a normal inbound call it was
 * false from beginning to end, the goodbye branch never ran, and the call sat
 * open until MAX_TURNS or the caller themselves hung up. Every second of that
 * was billed.
 *
 * The caller ID answers the question the spoken digits were standing in for.
 * /api/voice/el/init puts it in dynamic_variables and it is on every turn from
 * the first — the route was already using it to decide owner mode while this
 * function, three lines away, was insisting the caller say it aloud.
 *
 * A withheld number is not a callback number: it arrives as a word rather than
 * digits, and treating "anonymous" as reachable would hang up on exactly the
 * caller we cannot phone back.
 *
 * Shape-matched rather than digit-counted: a run of ten digits also turns up in
 * dates, dimensions and dollar amounts, and 3-3-4 is how every transcriber
 * renders a North American number, separators or not.
 */
const PHONE_SHAPE = /(?:\+?1[\s.\-]*)?\(?\d{3}\)?[\s.\-]*\d{3}[\s.\-]*\d{4}/;

export function hasCallbackNumber(
  texts: string[],
  options: { callerId?: string | null } = {},
): boolean {
  const callerId = (options.callerId ?? "").trim();
  if (callerId && PHONE_SHAPE.test(callerId)) return true;
  return texts.some((text) => PHONE_SHAPE.test(text ?? ""));
}
