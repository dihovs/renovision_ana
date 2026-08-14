import { guarded } from "../guard";
import { listConversations } from "@/lib/sms/inbox";

/**
 * The text-message inbox, for the native app.
 *
 * One call to `listConversations` and nothing else. The awaiting-reply and
 * last-failed semantics live in its fold over the newest messages, and
 * re-deriving them here from raw rows would give the phone a second, slightly
 * different definition of "needs an answer" than the web inbox has.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return guarded(async () => ({ conversations: await listConversations() }));
}
