export { POST } from "../route";

/**
 * ElevenLabs' "Chat Completions" server-URL mode always appends a fixed
 * `/chat/completions` suffix to whatever base URL is configured — it is not
 * editable in the dashboard. The agent's Server URL is set to
 * `https://www.renovisionana.ca/api/voice/el`, so this is the exact path it
 * calls. Re-exports the real handler in ../route.ts rather than duplicating it.
 * `runtime`/`dynamic` must be literal per-file (Next.js rejects a re-export),
 * so they're restated here even though they match the source file.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
