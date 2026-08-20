import { SITE_PHONE_TEL } from "@/lib/constants";

/**
 * Text the owner when something happens he would want to walk over and look
 * at: a lead lands, Ana takes a call, a job gets approved.
 *
 * **Why SMS and not a push notification.** He asked for notifications on his
 * phone, 20 Aug 2026 — *"I want more notifications when I get leads… or when
 * someone calls and my AI answers. I wanna get notifications so I can go and
 * actually check what's going on."* Push is the right long answer and needs
 * an APNs key out of his Apple Developer account, which nobody but him can
 * produce. This needs nothing: Twilio is already sending, and a text reaches
 * a pocket in a wet basement exactly as well as a banner does.
 *
 * **This is NOT the customer SMS path, and the difference is legal, not
 * stylistic.** `sendSms` checks the opt-out list, appends a CASL footer on
 * first contact, and files the message into the customer thread it belongs
 * to — all correct for a message to a consumer, all wrong for an operational
 * alert a business sends to its own owner. Consent law governs commercial
 * electronic messages to other people; this is the system telling its
 * operator that his phone rang. Footing it with "reply STOP to unsubscribe"
 * and filing it under his own number as a customer conversation would be
 * both wrong and confusing.
 *
 * **Never throws, never blocks.** Every caller is in the middle of doing
 * something that matters more — saving a lead, closing a call — and an alert
 * that cost a real customer enquiry because Twilio was slow would be a bad
 * trade. Failures are logged and swallowed.
 */

const TWILIO_API = "https://api.twilio.com/2010-04-01";
const TIMEOUT_MS = 8_000;

/** Where alerts go. Unset means alerts are off, which is a valid state. */
function alertNumber(): string | null {
  const raw = process.env.OWNER_ALERT_NUMBER?.trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/**
 * Send one alert. Fire-and-forget: callers should NOT await this in a request
 * path they care about — see `notify()` below.
 */
async function send(body: string): Promise<void> {
  const to = alertNumber();
  if (!to) return;

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = (process.env.SMS_FROM_NUMBER?.trim() || SITE_PHONE_TEL).trim();
  if (!accountSid || !authToken) return;

  // Texting the business line from the business line arrives back through the
  // inbound webhook and is recorded as a customer reply — the same trap
  // `sendSms` guards.
  if (from.replace(/[^\d]/g, "") === to.replace(/[^\d]/g, "")) {
    console.error("[notify] OWNER_ALERT_NUMBER is the business line — not sending");
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${TWILIO_API}/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body.trim().slice(0, 600) }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      console.error("[notify] Twilio refused:", payload?.message ?? response.status);
    }
  } catch (error) {
    console.error("[notify] could not send:", (error as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Alert the owner, without making him wait for it.
 *
 * The `void` is deliberate and the reason is worth keeping: this runs inside
 * request handlers that are finishing something important. Awaiting a text
 * message before returning a saved lead adds Twilio's latency to a customer's
 * form submission, and Twilio's failures to its failure modes.
 */
export function notify(body: string): void {
  void send(body);
}

/** A lead just landed. */
export function notifyNewLead(input: {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  isEmergency?: boolean | null;
  source?: string | null;
}): void {
  const who = input.name?.trim() || input.phone?.trim() || "Someone";
  const where = input.address?.trim();
  // The emergency flag leads, because it is the only part of a lead that
  // changes what he does in the next ten minutes.
  const head = input.isEmergency ? "URGENT lead" : "New lead";
  const from = input.source && input.source !== "website" ? ` (${input.source})` : "";
  notify(
    [`${head}${from}: ${who}`, where ? where : null, input.phone ? input.phone : null]
      .filter(Boolean)
      .join(" — "),
  );
}

/** Ana finished a call. */
export function notifyCallEnded(input: {
  from?: string | null;
  seconds?: number | null;
  becameLead?: boolean;
  escalated?: boolean;
  transferred?: boolean;
}): void {
  const who = input.from?.trim() || "Unknown number";
  const length =
    input.seconds == null
      ? ""
      : input.seconds >= 60
        ? `, ${Math.round(input.seconds / 60)} min`
        : `, ${input.seconds}s`;
  // Worst first, same order the home screen uses — a call Ana had to hand
  // over is the one worth walking inside for.
  const outcome = input.escalated
    ? " — she escalated it"
    : input.transferred
      ? " — transferred to you"
      : input.becameLead
        ? " — became a lead"
        : "";
  notify(`Ana answered ${who}${length}${outcome}`);
}
