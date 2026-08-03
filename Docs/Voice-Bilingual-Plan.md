# Ana in two voices: French voice for French, English voice for English

**Researched 2026-08-02.** Companion to `Docs/Voice-ElevenLabs-Setup.md`.
Agent `agent_6801kz0da1ygfkt9ds7yc90btqxr`.

The problem in one line: Melanie (`tLK6fPv15M0oKv4V3ACR`) is a French voice, so
when Ana switches to English she is a French woman speaking English. In
Montreal that reads as "not from here". The fix is two voice IDs, selected by
the conversation's current language.

---

## Recommendation

**Use ElevenLabs' `language_presets` (per-language overrides), driven by the
`language_detection` system tool — and make our Custom LLM actually emit that
tool call, which it currently never does.**

That is the whole recommendation. Three parts, in dependency order:

1. **`language_presets`** is the only mechanism that can change the voice
   *mid-call*. It is a map keyed by language code where each entry carries an
   `overrides` object that can set `tts.voice_id`, `tts.model_id`,
   `agent.first_message`, `agent.language`, `agent.prompt`, and ASR settings
   for that language ([API schema][api-create], [Language docs][lang]). When
   the conversation's language becomes `en`, the `en` preset's overrides take
   effect — including its voice.

2. **`language_detection`** is what changes the conversation's language
   mid-call. It "allows your agent to switch its output language to any the
   agent supports" and is **not enabled automatically** — it must be added to
   the agent's tools ([Language detection][langdet]). With presets configured,
   "the agent will automatically switch voice and responses to match detected
   languages" ([Language detection][langdet]).

3. **The blocker nobody has hit yet:** we run a **Custom LLM**. ElevenLabs'
   own LLM is not in the loop, so ElevenLabs cannot decide to call
   `language_detection` on its own. System tools "are automatically included
   in the `tools` parameter of your chat completion requests", and "your
   custom LLM must support function calling to use system tools"
   ([Custom LLM][customllm]). Our `src/app/api/voice/el/chat/route.ts` ignores
   `body.tools` entirely and never emits a `tool_calls` delta. **So today the
   conversation language is pinned to `fr` for the entire call, no preset can
   ever fire, and `end_call` never fires either.** Fixing the route is a
   prerequisite for the voice switch, not an optimization.

Rejected alternatives, briefly:

- **Runtime override from `el/init`** (what we do now with `tts.voice_id`):
  overrides are supplied "at the start of each conversation"
  ([Overrides][overrides]). Conversation-start only. It cannot switch voice
  mid-call. **Confirmed: this path alone cannot solve the problem.** Worse, our
  init override is actively harmful here — see the code changes below.
- **Multi-voice support** (`conversation_config.tts.supported_voices`, up to 10
  voices, LLM picks one per utterance with `<LABEL>text</LABEL>` XML tags,
  [Multi-voice][multivoice]). This *would* work and we control the LLM, so we
  could emit the tags ourselves. But it makes voice a property of the *text*
  rather than the *conversation*, it leaks markup into every reply (and into
  our Supabase transcript unless stripped), and "the first use of each voice in
  a conversation may have slightly higher latency" ([Multi-voice][multivoice]).
  Keep it as fallback #2 if presets misbehave.
- **DTMF language menu.** See the assessment section — recommend against.

---

## Step-by-step: what the owner does in the ElevenLabs dashboard

Do these in order. Steps 1–3 are safe to do before the code change ships;
step 4 is the one that only matters once the code ships.

### 1. Pick and audition the English voice

Voice Library → filter **Female**, **English**, accent **American** (there is
now an accent facet; the API behind it is `GET /v1/voices/accents`, added
2026). Audition against a real Ana line, not the default sample:

> "Hi, this is Ana at Renovision. Is the water still running right now?"

Shortlist with IDs is at the bottom of this doc. Default pick: **Sarah**
(`EXAVITQu4vr4xnSDxMaL`). Add the chosen voice to the workspace ("Add to My
Voices") so it is selectable in the agent.

### 2. Confirm the agent's language list

Agent → **Agent** tab → **Language**: French (default). **Additional
Languages**: English must be listed. (It already is.) A preset can only exist
for a language in this list.

### 3. Create the English voice override (the language preset)

Agent → **Voice** tab → **Agent voice**. Under the voice picker there is the
prompt *"Want a language to speak with a different voice? Create a voice
override to change voice settings per language."* — click it. The docs call
this section **"Language-specific voice settings"** ([Language docs][lang]).

- Language: **English**
- Voice: the voice from step 1
- Model family: leave **Same as agent** unless step 5 of the latency list says
  otherwise
- Leave French with no override — French inherits the agent default (Melanie),
  which is correct.

Optionally set an English `first_message` on the same preset. **Do not bother**
— our `el/init` webhook already overrides `first_message` on every call, and
the call always opens in French anyway.

What this writes, for reference (this is the API shape; the dashboard is just
a form over it):

```json
{
  "conversation_config": {
    "agent": { "language": "fr" },
    "tts": { "voice_id": "tLK6fPv15M0oKv4V3ACR" },
    "language_presets": {
      "en": {
        "overrides": {
          "tts": { "voice_id": "EXAVITQu4vr4xnSDxMaL" }
        }
      }
    }
  }
}
```

### 4. Add the `language_detection` system tool

Agent → **Agent** tab → **Tools** → **Add tool** → it appears in the
pre-configured system-tool list. Leave the description blank to use the default
prompt ([Language detection][langdet]). (Check whether `end_call` is already
there too — same list, and it is equally non-functional until the route change
lands.)

### 5. Leave DTMF off

Settings → Advanced → **Enable DTMF input (Alpha)** stays **off**. Reasoning
below.

---

## Code changes required

All in `src/app/api/voice/el/`. Another agent owns these; this section is the
spec, not the patch.

### A. `src/app/api/voice/el/init/route.ts` — stop pinning the voice

Line 29 defines `VOICE_ID = "tLK6fPv15M0oKv4V3ACR"` and line 75 sends it as
`conversation_config_override.tts.voice_id` on **every** call. The file's own
comment says it: *"changing the agent's voice in the ElevenLabs dashboard alone
does nothing, because this response's tts.voice_id wins over it every time."*

Precedence between a conversation-start `tts.voice_id` override and a
mid-conversation `language_presets` override is **not documented**. Assume the
init override wins and would defeat the whole plan.

**Change:** delete the `tts` key from the `conversation_config_override`
object, and delete the now-unused `VOICE_ID` constant. Let the dashboard own
the French voice and the English preset own the English voice — one source of
truth. Keep `agent.first_message` and `agent.language` exactly as they are.

If the owner wants the French voice to stay code-controlled, the fallback is to
keep `tts.voice_id` but *also* prove on a real call that the `en` preset still
overrides it. Simpler to just remove it.

### B. `src/app/api/voice/el/chat/route.ts` — emit the `language_detection` tool call

This is the substantive change.

**What arrives.** When the tool is enabled, the POST body gains a `tools` array
in standard OpenAI function-calling format, including `language_detection` with
parameters `reason` (string) and `language` (string — a language code from the
agent's supported list) ([Language detection][langdet], [Custom LLM][customllm]).

**Where to hook it.** Lines 150–154 already do the detection:

```ts
const detected = detectLocale(spoken, locale);
if (detected !== locale) {
  locale = detected;
  if (callSid) await setCallLocale(callSid, locale).catch(() => {});
}
```

We do **not** need Claude to decide this. `detectLocale` already decides it,
deterministically, with no extra model round trip. When `detected !== locale`,
emit an OpenAI-shaped tool-call response instead of a text response:

```ts
// delta 1
{"choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[
  {"index":0,"id":"call_lang_1","type":"function",
   "function":{"name":"language_detection","arguments":""}}]},
  "finish_reason":null}]}
// delta 2 — arguments streamed as a JSON string
{"choices":[{"index":0,"delta":{"tool_calls":[
  {"index":0,"function":{"arguments":"{\"reason\":\"caller switched language\",\"language\":\"en\"}"}}]},
  "finish_reason":null}]}
// delta 3
{"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}
data: [DONE]
```

Reuse the existing `sseChunk()` helper — it already emits exactly this envelope
shape; only the `delta` contents change and `finish_reason` becomes
`"tool_calls"`.

**Then handle the callback.** ElevenLabs executes the tool and re-invokes our
endpoint with a `tool` role message appended. Our current code breaks here:
line 113 filters to `user`/`assistant` only, line 115 requires `last.role ===
"user"`, so `spoken` becomes `""` and line 128 emits `fallbackLine("fr")` — the
caller would hear a French fallback line at exactly the moment they switched to
English. **Must fix:**

- Detect the tool-result turn: the raw `messages` array's last element has
  `role === "tool"` (and/or the preceding assistant message carries
  `tool_calls`).
- In that case, take `spoken` from the **last `user` message** rather than the
  last message overall, and generate the reply normally with
  `locale = "en"`.
- Guard against a loop: on a tool-result turn, never emit another
  `language_detection` call, even if `detectLocale` still disagrees.

**Cost of this design:** one extra ElevenLabs↔us round trip on the single turn
where the language flips. At our current TTFB that is a few hundred ms, once
per call at most, and it buys a genuinely unaccented English voice.

**Optimization to test later (unverified):** OpenAI's format permits `content`
and `tool_calls` in the same assistant message. If ElevenLabs honours both, we
can stream the English reply *and* the language switch in one response and pay
zero extra round trips. Try it only after the two-round-trip version is proven
working.

### C. `src/lib/voice/locale.ts` — `detectLocale` becomes load-bearing

<sup>(It lived in `src/lib/voice/twiml.ts` when this was written; it has since
moved to its own module, since it has nothing to do with TwiML.)</sup>

It already exists and is already called, but until now a wrong answer only
affected which language Claude was *prompted* in. After this change a wrong
answer flips the caller's voice mid-sentence. Worth a review pass for the
Quebec case specifically: a French caller saying "OK, parfait, thank you" must
not trigger a switch. Consider requiring two consecutive turns in the new
language, or a minimum token count, before emitting the tool call. Do not let a
single English loanword flip the voice.

### D. Nothing changes in `el/completed/route.ts`.

---

## Latency: prioritized list

Target for natural conversation is **P50 under 800 ms, P95 under 1.5 s**
end-to-end ([ElevenLabs latency guide][latblog]). The budget breaks down as
endpointing/VAD 200–700 ms, ASR ~150 ms, LLM time-to-first-token (usually the
single largest contributor), TTS ~75 ms for Flash v2.5, network 20–200 ms,
player buffer up to ~500 ms ([latency guide][latblog], [latency
concepts][latconcepts]).

Ordered by expected win per unit of effort:

1. **Endpointing / turn-taking threshold — biggest single controllable knob
   (200–700 ms).** Agent → Advanced → turn-taking silence threshold. Guidance:
   "fine-tune the silence threshold to the smallest value that does not
   truncate your users' natural pauses" ([latency guide][latblog]). If the
   owner perceives a *pause after he stops talking*, this is almost certainly
   the cause, not the LLM. **Try this first — it is a slider, not a deploy.**

2. **Remove the serialized Supabase read before Claude starts.**
   `el/chat/route.ts` line 134 does `await getCallBySid(callSid)` before any
   token is requested from Claude. That is a full DB round trip added to
   time-to-first-token on *every* turn, and its only outputs are `call.locale`
   and `call.escalated_at` — both of which could be carried in
   `elevenlabs_extra_body` or derived from the message array we already
   receive. Start the Claude stream first; resolve the Supabase read in
   parallel. Likely 50–200 ms per turn, free.

3. **Pin the Vercel region.** `vercel.json` has no `regions` key, so the
   functions run in the project's default region. ElevenLabs routes to North
   America / Europe / Southeast Asia clusters, and network round-trip is
   "typically 20–200ms depending on geographic proximity"
   ([latency concepts][latconcepts]). Pin to `iad1` (US East) — closest to both
   Montreal and the likely ElevenLabs NA cluster — and measure.

4. **Confirm the TTS model family is Flash.** Flash v2.5 is ~75 ms inference,
   "2–4x faster than turbo and 5–8x faster than multilingual_v2"; it is "the
   model to use in an agent" ([latency guide][latblog], [latency
   concepts][latconcepts]). The setup notes say Flash is already selected —
   verify, and verify the **English preset** does not silently override the
   family to Multilingual (the per-voice model-family override defaults to
   "Same as agent"; leave it there).

5. **Check whether Melanie is a Professional Voice Clone.** "Default and
   synthetic voices are faster than cloned options. Instant Voice Clones (IVC)
   produce audio quicker than Professional Voice Clones (PVC)"; PVC carries
   "additional model complexity that adds per-generation overhead"
   ([latency concepts][latconcepts]). A community PVC could be costing tens of
   ms on every chunk. If so, a library default voice of similar character is
   strictly faster.

6. **We already stream token-by-token** (`replyToStream`), which is the big one
   and is done. `MAX_TOKENS = 200` is already tight. Haiku 4.5 is already the
   fast-path model. Not much left here — but note that the **escalated path
   swaps to Sonnet 4.6**, which will visibly slow the exact calls where the
   caller is already frustrated. Worth questioning.

7. **Buffer words, last resort.** ElevenLabs suggests returning an initial
   response ending with `"... "` (ellipsis then a space — "the extra space is
   crucial") to keep prosody natural while the LLM thinks
   ([Custom LLM][customllm]). This does not reduce latency, it disguises it.
   Only reach for it if 1–5 leave a gap the owner still dislikes.

8. **Audio player buffer / codec.** For telephony, `ulaw_8000` matches carrier
   expectations ([latency guide][latblog]). ElevenLabs' native Twilio
   integration should already do this; nothing for us to change unless a
   setting is exposed.

---

## English voice shortlist

All are ElevenLabs library default voices, so they are fast (no clone
overhead) and stable across model families. IDs verified against ElevenLabs
voice listings.

| Voice | Voice ID | Character | Fit |
|---|---|---|---|
| **Sarah** | `EXAVITQu4vr4xnSDxMaL` | Young-adult American female; confident, warm, professional | **Top pick.** Closest to Melanie's register — calm and composed rather than bright. Sounds like a competent person answering a business line. |
| **Matilda** | `XrExE9yKIg1WjnnlVkGX` | Middle-aged American female; friendly, professional, pleasing alto | **Strong second.** Slightly older and warmer; reads as more senior, which suits a restoration company. |
| **Aria** | `9BWtsMINqrJLrRacOk9x` | Middle-aged American female; expressive, husky | Warm and human, more personality. Risk: expressiveness can read as theatrical on a distress call. |
| **Laura** | `FGY2WhTYpPnrIDTdsKH5` | Young-adult American female; upbeat | Bright and energetic. Too upbeat for "your basement is flooding" — include only for the audition comparison. |
| **Jessica** | `cgSgspJ2msm6clMCkdW9` | Young American female; expressive, playful | Same caution as Laura, more so. Listed for completeness. |

Explicitly excluded: **Alice** (`Xb7hH8MSUJpSbSDYk0k2`) and **Lily**
(`pFZP5JQG7iQjIQuC4Bku`) are British; **Charlotte**
(`XB0fDUnXU5powFXDhCwa`) carries a Swedish accent. Any of these trades a French
accent for a different foreign accent — no gain.

There is no Canadian-specific female voice in the default library set. Neutral
North American is the right target; Montrealers do not hear standard American
English as foreign.

### Can Ana sound like the *same person* in both languages?

Not with library voices. Sarah and Melanie are different people and will sound
like different people — the caller who switches languages mid-call will notice
a handoff.

The only real path to a matched pair is **two Instant Voice Clones of one
genuinely bilingual Montreal speaker**: record her reading ~1–2 minutes of
French, clone it; record ~1–2 minutes of English, clone that. Two voice IDs,
one timbre, correct accent in each — which is precisely what the owner
described. This is the ideal outcome and it is achievable, but it needs a real
person and a recording session, and IVC voices are marginally slower than
library defaults ([latency concepts][latconcepts]).

**Suggested sequencing:** ship Sarah now (one dashboard field, solves the
accent complaint today), and treat the bilingual-clone pair as a later polish
pass if the voice handoff turns out to bother anyone. Nothing about the
architecture changes — it is the same two `voice_id` values in the same two
places.

---

## DTMF "press 1 for English": recommend against

**Do not build it. Keep automatic detection.** Reasons, in order of weight:

1. **The callers this business exists for cannot use a menu.** Burst pipe,
   flooding basement, water coming through a ceiling. That caller is holding a
   phone in one hand and a bucket in the other. Making them take the phone away
   from their ear, look at it, and press a key before anyone will listen is the
   worst possible first five seconds. Automatic detection costs them nothing —
   they just talk.

2. **French-first already handles ~90% of Laval correctly.** The menu exists to
   serve the minority case, but it taxes the majority case: every French caller
   also has to sit through it. A greeting that opens in French and simply
   *responds* in English when addressed in English serves both groups with zero
   friction for either.

3. **It solves a problem we don't have.** DTMF fixes *misdetection*. We have no
   evidence of misdetection — we have evidence of *the wrong voice*, which is a
   voice-configuration problem. Fix the voice; keep the detection.

4. **It is Alpha.** The toggle says so. An unproven feature on the critical path
   of a business phone line, for a UX that is worse anyway, is a bad trade.
   (Note also that ElevenLabs' documented DTMF tooling —
   `play_keypad_touch_tone` — is for the agent *sending* tones to navigate other
   IVRs, not for receiving caller keypresses. Inbound DTMF handling is the
   less-documented direction.)

5. **Cheaper alternative that gets 95% of the benefit:** make the opening line
   itself signal bilingualism, so the caller self-selects by simply answering.
   Something like *"Renovision, bonjour! How can I help you?"* — a French
   greeting followed by an English offer. The English speaker answers in
   English, `detectLocale` fires on turn one, the voice switches, and nobody
   pressed anything. This is a one-string change in `greeting()` in
   `src/lib/voice/agent.ts` (plus the matching `first_message` in `el/init`).

The one scenario that would change this answer: if real call logs show
`detectLocale` flipping the voice back and forth mid-call. That is a
detection-tuning problem (see code change C), and a keypad menu would be a
sledgehammer response to it.

---

## Unverified — confirm on the first real call

Ordered by how badly a wrong assumption hurts.

1. **Does a `language_presets` voice override actually beat a
   conversation-start `conversation_config_override.tts.voice_id`?** Not
   documented anywhere. Plan A assumes it does not need to, because change (A)
   removes our init override. If for some reason the init override must stay,
   test this explicitly.
2. **Does ElevenLabs accept a tool-call-only SSE response from a Custom LLM,
   with `finish_reason: "tool_calls"` and no `content`?** The docs say system
   tools are returned "in standard OpenAI format" but show no streamed
   `tool_calls` delta example. If it rejects it, fall back to multi-voice
   support (`supported_voices` + `<EN>…</EN>` tags emitted by our route).
3. **What exactly the tool-result turn looks like** when it comes back to
   `el/chat` — role, position in `messages`, whether the original user turn is
   still present. Code change B depends on this; log the raw body on the first
   switching call.
4. **Whether `content` + `tool_calls` in one response works** (the
   zero-extra-round-trip optimization). Test only after #2 passes.
5. **Whether `language_detection` needs to be declared overridable** in the
   Security tab, the way `first_message` / `language` / `voice_id` are. Nothing
   suggests it does, but our Security tab is already non-default.
6. **Whether Melanie is a PVC** (latency item 5). Check the voice's page in the
   library.
7. **Whether the English preset silently changes the TTS model family.** The
   language docs contain a note that additional languages move the agent to the
   v2.5 multilingual model while English stays on v2 — the wording is
   ambiguous about whether that is within the Flash family or across families.
   Confirm the English preset is still running Flash after configuration.
8. **`end_call` has almost certainly never fired** either, for the same
   root cause as the language tool. Not this document's job to fix, but worth
   confirming and filing.

---

[lang]: https://elevenlabs.io/docs/eleven-agents/customization/voice/customization/language
[langdet]: https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/language-detection
[customllm]: https://elevenlabs.io/docs/eleven-agents/customization/llm/custom-llm
[overrides]: https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides
[multivoice]: https://elevenlabs.io/docs/eleven-agents/customization/voice/multi-voice-support
[api-create]: https://elevenlabs.io/docs/api-reference/agents/create
[latblog]: https://elevenlabs.io/blog/voice-agent-latency-optimization
[latconcepts]: https://elevenlabs.io/docs/eleven-api/concepts/latency
