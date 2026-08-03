import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the post-call webhook does with a call that was ours to place.
 *
 * THE PROPERTY THAT MATTERS MOST HERE IS THE STATUS CODE. ElevenLabs disables a
 * post-call webhook after ten consecutive non-200s when the last success was
 * over seven days ago, and this endpoint is shared with inbound — so a 500 on
 * an outbound edge case does not degrade outbound, it silently switches off
 * inbound transcripts too, with no error anywhere on our side. Every test below
 * asserts 200, including the ones where nothing could be done.
 */

const SECRET = "test-postcall-secret";

vi.mock("@/lib/crm/calls", () => ({ endCall: vi.fn(async () => {}) }));
vi.mock("@/lib/crm/callTasks", () => ({
  completeCallTask: vi.fn(async () => ({ ok: true, changed: 1 })),
  failCallTask: vi.fn(async () => ({ ok: true, changed: 1 })),
}));

const { endCall } = await import("@/lib/crm/calls");
const { completeCallTask, failCallTask } = await import("@/lib/crm/callTasks");
const { POST } = await import("./route");

const OUTBOUND_SID = "task_9f2c1ab74e6d4f0e9b3a5c8d10e2f7a4";
const TASK_ID = "9f2c1ab7-4e6d-4f0e-9b3a-5c8d10e2f7a4";

function signed(payload: unknown): Request {
  const raw = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(`${timestamp}.${raw}`, "utf8")
    .digest("hex");

  return new Request("https://example.test/api/voice/el/completed", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "elevenlabs-signature": `t=${timestamp},v0=${signature}`,
    },
    body: raw,
  });
}

describe("the post-call webhook", () => {
  beforeEach(() => {
    process.env.ELEVENLABS_POSTCALL_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.ELEVENLABS_POSTCALL_WEBHOOK_SECRET;
    vi.clearAllMocks();
  });

  it("refuses an unsigned request", async () => {
    const response = await POST(
      new Request("https://example.test/api/voice/el/completed", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(response.status).toBe(403);
  });

  it("leaves the inbound path exactly as it was", async () => {
    const response = await POST(
      signed({
        type: "post_call_transcription",
        data: {
          status: "done",
          metadata: { call_duration_secs: 42 },
          dynamic_variables: { call_sid: "CA1234567890" },
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(endCall).toHaveBeenCalledWith("CA1234567890", {
      status: "completed",
      durationSeconds: 42,
    });
    // No queue row exists for a call the customer placed.
    expect(completeCallTask).not.toHaveBeenCalled();
    expect(failCallTask).not.toHaveBeenCalled();
  });

  it("records the outcome of a call we placed", async () => {
    const response = await POST(
      signed({
        type: "post_call_transcription",
        data: {
          status: "done",
          conversation_id: "conv_abc123",
          metadata: {
            call_duration_secs: 31,
            features_usage: { voicemail_detection: { enabled: true, used: false } },
          },
          transcript: [{ role: "agent" }, { role: "user" }],
          analysis: {
            transcript_summary: "She confirmed tomorrow at nine.",
            data_collection_results: {
              outcome: { value: "reached_confirmed" },
              contact_verified: { value: true },
            },
          },
          conversation_initiation_client_data: {
            dynamic_variables: { call_sid: OUTBOUND_SID, task_id: TASK_ID },
          },
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(endCall).toHaveBeenCalledWith(OUTBOUND_SID, {
      status: "completed",
      durationSeconds: 31,
    });
    expect(completeCallTask).toHaveBeenCalledTimes(1);
    const [sid, result] = vi.mocked(completeCallTask).mock.calls[0];
    expect(sid).toBe(OUTBOUND_SID);
    expect(result.outcome).toBe("reached_confirmed");
    expect(result.conversationId).toBe("conv_abc123");
    expect(result.outcomeDetail).toMatchObject({
      contact_verified: true,
      transcript_summary: "She confirmed tomorrow at nine.",
    });
  });

  it("still returns 200 when the outcome write fails", async () => {
    vi.mocked(completeCallTask).mockRejectedValueOnce(new Error("supabase is down"));

    const response = await POST(
      signed({
        type: "post_call_transcription",
        data: {
          status: "done",
          dynamic_variables: { call_sid: OUTBOUND_SID },
        },
      }),
    );

    expect(response.status).toBe(200);
  });
});

describe("a call that never connected", () => {
  beforeEach(() => {
    process.env.ELEVENLABS_POSTCALL_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.ELEVENLABS_POSTCALL_WEBHOOK_SECRET;
    vi.clearAllMocks();
  });

  it("requeues a busy line through the retry policy", async () => {
    const response = await POST(
      signed({
        type: "call_initiation_failure",
        data: {
          failure_reason: "busy",
          dynamic_variables: { call_sid: OUTBOUND_SID, task_id: TASK_ID },
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(failCallTask).toHaveBeenCalledTimes(1);
    expect(vi.mocked(failCallTask).mock.calls[0][0]).toBe(TASK_ID);
    expect(vi.mocked(failCallTask).mock.calls[0][1]).toContain("busy");
    // The transcript row was opened at dispatch and nothing was ever said on it.
    expect(endCall).toHaveBeenCalledWith(OUTBOUND_SID, { status: "failed", durationSeconds: 0 });
  });

  it("requeues a rang-out call — note Twilio's hyphen", async () => {
    await POST(
      signed({
        type: "call_initiation_failure",
        data: {
          failure_reason: "no-answer",
          dynamic_variables: { call_sid: OUTBOUND_SID, task_id: TASK_ID },
        },
      }),
    );

    expect(failCallTask).toHaveBeenCalledTimes(1);
  });

  it("closes a dead number terminally instead of dialling it twice more", async () => {
    const response = await POST(
      signed({
        type: "call_initiation_failure",
        data: {
          failure_reason: "unknown",
          metadata: { body: { sip_status_code: 404 } },
          dynamic_variables: { call_sid: OUTBOUND_SID, task_id: TASK_ID },
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(failCallTask).not.toHaveBeenCalled();
    expect(vi.mocked(completeCallTask).mock.calls[0][1].outcome).toBe("wrong_number");
  });

  it("reads the failure from the top level when it is not nested under data", async () => {
    await POST(
      signed({
        type: "call_initiation_failure",
        failure_reason: "busy",
        dynamic_variables: { call_sid: OUTBOUND_SID, task_id: TASK_ID },
      }),
    );

    expect(failCallTask).toHaveBeenCalledTimes(1);
  });

  it("records the failure on the correlation id when there is no task id", async () => {
    await POST(
      signed({
        type: "call_initiation_failure",
        data: { failure_reason: "busy", dynamic_variables: { call_sid: OUTBOUND_SID } },
      }),
    );

    expect(failCallTask).not.toHaveBeenCalled();
    expect(vi.mocked(completeCallTask).mock.calls[0][0]).toBe(OUTBOUND_SID);
  });
});

describe("anything else at all", () => {
  beforeEach(() => {
    process.env.ELEVENLABS_POSTCALL_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.ELEVENLABS_POSTCALL_WEBHOOK_SECRET;
    vi.clearAllMocks();
  });

  const unrecognised: Array<[string, unknown]> = [
    ["an audio webhook", { type: "post_call_audio", data: { full_audio: "…" } }],
    ["an event type that did not exist when this was written", { type: "post_call_vibes" }],
    ["a transcription with no data", { type: "post_call_transcription" }],
    ["a transcription with no correlation id", { type: "post_call_transcription", data: {} }],
    ["an empty object", {}],
  ];

  for (const [label, payload] of unrecognised) {
    it(`returns 200 for ${label}`, async () => {
      const response = await POST(signed(payload));
      expect(response.status).toBe(200);
    });
  }

  it("returns 200 for a body that is not JSON at all", async () => {
    const raw = "this is not json";
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac("sha256", SECRET)
      .update(`${timestamp}.${raw}`, "utf8")
      .digest("hex");

    const response = await POST(
      new Request("https://example.test/api/voice/el/completed", {
        method: "POST",
        headers: { "elevenlabs-signature": `t=${timestamp},v0=${signature}` },
        body: raw,
      }),
    );
    expect(response.status).toBe(200);
  });
});
