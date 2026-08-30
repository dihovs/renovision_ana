/**
 * The only module that talks to Meta's /messages endpoint.
 *
 * NOTHING HERE THROWS FOR AN OUTCOME THE CALLER HAS TO DECIDE ABOUT. Every send
 * returns a discriminated result, because every failure has a different right
 * answer: a number that is not on WhatsApp should fall back to SMS, a paused
 * template should stop the whole dispatch, and an expired token should page
 * somebody. An exception makes all three easy to skip with one try/catch.
 *
 * THE TOKEN IS NEVER LOGGED. Not in an error, not in a debug line, not inside a
 * request echo. A WhatsApp access token with `whatsapp_business_messaging` can
 * send as this company to anyone, and it does not expire (§12.4) — so a leaked
 * one is leaked until somebody notices.
 */

/**
 * Graph API version, in ONE place. The webhook imports this rather than pinning
 * its own — two version strings drift, and the one that drifts is always the one
 * nobody is looking at. Meta supports a version for about two years; v26.0
 * shipped July 2026.
 */
export const GRAPH_VERSION = "v26.0";

const GRAPH_BASE = "https://graph.facebook.com";

/** Meta answers in well under a second when healthy. Ten is already generous. */
const TIMEOUT_MS = 10_000;

export type SendOk = { ok: true; wamid: string };
export type SendError = {
  ok: false;
  /** Meta's numeric code where there is one, 0 for transport failures. */
  code: number;
  detail: string;
  /** True when the same call might work later: a timeout, a 5xx, a rate limit. */
  retryable: boolean;
};
export type SendResult = SendOk | SendError;

/** Meta's codes, named where the dispatcher branches on them. */
export const WA_ERROR = {
  /** The recipient is not a WhatsApp user, or the number is wrong. Use SMS. */
  NOT_A_WHATSAPP_USER: 131026,
  /** Free-form outside the 24-hour window. Send the template instead. */
  OUTSIDE_WINDOW: 131047,
  /** Rate limited — Meta's own throttle, not ours. */
  RATE_LIMITED: 130429,
  /** The template is paused, deleted, or its name/language does not resolve. */
  TEMPLATE_PROBLEM: 132000,
  /** The access token is invalid or expired. Nothing will send until fixed. */
  BAD_TOKEN: 190,
} as const;

export type TemplateComponent = Record<string, unknown>;

function configured(): { token: string; phoneNumberId: string } | null {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId };
}

/** True when sending is possible at all. The UI uses this to explain itself. */
export function canSend(): boolean {
  return configured() !== null;
}

/**
 * Free-form text. Only legal inside an open 24-hour window — outside it Meta
 * refuses with 131047 and the caller should send a template instead.
 *
 * `preview_url: false` because a body containing a crew link would otherwise
 * unfurl an internal page into the chat list.
 */
export async function sendText(input: {
  to: string;
  body: string;
  callbackData?: string;
}): Promise<SendResult> {
  return post({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normaliseTo(input.to),
    type: "text",
    text: { preview_url: false, body: input.body },
    ...(input.callbackData ? { biz_opaque_callback_data: input.callbackData } : {}),
  });
}

/**
 * An approved template. The components array is built in `templates.ts` — this
 * function deliberately knows nothing about which templates exist, so adding a
 * third one never touches the transport.
 */
export async function sendTemplate(input: {
  to: string;
  name: string;
  language: "fr" | "en";
  components: TemplateComponent[];
  callbackData?: string;
}): Promise<SendResult> {
  return post({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normaliseTo(input.to),
    type: "template",
    template: {
      name: input.name,
      language: { code: input.language },
      components: input.components,
    },
    ...(input.callbackData ? { biz_opaque_callback_data: input.callbackData } : {}),
  });
}

/**
 * E.164 without the leading + — the shape Meta both sends and expects, and the
 * shape `whatsapp_contacts.wa_id` already stores. Anything else is passed
 * through as digits so a stored `+1514…` does not silently become a wrong
 * number.
 */
function normaliseTo(value: string): string {
  return value.replace(/[^\d]/g, "");
}

type MetaErrorBody = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    error_data?: { details?: string };
  };
};

async function post(body: unknown): Promise<SendResult> {
  const config = configured();
  if (!config) {
    return {
      ok: false,
      code: 0,
      detail: "WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not set",
      retryable: false,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${GRAPH_BASE}/${GRAPH_VERSION}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      },
    );

    const text = await response.text();

    if (!response.ok) {
      let parsed: MetaErrorBody = {};
      try {
        parsed = JSON.parse(text) as MetaErrorBody;
      } catch {
        // A non-JSON error body is Meta's edge, not Meta's API — keep the text.
      }
      const code = parsed.error?.code ?? 0;
      const detail =
        parsed.error?.error_data?.details ??
        parsed.error?.message ??
        text.slice(0, 300) ??
        `HTTP ${response.status}`;
      return {
        ok: false,
        code,
        detail,
        // 5xx and rate limits are worth trying again; a bad template or a
        // stranger's number will fail identically forever.
        retryable: response.status >= 500 || code === WA_ERROR.RATE_LIMITED,
      };
    }

    const parsed = JSON.parse(text) as { messages?: { id?: string }[] };
    const wamid = parsed.messages?.[0]?.id;
    if (!wamid) {
      // A 200 with no message id has never been observed, but a dispatch with
      // no wamid can never be correlated to a status, so it is not a success.
      return { ok: false, code: 0, detail: "Meta accepted the send but returned no message id", retryable: false };
    }
    return { ok: true, wamid };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      code: 0,
      detail: aborted ? `No answer from Meta within ${TIMEOUT_MS / 1000}s` : String(err),
      retryable: true,
    };
  } finally {
    clearTimeout(timer);
  }
}
