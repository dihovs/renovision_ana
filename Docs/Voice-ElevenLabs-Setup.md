# Ana's voice: ElevenLabs Agents, not a self-hosted bridge

**Decided 2026-08-02.** The original plan (`voice-relay/`, Twilio
ConversationRelay, a Fly.io-hosted WebSocket bridge) was shelved and has since
been **deleted** — the Fly app is gone and the code with it; the reasoning is
preserved in `Docs/Voice-Architecture-History.md`. The fallback if this path
needs replacing is the turn-based `<Gather>` path (`/api/voice/incoming`,
`/api/voice/turn`, `/api/voice/status`), which is still here and still works.
Research showed a materially better answer: **ElevenLabs Agents has a native
Twilio integration that needs no server of ours at all.**

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
3. **Voice**: two voices, one per language — see "Bilingual voices" below.
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

## Bilingual voices — configured 2026-08-02

Ana speaks with a different voice per language, because one voice cannot do
both without an accent, and in Montreal a bilingual person is expected to have
neither:

| Language | Voice | Voice ID |
|---|---|---|
| French (default) | Melanie – Captivative, Elegant and Calm | `tLK6fPv15M0oKv4V3ACR` |
| English (preset override) | Sarah – Approachable and Informative | `Nhs7eitvQWFTQBsf0yiT` |

Set in **Agent → Voices → the primary voice → Override voice → English**. The
French voice is the agent default; only English carries an override, so the two
can be changed independently. Swapping either is a 30-second dashboard change
and needs no deploy — the code no longer names a voice at all.

**What makes the switch actually happen.** Three things have to line up, and
until this pass only the first was true:

1. The **Detect language** and **End conversation** system tools are enabled
   (Agent → Tools → System tools).
2. `src/app/api/voice/el/chat/route.ts` **emits** the `language_detection` tool
   call. This is the part that was missing. Because we run a Custom LLM,
   ElevenLabs does not run its system tools itself — it passes them to our
   endpoint and waits for us to return an OpenAI-shaped `tool_calls` response.
   The route ignored `body.tools` entirely, so the conversation language stayed
   pinned to French for the whole call. Claude switched to English (our own
   `detectLocale` drives the prompt) while ElevenLabs kept speaking through the
   French voice — which is exactly the accent problem, and it was never a voice
   selection issue at all.
3. `el/init` no longer sends `conversation_config_override.tts.voice_id`. It
   used to pin one voice on every call, which would sit on top of the preset
   and defeat it.

**The extra round trip.** On the single turn where the language flips, Ana
returns a tool call instead of speech; ElevenLabs runs it and immediately calls
back, and the reply is generated on that second pass. That costs one round trip
per call at most. The route detects the callback (`role: "tool"` as the last
message), takes the spoken text from the last *user* message rather than the
last message overall, and suppresses re-emitting the tool call so a stubborn
`detectLocale` cannot bounce the call between languages.

### Still open

- **The company name.** TTS reads "Renovision AnA" as "Renova Vision N-A". Ana
  no longer repeats it when closing, but she still says it in the greeting.
  Fixing it properly needs the owner to say how it should sound — see
  `Docs/Owner-Decisions-Needed.md`. A pronunciation dictionary exists under
  Voices → the gear icon → **Pronunciation dictionaries**, but note its caveat:
  IPA/CMU phonemes only apply to V3 Conversational and Flash V2 (English only),
  and this agent runs Flash.
- **Matching timbre across both languages** — so Ana sounds like the same
  person in French and English — would need two Instant Voice Clones of one
  bilingual speaker. Worth doing only if the two-voice split reads as jarring.

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
