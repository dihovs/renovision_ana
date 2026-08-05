import { SITE_PHONE_TEL } from "@/lib/constants";
import { toE164 } from "@/lib/sms/send";

/**
 * The owner calling somebody FROM the business number.
 *
 * Distinct from three things that already exist, and the distinction is the
 * reason this file is separate from all of them:
 *
 *   - CallButton's `tel:` link, which dials from the phone in his hand under
 *     his OWN caller ID. Fine for calling a supplier; wrong for calling a
 *     customer, who then has his personal mobile and will use it forever.
 *   - outboundDialer.ts, which puts ANA on the call. Nobody human is involved.
 *   - /api/voice/el/init, which is inbound.
 *
 * HOW IT WORKS. Twilio rings the owner first, from the business number, and
 * only once he picks up does it dial the customer with the business number as
 * caller ID. Both legs therefore show +1 579-999-5979: he recognises the
 * incoming call as "my own system calling me", and the customer sees the
 * company. His mobile number is never transmitted to anyone.
 *
 * The order matters and is not arbitrary. Ringing the customer first would
 * mean they answer to silence while his phone is still ringing — the exact
 * experience that makes people hang up on what they assume is a robocall.
 *
 * INLINE TwiML RATHER THAN A CALLBACK URL. Twilio's Call resource accepts a
 * `Twiml` parameter as an alternative to `Url`, and taking it removes a public
 * endpoint that would otherwise exist solely to be told which number to dial.
 * Such an endpoint is a standing invitation: anyone who can forge a request to
 * it makes the business place calls at its own expense. Signature verification
 * would close that, but not having the endpoint at all closes it better.
 */

const TWILIO_API = "https://api.twilio.com/2010-04-01";
const TIMEOUT_MS = 10_000;

/**
 * How long Twilio waits for the owner to pick up before giving up on the whole
 * thing. Twenty seconds is about four rings — long enough to reach a phone in
 * another room, short enough that a phone left on a desk does not tie up a call
 * leg for a minute.
 */
const RING_SECONDS = 20;

export type BridgeResult =
  | { ok: true; sid: string }
  | {
      ok: false;
      reason: "not_configured" | "no_owner_number" | "invalid_number" | "failed";
      detail?: string;
    };

/**
 * Which phone to ring for the owner.
 *
 * Defaults to the first entry of OWNER_PHONE_NUMBERS — the allowlist that
 * already decides whose caller ID may attempt owner mode, so the number is
 * configured once and means the same thing in both places. OWNER_MOBILE
 * overrides it for the case where he wants CRM calls to land somewhere other
 * than the line he authenticates from.
 */
export function ownerMobile(): string | null {
  const explicit = process.env.OWNER_MOBILE?.trim();
  if (explicit) return toE164(explicit);

  const first = (process.env.OWNER_PHONE_NUMBERS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)[0];
  return first ? toE164(first) : null;
}

/**
 * Escape a value for inclusion in the TwiML document.
 *
 * Both numbers are E.164 by the time they get here, so there is nothing left
 * to escape and this should never change a single character. It exists anyway,
 * because "this string cannot contain a quote" is exactly the assumption that
 * stops being true the day somebody widens toE164, and the failure mode is an
 * injected <Dial> to a number of the attacker's choosing.
 */
function xmlAttr(value: string): string {
  return value.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export async function bridgeCall(input: { to: string }): Promise<BridgeResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const business = toE164(process.env.SMS_FROM_NUMBER?.trim() || SITE_PHONE_TEL);

  const to = toE164(input.to);
  if (!to) return { ok: false, reason: "invalid_number" };

  const mine = ownerMobile();
  if (!mine) return { ok: false, reason: "no_owner_number" };

  if (!business) {
    return { ok: false, reason: "not_configured", detail: "the business number is not set" };
  }
  if (to === mine || to === business) {
    return { ok: false, reason: "invalid_number", detail: "that would call yourself" };
  }
  if (!accountSid || !authToken) {
    console.error("[voice-bridge] TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are not set");
    return { ok: false, reason: "not_configured" };
  }

  // answerOnBridge keeps the owner hearing a real ringback while the customer's
  // phone rings, instead of dead air he would assume was a failed call. It also
  // stops the customer's leg being billed as answered before they pick up.
  const twiml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response><Dial answerOnBridge="true" callerId="${xmlAttr(business)}">` +
    `${xmlAttr(to)}</Dial></Response>`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${TWILIO_API}/Accounts/${accountSid}/Calls.json`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: mine,
        From: business,
        Twiml: twiml,
        Timeout: String(RING_SECONDS),
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as {
      sid?: string;
      message?: string;
    } | null;

    if (!response.ok) {
      const detail = payload?.message ?? `Twilio returned ${response.status}`;
      console.error("[voice-bridge] Twilio refused the call", { status: response.status, detail });
      return { ok: false, reason: "failed", detail };
    }

    console.info("[voice-bridge] ringing the owner to connect a call");
    return { ok: true, sid: payload?.sid ?? "" };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "the request failed";
    console.error("[voice-bridge] could not reach Twilio", err);
    return { ok: false, reason: "failed", detail };
  } finally {
    clearTimeout(timer);
  }
}
