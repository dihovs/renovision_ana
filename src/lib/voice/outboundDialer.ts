import type { CallTask } from "@/lib/crm/callTasks";

/**
 * Placing the call.
 *
 * One POST — `POST /v1/convai/twilio/outbound-call` — and nothing of ours held
 * open: no websocket, no TwiML, same as inbound. ElevenLabs dials through the
 * Twilio credentials it already holds and hands back a conversation id and a
 * Twilio SID. See Docs/Voice-Outbound-Research.md §1.1 for the full schema; the
 * body built below is §2.2 verbatim, minus the pieces that belong to the
 * script rather than the transport.
 *
 * Hand-rolled `fetch` rather than an SDK, in the house style — the Twilio and
 * Meta webhooks are hand-rolled here too.
 *
 * THE ONE THING TO UNDERSTAND: the correlation id. `call_sid` on the task row
 * is minted by us, before dialling, and shipped in both `dynamic_variables`
 * and `custom_llm_extra_body`. It has to be, because the outbound endpoint
 * wants the conversation's initiation data in the same request that returns
 * the Twilio SID — the provider's own identifier does not exist yet at the
 * moment we need one. Everything downstream (the per-turn LLM endpoint, the
 * post-call webhook, the transcript row) resolves the call through that key,
 * so a dispatch without one is refused rather than guessed at.
 */

/** Read from the env at call time, never at module load, so tests can set them. */
type DialerConfig = { apiKey: string; agentId: string; phoneNumberId: string };

const OUTBOUND_URL = "https://api.elevenlabs.io/v1/convai/twilio/outbound-call";

/**
 * Sixty seconds of ringing on a Quebec mobile lands in voicemail long before it
 * times out. Thirty gets the no-answer verdict back to the queue half a minute
 * sooner and costs nothing real.
 */
export const RINGING_TIMEOUT_SECONDS = 30;

/**
 * A hung dispatch must not eat the cron's execution budget. This is the POST,
 * not the call — ElevenLabs returns as soon as it has handed the leg to Twilio.
 */
const DISPATCH_TIMEOUT_MS = 10_000;

export type OutboundDispatch =
  | {
      ok: true;
      /** ElevenLabs' own id for the conversation. */
      conversationId: string | null;
      /** Twilio's SID. Secondary — our `call_sid` is the key everything joins on. */
      providerCallSid: string | null;
    }
  | {
      ok: false;
      /**
       * Whether trying again could plausibly work. 429 and 5xx yes; a bad
       * agent id or a number that does not exist, no — a configuration error
       * retried three times is three identical errors and two wasted slots.
       */
      retryable: boolean;
      /** HTTP status, or 0 when the request never completed. */
      status: number;
      message: string;
    };

/**
 * Fail closed and loudly.
 *
 * These three credentials are the first ones this project holds that can spend
 * money and make a stranger's phone ring. Missing one is not a soft
 * degradation to be logged at debug level and forgotten; it is the whole
 * feature being off, and the owner needs to be able to find out why from the
 * logs without adding instrumentation.
 *
 * The key itself is never logged, here or anywhere — only whether it is set.
 */
function readConfig(): DialerConfig | { missing: string[] } {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  // Named for the OUTBOUND agent specifically, and it must not be the inbound
  // receptionist's id. Two reasons: outbound needs its own opening and its own
  // permitted overrides, and /api/voice/el/init compares against this exact
  // variable to recognise — and refuse to interfere with — an outbound call.
  // One name, checked in both places, so the guard cannot drift from the dial.
  const agentId = process.env.ELEVENLABS_OUTBOUND_AGENT_ID?.trim();
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID?.trim();

  const missing: string[] = [];
  if (!apiKey) missing.push("ELEVENLABS_API_KEY");
  if (!agentId) missing.push("ELEVENLABS_OUTBOUND_AGENT_ID");
  if (!phoneNumberId) missing.push("ELEVENLABS_PHONE_NUMBER_ID");
  if (missing.length > 0) return { missing };

  return { apiKey: apiKey!, agentId: agentId!, phoneNumberId: phoneNumberId! };
}

/**
 * Dynamic variables are substituted into ElevenLabs-rendered text as `{{var}}`
 * — most importantly the voicemail message, which ElevenLabs renders itself and
 * which therefore cannot see `custom_llm_extra_body`. Only flat scalars can go
 * through that channel, so the task payload is flattened and anything nested is
 * dropped (it is still in the extra body, which is where the script reads it).
 *
 * Two hard exclusions:
 *  - `system__*` is reserved by ElevenLabs and rejected in a client payload.
 *  - `caller_phone` must never be set outbound. The per-turn endpoint reads it
 *    to decide whether a caller is the owner, and setting it to the number we
 *    are DIALLING would hand owner-mode CRM tools to whoever picks up.
 */
function flatVariables(payload: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key.startsWith("system__") || key === "caller_phone") continue;
    if (typeof value === "string") out[key] = value;
    else if (typeof value === "number" || typeof value === "boolean") out[key] = String(value);
  }
  return out;
}

/**
 * Place the call.
 *
 * Never throws: the cron must be able to run this in a loop and keep going. A
 * network failure, a timeout, a malformed response and a 500 all come back as
 * `{ ok: false }` with a retryable flag.
 */
export async function placeOutboundCall(task: CallTask): Promise<OutboundDispatch> {
  const config = readConfig();
  if ("missing" in config) {
    const message = `outbound calling is not configured — set ${config.missing.join(", ")}`;
    console.error(`[outbound] ${message}`);
    return { ok: false, retryable: false, status: 0, message };
  }

  if (!task.call_sid) {
    // Not a transport problem: a call we cannot correlate is a call whose
    // transcript, outcome and completion we will never be able to attach to
    // anything. Refuse it rather than place an untraceable call to a customer.
    const message = "call task has no correlation id (call_sid) — refusing to dial";
    console.error(`[outbound] ${message} (task ${task.id})`);
    return { ok: false, retryable: false, status: 0, message };
  }

  const body = {
    agent_id: config.agentId,
    agent_phone_number_id: config.phoneNumberId,
    to_number: task.to_number,
    // The privacy policy promises no audio is kept. Transcripts are enough.
    call_recording_enabled: false,
    telephony_call_config: {
      ringing_timeout_secs: RINGING_TIMEOUT_SECONDS,
      twilio_call_recording_enabled: false,
    },
    conversation_initiation_client_data: {
      conversation_config_override: {
        // Language only. `first_message` is deliberately absent: the opening
        // script is the agent's business, not the dialer's, and overriding a
        // prompt here would do nothing anyway (the Custom LLM discards it).
        agent: { language: task.locale },
      },
      // The channel that actually reaches the LLM: it arrives on every
      // per-turn request as the top-level `elevenlabs_extra_body` object.
      custom_llm_extra_body: {
        mode: "outbound",
        call_sid: task.call_sid,
        task_id: task.id,
        kind: task.kind,
        locale: task.locale,
        payload: task.payload ?? {},
      },
      // The only channel guaranteed to survive to the post-call webhook, which
      // is why the correlation id rides here as well as in the extra body.
      dynamic_variables: {
        ...flatVariables(task.payload ?? {}),
        call_sid: task.call_sid,
        task_id: task.id,
        kind: task.kind,
        locale: task.locale,
      },
    },
  };

  let response: Response;
  try {
    response = await fetch(OUTBOUND_URL, {
      method: "POST",
      headers: {
        "xi-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[outbound] dispatch failed for task ${task.id}:`, message);
    // Unknown whether the leg was created. Retryable, but the daily cap and
    // the attempt counter both tick, so at worst one customer's phone rings
    // once more than it strictly needed to.
    return { ok: false, retryable: true, status: 0, message };
  }

  const raw = await response.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const message = providerMessage(parsed) ?? raw.slice(0, 500) ?? response.statusText;
    console.error(`[outbound] ElevenLabs returned ${response.status} for task ${task.id}: ${message}`);
    return {
      ok: false,
      // 429 is concurrency, not a mistake; 5xx is theirs. Everything else is
      // ours — a bad agent id will still be bad in fifteen minutes.
      retryable: response.status === 429 || response.status >= 500,
      status: response.status,
      message,
    };
  }

  const payload = (parsed ?? {}) as {
    success?: boolean;
    message?: string;
    conversation_id?: string | null;
    // camelCase, in an otherwise snake_case API. Getting it wrong is a silent
    // null rather than an error, which is why it is spelled out here.
    callSid?: string | null;
  };

  if (payload.success === false) {
    const message = payload.message ?? "ElevenLabs declined the call";
    console.error(`[outbound] ElevenLabs declined task ${task.id}: ${message}`);
    return { ok: false, retryable: false, status: response.status, message };
  }

  return {
    ok: true,
    conversationId: payload.conversation_id ?? null,
    providerCallSid: payload.callSid ?? null,
  };
}

/** Pull a human-readable message out of an ElevenLabs error body. */
function providerMessage(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object") return null;
  const body = parsed as { message?: unknown; detail?: unknown };
  if (typeof body.message === "string") return body.message;
  if (typeof body.detail === "string") return body.detail;
  if (body.detail && typeof body.detail === "object") {
    const detail = body.detail as { message?: unknown; status?: unknown };
    if (typeof detail.message === "string") return detail.message;
    if (typeof detail.status === "string") return detail.status;
  }
  return null;
}
