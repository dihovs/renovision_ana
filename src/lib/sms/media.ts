import { db } from "@/lib/crm/db";

/**
 * Pictures that came in with a text, and the ones going out with one.
 *
 * **Copied out of Twilio, not linked to.** Twilio's media URLs expire and
 * need the account credentials to fetch, so storing one produces a link that
 * is already dead by the time an adjuster opens the file. On a water-damage
 * job the photo a customer texts at 2am is frequently the whole enquiry, so
 * it gets the same treatment as any other evidence: fetched once, put in our
 * own private bucket, and signed per read.
 *
 * The WhatsApp media store does exactly this and its reasoning holds here —
 * a separate bucket only because the two arrive by different routes and
 * neither should be able to break the other's paths.
 */

const MEDIA_BUCKET = "sms-media";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const FETCH_TIMEOUT_MS = 15_000;
/** Twilio's own MMS ceiling. Anything larger is not an MMS we could have
    sent, and refusing early beats a storage bill for a mis-sent file. */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Pull one Twilio media item into our bucket. Returns the stored path, or
 * nil — a photo that will not download must never cost the message it came
 * with, and the text alongside it usually says what happened.
 */
export async function storeTwilioMedia(
  url: string,
  contentType: string,
): Promise<string | null> {
  const client = db();
  if (!client) return null;

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!accountSid || !authToken) {
    console.error("[mms] Twilio credentials are not set — cannot fetch media");
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error("[mms] could not fetch media:", response.status);
      return null;
    }

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) {
      console.error("[mms] media larger than an MMS can be:", bytes.byteLength);
      return null;
    }

    const mime = response.headers.get("content-type") || contentType || "application/octet-stream";
    const extension =
      mime.split("/")[1]?.split(";")[0]?.replace("jpeg", "jpg") ?? "bin";
    const stamp = new Date().toISOString().slice(0, 10);
    const path = `${stamp}/${crypto.randomUUID()}.${extension}`;

    const { error } = await client.storage
      .from(MEDIA_BUCKET)
      .upload(path, Buffer.from(bytes), { contentType: mime, upsert: false });
    if (error) {
      console.error("[mms] upload failed:", error.message);
      return null;
    }
    return path;
  } catch (error) {
    console.error("[mms] media fetch failed:", (error as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Every media item on one inbound message, in the order Twilio numbered
 * them.
 *
 * Sequential rather than parallel: Twilio rate-limits media fetches per
 * account, and an MMS carries at most ten items, so the wall-clock saved by
 * racing them is not worth the 429 it invites.
 */
export async function storeInboundMedia(
  params: Record<string, string>,
): Promise<string[]> {
  const count = Number(params.NumMedia ?? "0");
  if (!Number.isFinite(count) || count <= 0) return [];

  const stored: string[] = [];
  for (let index = 0; index < Math.min(count, 10); index += 1) {
    const url = params[`MediaUrl${index}`];
    if (!url) continue;
    const path = await storeTwilioMedia(url, params[`MediaContentType${index}`] ?? "");
    if (path) stored.push(path);
  }
  return stored;
}

/** Signed per request, never stored — a persisted URL outlives its expiry. */
export async function signSmsMedia(paths: string[]): Promise<Record<string, string>> {
  const client = db();
  if (!client || paths.length === 0) return {};

  const { data, error } = await client.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error("[mms] could not sign media urls:", error.message);
    return {};
  }

  const out: Record<string, string> = {};
  for (const [index, entry] of (data ?? []).entries()) {
    if (entry.signedUrl) out[paths[index]] = entry.signedUrl;
  }
  return out;
}
