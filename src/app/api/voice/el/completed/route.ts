import crypto from "crypto";
import { endCall } from "@/lib/crm/calls";

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

  return new Response("", { status: 200 });
}
