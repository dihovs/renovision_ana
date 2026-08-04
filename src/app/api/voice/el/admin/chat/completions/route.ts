import { POST as chatCompletions } from "../../../chat/route";

/**
 * The admin dashboard's own Custom LLM endpoint — the same handler as the
 * phone's, entered through a different door.
 *
 * WHY A SECOND URL RATHER THAN A FLAG ON THE REQUEST. The first version of
 * "Talk to Ana" passed `dashboard_owner_session` through the widget's
 * `dynamic-variables` attribute and had the shared route read it. It never
 * worked, and the reason is the exact trap this codebase already documented
 * once (see "THE call_sid MYSTERY, SOLVED" in ../../../chat/route.ts):
 * ElevenLabs does NOT forward `dynamic_variables` to a Custom LLM. They go to
 * the post-call webhook. The only per-turn channel is `custom_llm_extra_body`,
 * and the phone path only has it because /api/voice/el/init explicitly sends
 * both fields. The embeddable widget has no `custom-llm-extra-body` attribute
 * to set — verified against the loaded element's own attribute list — so
 * there is no way to put the flag on the request from the browser at all.
 * ElevenLabs' dashboard confirmed the variable arriving on its side while our
 * endpoint never saw it, which is precisely this split.
 *
 * So the signal moves from the payload to the ROUTE. The admin agent
 * (ELEVENLABS_ADMIN_AGENT_ID) has its Server URL pointed at
 * `https://www.renovisionana.ca/api/voice/el/admin`, ElevenLabs appends its
 * fixed `/chat/completions` suffix, and this file is what it reaches. The
 * phone and outbound agents keep the original `/api/voice/el` base and are
 * untouched.
 *
 * THE TRUST ARGUMENT IS UNCHANGED, and if anything more legible: reaching
 * this path still requires the same ELEVENLABS_CUSTOM_LLM_SECRET bearer as
 * every other turn (verified inside the shared handler, before anything
 * below matters), and the only place the admin agent is ever embedded is a
 * page behind /admin's server-side session check. What changed is that
 * "which door did this come through" is now a property of the URL — which a
 * phone caller cannot influence at all — rather than a field in a body they
 * also cannot influence. Both are unforgeable from a call; this one has the
 * advantage of actually being delivered.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Let the shared handler own the malformed-body response shape rather
    // than inventing a second one here.
    return chatCompletions(rebuild(request, raw));
  }

  const extra = (body.elevenlabs_extra_body ?? {}) as Record<string, unknown>;
  const patched = {
    ...body,
    elevenlabs_extra_body: { ...extra, dashboard_owner_session: "authenticated" },
  };

  return chatCompletions(rebuild(request, JSON.stringify(patched)));
}

/**
 * A fresh Request carrying the rewritten body.
 *
 * Only the authorization header is carried over, deliberately: the original
 * `content-length` describes the pre-patch body and would be wrong, and
 * nothing else in the shared handler reads a header.
 */
function rebuild(request: Request, body: string): Request {
  const headers = new Headers({ "content-type": "application/json" });
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);
  return new Request(request.url, { method: "POST", headers, body });
}
