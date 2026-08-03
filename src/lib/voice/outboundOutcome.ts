import type { CallOutcome } from "@/lib/crm/callTasks";

/**
 * What came of an outbound call, read off ElevenLabs' own post-call analysis.
 *
 * NOT PARSED OUT OF THE TRANSCRIPT. ElevenLabs runs per-agent *data collection*
 * (typed, enum-constrained fields extracted by their analysis LLM) and
 * *evaluation criteria* after every call and delivers both under
 * `data.analysis` in the post-call webhook. Docs/Voice-Outbound-Research.md
 * §4.4 is blunt about why we read those rather than doing it ourselves: two
 * LLMs disagreeing about whether Madame Tremblay confirmed is a bug nobody can
 * debug, whereas one LLM with a typed enum is a field you can either trust or
 * ignore.
 *
 * So everything here is precedence and coercion, never judgement. The
 * precedence is Docs/Voice-Outbound-Conversation.md §4, which exists because a
 * call where the customer confirms the visit *and then* asks never to be called
 * again can otherwise classify either way, and one of those ways gets the
 * business in trouble:
 *
 *   1. opt-out            — beats everything, including a successful errand
 *   2. wrong number       — beats third-party; if it isn't their number,
 *                           nobody there is a third party to anything
 *   3. failed             — only if no conversation happened at all
 *   4. reached_*          — defaulting to reached_unresolved when in doubt
 *   5. voicemail_*
 *   6. no_answer          — the floor
 */

/** The outcome vocabulary, as constrained in 0018_call_tasks.sql. */
const OUTCOMES: readonly CallOutcome[] = [
  "reached_confirmed",
  "reached_declined",
  "reached_reschedule_requested",
  "reached_unresolved",
  "reached_third_party",
  "voicemail_left",
  "voicemail_no_message",
  "no_answer",
  "wrong_number",
  "opt_out_requested",
  "failed",
];

function isCallOutcome(value: unknown): value is CallOutcome {
  return typeof value === "string" && (OUTCOMES as readonly string[]).includes(value);
}

/** One entry of `analysis.data_collection_results`, as documented. */
type DataCollectionItem = { value?: unknown; rationale?: unknown };

export type PostCallAnalysis = {
  data_collection_results?: Record<string, DataCollectionItem> | null;
  evaluation_criteria_results?: Record<string, unknown> | null;
  call_successful?: unknown;
  transcript_summary?: unknown;
};

export type PostCallData = {
  status?: unknown;
  analysis?: PostCallAnalysis | null;
  transcript?: unknown[] | null;
  metadata?: {
    call_duration_secs?: unknown;
    features_usage?: {
      voicemail_detection?: { enabled?: unknown; used?: unknown } | null;
    } | null;
  } | null;
};

function field(analysis: PostCallAnalysis | null | undefined, key: string): unknown {
  return analysis?.data_collection_results?.[key]?.value;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function bool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

/**
 * The outcome of a call that actually connected.
 *
 * `voicemail_detection.used` deliberately resolves to `voicemail_left` rather
 * than `voicemail_no_message` when the analysis does not say which. The two
 * differ only in their retry policy — `voicemail_left` is terminal, the other
 * one calls again — and Docs/Voice-Outbound-Conversation.md §6 caps voicemails
 * at one per errand precisely because two is when a business becomes a
 * nuisance. Guessing toward the quieter of the two is the right way to be
 * wrong.
 */
export function outcomeFromPostCall(data: PostCallData): {
  outcome: CallOutcome;
  detail: Record<string, unknown>;
} {
  const analysis = data.analysis ?? null;

  const detail: Record<string, unknown> = {};
  const put = (key: string, value: unknown) => {
    if (value !== null && value !== undefined && value !== "") detail[key] = value;
  };

  // The free-text fields from Docs/Voice-Outbound-Conversation.md §5. Stored
  // verbatim, and `requested_date_text` in particular is never turned into a
  // timestamp: "jeudi prochain avant-midi" off a phone line is how a crew ends
  // up at the wrong house. A human books it.
  put("requested_date_text", text(field(analysis, "requested_date_text")));
  put("callback_window_text", text(field(analysis, "callback_window_text")));
  put("unanswered_question", text(field(analysis, "unanswered_question")));
  put("new_enquiry_text", text(field(analysis, "new_enquiry_text")));
  put("note_for_owner", text(field(analysis, "note_for_owner")));
  put("transcript_summary", text(analysis?.transcript_summary));
  put("call_successful", text(analysis?.call_successful));

  const contactVerified = bool(field(analysis, "contact_verified"));
  if (contactVerified !== null) detail.contact_verified = contactVerified;

  const doNotCall = bool(field(analysis, "do_not_call"));
  if (doNotCall !== null) detail.do_not_call = doNotCall;

  const reported = field(analysis, "outcome");
  const voicemailUsed = bool(data.metadata?.features_usage?.voicemail_detection?.used) === true;
  const humanAnswered = bool(field(analysis, "human_answered"));
  const turns = Array.isArray(data.transcript) ? data.transcript.length : 0;

  // 1 — an opt-out outranks a successful errand.
  if (doNotCall === true || reported === "opt_out_requested") {
    return { outcome: "opt_out_requested", detail };
  }

  // 2 — a wrong number outranks a third party.
  if (reported === "wrong_number") return { outcome: "wrong_number", detail };

  // 3 — the mechanical voicemail signal, which is free and does not depend on
  //     a classifier having read the transcript correctly.
  if (voicemailUsed) {
    detail.voicemail_detected = true;
    const declared = isCallOutcome(reported) && reported.startsWith("voicemail_") ? reported : null;
    return { outcome: declared ?? "voicemail_left", detail };
  }

  // 4 — whatever the analysis said, if it said something we recognise.
  if (isCallOutcome(reported)) return { outcome: reported, detail };

  // 5 — nothing usable. Fall back on what is mechanically knowable rather than
  //     guessing at an outcome nobody can audit.
  if (humanAnswered === false) return { outcome: "no_answer", detail };
  if (data.status !== undefined && data.status !== "done" && turns === 0) {
    return { outcome: "failed", detail };
  }
  if (turns === 0) return { outcome: "no_answer", detail };

  // Somebody spoke and the errand got no settled answer. §4's documented
  // default, and the one the owner can act on by reading the transcript.
  return { outcome: "reached_unresolved", detail };
}

/**
 * `failure_reason` on a `call_initiation_failure` webhook. Note the hyphen in
 * "no-answer" — Twilio's spelling, not `no_answer`.
 */
export type InitiationFailure = {
  failure_reason?: unknown;
  metadata?: { body?: { sip_status_code?: unknown } | null } | null;
  [key: string]: unknown;
};

/**
 * SIP codes that mean the number does not exist and will not start existing:
 * 404 Not Found, 484 Address Incomplete, 603 Decline (permanent).
 */
const DEAD_NUMBER_SIP = new Set([404, 484, 603]);

export type InitiationVerdict = {
  outcome: CallOutcome;
  /** Whether another attempt could plausibly connect. */
  retryable: boolean;
  reason: string;
};

/**
 * A call that never became a conversation.
 *
 * Worth knowing what is NOT here: reaching voicemail does not produce one of
 * these. From the telephony layer's point of view the call connected, so a
 * normal post-call transcription arrives instead — which is exactly why the
 * voicemail_detection tool has to be emitted during the call rather than
 * inferred afterwards.
 */
export function outcomeFromInitiationFailure(payload: InitiationFailure): InitiationVerdict {
  const reason = text(payload.failure_reason) ?? "unknown";
  const sip = Number(payload.metadata?.body?.sip_status_code);

  if (Number.isFinite(sip) && DEAD_NUMBER_SIP.has(sip)) {
    return { outcome: "wrong_number", retryable: false, reason: `sip ${sip}` };
  }

  switch (reason) {
    case "busy":
      return { outcome: "no_answer", retryable: true, reason: "busy" };
    case "no-answer":
      return { outcome: "no_answer", retryable: true, reason: "no-answer" };
    default:
      return { outcome: "failed", retryable: true, reason };
  }
}
