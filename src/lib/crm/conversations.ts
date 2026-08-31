import { db } from "./db";
import { contactLabel, type WhatsAppContact } from "@/lib/whatsapp/store";

/**
 * Reading the conversations back — what was actually said, across both
 * channels, so Ana can answer a question about it.
 *
 * WHY THIS DOES NOT BREAK THE "KEEP THEM SEPARATE" RULE. Docs/CRM-Messaging.md
 * says SMS and WhatsApp are deliberately independent and must not be merged.
 * That is about writing and about the inboxes: WhatsApp is a queue to be
 * emptied onto jobs, SMS is a conversation per number, and merging those would
 * ruin both. Nothing here writes, nothing here merges a thread, and every row
 * that comes back still says which channel it came from. The owner asking "what
 * did Mike say about the Fleury bathroom" does not care which app it arrived
 * in, and making him ask twice would be the bug.
 *
 * EVERYTHING IS READ-ONLY. This module is reached by the assistant, which is
 * reached by a voice agent, which answers a telephone. The worst outcome of a
 * bad question here must be a wrong answer, never a changed record.
 */

/** A phone answer is a breath long. Even a screen answer is not a transcript. */
const MAX_ROWS = 40;
const MAX_BODY_CHARS = 400;

/**
 * Every channel a message can arrive on.
 *
 * THE VOCABULARY, NOT THE INVENTORY. `teams` and `email` are named here before
 * anything can read them: the tables that hold them arrive in later orders
 * (ANA-05, ANA-06) and the type has to exist for the identity work to compile
 * against in the meantime.
 *
 * What is actually searchable is IMPLEMENTED_CHANNELS, derived from the readers
 * that exist. Ana is offered that list and never this one, so she cannot advertise
 * a channel that would silently come back empty.
 */
export type ConversationChannel = "whatsapp" | "sms" | "teams" | "email";

/**
 * Which channels a search should cover. `"all"` means every implemented one,
 * which is the sensible default: the owner asking what somebody said does not
 * know which app it arrived in, and making him ask twice would be the bug.
 */
export type ChannelFilter = ConversationChannel | ConversationChannel[] | "all";

export type ConversationMessage = {
  channel: ConversationChannel;
  /** "Mike (plumber)" for WhatsApp, the client's name or the number for SMS. */
  who: string;
  direction: "inbound" | "outbound";
  sentAt: string;
  text: string;
  /** Job number when the message is filed against one. */
  jobNumber: number | null;
  /** Set when the message carried a photo or a file rather than words. */
  attachment: string | null;
};

type Search = {
  /** Free text, matched case-insensitively against the message body. */
  query?: string | null;
  channel?: ChannelFilter;
  /** Only messages this many days back. Defaults to 90. */
  days?: number;
  /** Only this job's thread, by the number the owner says out loud. */
  jobNumber?: number | null;
  /** Only this person, matched against WhatsApp display and profile names. */
  who?: string | null;
  limit?: number;
};

function trim(text: string | null, fallback: string): string {
  const value = (text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return fallback;
  return value.length > MAX_BODY_CHARS ? `${value.slice(0, MAX_BODY_CHARS)}…` : value;
}

/**
 * Postgres `ilike` treats % and _ as wildcards, so a search for "50%" would
 * match everything after "50". Escaped rather than stripped: the owner is
 * allowed to search for a percent sign.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Search what was said. This is the one Ana reaches for most.
 *
 * Returns newest first, because "what did they say about X" almost always means
 * the last thing they said about X.
 */
export async function searchConversations(search: Search = {}): Promise<ConversationMessage[]> {
  const client = db();
  if (!client) return [];

  const limit = Math.max(1, Math.min(MAX_ROWS, search.limit ?? 20));
  const days = Math.max(1, Math.min(365, search.days ?? 90));
  const since = new Date(Date.now() - days * 24 * 3_600_000).toISOString();

  const results = await Promise.all(
    channelsFor(search.channel).map(
      (channel) => CHANNEL_READERS[channel]?.(client, search, since, limit) ?? [],
    ),
  );

  return results
    .flat()
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    .slice(0, limit);
}

/**
 * The asked-for channels, narrowed to the ones something can actually read.
 *
 * A channel with no reader is dropped rather than raised. Asking for Teams
 * before ANA-05 lands should give back the other channels, not an exception in
 * the middle of a phone call — and "we have no Teams messages" is a true answer
 * either way.
 *
 * Exported because it is the only part of the fan-out that decides anything,
 * and it decides it without a database — the same split `contactMatch.ts` makes
 * between `rankMatches` and `resolveContact`, so the deciding can be tested
 * against hand-written values rather than a mocked query builder.
 */
export function channelsFor(filter: ChannelFilter | undefined): ConversationChannel[] {
  if (!filter || filter === "all") return [...IMPLEMENTED_CHANNELS];
  const asked = Array.isArray(filter) ? filter : [filter];
  return asked.filter((channel) => channel in CHANNEL_READERS);
}

type Client = NonNullable<ReturnType<typeof db>>;

async function searchWhatsApp(
  client: Client,
  search: Search,
  since: string,
  limit: number,
): Promise<ConversationMessage[]> {
  let jobId: string | null = null;
  if (search.jobNumber != null) {
    const { data } = await client
      .from("jobs")
      .select("id")
      .eq("job_number", search.jobNumber)
      .maybeSingle();
    jobId = (data as { id: string } | null)?.id ?? null;
    // A job number that matches nothing must not silently widen to every job.
    if (!jobId) return [];
  }

  let query = client
    .from("whatsapp_messages")
    .select("body, media_mime, media_caption, direction, sent_at, kind, whatsapp_contacts(*), jobs(job_number)")
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (jobId) query = query.eq("job_id", jobId);
  if (search.query) query = query.ilike("body", `%${escapeLike(search.query)}%`);

  const { data, error } = await query;
  if (error) return [];

  const rows = (data ?? []) as unknown as {
    body: string | null;
    media_mime: string | null;
    media_caption: string | null;
    direction: "inbound" | "outbound";
    sent_at: string;
    kind: string;
    whatsapp_contacts: WhatsAppContact | null;
    jobs: { job_number: number } | null;
  }[];

  const wanted = search.who?.toLowerCase().trim();

  return rows
    .filter((row) => {
      if (!wanted) return true;
      const contact = row.whatsapp_contacts;
      if (!contact) return false;
      return `${contact.display_name ?? ""} ${contact.profile_name ?? ""}`.toLowerCase().includes(wanted);
    })
    .map((row) => ({
      channel: "whatsapp" as const,
      who: row.whatsapp_contacts
        ? contactLabel(row.whatsapp_contacts)
        : row.direction === "outbound"
          ? "Us"
          : "Unknown number",
      direction: row.direction,
      sentAt: row.sent_at,
      text: trim(row.body ?? row.media_caption, row.kind === "text" ? "(empty message)" : `(${row.kind})`),
      jobNumber: row.jobs?.job_number ?? null,
      // Named, never described: nothing here has looked at the picture, and
      // saying "a photo of the bathroom" would be an invention.
      attachment: row.media_mime ? row.kind : null,
    }));
}

async function searchSms(
  client: Client,
  search: Search,
  since: string,
  limit: number,
): Promise<ConversationMessage[]> {
  // SMS is keyed by phone number and knows nothing about jobs. A job-scoped
  // question therefore has no SMS half — answering it with the customer's
  // whole text history would be a different question than the one asked.
  if (search.jobNumber != null) return [];

  let query = client
    .from("sms_messages")
    .select("body, direction, created_at, phone, clients(first_name, last_name, company_name)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (search.query) query = query.ilike("body", `%${escapeLike(search.query)}%`);

  const { data, error } = await query;
  if (error) return [];

  const rows = (data ?? []) as unknown as {
    body: string;
    direction: "inbound" | "outbound";
    created_at: string;
    phone: string;
    clients: { first_name: string | null; last_name: string | null; company_name: string | null } | null;
  }[];

  const wanted = search.who?.toLowerCase().trim();

  return rows
    .map((row) => {
      const name =
        [row.clients?.first_name, row.clients?.last_name].filter(Boolean).join(" ") ||
        row.clients?.company_name ||
        row.phone;
      return {
        channel: "sms" as const,
        who: name,
        direction: row.direction,
        sentAt: row.created_at,
        text: trim(row.body, "(empty message)"),
        jobNumber: null,
        attachment: null,
      };
    })
    .filter((row) => !wanted || row.who.toLowerCase().includes(wanted));
}

/**
 * One reader per channel, and the only place that list is written down.
 *
 * ADDING A CHANNEL IS ADDING A LINE HERE. The searchable set, the tool schema
 * Ana is given, and the fan-out above all derive from this object — so a new
 * channel cannot arrive half-wired, readable by the code but never offered to
 * the model, or offered to the model with nothing behind it.
 *
 * Per-channel tables stay separate on purpose. Each has fields the others do
 * not — `wamid` and `billing_category` for WhatsApp, a thread id for mail — and
 * flattening them into one table would lose exactly the information that makes
 * each channel worth reading. Docs/CRM-Messaging.md's "keep them separate" rule
 * is about writing and about the inboxes; merging on the way OUT is what this
 * module is for.
 */
const CHANNEL_READERS: Partial<Record<ConversationChannel, ChannelReader>> = {
  whatsapp: searchWhatsApp,
  sms: searchSms,
};

type ChannelReader = (
  client: Client,
  search: Search,
  since: string,
  limit: number,
) => Promise<ConversationMessage[]>;

/** The channels something can actually read today. Derived, never hand-listed. */
export const IMPLEMENTED_CHANNELS = Object.keys(CHANNEL_READERS) as ConversationChannel[];

/**
 * What to call each channel out loud.
 *
 * Every line of a transcript is labelled, including WhatsApp — which used to go
 * unmarked as the implied default. With four channels there is no default, and
 * "where was this said" is half the answer when a customer said one thing by
 * email and the crew heard another on WhatsApp.
 */
const CHANNEL_LABEL: Record<ConversationChannel, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  teams: "Teams",
  email: "email",
};

/**
 * One job's thread, oldest first — the shape you read rather than search.
 *
 * WhatsApp only, deliberately: a job's WhatsApp messages were filed against it
 * by hand or by an explicit job number, so they are about this job. The
 * customer's texts are not filed against anything and pulling them in here
 * would mean guessing, which is the one thing `inferJobId` is careful not to do.
 */
export async function jobConversation(jobNumber: number): Promise<{
  jobNumber: number;
  title: string | null;
  messages: ConversationMessage[];
  summary: string | null;
} | null> {
  const client = db();
  if (!client) return null;

  const { data: jobRow } = await client
    .from("jobs")
    .select("id, job_number, title")
    .eq("job_number", jobNumber)
    .maybeSingle();
  const job = jobRow as { id: string; job_number: number; title: string | null } | null;
  if (!job) return null;

  const [{ data: messageRows }, { data: summaryRow }] = await Promise.all([
    client
      .from("whatsapp_messages")
      .select("body, media_mime, media_caption, direction, sent_at, kind, whatsapp_contacts(*)")
      .eq("job_id", job.id)
      .order("sent_at", { ascending: true })
      .limit(MAX_ROWS),
    client.from("whatsapp_summaries").select("summary").eq("job_id", job.id).maybeSingle(),
  ]);

  const rows = (messageRows ?? []) as unknown as {
    body: string | null;
    media_mime: string | null;
    media_caption: string | null;
    direction: "inbound" | "outbound";
    sent_at: string;
    kind: string;
    whatsapp_contacts: WhatsAppContact | null;
  }[];

  return {
    jobNumber: job.job_number,
    title: job.title,
    summary: (summaryRow as { summary: string } | null)?.summary ?? null,
    messages: rows.map((row) => ({
      channel: "whatsapp" as const,
      who: row.whatsapp_contacts
        ? contactLabel(row.whatsapp_contacts)
        : row.direction === "outbound"
          ? "Us"
          : "Unknown number",
      direction: row.direction,
      sentAt: row.sent_at,
      text: trim(row.body ?? row.media_caption, row.kind === "text" ? "(empty message)" : `(${row.kind})`),
      jobNumber: job.job_number,
      attachment: row.media_mime ? row.kind : null,
    })),
  };
}

/**
 * What the crew has said lately, across every job.
 *
 * Inbound only. The owner asking "what has the team been saying" wants what
 * came back, not a replay of what he sent — and a dispatch he authorised
 * himself is not news.
 */
export async function recentTeamMessages(days = 7, limit = 20): Promise<ConversationMessage[]> {
  const all = await searchConversations({ channel: "whatsapp", days, limit: MAX_ROWS });
  return all.filter((m) => m.direction === "inbound").slice(0, limit);
}

/**
 * One customer's texts, newest first.
 *
 * By `client_id` rather than by number: a client can have two numbers, and the
 * webhook already resolved which client a text belongs to when it arrived.
 * Matching on the number again here would answer a slightly different question
 * and disagree with the inbox.
 */
export async function clientMessages(clientId: string, limit = 20): Promise<ConversationMessage[]> {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("sms_messages")
    .select("body, direction, created_at, phone")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(Math.min(MAX_ROWS, limit));

  if (error) return [];

  return ((data ?? []) as { body: string; direction: "inbound" | "outbound"; created_at: string; phone: string }[]).map(
    (row) => ({
      channel: "sms" as const,
      who: row.phone,
      direction: row.direction,
      sentAt: row.created_at,
      text: trim(row.body, "(empty message)"),
      jobNumber: null,
      attachment: null,
    }),
  );
}

/**
 * Rows as lines, for a prompt or for something read out loud.
 *
 * Deliberately plain: a date, who, and what they said. The model does the
 * interpreting; this function's only job is to not lose anything on the way.
 */
export function asTranscript(messages: ConversationMessage[]): string {
  if (messages.length === 0) return "No messages.";
  return messages
    .map((m) => {
      const when = new Date(m.sentAt).toLocaleString("en-CA", {
        timeZone: "America/Toronto",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const job = m.jobNumber ? ` [job ${m.jobNumber}]` : "";
      const channel = ` (${CHANNEL_LABEL[m.channel]})`;
      const who = m.direction === "outbound" ? `Us → ${m.who}` : m.who;
      const attachment = m.attachment ? ` [sent a ${m.attachment}]` : "";
      return `${when}${job}${channel} — ${who}: ${m.text}${attachment}`;
    })
    .join("\n");
}
