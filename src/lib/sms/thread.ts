import { signSmsMedia } from "@/lib/sms/media";
import { db, isMissingTable, MigrationPendingError } from "@/lib/crm/db";
import { toE164 } from "./send";

/**
 * Reading a text conversation back.
 *
 * Keyed on the NUMBER rather than the client id, which matters more than it
 * looks: a message that arrived before the number was attached to anybody has
 * client_id null, and keying on the client would hide exactly the messages the
 * owner most needs to see — the ones from someone not yet in the CRM.
 */

export type SmsMessage = {
  id: string;
  direction: "outbound" | "inbound";
  phone: string;
  body: string;
  status: "queued" | "failed" | "received";
  error: string | null;
  createdAt: string;
  /**
   * Signed URLs for anything that arrived with the message, ready to render.
   *
   * Signed HERE rather than stored, because a signed URL outlives its own
   * expiry the moment it is written into a row: the link would be in the
   * database long after it stopped working. This is the same rule the
   * WhatsApp thread already follows.
   */
  media: string[];
};

export type SmsThread = {
  messages: SmsMessage[];
  /** Set when this number has withdrawn consent — the composer disables. */
  optedOut: boolean;
};

const EMPTY: SmsThread = { messages: [], optedOut: false };

export async function listThread(rawPhone: string | null, limit = 50): Promise<SmsThread> {
  const phone = toE164(rawPhone);
  const client = db();
  if (!phone || !client) return EMPTY;

  const [messages, optOut] = await Promise.all([
    client
      .from("sms_messages")
      .select("*")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(limit),
    client.from("sms_opt_outs").select("id").eq("phone", phone).maybeSingle(),
  ]);

  if (messages.error) {
    // The admin renders "run the migration" rather than crashing, the same way
    // every other unmigrated table in this codebase does.
    if (isMissingTable(messages.error)) throw new MigrationPendingError("sms_messages");
    console.error("[sms] could not read the thread", messages.error);
    return EMPTY;
  }

  // One signing call for the whole thread rather than one per message: it is
  // a round trip to storage, and a conversation with twenty photos in it
  // should cost one.
  const rows = messages.data ?? [];
  const allPaths = rows.flatMap((row) => ((row.media_paths ?? []) as string[]) ?? []);
  const signed = allPaths.length > 0 ? await signSmsMedia(allPaths) : {};

  return {
    // Newest-first from the database because that is what the index serves;
    // reversed here because a conversation reads downwards.
    messages: rows
      .map((row) => ({
        id: row.id as string,
        direction: row.direction as "outbound" | "inbound",
        phone: row.phone as string,
        body: row.body as string,
        status: row.status as "queued" | "failed" | "received",
        error: (row.error ?? null) as string | null,
        createdAt: row.created_at as string,
        media: (((row.media_paths ?? []) as string[]) ?? [])
          .map((path) => signed[path])
          .filter(Boolean),
      }))
      .reverse(),
    optedOut: Boolean(optOut.data),
  };
}
