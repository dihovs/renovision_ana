import { db, isMissingTable, MigrationPendingError } from "@/lib/crm/db";
import { clientDisplayName } from "@/lib/crm/types";

/**
 * Every text conversation, one row each, newest activity first.
 *
 * This is the view that did not exist: a message could arrive from a number
 * the CRM had never seen and land in sms_messages with nobody looking. The
 * client page shows a thread only for the client you are already looking at —
 * an inbox is the opposite question, "who has texted US", and it has to lead
 * with the conversations that are waiting on an answer.
 *
 * Grouping happens in JS over the most recent messages rather than in SQL,
 * for the same reason deriveCallState folds the transcript instead of reading
 * state back: the input is small (the last few hundred rows), the function
 * stays pure and testable, and Supabase's query builder has no DISTINCT ON.
 * The window is a real limit and it is logged honestly below: a conversation
 * whose entire history fell out of the last RECENT_WINDOW messages does not
 * appear, which at this business's volume means "a thread untouched for
 * months".
 */

export type ConversationRow = {
  phone: string;
  body: string;
  direction: "outbound" | "inbound";
  status: "queued" | "failed" | "received";
  created_at: string;
  client_id: string | null;
};

export type Conversation = {
  phone: string;
  clientId: string | null;
  clientName: string | null;
  lastBody: string;
  lastDirection: "outbound" | "inbound";
  lastAt: string;
  /** The last word is theirs — the thread is waiting on the owner. */
  awaitingReply: boolean;
  /** The last thing we tried to send never went. Worth a red mark. */
  lastFailed: boolean;
  messageCount: number;
  optedOut: boolean;
};

/** How many recent messages the inbox is built from. */
const RECENT_WINDOW = 500;

/**
 * Fold messages (newest first, as the index serves them) into one row per
 * number. Pure, so the ordering and badge rules are testable without a
 * database.
 */
export function groupIntoConversations(
  rows: ConversationRow[],
): Array<Omit<Conversation, "clientName" | "optedOut">> {
  const byPhone = new Map<string, Omit<Conversation, "clientName" | "optedOut">>();

  for (const row of rows) {
    const existing = byPhone.get(row.phone);
    if (!existing) {
      // First sighting is the newest message — it decides every "last" field.
      byPhone.set(row.phone, {
        phone: row.phone,
        clientId: row.client_id,
        lastBody: row.body,
        lastDirection: row.direction,
        lastAt: row.created_at,
        awaitingReply: row.direction === "inbound",
        lastFailed: row.direction === "outbound" && row.status === "failed",
        messageCount: 1,
      });
      continue;
    }
    existing.messageCount += 1;
    // Attribution can be missing on early messages and present on later ones
    // (the client was created mid-conversation). Any attributed message names
    // the thread.
    if (!existing.clientId && row.client_id) existing.clientId = row.client_id;
  }

  // Map preserves insertion order and rows arrived newest-first, so the
  // conversations are already ordered by latest activity.
  return [...byPhone.values()];
}

export async function listConversations(): Promise<Conversation[]> {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("sms_messages")
    .select("phone, body, direction, status, created_at, client_id")
    .order("created_at", { ascending: false })
    .limit(RECENT_WINDOW);

  if (error) {
    if (isMissingTable(error)) throw new MigrationPendingError("sms_messages");
    console.error("[sms] could not read the inbox", error);
    return [];
  }

  const grouped = groupIntoConversations((data ?? []) as ConversationRow[]);
  if ((data?.length ?? 0) === RECENT_WINDOW) {
    // Not silent: at the window boundary, a long-dormant thread may be absent.
    console.info(`[sms] inbox built from the most recent ${RECENT_WINDOW} messages only`);
  }
  if (grouped.length === 0) return [];

  // Names and opt-outs in two batched reads rather than one per conversation.
  const clientIds = [...new Set(grouped.map((c) => c.clientId).filter(Boolean))] as string[];
  const phones = grouped.map((c) => c.phone);

  const [clients, optOuts] = await Promise.all([
    clientIds.length > 0
      ? client
          .from("clients")
          .select("id, first_name, last_name, company_name")
          .in("id", clientIds)
      : Promise.resolve({ data: [], error: null }),
    client.from("sms_opt_outs").select("phone").in("phone", phones),
  ]);

  const names = new Map<string, string>();
  for (const row of clients.data ?? []) {
    names.set(row.id as string, clientDisplayName(row));
  }
  const stopped = new Set((optOuts.data ?? []).map((row) => row.phone as string));

  return grouped.map((c) => ({
    ...c,
    clientName: c.clientId ? (names.get(c.clientId) ?? null) : null,
    optedOut: stopped.has(c.phone),
  }));
}
