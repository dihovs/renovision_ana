import { NextResponse } from "next/server";
import { endCall, getCallBySid } from "@/lib/crm/calls";
import { saveLead } from "@/lib/leadStore";
import { sanitizeBrief } from "@/lib/projectBrief";
import {
  publicUrl,
  readTwilioParams,
  verifyTwilioSignature,
} from "@/lib/voice/twiml";

/**
 * File a lead from a phone call.
 *
 * A separate route from /api/leads on purpose. That one requires an email
 * address, which is correct for a web form — the customer is typing and the
 * field is right there — and wrong for a phone call, where a caller often has
 * no email to give and reciting one aloud is the fastest way to record it
 * incorrectly. Weakening the web form's validation to accommodate the phone
 * would trade a real guarantee for a convenience.
 *
 * So: phone leads need a name and a number, and nothing else is mandatory.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const params = await readTwilioParams(request);

  if (
    !verifyTwilioSignature({
      signature: request.headers.get("x-twilio-signature"),
      url: publicUrl(request),
      params,
      authToken: process.env.TWILIO_AUTH_TOKEN,
    })
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const callSid = params.CallSid;
  if (!callSid) return NextResponse.json({ error: "No call" }, { status: 400 });

  const call = await getCallBySid(callSid);
  if (!call) return NextResponse.json({ error: "Unknown call" }, { status: 404 });

  // The caller's own number is the fallback contact, and it is more reliable
  // than a number read out over a bad line.
  const phone = params.phone?.trim() || call.from_number || "";
  const name = params.name?.trim() || "Phone caller";

  if (!phone) {
    return NextResponse.json({ error: "No number to call back" }, { status: 400 });
  }

  const brief = sanitizeBrief(safeJson(params.brief));

  let leadId: string | null = null;
  try {
    leadId = await saveLead({
      name,
      // Deliberately empty rather than invented. A placeholder address would
      // end up in a mail merge one day.
      email: params.email?.trim() ?? "",
      phone,
      address: params.address?.trim() || undefined,
      locale: call.locale,
      scopeSummary: brief?.headline ?? undefined,
      projectBrief: brief,
      source: "phone",
    });
  } catch (err) {
    // The call is the lead. If storage fails, the transcript still holds the
    // number and the conversation, so nothing is actually lost — say so in the
    // logs rather than failing the call.
    console.error("[voice] could not file the lead; transcript still holds it:", err);
  }

  await endCall(callSid, { brief, leadId }).catch(() => {});

  return NextResponse.json({ ok: true, leadId });
}

function safeJson(value: string | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
