# Ana's voice: ElevenLabs Agents, not a self-hosted bridge

**Decided 2026-08-02.** The original plan (`voice-relay/`, Twilio
ConversationRelay, a Fly.io-hosted WebSocket bridge) is shelved, not deleted —
kept on disk as a fallback if this path ever needs replacing. Research showed
a materially better answer: **ElevenLabs Agents has a native Twilio
integration that needs no server of ours at all.**

## Why this replaced the Fly.io plan

| | ConversationRelay + Fly.io bridge | ElevenLabs Agents (this) |
|---|---|---|
| New infrastructure | 1 always-on host, ~$3–7/mo | **none** |
| Owner setup | Fly.io account + `flyctl` CLI | **dashboard only** |
| Latency | turn-based floor ~3–5s | **~1.7s**, real barge-in |
| Voice | Amélie | **same Amélie voice** |
| Claude stays the brain | yes (bridge → our routes) | yes (custom LLM → our routes) |
| Transcripts to Supabase | yes | yes (3 webhooks, below) |

ElevenLabs imports the Twilio number directly (owner pastes the number,
Account SID, and Auth Token into their dashboard) and hosts the entire call
loop — STT, orchestration, TTS, the WebSocket Twilio needs held open for the
whole call. Nothing of ours needs to hold a socket open, which is the
constraint that made the Fly.io bridge necessary in the first place.

## What Claude still does

ElevenLabs supports a **Custom LLM** — an arbitrary HTTPS endpoint shaped like
OpenAI's `/v1/chat/completions`, called every turn with the full running
conversation. Three new Vercel routes replace the old turn-based ones,
reusing every bit of existing logic (`replyTo`, `shouldEscalate`,
`appendTurns`, `detectLocale`, `startCall`, `endCall`):

| Route | Fires when | Replaces |
|---|---|---|
| `src/app/api/voice/el/init/route.ts` | call connects | `/api/voice/incoming` |
| `src/app/api/voice/el/chat/route.ts` | every turn (SSE, OpenAI-shaped) | `/api/voice/turn` |
| `src/app/api/voice/el/completed/route.ts` | call ends | `/api/voice/status` |

The turn-based path (`/api/voice/incoming`, `/api/voice/turn`,
`/api/voice/status`) and the current Twilio number are **untouched** — this
is a parallel setup, not a migration of the live one. Cutover happens only
when the Twilio number gets imported into ElevenLabs, which rewrites that
number's Voice URL itself.

## Env vars this needs (set in Vercel, values chosen when wiring the ElevenLabs dashboard)

- `ELEVENLABS_WEBHOOK_SECRET` — checked by `el/init`, sent as a custom header
  configured in the agent's conversation-initiation webhook settings.
- `ELEVENLABS_CUSTOM_LLM_SECRET` — checked by `el/chat` as `Authorization:
  Bearer <secret>`; this is the "API key" the ElevenLabs dashboard's Custom
  LLM setup asks you to create.
- `ELEVENLABS_POSTCALL_WEBHOOK_SECRET` — checked by `el/completed` against
  the `ElevenLabs-Signature` header (HMAC-SHA256, see the file's comments for
  the exact format); configured in workspace-level webhook settings.

Three separate secrets, deliberately: each is a different ElevenLabs
dashboard config screen with its own auth mechanism, and rotating one should
never require touching the other two.

## Setup, entirely in the ElevenLabs dashboard (no CLI)

1. elevenlabs.io → sign up (Starter plan, $6/mo — the free tier has no
   commercial-use license) → **Agents** → **Create new assistant** → Blank
   template.
2. **Agent** tab: first message + system prompt (port from
   `systemPrompt()` in `src/lib/voice/agent.ts` — keep it pricing-free, that
   guardrail matters). Language: French, add English as an additional
   language. Add the **language_detection** and **end_call** system tools.
3. **Voice** tab: search "Amélie" or paste `UJCi4DDncuo0VJDSIegj`.
4. **LLM** dropdown → **Custom LLM** → Server URL
   `https://www.renovisionana.ca/api/voice/el/chat` → Model ID anything
   (e.g. `ana-v1`) → API key → **Create new secret**, paste the value that
   also goes into `ELEVENLABS_CUSTOM_LLM_SECRET` in Vercel.
5. **Security** tab: enable overrides — tick **Custom LLM extra body**
   (this is what makes `call_sid` round-trip into every chat request) and
   declare `first_message` / `language` / `voice_id` overridable. Add the
   conversation-initiation webhook URL
   (`https://www.renovisionana.ca/api/voice/el/init`) with the custom header
   matching `ELEVENLABS_WEBHOOK_SECRET`.
6. Workspace **Settings**: post-call webhook URL
   (`https://www.renovisionana.ca/api/voice/el/completed`); copy the signing
   secret into `ELEVENLABS_POSTCALL_WEBHOOK_SECRET`.
7. **Phone Numbers** → **+ Import number** → **From Twilio** → paste the
   number, Account SID, Auth Token → **Import**.
8. On the imported number, the **No agent** dropdown → select the agent.

Call the number. That's the cutover — no Twilio console edit needed since
ElevenLabs rewrites the Voice URL itself on import.

## Rollback

Twilio Console → the number → Voice URL → set back to
`https://www.renovisionana.ca/api/voice/incoming`. The turn-based path was
never modified and answers immediately.

## Known unverified points (confirm on the first real test call)

- Whether the Custom LLM secret truly arrives as `Authorization: Bearer
  <secret>` — `el/chat/route.ts` checks that shape; adjust if ElevenLabs logs
  show otherwise.
- The exact key path where `call_sid` lands inside the chat request body —
  `el/chat` checks several plausible shapes and logs when none match.
- Same uncertainty for the post-call webhook payload — `el/completed` checks
  `data.dynamic_variables.call_sid` and one nested fallback.

If any of these are wrong, the fix is narrow: one extraction function per
file, not a redesign.
