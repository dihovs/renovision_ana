import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The conversation-initiation webhook, and the one thing it must never do.
 *
 * ElevenLabs documents this hook as inbound-only, and the outbound agent is
 * configured with no initiation webhook at all — so on paper this guard is
 * unreachable. It exists for the day somebody points both agents at the same
 * URL, because the failure mode is not cosmetic: the response's
 * `first_message` is applied AFTER the payload sent at dispatch, so a
 * receptionist greeting returned here would overwrite the mandatory outbound
 * identification. Ana would ring a customer who did not call us and open with
 * "how can I help you?", which is a UTR 4(d) failure rather than an
 * embarrassment.
 */

const SECRET = "test-init-secret";
const OUTBOUND_AGENT = "agent_outbound_123";

vi.mock("@/lib/crm/calls", () => ({
  callerLocale: vi.fn(async () => null),
  startCall: vi.fn(async () => null),
}));

const { callerLocale, startCall } = await import("@/lib/crm/calls");
const { POST } = await import("./route");

async function init(body: Record<string, unknown>) {
  const response = await POST(
    new Request("https://example.test/api/voice/el/init", {
      method: "POST",
      headers: { "content-type": "application/json", "x-el-webhook-secret": SECRET },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

describe("the initiation webhook", () => {
  beforeEach(() => {
    process.env.ELEVENLABS_WEBHOOK_SECRET = SECRET;
    process.env.ELEVENLABS_OUTBOUND_AGENT_ID = OUTBOUND_AGENT;
  });

  afterEach(() => {
    delete process.env.ELEVENLABS_WEBHOOK_SECRET;
    delete process.env.ELEVENLABS_OUTBOUND_AGENT_ID;
    vi.clearAllMocks();
  });

  it("refuses a request without the shared secret", async () => {
    const response = await POST(
      new Request("https://example.test/api/voice/el/init", { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(403);
  });

  it("still greets an inbound caller exactly as before", async () => {
    const { json } = await init({
      call_sid: "CA123",
      caller_id: "+15145550188",
      called_number: "+15799903077",
      agent_id: "agent_inbound_999",
    });

    const override = json.conversation_config_override as {
      agent: { first_message: string; language: string };
    };
    expect(override.agent.first_message).toContain("Ana");
    expect(override.agent.language).toBe("fr");
    expect(startCall).toHaveBeenCalledTimes(1);
  });

  it("returns a bare no-op for the outbound agent", async () => {
    const { json } = await init({ call_sid: "CA123", agent_id: OUTBOUND_AGENT });

    expect(json).toEqual({ type: "conversation_initiation_client_data" });
    // No greeting to overwrite the outbound opening with…
    expect(json.conversation_config_override).toBeUndefined();
    // …and no second calls row for a conversation that already has one.
    expect(startCall).not.toHaveBeenCalled();
    expect(callerLocale).not.toHaveBeenCalled();
  });

  it("also recognises our own correlation id, with no agent id at all", async () => {
    const { json } = await init({ call_sid: "task_9f2c1ab74e6d4f0e9b3a5c8d10e2f7a4" });
    expect(json).toEqual({ type: "conversation_initiation_client_data" });
    expect(startCall).not.toHaveBeenCalled();
  });

  it("recognises that we are the caller, which holds on a shared agent", async () => {
    // The dialer currently uses the inbound ELEVENLABS_AGENT_ID, so agent_id
    // does not discriminate. This does: on an inbound call caller_id is the
    // customer's number, on a call we placed it is ours.
    const { json } = await init({
      call_sid: "CA555",
      caller_id: "+1 579-990-3077",
      called_number: "+15145550188",
      agent_id: "agent_inbound_999",
    });

    expect(json).toEqual({ type: "conversation_initiation_client_data" });
    expect(startCall).not.toHaveBeenCalled();
  });

  it("recognises an explicit direction flag", async () => {
    expect((await init({ call_sid: "CA9", mode: "outbound" })).json).toEqual({
      type: "conversation_initiation_client_data",
    });
    expect((await init({ call_sid: "CA9", direction: "outbound" })).json).toEqual({
      type: "conversation_initiation_client_data",
    });
  });

  it("does not treat every call as outbound when the env var is unset", async () => {
    delete process.env.ELEVENLABS_OUTBOUND_AGENT_ID;
    const { json } = await init({ call_sid: "CA123", agent_id: "agent_inbound_999" });
    expect(json.conversation_config_override).toBeDefined();
  });
});
