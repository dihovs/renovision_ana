import { db } from "@/lib/crm/db";
import { SITE_PHONE_TEL } from "@/lib/constants";

/**
 * Sending a text message.
 *
 * Hand-rolled `fetch` against Twilio's REST API rather than their SDK, in the
 * house style and for the reason outboundDialer.ts gives: one POST, a response
 * shape we read three fields out of, and no dependency that has to be kept in
 * step with a runtime.
 *
 * WHAT THIS REFUSES TO DO IS THE POINT. Three checks run before the request is
 * built, and each of them is a thing that has gone wrong for somebody:
 *
 *   - the number has withdrawn consent (CASL s.11(2)) — checked against the
 *     database, not a cached list, because the withdrawal may have arrived
 *     thirty seconds ago from the inbound webhook;
 *   - the number is not a number;
 *   - we are texting ourselves, which is a loop.
 *
 * NOTHING HERE SENDS ON ITS OWN. Every call originates in an owner action in
 * the admin. That is the whole reason this can rely on CASL's implied consent
 * (s.10(9)) — an existing business relationship with someone who contacted us —
 * rather than needing the express-consent apparatus 0021 built for ADAD voice
 * calls. The day something automated wants to use this, that assumption has to
 * be revisited, which is why it is written down here rather than assumed.
 */

const TWILIO_API = "https://api.twilio.com/2010-04-01";

/**
 * How long to wait on Twilio. Short: this runs inside a server action with the
 * owner watching a button, and a request still hanging after ten seconds is not
 * going to succeed in a way that helps him.
 */
const TIMEOUT_MS = 10_000;

export type SmsResult =
  | { sent: true; sid: string }
  | { sent: false; reason: "not_configured" | "opted_out" | "invalid_number" | "failed"; detail?: string };

/**
 * To E.164, or null.
 *
 * Deliberately narrow: ten digits is assumed to be North American and gets a
 * +1, eleven starting with 1 is the same number written differently, and
 * anything already carrying a + is trusted as typed. Everything else is
 * refused rather than guessed at — a wrong guess here texts a stranger.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Has this number told us to stop? */
export async function hasOptedOut(phone: string): Promise<boolean> {
  const client = db();
  if (!client) return false;

  const { data, error } = await client
    .from("sms_opt_outs")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  // Fail OPEN on a database error, and this is the one place in this file
  // where that is the right direction. The alternative is that a transient
  // Supabase blip silently blocks the owner from answering a customer, with a
  // "they unsubscribed" message that is not true. A genuine opt-out is
  // enforced by the webhook that wrote it and by the admin showing the state;
  // this check is the fast path, not the only guard.
  if (error) {
    console.error("[sms] could not check the opt-out list — allowing the send", error);
    return false;
  }
  return Boolean(data);
}

/**
 * The identification and unsubscribe line CASL s.6 requires.
 *
 * Attached only to AUTOMATED first contact, and today nothing in this
 * codebase qualifies — see `automated` on sendSms below.
 *
 * The owner's objection, 27 Aug 2026, and it is the correct one: "if I'm
 * texting them and it's me, then giving them an option to stop the messaging
 * makes it look like a robot, but it's not a robot, it's actually me." A
 * tradesman who types "I'm outside, in front of 7144" and has a footer
 * stapled to it does not read as a person. It reads as a marketing system,
 * which is the opposite of what this business sells.
 *
 * He is also right on the law, for the messages he actually sends. CASL
 * governs COMMERCIAL electronic messages; a one-to-one reply about a job the
 * customer already hired us for is not one. What CASL does NOT say is
 * "first message only" -- a genuine commercial message needs the unsubscribe
 * mechanism every time, not once. So the honest split is not first-vs-later,
 * it is human-vs-automated, which is what this now keys on.
 */
function caslFooter(locale: "fr" | "en"): string {
  return locale === "fr"
    ? "\n\n— Renovision AnA. Répondez STOP pour ne plus recevoir de textos."
    : "\n\n— Renovision AnA. Reply STOP to opt out.";
}

/** Have we texted this number before? Only consulted for automated sends. */
async function isFirstContact(phone: string): Promise<boolean> {
  const client = db();
  if (!client) return true;

  const { data, error } = await client
    .from("sms_messages")
    .select("id")
    .eq("phone", phone)
    .eq("direction", "outbound")
    .limit(1);

  // On an error, assume it IS the first message. Sending the footer twice is
  // mildly redundant; omitting it when it was required is the failure that
  // matters.
  if (error) return true;
  return (data?.length ?? 0) === 0;
}

/** Write the row. Never throws — a logging failure must not lose the message. */
async function record(input: {
  direction: "outbound" | "inbound";
  phone: string;
  body: string;
  clientId?: string | null;
  leadId?: string | null;
  providerSid?: string | null;
  status: "queued" | "failed" | "received";
  error?: string | null;
  mediaPaths?: string[];
}): Promise<void> {
  const client = db();
  if (!client) return;

  const { error } = await client.from("sms_messages").insert({
    direction: input.direction,
    phone: input.phone,
    body: input.body,
    client_id: input.clientId ?? null,
    lead_id: input.leadId ?? null,
    provider_sid: input.providerSid ?? null,
    status: input.status,
    error: input.error ?? null,
    media_paths: input.mediaPaths ?? [],
  });
  if (error) console.error("[sms] could not record the message", error);
}

/**
 * Send one text message.
 *
 * Resolves rather than throws for every outcome the caller can do something
 * about — an unconfigured environment, an unsubscribed number, a rejection
 * from Twilio — because all three are things the admin should render as a
 * sentence rather than a 500 page. It follows the same contract as
 * sendDocument.ts: the caller is told what happened and never has to guess
 * whether to retry.
 */
export async function sendSms(input: {
  to: string;
  body: string;
  clientId?: string | null;
  leadId?: string | null;
  locale?: "fr" | "en";
  /**
   * Publicly reachable URLs Twilio will fetch and attach — this makes it an
   * MMS. They have to be reachable by TWILIO, not by us: a signed URL from
   * our own bucket works, a path does not.
   *
   * An empty list is not the same as none: it still sends a plain SMS, which
   * is what a caller that found no photos should do.
   */
  mediaUrls?: string[];
  /**
   * True only when a machine composed this, with no one reading it before it
   * went. Those get the CASL identification-and-unsubscribe footer on first
   * contact; a message the owner typed himself gets nothing appended.
   *
   * Defaults to false because every caller today is a person at a keyboard --
   * the client page, the message thread, and the native app's send. If you
   * are adding a sender that blasts, set this, and know that the footer this
   * flag turns on is a FIRST-CONTACT footer: CASL wants the unsubscribe
   * mechanism in every commercial message, so a real marketing campaign needs
   * more than flipping this to true.
   */
  automated?: boolean;
}): Promise<SmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = (process.env.SMS_FROM_NUMBER?.trim() || SITE_PHONE_TEL).trim();

  const to = toE164(input.to);
  if (!to) return { sent: false, reason: "invalid_number" };

  const body = input.body.trim();
  const media = (input.mediaUrls ?? []).filter((url) => /^https?:\/\//.test(url)).slice(0, 10);
  // A picture with no words is a perfectly good message; only a message with
  // NEITHER is empty.
  if (!body && media.length === 0) {
    return { sent: false, reason: "failed", detail: "the message was empty" };
  }

  // Texting our own number would arrive back through the inbound webhook and
  // be recorded as a customer reply.
  if (toE164(from) === to) {
    return { sent: false, reason: "invalid_number", detail: "that is our own number" };
  }

  if (await hasOptedOut(to)) return { sent: false, reason: "opted_out" };

  if (!accountSid || !authToken) {
    console.error("[sms] TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are not set — not sending");
    return { sent: false, reason: "not_configured" };
  }

  const full =
    input.automated && (await isFirstContact(to))
      ? `${body}${caslFooter(input.locale ?? "fr")}`
      : body;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${TWILIO_API}/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        // Twilio takes HTTP Basic; the SID is the user and the token the
        // password. Built here rather than held in an env var so the token is
        // never sitting around pre-encoded.
        authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      // `MediaUrl` REPEATS — one parameter per attachment, not a list in
      // one. Twilio ignores a comma-joined value silently, which sends the
      // text without the photo and reports success.
      body: (() => {
        const form = new URLSearchParams({ To: to, From: from, Body: full });
        for (const url of media) form.append("MediaUrl", url);
        return form;
      })(),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as {
      sid?: string;
      message?: string;
    } | null;

    if (!response.ok) {
      const detail = payload?.message ?? `Twilio returned ${response.status}`;
      console.error("[sms] Twilio refused the message", { status: response.status, detail });
      await record({ ...toRecord(input, to, full), status: "failed", error: detail });
      return { sent: false, reason: "failed", detail };
    }

    const sid = payload?.sid ?? null;
    await record({ ...toRecord(input, to, full), status: "queued", providerSid: sid });
    return { sent: true, sid: sid ?? "" };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "the request failed";
    console.error("[sms] could not reach Twilio", err);
    await record({ ...toRecord(input, to, full), status: "failed", error: detail });
    return { sent: false, reason: "failed", detail };
  } finally {
    clearTimeout(timer);
  }
}

function toRecord(
  input: { clientId?: string | null; leadId?: string | null },
  phone: string,
  body: string,
) {
  return {
    direction: "outbound" as const,
    phone,
    body,
    clientId: input.clientId ?? null,
    leadId: input.leadId ?? null,
  };
}

/** Record an inbound message. Used by the Twilio webhook. */
export async function recordInbound(input: {
  phone: string;
  body: string;
  clientId?: string | null;
  providerSid?: string | null;
  /** Paths in our own bucket, already copied out of Twilio. */
  mediaPaths?: string[];
}): Promise<void> {
  await record({
    direction: "inbound",
    phone: input.phone,
    body: input.body,
    clientId: input.clientId ?? null,
    providerSid: input.providerSid ?? null,
    status: "received",
    mediaPaths: input.mediaPaths ?? [],
  });
}

/**
 * STOP, and the French equivalent Quebec recipients actually type.
 *
 * Twilio intercepts the English keywords itself and stops delivery at their
 * end, which is necessary and not sufficient: their list is not our list, and
 * a number they have blocked would still look sendable to every other part of
 * this system. So we keep our own, and we recognise ARRÊT, which Twilio's
 * default keyword set does not.
 */
const STOP_WORDS =
  /^\s*(stop|stopall|unsubscribe|cancel|end|quit|arr[êe]t|arr[êe]te[zr]?|d[ée]sabonne[rz]?|desabonnement)\s*[.!]?\s*$/i;

export function isStopRequest(text: string): boolean {
  return STOP_WORDS.test(text);
}

/** START/UNSTOP — the recipient asking to hear from us again. */
const START_WORDS = /^\s*(start|unstop|yes|oui|d[ée]bloquer)\s*[.!]?\s*$/i;

export function isStartRequest(text: string): boolean {
  return START_WORDS.test(text);
}

/** Add a number to the unsubscribe list. Idempotent. */
export async function recordOptOut(phone: string, requestedVia: string): Promise<void> {
  const client = db();
  if (!client) return;

  const { error } = await client
    .from("sms_opt_outs")
    .upsert({ phone, requested_via: requestedVia }, { onConflict: "phone" });
  if (error) console.error("[sms] could not record the opt-out", error);
}

/** Remove a number from the unsubscribe list, after an explicit START. */
export async function clearOptOut(phone: string): Promise<void> {
  const client = db();
  if (!client) return;

  const { error } = await client.from("sms_opt_outs").delete().eq("phone", phone);
  if (error) console.error("[sms] could not clear the opt-out", error);
}
