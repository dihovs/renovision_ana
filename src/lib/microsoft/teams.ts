import { readSetting, writeSetting } from "@/lib/crm/settings";
import { db } from "@/lib/crm/db";
import { personForIdentity } from "@/lib/crm/people";
import { accessTokenForGraph } from "./auth";

/**
 * Pulling the owner's Teams chats into the CRM. (ANA-05)
 *
 * POLLED, NOT PUSHED. WhatsApp and SMS arrive by webhook; Graph offers change
 * notifications too, but a subscription expires every ~3 days, must be renewed
 * by a job that itself can fail, and needs a public validation endpoint — a
 * standing machine with three moving parts. The cron already runs every 15
 * minutes for the outbound dialer, and a chat answered within 15 minutes is
 * well inside "Ana, what did he say" latency. Fewer parts, same answer. If
 * that latency ever matters, notifications bolt onto this sync without
 * changing the storage.
 *
 * WHAT IS DELIBERATELY SKIPPED, each one a boundary rather than a gap:
 *
 * - `meeting` chats. They are the chat surface of a call, and calls are the
 *   thing the owner ruled out on 30 Aug 2026. oneOnOne and group only.
 * - `systemEventMessage` rows — "X started a call", "Y was added". The call
 *   events among them are exactly what we promised never to read, and none of
 *   them are anybody's words.
 * - Bot and application messages. Ana quotes people.
 * - Deleted messages. A message the sender withdrew stays withdrawn; syncing
 *   it back would out-remember the person who deleted it.
 *
 * IDENTITY, NOT JUST TEXT. Every inbound sender is resolved through
 * personForIdentity('teams_user_id', …) — the 0046 join — so the day the same
 * human's email lands (ANA-06), both point at one person. That is the entire
 * reason Teams is worth ingesting rather than just reading in the app.
 */

/** Where the cursor lives — the house key/value store, not a new table. */
const SYNC_SETTING = "microsoft_teams_sync";

/**
 * Overlap between runs. Graph timestamps and ours need not agree to the
 * second, and a message that lands during a run must not fall between two
 * windows. The unique graph_message_id makes re-seeing a message free.
 */
const OVERLAP_MS = 5 * 60 * 1000;

/** One run's budget. The cron returns in 15 minutes; leftovers keep. */
const MAX_MESSAGES_PER_RUN = 200;
const MAX_CHATS_PER_RUN = 25;

type SyncState = {
  /** ISO timestamp the next run starts from (minus the overlap). */
  cursor: string | null;
  /** The owner's AAD object id — what makes a message his or theirs. */
  ownerAadId: string | null;
};

// ---------------------------------------------------------------------------
// Pure parts — what the tests exercise
// ---------------------------------------------------------------------------

/**
 * Teams message HTML down to the words.
 *
 * Graph hands chat bodies back as HTML: <p>, <br>, <at> mentions, <attachment>
 * placeholders, entity-encoded punctuation. What Ana needs is what a person
 * would have read aloud. This is a whitelist-shaped strip, not a parser — the
 * input is Teams markup, which is narrow, and the cost of imperfection is a
 * stray space, not an injection: the output is data in a transcript, never
 * markup anywhere.
 */
export function teamsHtmlToText(html: string | null | undefined): string {
  if (!html) return "";
  let text = html;
  // Attachment placeholders carry no words; the attachment is named separately.
  text = text.replace(/<attachment[^>]*>[\s\S]*?<\/attachment>/gi, "");
  text = text.replace(/<attachment[^>]*\/>/gi, "");
  // Mentions keep their visible text: "did <at>Mike</at> confirm" reads wrong without it.
  text = text.replace(/<\/?at[^>]*>/gi, "");
  // Line-shaped tags become line breaks before everything else is dropped.
  text = text.replace(/<(?:br|\/p|\/div|\/li)[^>]*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/gi, "'");
  // Teams pads generously; a transcript should not.
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** The subset of a Graph chatMessage this module reads. */
export type GraphChatMessage = {
  id: string;
  messageType?: string;
  deletedDateTime?: string | null;
  createdDateTime?: string;
  from?: {
    user?: { id?: string; displayName?: string } | null;
    application?: { id?: string; displayName?: string } | null;
  } | null;
  body?: { contentType?: string; content?: string } | null;
  attachments?: { name?: string | null; contentType?: string | null }[];
};

export type GraphChat = {
  id: string;
  chatType?: string;
  topic?: string | null;
  lastUpdatedDateTime?: string;
  members?: { userId?: string; displayName?: string }[];
};

export type MappedMessage = {
  graph_message_id: string;
  chat_id: string;
  chat_type: "oneOnOne" | "group";
  chat_topic: string | null;
  direction: "inbound" | "outbound";
  sender_aad_id: string | null;
  sender_name: string | null;
  counterpart_name: string | null;
  body: string;
  attachment: string | null;
  sent_at: string;
};

/**
 * One Graph message into one row, or null for the kinds we do not keep.
 *
 * Null is a decision, not a failure — see the module comment for why each kind
 * is skipped. Pure, so every skip rule is testable without Graph.
 */
export function mapChatMessage(
  message: GraphChatMessage,
  chat: GraphChat,
  ownerAadId: string,
): MappedMessage | null {
  if (message.messageType && message.messageType !== "message") return null;
  if (message.deletedDateTime) return null;
  if (message.from?.application) return null;

  const chatType = chat.chatType === "oneOnOne" ? "oneOnOne" : chat.chatType === "group" ? "group" : null;
  if (!chatType) return null;

  const senderId = message.from?.user?.id ?? null;
  const direction = senderId && senderId === ownerAadId ? "outbound" : "inbound";

  const body = teamsHtmlToText(
    message.body?.contentType === "html" ? message.body.content : (message.body?.content ?? ""),
  );

  // Named, never described — nothing here has opened the file.
  const named = (message.attachments ?? []).map((a) => a.name).filter(Boolean) as string[];
  const attachment = named.length ? `file: ${named.join(", ")}` : null;

  // A message with no words and no file is a reaction or a card; skip.
  if (!body && !attachment) return null;

  const other = (chat.members ?? []).find((m) => m.userId && m.userId !== ownerAadId);
  const counterpart =
    chatType === "oneOnOne" ? (other?.displayName ?? null) : (chat.topic ?? "group chat");

  return {
    graph_message_id: message.id,
    chat_id: chat.id,
    chat_type: chatType,
    chat_topic: chat.topic ?? null,
    direction,
    sender_aad_id: senderId,
    sender_name: message.from?.user?.displayName ?? null,
    counterpart_name: counterpart,
    body,
    attachment,
    sent_at: message.createdDateTime ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Graph calls
// ---------------------------------------------------------------------------

const GRAPH = "https://graph.microsoft.com/v1.0";

/**
 * One authenticated GET, with one polite retry on 429.
 *
 * Anything else non-OK gives up for this run rather than retrying in a loop —
 * the cron returns in fifteen minutes, and a sync that hammers a struggling
 * API is how a tenant gets throttled harder.
 */
async function graphGet(
  token: string,
  url: string,
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (response.ok) {
      return { ok: true, json: (await response.json()) as Record<string, unknown> };
    }
    if (response.status === 429 && attempt === 0) {
      const wait = Number(response.headers.get("retry-after") ?? "2");
      await new Promise((r) => setTimeout(r, Math.min(wait, 30) * 1000));
      continue;
    }
    const body = await response.text().catch(() => "");
    return { ok: false, error: `${response.status} on ${url.replace(GRAPH, "")}: ${body.slice(0, 300)}` };
  }
  return { ok: false, error: "throttled twice" };
}

export type TeamsSyncReport = {
  ran: boolean;
  reason?: string;
  chatsChecked?: number;
  messagesStored?: number;
  messagesSkipped?: number;
  errors?: string[];
};

/**
 * One sync pass: newest chats, newest messages, stop at the cursor.
 *
 * Every write is an upsert that ignores conflicts on graph_message_id, so the
 * overlap window and retried runs cost nothing. The cursor only advances when
 * the run finishes; a run that dies mid-way repeats work instead of losing it.
 */
export async function syncTeamsMessages(): Promise<TeamsSyncReport> {
  const client = db();
  if (!client) return { ran: false, reason: "database unconfigured" };

  const auth = await accessTokenForGraph();
  if (!auth.ok) {
    // "Not connected yet" is an ordinary morning, not an error worth a red log.
    return { ran: false, reason: `no Graph access: ${auth.reason}` };
  }

  const state = await readSetting<SyncState>(SYNC_SETTING, { cursor: null, ownerAadId: null });

  let ownerAadId = state.ownerAadId;
  if (!ownerAadId) {
    const me = await graphGet(auth.token, `${GRAPH}/me?$select=id`);
    if (!me.ok) return { ran: false, reason: `could not read /me: ${me.error}` };
    ownerAadId = String(me.json.id ?? "");
    if (!ownerAadId) return { ran: false, reason: "/me returned no id" };
  }

  const runStarted = new Date().toISOString();
  const since = state.cursor ? new Date(Date.parse(state.cursor) - OVERLAP_MS) : null;

  const chats = await graphGet(
    auth.token,
    `${GRAPH}/me/chats?$top=${MAX_CHATS_PER_RUN}&$expand=members&$orderby=lastMessagePreview/createdDateTime desc`,
  );
  if (!chats.ok) return { ran: false, reason: `could not list chats: ${chats.error}` };

  const errors: string[] = [];
  let stored = 0;
  let skipped = 0;
  let chatsChecked = 0;

  for (const raw of (chats.json.value as GraphChat[] | undefined) ?? []) {
    if (stored >= MAX_MESSAGES_PER_RUN) break;
    // The chat list is newest-first: the first chat quiet since the cursor
    // means everything after it is too.
    if (since && raw.lastUpdatedDateTime && Date.parse(raw.lastUpdatedDateTime) < since.getTime()) {
      break;
    }
    // Meeting chats are the chat surface of a call. Never read.
    if (raw.chatType !== "oneOnOne" && raw.chatType !== "group") continue;
    chatsChecked += 1;

    let url: string | null = `${GRAPH}/me/chats/${raw.id}/messages?$top=50`;
    pages: while (url && stored < MAX_MESSAGES_PER_RUN) {
      const page = await graphGet(auth.token, url);
      if (!page.ok) {
        errors.push(page.error);
        break;
      }
      for (const item of (page.json.value as GraphChatMessage[] | undefined) ?? []) {
        // Messages arrive newest-first; past the window means done with this chat.
        if (since && item.createdDateTime && Date.parse(item.createdDateTime) < since.getTime()) {
          url = null;
          break pages;
        }
        const mapped = mapChatMessage(item, raw, ownerAadId);
        if (!mapped) {
          skipped += 1;
          continue;
        }

        // The identity join. Only inbound humans — the owner is not a "person
        // we talk to", and bots were already dropped in the mapper.
        let personId: string | null = null;
        if (mapped.direction === "inbound" && mapped.sender_aad_id) {
          const person = await personForIdentity("teams_user_id", mapped.sender_aad_id, {
            displayName: mapped.sender_name,
            source: "teams_sync",
          });
          if (person.ok) personId = person.person.id;
        }

        const { error } = await client
          .from("teams_messages")
          .upsert({ ...mapped, person_id: personId }, { onConflict: "graph_message_id", ignoreDuplicates: true });
        if (error) {
          errors.push(`store ${mapped.graph_message_id}: ${error.message}`);
        } else {
          stored += 1;
        }
      }
      // First-ever run (no cursor): one page per chat is the seed, not a
      // history import. With a cursor, follow pages until past the window.
      const next = page.json["@odata.nextLink"];
      url = since && typeof next === "string" ? next : null;
    }
  }

  await writeSetting(SYNC_SETTING, { cursor: runStarted, ownerAadId } satisfies SyncState);

  return { ran: true, chatsChecked, messagesStored: stored, messagesSkipped: skipped, errors };
}
