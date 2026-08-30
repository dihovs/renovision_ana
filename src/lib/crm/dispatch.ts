import { db } from "./db";
import { crewJobPayload, ensureCrewToken } from "./crewView";
import { sendSms } from "@/lib/sms/send";
import { sendTemplate, sendText, canSend, WA_ERROR, type SendResult } from "@/lib/whatsapp/send";
import {
  componentsFor,
  freeFormBody,
  templateName,
  type DispatchKind,
  type DispatchParams,
} from "@/lib/whatsapp/templates";
import {
  contactLabel,
  getContact,
  hasRecentInboundFrom,
  recordOutbound,
  type WhatsAppContact,
} from "@/lib/whatsapp/store";

/**
 * Telling the crew about a job.
 *
 * This is the only orchestration in the WhatsApp feature, and it is written so
 * that the interesting decisions are visible in one file:
 *
 *   WHO — only contacts with `opted_in_at`. No opt-in, no message, and the
 *   refusal is returned as an outcome rather than skipped silently, so the
 *   owner sees "Mike: never opted in" instead of wondering why Mike never
 *   answered.
 *
 *   WHAT — the job number, the arrival window, the street, and a link. Nothing
 *   else. The tasks and the photos are behind the link, on the crew page, where
 *   the column allowlist in crewView.ts already guarantees no price follows.
 *
 *   HOW — a template, unless a 24-hour window happens to be open, in which case
 *   free-form text reads better and costs nothing. Never free-form as the
 *   mechanism: that would make dispatch depend on the crew remembering to
 *   message first, which is the discipline this is replacing.
 *
 *   WHEN IT FAILS — the dispatch row is written BEFORE the API call. A crash
 *   between "Meta accepted it" and "we wrote it down" then leaves evidence that
 *   a send was attempted, which is recoverable; the other order loses the fact
 *   entirely and the crew gets told twice.
 */

const TZ = "America/Toronto";

export type DispatchOutcome = {
  contactId: string;
  name: string;
  channel: "whatsapp" | "sms" | "none";
  ok: boolean;
  /** One sentence for the owner. Never a raw API error. */
  detail: string;
};

export type DispatchResult = {
  ok: boolean;
  crewUrl: string | null;
  outcomes: DispatchOutcome[];
  /** Set when nothing could be attempted at all. */
  blocked?: string;
};

/**
 * The arrival window, as one line a person would say out loud.
 *
 * Meta rejects a parameter containing a newline, a tab or a run of spaces, so
 * this returns a single clean line by construction rather than by hoping.
 * Falls back through: the next uncompleted visit, then the job's start date,
 * then an honest "to be confirmed" — a dispatch with no time is still worth
 * sending, and an invented time is not.
 */
export function arrivalWindow(
  visits: { startsAt: string; endsAt: string | null; allDay: boolean; completedAt: string | null }[],
  startsOn: string | null,
  language: "fr" | "en",
  now: Date = new Date(),
): string {
  const locale = language === "fr" ? "fr-CA" : "en-CA";
  const next = visits
    .filter((v) => !v.completedAt && new Date(v.startsAt).getTime() >= now.getTime() - 12 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

  if (next) {
    const start = new Date(next.startsAt);
    const day = start.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: TZ,
    });
    if (next.allDay) return clean(day);

    const from = start.toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: TZ,
    });
    const to = next.endsAt
      ? new Date(next.endsAt).toLocaleTimeString(locale, {
          hour: "numeric",
          minute: "2-digit",
          timeZone: TZ,
        })
      : null;
    return clean(to ? `${day}, ${from} – ${to}` : `${day}, ${from}`);
  }

  if (startsOn) {
    // A date-only column: parsed as UTC midnight, so it is formatted as UTC too
    // or it renders as the day before in Montreal.
    const day = new Date(`${startsOn}T12:00:00Z`).toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: TZ,
    });
    return clean(day);
  }

  return language === "fr" ? "à confirmer" : "to be confirmed";
}

function clean(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function crewBaseUrl(): string {
  const base =
    process.env.CREW_LINK_BASE_URL?.trim() ||
    `${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.renovisionana.ca").replace(/\/$/, "")}/crew`;
  return base.replace(/\/$/, "");
}

/**
 * Send one job's details to the chosen crew.
 *
 * `contactIds` is explicit rather than "everyone with the subcontractor role":
 * three people is few enough that choosing is a checkbox, and blasting the
 * whole list is how a plumber learns about a job he is not on.
 */
export async function dispatchJob(input: {
  jobId: string;
  contactIds: string[];
  kind: DispatchKind;
  language?: "fr" | "en";
  now?: Date;
}): Promise<DispatchResult> {
  const now = input.now ?? new Date();
  const language = input.language ?? "fr";

  if (input.contactIds.length === 0) {
    return { ok: false, crewUrl: null, outcomes: [], blocked: "Nobody was selected." };
  }
  if (!canSend()) {
    return {
      ok: false,
      crewUrl: null,
      outcomes: [],
      blocked:
        "WhatsApp sending is not configured yet — WHATSAPP_PHONE_NUMBER_ID and a permanent WHATSAPP_ACCESS_TOKEN need to be set.",
    };
  }

  const job = await crewJobPayload(input.jobId);
  if (!job) {
    return { ok: false, crewUrl: null, outcomes: [], blocked: "That job could not be read." };
  }

  const token = await ensureCrewToken(input.jobId, now);
  const crewUrl = `${crewBaseUrl()}/${token}`;

  const street =
    [job.site.street1, job.site.city].filter(Boolean).join(", ") ||
    (language === "fr" ? "adresse à confirmer" : "address to be confirmed");

  const params: DispatchParams = {
    jobNumber: String(job.jobNumber),
    arrivalWindow: arrivalWindow(job.visits, job.startsOn, language, now),
    street,
    token,
  };

  const outcomes: DispatchOutcome[] = [];
  for (const contactId of input.contactIds) {
    outcomes.push(await dispatchOne({ contactId, job: input.jobId, params, crewUrl, kind: input.kind, language, now }));
  }

  return { ok: outcomes.some((o) => o.ok), crewUrl, outcomes };
}

async function dispatchOne(input: {
  contactId: string;
  job: string;
  params: DispatchParams;
  crewUrl: string;
  kind: DispatchKind;
  language: "fr" | "en";
  now: Date;
}): Promise<DispatchOutcome> {
  const contact = await getContact(input.contactId);
  if (!contact) {
    return {
      contactId: input.contactId,
      name: "Unknown contact",
      channel: "none",
      ok: false,
      detail: "That contact no longer exists.",
    };
  }

  const name = contactLabel(contact);

  // The consent gate. Not a warning, not a prompt — a refusal.
  if (!contact.opted_in_at) {
    return {
      contactId: contact.id,
      name,
      channel: "none",
      ok: false,
      detail: "Never opted in — ask them first, then tick the box on their contact.",
    };
  }

  const dispatchId = await openDispatch({
    jobId: input.job,
    contactId: contact.id,
    kind: input.kind,
    sentAt: input.now,
  });

  // An open window means an ordinary message instead of a formatted
  // notification. Same content either way, so a failure here is not worth a
  // fallback — the template path is tried on the next dispatch anyway.
  const windowOpen = await hasRecentInboundFrom(contact.id, input.now);
  const callbackData = `dispatch:${input.job}:${contact.id}`;

  let result: SendResult;
  let bodyForRecord: string;
  let usedTemplate: string | null = null;

  if (windowOpen) {
    bodyForRecord = freeFormBody(input.kind, input.params, input.crewUrl, input.language);
    result = await sendText({ to: contact.wa_id, body: bodyForRecord, callbackData });
  } else {
    usedTemplate = templateName(input.kind);
    bodyForRecord = freeFormBody(input.kind, input.params, input.crewUrl, input.language);
    result = await sendTemplate({
      to: contact.wa_id,
      name: usedTemplate,
      language: input.language,
      components: componentsFor(input.params),
      callbackData,
    });
  }

  if (result.ok) {
    await Promise.all([
      recordOutbound({
        waMessageId: result.wamid,
        contactId: contact.id,
        jobId: input.job,
        body: bodyForRecord,
        templateName: usedTemplate,
        status: "sent",
      }),
      patchDispatch(dispatchId, { wa_message_id: result.wamid }),
    ]);
    return { contactId: contact.id, name, channel: "whatsapp", ok: true, detail: "Sent on WhatsApp." };
  }

  await Promise.all([
    recordOutbound({
      waMessageId: null,
      contactId: contact.id,
      jobId: input.job,
      body: bodyForRecord,
      templateName: usedTemplate,
      errorCode: result.code,
      errorDetail: result.detail,
      status: "failed",
    }),
    patchDispatch(dispatchId, {
      failed_at: new Date().toISOString(),
      error_code: result.code,
      error_detail: result.detail,
    }),
  ]);

  // The one failure with a good answer: they are not on WhatsApp, so text them.
  // Every other code is a problem with us — a paused template, a dead token, a
  // rate limit — and texting around it would hide the thing that needs fixing.
  if (result.code === WA_ERROR.NOT_A_WHATSAPP_USER) {
    const sms = await sendSms({
      to: `+${contact.wa_id}`,
      body: freeFormBody(input.kind, input.params, input.crewUrl, input.language),
      locale: input.language,
      automated: true,
    });
    await patchDispatch(dispatchId, { channel: "sms" });
    return sms.sent
      ? { contactId: contact.id, name, channel: "sms", ok: true, detail: "Not on WhatsApp — texted instead." }
      : {
          contactId: contact.id,
          name,
          channel: "sms",
          ok: false,
          detail: `Not on WhatsApp, and the text failed too (${sms.reason ?? "unknown"}).`,
        };
  }

  return {
    contactId: contact.id,
    name,
    channel: "whatsapp",
    ok: false,
    detail: explain(result.code, result.detail),
  };
}

/** Meta's codes, turned into something the owner can act on. */
function explain(code: number, detail: string): string {
  switch (code) {
    case WA_ERROR.BAD_TOKEN:
      return "WhatsApp rejected our access token. It needs a new permanent System User token.";
    case WA_ERROR.TEMPLATE_PROBLEM:
      return "The message template is paused or missing in WhatsApp Manager. Nothing will send until it is active again.";
    case WA_ERROR.OUTSIDE_WINDOW:
      return "WhatsApp refused a free-form message outside the 24-hour window. Try again — it will use the template.";
    case WA_ERROR.RATE_LIMITED:
      return "WhatsApp is rate-limiting us. Wait a minute and try again.";
    default:
      return `WhatsApp refused it: ${detail}`;
  }
}

async function openDispatch(input: {
  jobId: string;
  contactId: string;
  kind: DispatchKind;
  sentAt: Date;
}): Promise<string | null> {
  const client = db();
  if (!client) return null;
  const { data, error } = await client
    .from("job_dispatches")
    .insert({
      job_id: input.jobId,
      contact_id: input.contactId,
      kind: input.kind,
      channel: "whatsapp",
      sent_at: input.sentAt.toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    // A unique violation here is the double-click guard doing its job. Logged,
    // not thrown: the send still goes ahead, because refusing to tell the crew
    // about a job because of a bookkeeping row would be the wrong trade.
    console.error("[dispatch] could not open dispatch row:", error.message);
    return null;
  }
  return data.id as string;
}

async function patchDispatch(id: string | null, patch: Record<string, unknown>): Promise<void> {
  if (!id) return;
  const client = db();
  if (!client) return;
  const { error } = await client.from("job_dispatches").update(patch).eq("id", id);
  if (error) console.error("[dispatch] could not update dispatch row:", error.message);
}

/** What has already been sent about a job, newest first. */
export type JobDispatchRow = {
  id: string;
  contact_id: string | null;
  kind: DispatchKind;
  channel: "whatsapp" | "sms";
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  error_detail: string | null;
};

export async function listJobDispatches(jobId: string): Promise<JobDispatchRow[]> {
  const client = db();
  if (!client) return [];
  const { data, error } = await client
    .from("job_dispatches")
    .select("id, contact_id, kind, channel, sent_at, delivered_at, read_at, failed_at, error_detail")
    .eq("job_id", jobId)
    .order("sent_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as JobDispatchRow[];
}

/** Contacts named on this job's dispatches, so the UI can show who was told. */
export function describeContacts(
  rows: JobDispatchRow[],
  contacts: WhatsAppContact[],
): { row: JobDispatchRow; name: string }[] {
  const byId = new Map(contacts.map((c) => [c.id, contactLabel(c)]));
  return rows.map((row) => ({
    row,
    name: (row.contact_id && byId.get(row.contact_id)) || "Someone no longer in the list",
  }));
}
