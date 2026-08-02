import { startCall } from "@/lib/crm/calls";
import { greeting } from "@/lib/voice/agent";
import { verifyRelaySecret } from "@/lib/voice/relayAuth";

/**
 * Called once per call by the relay bridge, right after Twilio's ConversationRelay
 * `setup` message arrives.
 *
 * Mirrors what /api/voice/incoming does for the turn-based path: open the
 * transcript row so a call that drops after one word still leaves a record,
 * and hand back the greeting to speak. Kept as its own endpoint (rather than
 * folding into /api/voice/relay/turn) because "start a call" and "answer a
 * turn" have different failure shapes worth seeing separately in logs.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!verifyRelaySecret(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const callSid: string | undefined = body?.callSid;
  if (!callSid) {
    return Response.json({ error: "callSid required" }, { status: 400 });
  }

  // French default, same as the turn-based path — the site's default language
  // is French and this is Laval. The agent switches the moment the caller
  // answers in English.
  const locale = "fr" as const;

  // Failing soft: if the database is unreachable the customer still gets a
  // working phone line, and the transcript is what we lose rather than the call.
  try {
    await startCall({
      callSid,
      from: body?.from ?? null,
      to: body?.to ?? null,
      locale,
    });
  } catch (err) {
    console.error("[voice-relay] could not open the transcript:", err);
  }

  return Response.json({ greeting: greeting(locale), locale });
}
