import crypto from "crypto";
import { completeCallTask, failCallTask } from "@/lib/crm/callTasks";
import { endCall } from "@/lib/crm/calls";
import { fileLeadFromCall } from "@/lib/voice/postCallLead";
import {
  outcomeFromInitiationFailure,
  outcomeFromPostCall,
  type InitiationFailure,
  type PostCallData,
} from "@/lib/voice/outboundOutcome";

/**
 * ElevenLabs Agents — post-call webhook.
 *
 * Fires once the call ends, with the full transcript and duration ElevenLabs
 * recorded on its own side. This is what closes the Supabase row — the
 * equivalent of /api/voice/status in the turn-based path, except Twilio's
 * Status Callback URL only fires for calls Twilio itself is running the TwiML
 * for, which an ElevenLabs-hosted call is not. So this webhook is the only
 * place "the call ended" is ever heard for this path.
 *
 * Signature format hand-verified here (HMAC-SHA256, not their SDK) to avoid
 * a dependency for one check — matches the manual-HMAC house style already
 * used for Twilio and Meta's webhooks elsewhere in this codebase:
 *   Header: `ElevenLabs-Signature: t=<unix_seconds>,v0=<hex>[,v0=<hex>...]`
 *   Signed payload: `${timestamp}.${rawBody}` (the RAW body — parsing first
 *   and re-serialising would produce a different byte string and never match)
 *   Tolerance: 30 minutes, to reject old signatures replayed later.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMESTAMP_TOLERANCE_SECONDS = 30 * 60;

function verifySignature(raw: string, header: string | null): boolean {
  const secret = process.env.ELEVENLABS_POSTCALL_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[voice-el] ELEVENLABS_POSTCALL_WEBHOOK_SECRET is not set — refusing");
    return false;
  }
  if (!header) return false;

  const parts = Object.fromEntries(
    header.split(",").map((pair) => {
      const [key, ...rest] = pair.split("=");
      return [key.trim(), rest.join("=")];
    }),
  ) as Record<string, string>;
  // Multiple v0= entries are possible during secret rotation; header parsing
  // above only keeps the last one with a given key, which is exactly wrong
  // for that case — collected properly below instead.
  const signatures = header
    .split(",")
    .filter((pair) => pair.trim().startsWith("v0="))
    .map((pair) => pair.trim().slice("v0=".length));

  const timestamp = Number(parts.t);
  if (!timestamp || signatures.length === 0) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - timestamp);
  if (ageSeconds > TIMESTAMP_TOLERANCE_SECONDS) {
    console.error("[voice-el] webhook timestamp outside tolerance — possible replay");
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${raw}`, "utf8")
    .digest("hex");
  const expectedBuf = Buffer.from(expected);

  return signatures.some((sig) => {
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
}

/** Best-effort — see the same UNVERIFIED note in el/chat/route.ts. */
function extractCallSid(data: Record<string, unknown>): string | null {
  const dynamic = data.dynamic_variables as Record<string, unknown> | undefined;
  const initData = data.conversation_initiation_client_data as Record<string, unknown> | undefined;
  const nestedDynamic = initData?.dynamic_variables as Record<string, unknown> | undefined;
  return (dynamic?.call_sid as string) ?? (nestedDynamic?.call_sid as string) ?? null;
}

/** The queue row id, same three places, for the retry path. */
function extractTaskId(data: Record<string, unknown>): string | null {
  const dynamic = data.dynamic_variables as Record<string, unknown> | undefined;
  const initData = data.conversation_initiation_client_data as Record<string, unknown> | undefined;
  const nestedDynamic = initData?.dynamic_variables as Record<string, unknown> | undefined;
  const extra = initData?.custom_llm_extra_body as Record<string, unknown> | undefined;
  const value = dynamic?.task_id ?? nestedDynamic?.task_id ?? extra?.task_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Was this a call we placed?
 *
 * Two independent signals, for the same reason el/chat uses two: the explicit
 * mode flag, and the `task_` prefix on the correlation id, which only the
 * outbound dialer mints (a real Twilio SID starts `CA`). Getting this wrong in
 * the false direction would write an outcome onto a task that was never called;
 * getting it wrong in the true direction leaves a queue row stuck in `dialing`
 * until the stall sweep rescues it. Both signals have to be absent for an
 * outbound call to be missed.
 */
function isOutbound(data: Record<string, unknown>, callSid: string | null): boolean {
  if (typeof callSid === "string" && callSid.startsWith("task_")) return true;
  const dynamic = data.dynamic_variables as Record<string, unknown> | undefined;
  const initData = data.conversation_initiation_client_data as Record<string, unknown> | undefined;
  const nestedDynamic = initData?.dynamic_variables as Record<string, unknown> | undefined;
  const extra = initData?.custom_llm_extra_body as Record<string, unknown> | undefined;
  return (
    dynamic?.mode === "outbound" || nestedDynamic?.mode === "outbound" || extra?.mode === "outbound"
  );
}

export async function POST(request: Request) {
  const raw = await request.text();

  if (!verifySignature(raw, request.headers.get("elevenlabs-signature"))) {
    return new Response("Forbidden", { status: 403 });
  }

  let payload: {
    type?: string;
    data?: {
      status?: string;
      metadata?: { call_duration_secs?: number };
      [key: string]: unknown;
    };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    // 200 on a malformed body: retrying will not fix a body that never
    // parses, and a non-200 buys a retry storm for nothing.
    return new Response("", { status: 200 });
  }

  // BOTH WEBHOOK TYPES ARRIVE HERE, and until now everything that wasn't a
  // transcription was silently dropped — which meant a call that never
  // connected recorded nothing at all and its queue row sat in `dialing`
  // forever. Docs/Voice-Outbound-Research.md §6 calls this the single most
  // important edit in this file.
  //
  // EVERY PATH BELOW STILL RETURNS 200. ElevenLabs auto-disables a post-call
  // webhook after ten consecutive non-200s when the last success was more than
  // seven days ago, and this endpoint is shared with inbound — so an outbound
  // bug that 500s would quietly switch off inbound transcripts too, with no
  // error anywhere on our side. That property is worth more than any error
  // signalling we would gain by being honest with a status code.
  if (payload.type === "call_initiation_failure") {
    // The documented envelope nests everything under `data`, but this event
    // type is thinly documented and the failure fields have been seen at the
    // top level. Look in both rather than drop the event.
    await handleInitiationFailure(payload.data ?? (payload as Record<string, unknown>));
    return new Response("", { status: 200 });
  }

  if (payload.type !== "post_call_transcription" || !payload.data) {
    return new Response("", { status: 200 });
  }

  const callSid = extractCallSid(payload.data);
  if (!callSid) {
    console.error("[voice-el] post-call webhook had no call_sid — cannot close the transcript");
    return new Response("", { status: 200 });
  }

  try {
    await endCall(callSid, {
      status: payload.data.status === "done" ? "completed" : "failed",
      durationSeconds: payload.data.metadata?.call_duration_secs ?? null,
    });
  } catch (err) {
    console.error("[voice-el] could not close the transcript:", err);
  }

  if (isOutbound(payload.data, callSid)) {
    await recordOutboundOutcome(callSid, payload.data as unknown as PostCallData);
  } else {
    // Inbound only: the finished transcript may now become a CRM lead.
    // Everything in there is a logged no-op on failure — this webhook's 200
    // is what keeps transcripts flowing at all (the auto-disable note above),
    // and no extraction is worth risking it. fileLeadFromCall never throws by
    // construction; the catch is the belt on those braces.
    await fileLeadFromCall(callSid).catch((err) => {
      console.error("[voice-lead] post-call extraction crashed:", err);
    });
  }

  return new Response("", { status: 200 });
}

/**
 * Close the queue row for a call that happened.
 *
 * Keyed on the correlation id rather than the task id because that is what
 * every other path already joins on, and because it is the one key that is
 * guaranteed to have existed before the call was placed.
 *
 * Swallows everything. A queue row that does not get its outcome is a row the
 * owner has to read the transcript for; a throw here is a non-200, and a
 * non-200 is how the whole webhook gets turned off.
 */
async function recordOutboundOutcome(callSid: string, data: PostCallData): Promise<void> {
  try {
    const { outcome, detail } = outcomeFromPostCall(data);
    const conversationId =
      typeof (data as { conversation_id?: unknown }).conversation_id === "string"
        ? ((data as { conversation_id?: string }).conversation_id ?? null)
        : null;

    const result = await completeCallTask(callSid, {
      outcome,
      outcomeDetail: detail,
      conversationId,
    });

    if (!result.ok) {
      console.error("[voice-outbound] could not record the outcome", { callSid, outcome, result });
    } else if (result.changed === 0) {
      // Either the owner cancelled the task while the call was in flight, or
      // this correlation id was never a queued call. Both are worth a line and
      // neither is worth a retry.
      console.info("[voice-outbound] no open call task matched this call", { callSid, outcome });
    } else {
      console.info("[voice-outbound] call task completed", { callSid, outcome });
    }
  } catch (err) {
    console.error("[voice-outbound] outcome mapping failed:", err);
  }
}

/**
 * The call never became a conversation — busy, rang out, or a number that does
 * not exist.
 *
 * A dead number is terminal and gets `wrong_number` written straight onto the
 * row: a number that does not exist will not start existing, and three attempts
 * at it are three identical failures. Everything else goes through
 * failCallTask(), which owns the attempt counter and the backoff table, so a
 * busy line is tried again and an exhausted one lands in `failed` with the
 * reason attached.
 */
async function handleInitiationFailure(data: Record<string, unknown>): Promise<void> {
  const callSid = extractCallSid(data);
  const taskId = extractTaskId(data);
  const verdict = outcomeFromInitiationFailure(data as unknown as InitiationFailure);

  console.info("[voice-outbound] the call could not be placed", {
    callSid,
    taskId,
    ...verdict,
  });

  // The transcript row was opened at dispatch, before ElevenLabs was asked to
  // dial. Nothing was ever said on it, so it closes as failed rather than
  // hanging in `in_progress` until the retention purge finds it.
  if (callSid) {
    await endCall(callSid, { status: "failed", durationSeconds: 0 }).catch((err) => {
      console.error("[voice-outbound] could not close the transcript:", err);
    });
  }

  try {
    if (verdict.retryable && taskId) {
      const result = await failCallTask(taskId, `call not placed: ${verdict.reason}`);
      if (!result.ok) {
        console.error("[voice-outbound] could not requeue the call task", { taskId, result });
      }
      return;
    }

    if (!callSid) {
      console.error(
        "[voice-outbound] initiation failure with neither a correlation id nor a task id — nothing to record",
      );
      return;
    }

    const result = await completeCallTask(callSid, {
      outcome: verdict.outcome,
      outcomeDetail: { initiation_failure: verdict.reason },
    });
    if (!result.ok) {
      console.error("[voice-outbound] could not record the failure", { callSid, result });
    }
  } catch (err) {
    console.error("[voice-outbound] initiation-failure handling threw:", err);
  }
}
