import crypto from "crypto";
import {
  inferJobId,
  recordMessage,
  storeMedia,
  upsertContact,
  type WhatsAppMessage,
} from "@/lib/whatsapp/store";
// One version string for the whole integration. Two of them drift, and the one
// that drifts is always the one nobody is looking at.
import { GRAPH_VERSION } from "@/lib/whatsapp/send";

/**
 * WhatsApp Cloud API webhook.
 *
 * Meta POSTs every inbound message here. Two rules govern everything below:
 *
 *   ANSWER FAST. Meta retries on anything slow or non-200, and a retry storm
 *   turns one photo into six. So the handler acknowledges quickly and does the
 *   slow part — downloading media — inside the same request only because it is
 *   a couple of seconds; anything heavier would need a queue.
 *
 *   NEVER GUESS WHICH JOB. A photo of someone's bathroom filed against the
 *   wrong customer is worse than a photo sitting in an inbox waiting for one
 *   tap. Unmatched messages are flagged, not assigned.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Meta's subscription handshake: they GET with a token we chose, and we echo
 * the challenge back only if it matches.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expected) {
    console.error("[whatsapp] WHATSAPP_VERIFY_TOKEN is not set");
    return new Response("Not configured", { status: 503 });
  }

  if (mode === "subscribe" && token && challenge) {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return new Response(challenge, { status: 200 });
    }
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  // The raw body is needed for the signature, so it is read as text once and
  // parsed afterwards — re-reading a consumed body would throw.
  const raw = await request.text();

  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new Response("Forbidden", { status: 403 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(raw) as MetaWebhookPayload;
  } catch {
    // 200 on a malformed body: retrying will not fix it, and a non-200 buys a
    // retry storm for a message we can never parse.
    return new Response("", { status: 200 });
  }

  try {
    await handle(payload);
  } catch (err) {
    // Logged, not surfaced. A 500 here makes Meta redeliver, which duplicates
    // whatever did succeed before the failure.
    console.error("[whatsapp] handler failed:", err);
  }

  return new Response("", { status: 200 });
}

/**
 * Meta signs the raw body with the app secret.
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */
function verifySignature(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    // Refuse rather than default open: this endpoint is public, and an
    // unverifiable one accepts anybody's idea of what a subcontractor said.
    console.error("[whatsapp] WHATSAPP_APP_SECRET is not set — rejecting");
    return false;
  }
  if (!header?.startsWith("sha256=")) return false;

  const expected = crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header.slice("sha256=".length));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type MetaWebhookPayload = {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: MetaMessage[];
        statuses?: MetaStatus[];
      };
    }[];
  }[];
};

/**
 * A delivery receipt. `errors` and `pricing` are the two fields worth having:
 * the first says why a message never arrived (131026 — not a WhatsApp user — is
 * the one with an answer, which is SMS), and the second says what Meta actually
 * billed it as, which is the only place a utility template silently
 * recategorised as marketing shows up.
 */
type MetaStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
  pricing?: { category?: string; billable?: boolean };
  biz_opaque_callback_data?: string;
};

type MetaMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; caption?: string };
  video?: { id?: string; mime_type?: string; caption?: string };
  audio?: { id?: string; mime_type?: string };
  document?: { id?: string; mime_type?: string; caption?: string; filename?: string };
  location?: { latitude?: number; longitude?: number; name?: string };
};

async function handle(payload: MetaWebhookPayload): Promise<void> {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      // Delivery receipts for our own outbound messages.
      for (const status of value.statuses ?? []) {
        if (status.id && status.status) await updateStatus(status);
      }

      const profileByWaId = new Map<string, string>();
      for (const contact of value.contacts ?? []) {
        if (contact.wa_id && contact.profile?.name) {
          profileByWaId.set(contact.wa_id, contact.profile.name);
        }
      }

      for (const message of value.messages ?? []) {
        await handleMessage(message, profileByWaId.get(message.from ?? "") ?? null);
      }
    }
  }
}

async function handleMessage(message: MetaMessage, profileName: string | null): Promise<void> {
  if (!message.from) return;

  const contact = await upsertContact(message.from, profileName);
  const kind = normaliseKind(message.type);

  const text =
    message.text?.body ??
    message.image?.caption ??
    message.video?.caption ??
    message.document?.caption ??
    (message.location
      ? `Location: ${message.location.name ?? `${message.location.latitude}, ${message.location.longitude}`}`
      : null);

  const { jobId, confident } = await inferJobId(contact?.id ?? null, text);

  // Download the media into our own bucket. Meta's URLs expire in minutes, so
  // a link stored now would be broken by the time anyone opened the job.
  let mediaPath: string | null = null;
  let mediaMime: string | null = null;
  const mediaId =
    message.image?.id ?? message.video?.id ?? message.audio?.id ?? message.document?.id ?? null;

  if (mediaId) {
    const media = await downloadMedia(mediaId);
    if (media) {
      mediaPath = await storeMedia(media.bytes, media.mime);
      mediaMime = media.mime;
    }
  }

  await recordMessage({
    waMessageId: message.id,
    contactId: contact?.id ?? null,
    jobId,
    direction: "inbound",
    kind,
    body: text,
    mediaPath,
    mediaMime,
    mediaCaption: message.image?.caption ?? message.video?.caption ?? null,
    sentAt: message.timestamp
      ? new Date(Number(message.timestamp) * 1000).toISOString()
      : undefined,
    // Flagged when it landed on a job by inference rather than by an explicit
    // job number, so a wrong guess is visible instead of silent.
    needsFiling: !jobId || !confident,
  });
}

function normaliseKind(type: string | undefined): WhatsAppMessage["kind"] {
  switch (type) {
    case "text":
    case "image":
    case "video":
    case "audio":
    case "document":
    case "location":
      return type;
    default:
      return "other";
  }
}

/**
 * Meta's two-step media fetch: the id resolves to a short-lived URL, and that
 * URL needs the bearer token too.
 */
async function downloadMedia(
  mediaId: string,
): Promise<{ bytes: ArrayBuffer; mime: string } | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    console.error("[whatsapp] WHATSAPP_ACCESS_TOKEN is not set — cannot fetch media");
    return null;
  }

  try {
    const lookup = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!lookup.ok) throw new Error(`media lookup ${lookup.status}`);

    const meta = (await lookup.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return null;

    const file = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!file.ok) throw new Error(`media download ${file.status}`);

    return {
      bytes: await file.arrayBuffer(),
      mime: meta.mime_type ?? file.headers.get("content-type") ?? "application/octet-stream",
    };
  } catch (err) {
    // Swallowed on purpose: a photo that won't download must not cost the
    // message it arrived with, and the text is usually what says what happened.
    console.error("[whatsapp] media fetch failed:", err);
    return null;
  }
}

/**
 * Walk an outbound message along sent → delivered → read, or park it at failed.
 *
 * Mirrored onto `job_dispatches` as well as the message, because those are two
 * different questions: the message row answers "what happened to this envelope",
 * the dispatch row answers "does the crew know about this job". A status that
 * only updated the message would leave the dispatch list claiming everyone was
 * told when one of them was never reachable.
 */
async function updateStatus(status: MetaStatus): Promise<void> {
  const { db } = await import("@/lib/crm/db");
  const client = db();
  if (!client || !status.id) return;

  const error = status.errors?.[0];
  const at = status.timestamp
    ? new Date(Number(status.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  await client
    .from("whatsapp_messages")
    .update({
      status: status.status,
      ...(error ? { error_code: error.code ?? null, error_detail: error.error_data?.details ?? error.title ?? null } : {}),
      ...(status.pricing?.category ? { billing_category: status.pricing.category } : {}),
    })
    .eq("wa_message_id", status.id);

  const dispatchPatch: Record<string, unknown> = {};
  if (status.status === "delivered") dispatchPatch.delivered_at = at;
  if (status.status === "read") dispatchPatch.read_at = at;
  if (status.status === "failed") {
    dispatchPatch.failed_at = at;
    dispatchPatch.error_code = error?.code ?? null;
    dispatchPatch.error_detail = error?.error_data?.details ?? error?.title ?? null;
  }
  if (Object.keys(dispatchPatch).length === 0) return;

  await client.from("job_dispatches").update(dispatchPatch).eq("wa_message_id", status.id);
}
