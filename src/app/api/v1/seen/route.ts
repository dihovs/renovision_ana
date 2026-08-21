import { NextResponse } from "next/server";
import { guarded } from "../guard";
import { writeSetting } from "@/lib/crm/settings";

/**
 * `POST /api/v1/seen` — "I have looked at this."
 *
 * The other half of the home screen's badges. A red circle that never clears
 * is not a notification, it is decoration: after a week of ignoring it the
 * operator stops reading it, and then it cannot tell them anything. So
 * opening Messages or the phone marks that surface seen, exactly as tapping
 * an iPhone app icon does, and the next dashboard read returns zero.
 *
 * The mark is a timestamp rather than a per-row flag on purpose. There is one
 * operator; "everything before now" is the entire truth that needs storing,
 * and it needs no migration and no write to a table that grows forever.
 */
const SURFACES: Record<string, string> = {
  messages: "messages_seen_at",
  calls: "calls_seen_at",
};

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const what = typeof body.what === "string" ? body.what : "";
  const key = SURFACES[what];
  if (!key) {
    return NextResponse.json(
      { error: `Unknown surface. Expected one of: ${Object.keys(SURFACES).join(", ")}.` },
      { status: 400 },
    );
  }

  // Stamped here rather than taken from the caller: a phone with a wrong
  // clock would otherwise mark tomorrow's messages read today.
  return guarded(async () => {
    await writeSetting(key, new Date().toISOString());
    return { ok: true };
  });
}
