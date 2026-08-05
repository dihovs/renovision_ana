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

  return {
    // Newest-first from the database because that is what the index serves;
    // reversed here because a conversation reads downwards.
    messages: (messages.data ?? [])
      .map((row) => ({
        id: row.id as string,
        direction: row.direction as "outbound" | "inbound",
        phone: row.phone as string,
        body: row.body as string,
        status: row.status as "queued" | "failed" | "received",
        error: (row.error ?? null) as string | null,
        createdAt: row.created_at as string,
      }))
      .reverse(),
    optedOut: Boolean(optOut.data),
  };
}
