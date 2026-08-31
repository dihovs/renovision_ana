import { readSetting, writeSetting } from "@/lib/crm/settings";
import { db } from "@/lib/crm/db";
import { personForIdentity } from "@/lib/crm/people";
import { accessTokenForGraph } from "./auth";
import { teamsHtmlToText } from "./teams";

/**
 * Pulling the owner's mailbox into the CRM. (ANA-06)
 *
 * Same architecture as the Teams sync and for the same reasons: polled on the
 * 15-minute cron, cursor in the settings store, upserts that make overlap
 * free, one page of seed on the first run rather than a history import.
 *
 * ONE QUERY COVERS BOTH DIRECTIONS. /me/messages spans the mailbox's folders,
 * Sent Items included, so inbound and outbound arrive in one listing and
 * direction is decided by comparing the From address to the owner's own —
 * not by which folder a message happened to be filed in, which users rearrange.
 *
 * WHAT IS SKIPPED: drafts (unsent words are nobody's statement yet) and
 * attachment bytes (names only — "the adjuster sent plan.pdf" does not require
 * holding plan.pdf). Newsletters and no-replies are NOT skipped: deciding what
 * counts as a real correspondent is a judgement, and a sync that quietly
 * curates the mailbox is a sync that cannot be trusted to be complete. They
 * cost rows, not correctness.
 *
 * EMAIL IS THE WIDEST UNTRUSTED INPUT IN THE SYSTEM — anyone alive can put
 * text in front of Ana for the price of an email. The defence is not here (a
 * sync should be a faithful clerk): it is ANA-01's write boundary and the
 * standing rule that a message is a quote, never an instruction.
 */

const SYNC_SETTING = "microsoft_mail_sync";
const OVERLAP_MS = 5 * 60 * 1000;
const MAX_MESSAGES_PER_RUN = 200;
/** Enough for any real letter; a 2MB marketing blast is cut, not mirrored. */
const MAX_BODY_CHARS = 20_000;

type SyncState = {
  cursor: string | null;
  /** The owner's own address — what makes a message his or theirs. */
  ownerAddress: string | null;
};

// ---------------------------------------------------------------------------
// Pure parts
// ---------------------------------------------------------------------------

/**
 * Mail HTML down to the words.
 *
 * Mail bodies are heavier than Teams messages — <style> blocks, <head>
 * boilerplate, hidden preheaders — so those are cut wholesale first, then the
 * same strip Teams uses finishes the job. Imperfection costs a stray space in
 * a transcript, never markup anywhere: the output is data.
 */
export function mailHtmlToText(html: string | null | undefined): string {
  if (!html) return "";
  let text = html;
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  return teamsHtmlToText(text);
}

/** The subset of a Graph message this module reads. */
export type GraphMailMessage = {
  id: string;
  conversationId?: string | null;
  subject?: string | null;
  isDraft?: boolean;
  from?: { emailAddress?: { address?: string | null; name?: string | null } | null } | null;
  toRecipients?: { emailAddress?: { address?: string | null; name?: string | null } | null }[];
  receivedDateTime?: string;
  sentDateTime?: string;
  body?: { contentType?: string; content?: string } | null;
  attachments?: { name?: string | null }[];
};

export type MappedMail = {
  graph_message_id: string;
  thread_id: string | null;
  direction: "inbound" | "outbound";
  from_address: string | null;
  from_name: string | null;
  to_addresses: string[];
  counterpart_name: string | null;
  subject: string | null;
  body: string;
  attachment: string | null;
  sent_at: string;
};

/**
 * One Graph message into one row, or null for the kinds we do not keep.
 *
 * Pure, so the direction rule and every skip are testable without a mailbox.
 */
export function mapMailMessage(message: GraphMailMessage, ownerAddress: string): MappedMail | null {
  if (message.isDraft) return null;

  const from = message.from?.emailAddress?.address?.toLowerCase().trim() || null;
  const owner = ownerAddress.toLowerCase().trim();
  const direction = from === owner ? "outbound" : "inbound";

  const to = (message.toRecipients ?? [])
    .map((r) => r.emailAddress?.address?.toLowerCase().trim())
    .filter(Boolean) as string[];

  const bodyText =
    message.body?.contentType === "html"
      ? mailHtmlToText(message.body.content)
      : (message.body?.content ?? "").trim();

  const named = (message.attachments ?? []).map((a) => a.name).filter(Boolean) as string[];
  const attachment = named.length ? `file: ${named.join(", ")}` : null;

  const subject = message.subject?.trim() || null;
  if (!subject && !bodyText && !attachment) return null;

  // The subject rides the body's first line so one ilike over `body` finds it
  // — see migration 0049 for the full reasoning.
  const combined = [subject, bodyText].filter(Boolean).join("\n\n").slice(0, MAX_BODY_CHARS);

  const firstRecipient = (message.toRecipients ?? [])[0]?.emailAddress;
  const counterpart =
    direction === "inbound"
      ? (message.from?.emailAddress?.name?.trim() || from)
      : (firstRecipient?.name?.trim() || firstRecipient?.address?.toLowerCase().trim() || null);

  return {
    graph_message_id: message.id,
    thread_id: message.conversationId ?? null,
    direction,
    from_address: from,
    from_name: message.from?.emailAddress?.name?.trim() || null,
    to_addresses: to,
    counterpart_name: counterpart ?? null,
    subject,
    body: combined,
    attachment,
    sent_at: message.receivedDateTime ?? message.sentDateTime ?? new Date().toISOString(),
  };
}

/**
 * Whose identity a message should attach to: the human on the OTHER end.
 *
 * The sender for inbound mail, the first To recipient for outbound — the owner
 * is not "a person we talk to", and a reply he sends is evidence about the
 * customer's thread, not about him.
 */
export function identityFor(mail: MappedMail): { address: string; name: string | null } | null {
  if (mail.direction === "inbound") {
    return mail.from_address ? { address: mail.from_address, name: mail.from_name } : null;
  }
  const first = mail.to_addresses[0];
  return first ? { address: first, name: mail.counterpart_name } : null;
}

// ---------------------------------------------------------------------------
// The sync
// ---------------------------------------------------------------------------

const GRAPH = "https://graph.microsoft.com/v1.0";

async function graphGet(
  token: string,
  url: string,
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (response.ok) return { ok: true, json: (await response.json()) as Record<string, unknown> };
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

export type MailSyncReport = {
  ran: boolean;
  reason?: string;
  messagesStored?: number;
  messagesSkipped?: number;
  errors?: string[];
};

export async function syncMailMessages(): Promise<MailSyncReport> {
  const client = db();
  if (!client) return { ran: false, reason: "database unconfigured" };

  const auth = await accessTokenForGraph();
  if (!auth.ok) return { ran: false, reason: `no Graph access: ${auth.reason}` };

  const state = await readSetting<SyncState>(SYNC_SETTING, { cursor: null, ownerAddress: null });

  let ownerAddress = state.ownerAddress;
  if (!ownerAddress) {
    const me = await graphGet(auth.token, `${GRAPH}/me?$select=mail,userPrincipalName`);
    if (!me.ok) return { ran: false, reason: `could not read /me: ${me.error}` };
    ownerAddress = String(me.json.mail ?? me.json.userPrincipalName ?? "").toLowerCase();
    if (!ownerAddress) return { ran: false, reason: "/me returned no address" };
  }

  const runStarted = new Date().toISOString();
  const since = state.cursor
    ? new Date(Date.parse(state.cursor) - OVERLAP_MS).toISOString()
    : null;

  const select =
    "$select=id,conversationId,subject,isDraft,from,toRecipients,receivedDateTime,sentDateTime,body" +
    "&$expand=attachments($select=name)";
  // First run seeds one page of the recent mailbox; with a cursor, only what
  // arrived since. receivedDateTime is set on sent mail too, so one filter
  // covers both directions.
  let url: string | null = since
    ? `${GRAPH}/me/messages?$top=50&$orderby=receivedDateTime desc&$filter=receivedDateTime gt ${since}&${select}`
    : `${GRAPH}/me/messages?$top=50&$orderby=receivedDateTime desc&${select}`;

  const errors: string[] = [];
  let stored = 0;
  let skipped = 0;

  while (url && stored < MAX_MESSAGES_PER_RUN) {
    const page = await graphGet(auth.token, url);
    if (!page.ok) {
      errors.push(page.error);
      break;
    }

    for (const item of (page.json.value as GraphMailMessage[] | undefined) ?? []) {
      const mapped = mapMailMessage(item, ownerAddress);
      if (!mapped) {
        skipped += 1;
        continue;
      }

      let personId: string | null = null;
      const identity = identityFor(mapped);
      if (identity) {
        const person = await personForIdentity("email", identity.address, {
          displayName: identity.name,
          source: "mail_sync",
        });
        if (person.ok) personId = person.person.id;
      }

      const { error } = await client
        .from("email_messages")
        .upsert({ ...mapped, person_id: personId }, { onConflict: "graph_message_id", ignoreDuplicates: true });
      if (error) errors.push(`store ${mapped.graph_message_id}: ${error.message}`);
      else stored += 1;
    }

    const next = page.json["@odata.nextLink"];
    url = since && typeof next === "string" ? next : null;
  }

  await writeSetting(SYNC_SETTING, { cursor: runStarted, ownerAddress } satisfies SyncState);

  return { ran: true, messagesStored: stored, messagesSkipped: skipped, errors };
}
