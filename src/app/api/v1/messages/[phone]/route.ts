import { NextResponse } from "next/server";
import { guarded } from "../../guard";
import { listThread } from "@/lib/sms/thread";
import { findClientForPhone } from "@/lib/sms/attribution";
import { sendSms } from "@/lib/sms/send";

/**
 * One conversation, keyed by the number itself.
 *
 * There is no thread table: the E.164 string IS the identity, the URL carries
 * it without the plus, and it is rebuilt here exactly the way the web page
 * does it. Inconsistent stripping is how one customer becomes two threads.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function keyFrom(segment: string): string | null {
  const phone = `+${segment.replace(/\D/g, "")}`;
  return /^\+[1-9][0-9]{7,14}$/.test(phone) ? phone : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ phone: string }> }) {
  const { phone: segment } = await params;
  const phone = keyFrom(segment);
  if (!phone) {
    return NextResponse.json({ error: "That is not a phone number." }, { status: 404 });
  }

  return guarded(async () => {
    const thread = await listThread(phone);
    // A miss is ordinary — strangers are half the point of this inbox.
    const client = await findClientForPhone(phone).catch(() => null);
    return {
      phone,
      client,
      optedOut: thread.optedOut,
      messages: thread.messages,
    };
  });
}

/**
 * Send one text.
 *
 * `sendSms` and NOTHING else. Every safeguard this feature has lives inside
 * that function — the opt-out check, the self-send guard, the CASL
 * first-contact footer, and the audit row. A route that reached Twilio
 * directly would lose all of them silently, and the failure would be legal
 * rather than technical.
 */
export async function POST(request: Request, { params }: { params: Promise<{ phone: string }> }) {
  const { phone: segment } = await params;
  const phone = keyFrom(segment);
  if (!phone) {
    return NextResponse.json({ error: "That is not a phone number." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Write the message first." }, { status: 400 });
  }

  return guarded(async () => {
    const attributed = await findClientForPhone(phone).catch(() => null);
    const result = await sendSms({
      to: phone,
      body: text,
      clientId: attributed?.id ?? null,
      locale: body.locale === "en" ? "en" : "fr",
    });

    if (result.sent) return { sent: true, sid: result.sid };

    // The same sentences the web inbox shows, because the operator is the
    // same person on both screens and two phrasings of one refusal read as
    // two different problems.
    const message = (() => {
      switch (result.reason) {
        case "opted_out":
          return "That number asked us to stop texting. It has to come from them to start again.";
        case "invalid_number":
          return result.detail ?? "That does not look like a mobile number we can text.";
        case "not_configured":
          return "Texting is not switched on yet — TWILIO_ACCOUNT_SID is missing.";
        default:
          return result.detail ?? "It did not go through. Try again in a moment.";
      }
    })();

    return { sent: false, reason: result.reason, message };
  });
}
