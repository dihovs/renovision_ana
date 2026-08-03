import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { placeOutboundCall, RINGING_TIMEOUT_SECONDS } from "./outboundDialer";
import type { CallTask } from "@/lib/crm/callTasks";

/**
 * The dispatch layer has three jobs and this file checks all three.
 *
 * 1. **Fail closed.** No credentials, no correlation id — no call. Loudly, in
 *    the logs, and without a retry that would only fail identically.
 * 2. **Ship the correlation id on both channels.** `dynamic_variables` is the
 *    one that survives to the post-call webhook; `custom_llm_extra_body` is the
 *    one that reaches the LLM mid-call. Everything downstream joins on it.
 * 3. **Never throw.** The cron runs this in a loop; a rejected promise here
 *    would abandon every task behind it in the batch.
 */

const ENV = {
  ELEVENLABS_API_KEY: "sk_super_secret_key_value",
  ELEVENLABS_OUTBOUND_AGENT_ID: "agent_outbound_123",
  ELEVENLABS_PHONE_NUMBER_ID: "phone_456",
};

function task(overrides: Partial<CallTask> = {}): CallTask {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    created_at: "2026-07-08T12:00:00Z",
    updated_at: "2026-07-08T12:00:00Z",
    kind: "confirm_visit",
    visit_id: "v1",
    job_id: null,
    client_id: "c1",
    to_number: "+15145550188",
    locale: "fr",
    payload: { contact_name: "Madame Tremblay", appointment_time: "neuf heures demain matin" },
    status: "dialing",
    not_before: "2026-07-08T12:00:00Z",
    attempts: 0,
    max_attempts: 3,
    last_attempt_at: null,
    call_sid: "task_9f2c1ab74e6d4f0e9b3a5c8d10e2f7a4",
    conversation_id: null,
    outcome: null,
    outcome_detail: {},
    completed_at: null,
    error: null,
    ...overrides,
  };
}

const fetchMock = vi.fn();
let errorLog: string[] = [];

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type SentBody = {
  agent_id: string;
  agent_phone_number_id: string;
  to_number: string;
  call_recording_enabled: boolean;
  telephony_call_config: Record<string, unknown>;
  conversation_initiation_client_data: {
    conversation_config_override: { agent: Record<string, unknown> };
    custom_llm_extra_body: Record<string, unknown>;
    dynamic_variables: Record<string, string>;
  };
};

/** The body the dialer sent, parsed. */
function sentBody(): SentBody {
  return JSON.parse(fetchMock.mock.calls[0][1].body as string) as SentBody;
}

function sentHeaders(): Record<string, string> {
  return fetchMock.mock.calls[0][1].headers as Record<string, string>;
}

beforeEach(() => {
  Object.assign(process.env, ENV);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  errorLog = [];
  vi.spyOn(console, "error").mockImplementation((...args) => {
    errorLog.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  for (const key of Object.keys(ENV)) delete process.env[key as keyof typeof ENV];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("failing closed", () => {
  it.each(Object.keys(ENV))("refuses to dial without %s", async (missing) => {
    delete process.env[missing as keyof typeof ENV];
    const result = await placeOutboundCall(task());

    expect(result).toMatchObject({ ok: false, retryable: false, status: 0 });
    expect(result.ok === false && result.message).toContain(missing);
    expect(fetchMock).not.toHaveBeenCalled();
    // Loudly: the owner has to be able to find this without instrumenting it.
    expect(errorLog.join("\n")).toContain(missing);
  });

  it("names every missing variable at once", async () => {
    for (const key of Object.keys(ENV)) delete process.env[key as keyof typeof ENV];
    const result = await placeOutboundCall(task());
    expect(result.ok === false && result.message).toContain("ELEVENLABS_API_KEY");
    expect(result.ok === false && result.message).toContain("ELEVENLABS_PHONE_NUMBER_ID");
  });

  it("treats a blank string as unset", async () => {
    process.env.ELEVENLABS_API_KEY = "   ";
    const result = await placeOutboundCall(task());
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a task with no correlation id rather than placing an untraceable call", async () => {
    const result = await placeOutboundCall(task({ call_sid: null }));
    expect(result).toMatchObject({ ok: false, retryable: false });
    expect(result.ok === false && result.message).toContain("call_sid");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the request", () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(
      ok({ success: true, message: "Call initiated", conversation_id: "conv_abc", callSid: "CA123" }),
    );
  });

  it("posts to the Twilio outbound endpoint with the api key in the header", async () => {
    await placeOutboundCall(task());
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.elevenlabs.io/v1/convai/twilio/outbound-call");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(sentHeaders()["xi-api-key"]).toBe(ENV.ELEVENLABS_API_KEY);
  });

  it("sends the three required fields", async () => {
    await placeOutboundCall(task());
    const body = sentBody();
    expect(body.agent_id).toBe(ENV.ELEVENLABS_OUTBOUND_AGENT_ID);
    expect(body.agent_phone_number_id).toBe(ENV.ELEVENLABS_PHONE_NUMBER_ID);
    expect(body.to_number).toBe("+15145550188");
  });

  it("carries the correlation id on BOTH channels", async () => {
    await placeOutboundCall(task());
    const data = sentBody().conversation_initiation_client_data;
    expect(data.custom_llm_extra_body.call_sid).toBe("task_9f2c1ab74e6d4f0e9b3a5c8d10e2f7a4");
    expect(data.dynamic_variables.call_sid).toBe("task_9f2c1ab74e6d4f0e9b3a5c8d10e2f7a4");
  });

  it("gives the script the kind and the payload it needs", async () => {
    await placeOutboundCall(task({ kind: "schedule_change", payload: { new_time: "14:00" } }));
    const extra = sentBody().conversation_initiation_client_data.custom_llm_extra_body;
    expect(extra.mode).toBe("outbound");
    expect(extra.kind).toBe("schedule_change");
    expect(extra.payload).toEqual({ new_time: "14:00" });
    expect(extra.task_id).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("flattens scalar payload fields into dynamic_variables for the voicemail template", async () => {
    await placeOutboundCall(task());
    const vars = sentBody().conversation_initiation_client_data.dynamic_variables;
    expect(vars.contact_name).toBe("Madame Tremblay");
    expect(vars.appointment_time).toBe("neuf heures demain matin");
  });

  it("drops nested payload values from dynamic_variables — they cannot be interpolated", async () => {
    await placeOutboundCall(task({ payload: { address: { street: "1240 rue Saint-Denis" }, eta: 30 } }));
    const vars = sentBody().conversation_initiation_client_data.dynamic_variables;
    expect(vars).not.toHaveProperty("address");
    expect(vars.eta).toBe("30");
  });

  it("never sets caller_phone — that is how owner mode would leak to a customer", async () => {
    await placeOutboundCall(task({ payload: { caller_phone: "+15799903077" } }));
    const data = sentBody().conversation_initiation_client_data;
    expect(data.dynamic_variables).not.toHaveProperty("caller_phone");
  });

  it("strips reserved system__ variables, which ElevenLabs rejects", async () => {
    await placeOutboundCall(task({ payload: { system__caller_id: "+1", ok_field: "yes" } }));
    const vars = sentBody().conversation_initiation_client_data.dynamic_variables;
    expect(vars).not.toHaveProperty("system__caller_id");
    expect(vars.ok_field).toBe("yes");
  });

  it("cannot have its correlation id overwritten by a payload field", async () => {
    await placeOutboundCall(task({ payload: { call_sid: "task_impostor", kind: "nonsense" } }));
    const vars = sentBody().conversation_initiation_client_data.dynamic_variables;
    expect(vars.call_sid).toBe("task_9f2c1ab74e6d4f0e9b3a5c8d10e2f7a4");
    expect(vars.kind).toBe("confirm_visit");
  });

  it("overrides the language but leaves the opening script alone", async () => {
    await placeOutboundCall(task({ locale: "en" }));
    const override = sentBody().conversation_initiation_client_data.conversation_config_override;
    expect(override.agent.language).toBe("en");
    expect(override.agent).not.toHaveProperty("first_message");
    expect(override.agent).not.toHaveProperty("prompt");
  });

  it("keeps no audio and rings for thirty seconds", async () => {
    await placeOutboundCall(task());
    const body = sentBody();
    expect(body.call_recording_enabled).toBe(false);
    expect(body.telephony_call_config).toEqual({
      ringing_timeout_secs: RINGING_TIMEOUT_SECONDS,
      twilio_call_recording_enabled: false,
    });
    expect(RINGING_TIMEOUT_SECONDS).toBe(30);
  });
});

describe("the response", () => {
  it("reads conversation_id and the camelCase callSid", async () => {
    fetchMock.mockResolvedValue(
      ok({ success: true, message: "ok", conversation_id: "conv_abc", callSid: "CA999" }),
    );
    expect(await placeOutboundCall(task())).toEqual({
      ok: true,
      conversationId: "conv_abc",
      providerCallSid: "CA999",
    });
  });

  it("survives a 200 with nulls where the ids should be", async () => {
    fetchMock.mockResolvedValue(ok({ success: true, message: "ok", conversation_id: null, callSid: null }));
    expect(await placeOutboundCall(task())).toEqual({
      ok: true,
      conversationId: null,
      providerCallSid: null,
    });
  });

  it("treats success:false as a refusal, not a transport error", async () => {
    fetchMock.mockResolvedValue(
      ok({ success: false, message: "Phone number not found", conversation_id: null, callSid: null }),
    );
    const result = await placeOutboundCall(task());
    expect(result).toMatchObject({ ok: false, retryable: false, message: "Phone number not found" });
  });
});

describe("classifying failures", () => {
  it("retries a 429 — that is the concurrency cap, not a mistake", async () => {
    fetchMock.mockResolvedValue(ok({ detail: { status: "concurrent_limit_exceeded" } }, 429));
    const result = await placeOutboundCall(task());
    expect(result).toMatchObject({ ok: false, retryable: true, status: 429 });
    expect(result.ok === false && result.message).toContain("concurrent_limit_exceeded");
  });

  it("retries a 500", async () => {
    fetchMock.mockResolvedValue(ok({ message: "internal" }, 503));
    expect(await placeOutboundCall(task())).toMatchObject({ retryable: true, status: 503 });
  });

  it("does not retry a 400 — a bad agent id is still bad in fifteen minutes", async () => {
    fetchMock.mockResolvedValue(ok({ detail: "agent_id is invalid" }, 400));
    const result = await placeOutboundCall(task());
    expect(result).toMatchObject({ ok: false, retryable: false, status: 400 });
    expect(result.ok === false && result.message).toBe("agent_id is invalid");
  });

  it("does not retry a 401", async () => {
    fetchMock.mockResolvedValue(ok({ detail: "invalid api key" }, 401));
    expect(await placeOutboundCall(task())).toMatchObject({ retryable: false, status: 401 });
  });

  it("treats a network failure as retryable and does not throw", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const result = await placeOutboundCall(task());
    expect(result).toMatchObject({ ok: false, retryable: true, status: 0, message: "fetch failed" });
  });

  it("treats a timeout as retryable and does not throw", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted.", "TimeoutError"));
    expect(await placeOutboundCall(task())).toMatchObject({ ok: false, retryable: true, status: 0 });
  });

  it("copes with a non-JSON error body", async () => {
    fetchMock.mockResolvedValue(new Response("<html>502 Bad Gateway</html>", { status: 502 }));
    const result = await placeOutboundCall(task());
    expect(result).toMatchObject({ ok: false, retryable: true, status: 502 });
    expect(result.ok === false && result.message).toContain("502");
  });
});

describe("the api key", () => {
  it("never reaches a log, on any path", async () => {
    const logged: string[] = [];
    for (const method of ["log", "warn", "info"] as const) {
      vi.spyOn(console, method).mockImplementation((...args) => {
        logged.push(args.map(String).join(" "));
      });
    }

    fetchMock.mockResolvedValue(ok({ detail: "nope" }, 400));
    await placeOutboundCall(task());
    fetchMock.mockRejectedValue(new Error("fetch failed"));
    await placeOutboundCall(task());
    delete process.env.ELEVENLABS_OUTBOUND_AGENT_ID;
    await placeOutboundCall(task());

    const everything = [...logged, ...errorLog].join("\n");
    expect(everything).not.toContain(ENV.ELEVENLABS_API_KEY);
    expect(everything.length).toBeGreaterThan(0); // it did log *something*
  });
});
