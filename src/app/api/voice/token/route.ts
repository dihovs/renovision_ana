import { isSignedIn } from "@/lib/adminAuth";
import { mintVoiceToken } from "@/lib/voice/accessToken";

/**
 * Hands the admin's browser a credential to place calls as the business.
 *
 * Gated on the admin session and nothing else, which is the same trust
 * argument the "Talk to Ana" widget rests on: /admin re-verifies the session
 * cookie server-side on every request, and this route re-checks it rather than
 * trusting that the caller came from a page that did. A route that mints
 * calling credentials is precisely the one where "the layout already checked"
 * is not good enough — it is reachable directly, by anyone, at a guessable URL.
 *
 * Never cached. A token is short-lived and single-purpose, and a cached one
 * served to a later request would be both stale and shared.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isSignedIn())) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }

  const result = mintVoiceToken();
  if (!result.ok) {
    // Named in the response because the only person who can see this is the
    // owner, and "which variable is missing" is the entire content of the
    // answer he needs. Nothing secret is disclosed by listing the names.
    console.error("[voice-softphone] cannot mint a token", { missing: result.missing });
    return Response.json(
      { error: "Calling from the browser is not configured yet.", missing: result.missing },
      { status: 503 },
    );
  }

  return Response.json(
    { token: result.token, identity: result.identity },
    { headers: { "cache-control": "no-store" } },
  );
}
