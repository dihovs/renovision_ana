/**
 * "Is this a mailbox rather than a person?"
 *
 * WHY THIS IS OURS TO DECIDE. `voicemail_detection` is an ElevenLabs *system
 * tool*, and the custom-LLM docs are explicit that when a Custom LLM is
 * configured every system tool is handed to that LLM and the LLM chooses when
 * to invoke it — ElevenLabs does not run it itself. Enabling the toggle in the
 * dashboard and stopping there does nothing at all. That is exactly the trap
 * that pinned the conversation language to French for a week before
 * `language_detection` was emitted from the chat route by hand
 * (Docs/Voice-ElevenLabs-Setup.md), and Docs/Voice-Outbound-Research.md §4.3
 * calls it out as the same trap a second time.
 *
 * So the route emits the tool call, and this decides when.
 *
 * A HEURISTIC RATHER THAN THE MODEL'S JUDGEMENT, because the model's judgement
 * is not wired for it — the route only forwards tool calls it constructs
 * itself — and because a pure function is testable and a prompt instruction is
 * not. The prompt mentions it too, as belt and braces.
 *
 * TUNED CONSERVATIVELY, and the asymmetry is the reason: a false negative
 * leaves a slightly odd message on a machine, while a false positive hangs up
 * on a real customer mid-sentence. Two guards keep it that way:
 *
 *   1. Only the first two turns. A voicemail greeting is the opening of a call
 *      and never turn nine; anything later is a human saying a phrase that
 *      happens to overlap.
 *   2. Explicit greeting phrases only. "Je ne suis pas disponible" from a live
 *      person on turn one is vanishingly rare and, if it happens, hanging up is
 *      not the worst reading of it.
 */

export type VoicemailVerdict = { voicemail: true; reason: string } | { voicemail: false };

/**
 * Phrases that appear in answering-machine greetings and effectively nowhere
 * else in the opening seconds of a call. Bilingual because Quebec mailboxes
 * are, and because a French-only list would miss every English household.
 */
const GREETINGS: Array<{ re: RegExp; reason: string }> = [
  {
    re: /\blaiss(?:ez|er)(?:-(?:moi|nous|lui))?\s+(?:votre\s+|un\s+|nous\s+)?(?:message|nom)/i,
    reason: "the greeting asked for a message",
  },
  {
    re: /\b(après|apres)\s+(?:le|la)\s+(?:bip|tonalité|tonalite|signal|son)/i,
    reason: "the greeting mentioned the tone",
  },
  {
    re: /\b(boîte|boite)\s+vocale\b/i,
    reason: "the greeting named a voice mailbox",
  },
  {
    // Qualified deliberately. "Je ne suis pas disponible jeudi" is a customer
    // asking to move an appointment — the single most likely thing to be said
    // on a confirm_visit call — and hanging up on them would be the worst
    // possible false positive.
    re: /\b(?:n'est|ne\s+suis|ne\s+sommes)\s+pas\s+disponible\s+(?:pour\s+le\s+moment|en\s+ce\s+moment|présentement|presentement|pour\s+l'instant|pour\s+prendre)/i,
    reason: "the greeting said nobody is available",
  },
  {
    re: /\bmessagerie\b/i,
    reason: "the greeting named the messaging service",
  },
  {
    re: /\bleave\s+(?:a|your)\s+(?:message|name)\b/i,
    reason: "the greeting asked for a message",
  },
  {
    re: /\bafter\s+the\s+(?:tone|beep)\b/i,
    reason: "the greeting mentioned the tone",
  },
  {
    re: /\byou(?:'ve| have)\s+reached\b/i,
    reason: "the greeting opened with 'you have reached'",
  },
  {
    re: /\b(?:is|am|are)\s+not\s+available\s+(?:right\s+now|at\s+the\s+moment|to\s+take)/i,
    reason: "the greeting said nobody is available",
  },
  {
    re: /\bvoice\s?mail\b/i,
    reason: "the greeting named voicemail",
  },
  {
    re: /\brecord\s+your\s+message\b/i,
    reason: "the greeting asked for a recording",
  },
];

/** How many opening turns may be judged. See guard 1 above. */
const MAX_TURN_INDEX = 1;

/**
 * @param text       what was just heard, as ElevenLabs transcribed it
 * @param turnIndex  0 for the first thing the other end said, 1 for the second
 */
export function looksLikeVoicemail(
  text: string,
  options: { turnIndex: number },
): VoicemailVerdict {
  if (options.turnIndex > MAX_TURN_INDEX) return { voicemail: false };

  const spoken = (text ?? "").trim();
  if (!spoken) return { voicemail: false };

  for (const greeting of GREETINGS) {
    if (greeting.re.test(spoken)) return { voicemail: true, reason: greeting.reason };
  }
  return { voicemail: false };
}
