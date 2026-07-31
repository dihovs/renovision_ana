import { db, isMissingTable, MigrationPendingError } from "@/lib/crm/db";

/**
 * WhatsApp threads, filed against the job they belong to.
 *
 * Media is copied into our own private bucket rather than linked: Meta's media
 * URLs expire within minutes, so a stored link would be a broken image by the
 * time anyone opened the job.
 */

const MEDIA_BUCKET = "whatsapp-media";
/** Long enough to read a thread; short enough that a copied link dies. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type WhatsAppContact = {
  id: string;
  wa_id: string;
  profile_name: string | null;
  display_name: string | null;
  role: "subcontractor" | "supplier" | "client" | "other";
  opted_in_at: string | null;
  notes: string | null;
};

export type WhatsAppMessage = {
  id: string;
  wa_message_id: string | null;
  contact_id: string | null;
  job_id: string | null;
  direction: "inbound" | "outbound";
  kind: "text" | "image" | "video" | "audio" | "document" | "location" | "other";
  body: string | null;
  media_path: string | null;
  media_mime: string | null;
  media_caption: string | null;
  sent_at: string;
  status: string | null;
  needs_filing: boolean;
};

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not configured");
  return client;
}

/** Find or create the contact behind a WhatsApp id. */
export async function upsertContact(
  waId: string,
  profileName?: string | null,
): Promise<WhatsAppContact | null> {
  const client = db();
  if (!client) return null;

  const existing = await client
    .from("whatsapp_contacts")
    .select("*")
    .eq("wa_id", waId)
    .maybeSingle();

  if (existing.data) {
    // Refresh the profile name if WhatsApp reports a new one, but never touch
    // display_name — that is what the owner called them, and "Mike (plumber)"
    // should not be overwritten by whatever Mike set on his phone.
    if (profileName && (existing.data as WhatsAppContact).profile_name !== profileName) {
      await client
        .from("whatsapp_contacts")
        .update({ profile_name: profileName })
        .eq("wa_id", waId);
    }
    return existing.data as WhatsAppContact;
  }

  const { data, error } = await client
    .from("whatsapp_contacts")
    .insert({ wa_id: waId, profile_name: profileName ?? null })
    .select("*")
    .single();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("whatsapp_contacts");
    console.error("[whatsapp] could not create contact:", error.message);
    return null;
  }
  return data as WhatsAppContact;
}

/**
 * Which job a message belongs to.
 *
 * Two signals, in order of trust:
 *   1. An explicit job number in the text ("#1042", "job 1042"). Unambiguous,
 *      so it wins outright.
 *   2. The contact's most recent filed message, if it is recent enough. A sub
 *      sending six photos in a row is talking about one job, and asking them to
 *      label each one would guarantee they stop labelling any.
 *
 * Anything else is left unfiled rather than guessed. A photo of someone's
 * bathroom attached to the wrong customer's job is worse than a photo in an
 * inbox waiting for one tap.
 */
export async function inferJobId(
  contactId: string | null,
  text: string | null,
): Promise<{ jobId: string | null; confident: boolean }> {
  const client = db();
  if (!client) return { jobId: null, confident: false };

  const match = text?.match(/(?:#|job\s*|travail\s*)(\d{3,6})/i);
  if (match) {
    const { data } = await client
      .from("jobs")
      .select("id")
      .eq("job_number", Number(match[1]))
      .is("archived_at", null)
      .maybeSingle();
    if (data) return { jobId: (data as { id: string }).id, confident: true };
  }

  if (!contactId) return { jobId: null, confident: false };

  // Twelve hours: long enough to cover a working day of back-and-forth about
  // one job, short enough that yesterday's job doesn't capture this morning's
  // photos.
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { data } = await client
    .from("whatsapp_messages")
    .select("job_id")
    .eq("contact_id", contactId)
    .not("job_id", "is", null)
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const jobId = (data as { job_id: string | null } | null)?.job_id ?? null;
  return { jobId, confident: false };
}

export async function recordMessage(input: {
  waMessageId?: string | null;
  contactId: string | null;
  jobId: string | null;
  direction: "inbound" | "outbound";
  kind: WhatsAppMessage["kind"];
  body?: string | null;
  mediaPath?: string | null;
  mediaMime?: string | null;
  mediaCaption?: string | null;
  sentAt?: string;
  needsFiling?: boolean;
}): Promise<string | null> {
  const client = db();
  if (!client) return null;

  const { data, error } = await client
    .from("whatsapp_messages")
    // Meta retries webhooks, so an already-seen message id must update rather
    // than append the same message to the thread twice.
    .upsert(
      {
        wa_message_id: input.waMessageId ?? null,
        contact_id: input.contactId,
        job_id: input.jobId,
        direction: input.direction,
        kind: input.kind,
        body: input.body ?? null,
        media_path: input.mediaPath ?? null,
        media_mime: input.mediaMime ?? null,
        media_caption: input.mediaCaption ?? null,
        sent_at: input.sentAt ?? new Date().toISOString(),
        needs_filing: input.needsFiling ?? false,
      },
      { onConflict: "wa_message_id", ignoreDuplicates: false },
    )
    .select("id")
    .single();

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("whatsapp_messages");
    console.error("[whatsapp] could not record message:", error.message);
    return null;
  }
  return data.id as string;
}

/**
 * Copy media out of Meta and into our own private bucket.
 *
 * Failures are swallowed per-item: a photo that won't download must not cost
 * the message it came with, and the text alongside it is usually the part that
 * says what happened.
 */
export async function storeMedia(
  bytes: ArrayBuffer,
  mime: string,
): Promise<string | null> {
  const client = db();
  if (!client) return null;

  const extension = mime.split("/")[1]?.split(";")[0]?.replace("jpeg", "jpg") ?? "bin";
  const stamp = new Date().toISOString().slice(0, 10);
  const path = `${stamp}/${crypto.randomUUID()}.${extension}`;

  const { error } = await client.storage
    .from(MEDIA_BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: mime, upsert: false });

  if (error) {
    console.error("[whatsapp] media upload failed:", error.message);
    return null;
  }
  return path;
}

/** Signed per request, never stored — a persisted URL outlives its own expiry. */
export async function signMediaUrls(paths: string[]): Promise<Record<string, string>> {
  const client = db();
  if (!client || paths.length === 0) return {};

  const { data, error } = await client.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error("[whatsapp] could not sign media urls:", error.message);
    return {};
  }

  const out: Record<string, string> = {};
  for (const [index, entry] of (data ?? []).entries()) {
    if (entry.signedUrl) out[paths[index]] = entry.signedUrl;
  }
  return out;
}

export async function listJobMessages(jobId: string): Promise<WhatsAppMessage[]> {
  const client = requireDb();
  const { data, error } = await client
    .from("whatsapp_messages")
    .select("*")
    .eq("job_id", jobId)
    .order("sent_at", { ascending: true });

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("whatsapp_messages");
    throw new Error(`Could not load the thread: ${error.message}`);
  }
  return (data ?? []) as WhatsAppMessage[];
}

/** Messages that arrived without a job. The inbox that needs one tap each. */
export async function listUnfiled(limit = 100): Promise<
  (WhatsAppMessage & { contact: WhatsAppContact | null })[]
> {
  const client = requireDb();
  const { data, error } = await client
    .from("whatsapp_messages")
    .select("*, whatsapp_contacts(*)")
    .is("job_id", null)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("whatsapp_messages");
    throw new Error(`Could not load the inbox: ${error.message}`);
  }

  return ((data ?? []) as (WhatsAppMessage & { whatsapp_contacts: WhatsAppContact | null })[]).map(
    ({ whatsapp_contacts, ...message }) => ({ ...message, contact: whatsapp_contacts }),
  );
}

export async function fileMessage(messageId: string, jobId: string): Promise<void> {
  const client = requireDb();
  const { error } = await client
    .from("whatsapp_messages")
    .update({ job_id: jobId, needs_filing: false })
    .eq("id", messageId);
  if (error) throw new Error(`Could not file the message: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export async function getSummary(
  jobId: string,
): Promise<{ summary: string; message_count: number; generated_at: string } | null> {
  const client = db();
  if (!client) return null;
  const { data } = await client
    .from("whatsapp_summaries")
    .select("summary, message_count, generated_at")
    .eq("job_id", jobId)
    .maybeSingle();
  return (data as { summary: string; message_count: number; generated_at: string }) ?? null;
}

export async function saveSummary(
  jobId: string,
  summary: string,
  messageCount: number,
): Promise<void> {
  const client = requireDb();
  const { error } = await client.from("whatsapp_summaries").upsert(
    {
      job_id: jobId,
      summary,
      message_count: messageCount,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "job_id" },
  );
  if (error) console.error("[whatsapp] could not save summary:", error.message);
}
