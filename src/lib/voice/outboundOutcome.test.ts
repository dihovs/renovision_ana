import { describe, expect, it } from "vitest";
import {
  outcomeFromInitiationFailure,
  outcomeFromPostCall,
  type PostCallData,
} from "./outboundOutcome";

/** Shorthand for one ElevenLabs data-collection field. */
function collected(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, { data_collection_id: key, value }]),
  );
}

function postCall(over: Partial<PostCallData> = {}): PostCallData {
  return {
    status: "done",
    transcript: [{ role: "agent" }, { role: "user" }],
    analysis: { data_collection_results: {} },
    metadata: { features_usage: { voicemail_detection: { enabled: true, used: false } } },
    ...over,
  };
}

describe("reading the outcome off ElevenLabs' analysis", () => {
  it("takes the enum value the analysis LLM returned", () => {
    const { outcome } = outcomeFromPostCall(
      postCall({ analysis: { data_collection_results: collected({ outcome: "reached_confirmed" }) } }),
    );
    expect(outcome).toBe("reached_confirmed");
  });

  it("lets an opt-out beat a successful errand", () => {
    // §4 precedence 1. A call where the customer confirms the visit and then
    // asks never to be called again must classify as the opt-out, and the
    // boolean is deliberately redundant with the enum so that suppression does
    // not depend on a classifier picking one value out of eleven.
    const { outcome } = outcomeFromPostCall(
      postCall({
        analysis: {
          data_collection_results: collected({ outcome: "reached_confirmed", do_not_call: true }),
        },
      }),
    );
    expect(outcome).toBe("opt_out_requested");
  });

  it("trusts the mechanical voicemail signal over anything judged", () => {
    const { outcome, detail } = outcomeFromPostCall(
      postCall({
        metadata: { features_usage: { voicemail_detection: { enabled: true, used: true } } },
        analysis: { data_collection_results: collected({ outcome: "reached_unresolved" }) },
      }),
    );
    // Defaults to the terminal one: two voicemails is when a business becomes
    // a nuisance, so guessing toward the quieter of the pair is how to be wrong.
    expect(outcome).toBe("voicemail_left");
    expect(detail.voicemail_detected).toBe(true);
  });

  it("keeps the analysis's own voicemail split when it made one", () => {
    const { outcome } = outcomeFromPostCall(
      postCall({
        metadata: { features_usage: { voicemail_detection: { used: true } } },
        analysis: { data_collection_results: collected({ outcome: "voicemail_no_message" }) },
      }),
    );
    expect(outcome).toBe("voicemail_no_message");
  });

  it("falls back to no_answer when nobody spoke", () => {
    expect(
      outcomeFromPostCall(
        postCall({ analysis: { data_collection_results: collected({ human_answered: false }) } }),
      ).outcome,
    ).toBe("no_answer");
  });

  it("falls back to reached_unresolved rather than guessing, when there was a conversation", () => {
    // The documented default. Forcing this into reached_declined cancels a
    // visit that is still on; forcing it into reached_confirmed sends a crew to
    // a locked door.
    expect(outcomeFromPostCall(postCall()).outcome).toBe("reached_unresolved");
  });

  it("treats an empty, unfinished call as failed", () => {
    expect(
      outcomeFromPostCall(postCall({ status: "failed", transcript: [] })).outcome,
    ).toBe("failed");
  });

  it("treats an empty but finished call as no_answer", () => {
    expect(outcomeFromPostCall(postCall({ transcript: [] })).outcome).toBe("no_answer");
  });

  it("survives a webhook with no analysis block at all", () => {
    expect(outcomeFromPostCall({}).outcome).toBe("no_answer");
  });

  it("keeps the customer's own words, unparsed", () => {
    const { detail } = outcomeFromPostCall(
      postCall({
        analysis: {
          transcript_summary: "She asked to move the visit.",
          data_collection_results: collected({
            outcome: "reached_reschedule_requested",
            requested_date_text: "jeudi prochain avant-midi",
            note_for_owner: "Elle préfère l'avant-midi.",
            contact_verified: true,
          }),
        },
      }),
    );
    expect(detail.requested_date_text).toBe("jeudi prochain avant-midi");
    expect(detail.note_for_owner).toBe("Elle préfère l'avant-midi.");
    expect(detail.contact_verified).toBe(true);
    expect(detail.transcript_summary).toBe("She asked to move the visit.");
  });
});

describe("a call that never became a conversation", () => {
  it("maps a busy line to no_answer, and tries again", () => {
    expect(outcomeFromInitiationFailure({ failure_reason: "busy" })).toEqual({
      outcome: "no_answer",
      retryable: true,
      reason: "busy",
    });
  });

  it("maps no-answer — Twilio's hyphen, not an underscore", () => {
    expect(outcomeFromInitiationFailure({ failure_reason: "no-answer" }).outcome).toBe("no_answer");
    // The underscore spelling is not the documented one and must not be
    // silently treated as the same thing.
    expect(outcomeFromInitiationFailure({ failure_reason: "no_answer" }).outcome).toBe("failed");
  });

  it("maps an unknown reason to failed, once", () => {
    const verdict = outcomeFromInitiationFailure({ failure_reason: "unknown" });
    expect(verdict.outcome).toBe("failed");
    expect(verdict.retryable).toBe(true);
  });

  it("maps a dead number to wrong_number, terminally", () => {
    for (const sip of [404, 484, 603]) {
      const verdict = outcomeFromInitiationFailure({
        failure_reason: "unknown",
        metadata: { body: { sip_status_code: sip } },
      });
      expect(verdict.outcome).toBe("wrong_number");
      // A number that does not exist will not start existing.
      expect(verdict.retryable).toBe(false);
    }
  });

  it("does not treat a temporary SIP code as a dead number", () => {
    expect(
      outcomeFromInitiationFailure({
        failure_reason: "busy",
        metadata: { body: { sip_status_code: 486 } },
      }).outcome,
    ).toBe("no_answer");
  });

  it("copes with a payload carrying nothing useful", () => {
    expect(outcomeFromInitiationFailure({}).outcome).toBe("failed");
  });
});
