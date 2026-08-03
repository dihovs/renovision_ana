# Ana calling out: outbound calls, per-call context, structured outcomes

**Researched 2026-08-02** against the ElevenLabs docs as published that day
(API version `v1`, docs tree `elevenlabs.io/docs/eleven-agents/*` and
`elevenlabs.io/docs/api-reference/*`). Every JSON shape below is copied from
those pages, not paraphrased. Sources are listed at the bottom.

Read `Docs/Voice-ElevenLabs-Setup.md` first — this document assumes the
inbound setup described there (Custom LLM, three webhooks, imported Twilio
number) and only describes what changes.

---

## 0. The headline findings

Five things determine the whole design, and three of them are non-obvious:

1. **Outbound is one POST.** `POST /v1/convai/twilio/outbound-call` with
   `agent_id`, `agent_phone_number_id`, `to_number`. It returns **both** a
   `conversation_id` and a Twilio `callSid`. No websocket, no TwiML, nothing
   of ours held open — same as inbound.

2. **The conversation-initiation webhook is documented for INBOUND ONLY.**
   ElevenLabs' Twilio personalization page scopes it explicitly: *"When
   receiving inbound Twilio calls, you can dynamically fetch conversation
   initiation data through a webhook."* Nothing in the docs says it fires
   outbound, and it makes structural sense that it doesn't — the outbound
   endpoint takes `conversation_initiation_client_data` **directly in the
   request body**, which is the same payload the webhook would have returned.
   Design accordingly: **push the context at call-creation time, do not rely
   on `el/init` firing.** (Guard anyway — see §2.4.)

3. **`conversation_config_override.agent.prompt.prompt` is inert for us.**
   With a Custom LLM, ElevenLabs sends its system prompt to our endpoint as a
   `system` message, and `el/chat/route.ts` *discards it* and substitutes
   `systemPrompt()`. So overriding the prompt at call-creation time changes a
   string we throw away. **The outbound persona has to be chosen inside
   `el/chat`**, keyed off per-call data we round-trip ourselves. This is the
   single most important thing to understand before writing any code.
   (`first_message` is different — ElevenLabs speaks it directly without
   asking the LLM, so overriding *that* per call does work.)

4. **Voicemail detection is a system tool, which means it is OUR job.** The
   custom-LLM docs are explicit: all configured system tools — `end_call`,
   `language_detection`, `transfer_to_agent`, `transfer_to_number`,
   `skip_turn`, `voicemail_detection` — are passed to the custom LLM in the
   `tools` array and *the LLM decides when to invoke them*. ElevenLabs does
   not run them itself when a Custom LLM is configured. This is exactly the
   trap that pinned the language for a whole call before the
   `language_detection` fix (see `Voice-ElevenLabs-Setup.md`). Enabling
   voicemail detection in the dashboard and stopping there **will do nothing**.

5. **Structured outcomes are a first-class ElevenLabs feature.** Per-agent
   *data collection* fields (string/boolean/integer/number, LLM-extracted from
   the transcript) and *evaluation criteria* (success/failure/unknown with a
   rationale) both arrive in the post-call webhook under `data.analysis`. We
   do not have to parse the transcript ourselves — and shouldn't.

---

## 1. The outbound API

### 1.1 Twilio (the one we want)

```
POST https://api.elevenlabs.io/v1/convai/twilio/outbound-call
xi-api-key: <ELEVENLABS_API_KEY>
Content-Type: application/json
```

Full request body schema, from the API reference:

```json
{
  "agent_id": "string (required)",
  "agent_phone_number_id": "string (required)",
  "to_number": "string (required, E.164)",
  "call_recording_enabled": true,
  "conversation_initiation_client_data": {
    "conversation_config_override": {
      "asr": { "keywords": ["string"] },
      "turn": { "soft_timeout_config": { "message": "string" } },
      "tts": {
        "model_id": "string",
        "voice_id": "string",
        "stability": 0.0,
        "speed": 1.0,
        "similarity_boost": 0.0
      },
      "conversation": { "text_only": false },
      "agent": {
        "first_message": "string",
        "language": "string",
        "max_conversation_duration_message": "string",
        "prompt": {
          "prompt": "string",
          "llm": "string",
          "tool_ids": ["string"],
          "native_mcp_server_ids": ["string"],
          "knowledge_base": [
            { "type": "string", "name": "string", "id": "string", "usage_mode": "string" }
          ]
        }
      }
    },
    "custom_llm_extra_body": {},
    "user_id": "string | null",
    "source_info": { "source": "string", "version": "string" },
    "branch_id": "string | null",
    "environment": "string | null",
    "starting_workflow_node_id": "string | null",
    "dynamic_variables": {}
  },
  "telephony_call_config": {
    "ringing_timeout_secs": 60,
    "twilio_call_recording_enabled": false
  }
}
```

Response:

```json
{
  "success": true,
  "message": "Call initiated successfully",
  "conversation_id": "conv_abc123",
  "callSid": "CA1234567890abcdef"
}
```

`success`, `message`, `conversation_id`, `callSid` are all required keys in
the response schema; `conversation_id` and `callSid` are nullable (they are
`null` when `success` is `false`). Note the casing: `callSid`, camelCase, in
an otherwise snake_case API. Getting that wrong is a silent null.

**`agent_phone_number_id` is not the phone number.** Get it once from:

```
GET https://api.elevenlabs.io/v1/convai/phone-numbers
xi-api-key: <ELEVENLABS_API_KEY>
```

```json
[
  {
    "provider": "twilio",
    "phone_number": "+1234567890",
    "label": "Customer Support",
    "phone_number_id": "phone_123",
    "supports_inbound": true,
    "supports_outbound": true,
    "assigned_agent": {
      "agent_id": "string",
      "agent_name": "string",
      "environment": "string",
      "branch_id": "string"
    }
  }
]
```

Read `phone_number_id` off the row for our imported Twilio number and put it
in Vercel as `ELEVENLABS_PHONE_NUMBER_ID`. Do **not** look it up at dispatch
time — it never changes and a list call per outbound call is a wasted round
trip and a second thing that can 429.

Twilio numbers imported into ElevenLabs come in two flavours and the
capability flags tell you which: **purchased numbers** support inbound and
outbound; **verified caller IDs** support outbound only. Ours is purchased
(it answers inbound today), so `supports_outbound` should already be `true`.
Confirm it on the listing before writing dispatch code.

### 1.2 SIP trunk (for reference — we don't use it)

```
POST https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call
```

Identical required fields (`agent_id`, `agent_phone_number_id`, `to_number`)
and identical `conversation_initiation_client_data` / `telephony_call_config`.
Two differences:

- Response returns **`sip_call_id`** instead of `callSid`:
  ```json
  { "success": true, "message": "...", "conversation_id": "...", "sip_call_id": "..." }
  ```
- No `call_recording_enabled` (that flag is Twilio-only).

There is also an Exotel variant (`POST /v1/convai/exotel/outbound-call`, added
June 2026) with the same shape. Irrelevant here.

If the dispatcher is written to key on `conversation_id` and treat
`callSid`/`sip_call_id` as a secondary provider reference, swapping providers
later is a two-line change. Worth doing.

### 1.3 Batch calling — deliberately not used, but know it exists

```
POST https://api.elevenlabs.io/v1/convai/batch-calling/submit
```

```json
{
  "call_name": "string",
  "agent_id": "string",
  "agent_phone_number_id": "string",
  "recipients": [
    {
      "id": "string",
      "phone_number": "string",
      "conversation_initiation_client_data": { "...same shape as above..." }
    }
  ],
  "scheduled_time_unix": 0,
  "timezone": "string",
  "telephony_call_config": { "ringing_timeout_secs": 60, "twilio_call_recording_enabled": false },
  "target_concurrency_limit": 0
}
```

Response includes `status: "pending|in_progress|completed|failed|cancelled"`,
`total_calls_dispatched`, `total_calls_scheduled`, `total_calls_finished`,
and a `retry_count`.

**This partially invalidates the "ElevenLabs has no scheduler" assumption** —
`scheduled_time_unix` + `timezone` means ElevenLabs *can* hold a call until a
wall-clock time. See §8 for why we still shouldn't use it.

---

## 2. Per-call context

### 2.1 The three channels, and what each is actually for

| Channel | Where it lands | Use it for |
|---|---|---|
| `dynamic_variables` | Substituted into the dashboard prompt/first message as `{{var}}`; echoed back in the post-call webhook under `data.conversation_initiation_client_data.dynamic_variables` | **Correlation.** This is the only one guaranteed to survive to the post-call webhook. |
| `custom_llm_extra_body` | Arrives in every Custom LLM request as the top-level `elevenlabs_extra_body` object | **The call's brief.** Who we're calling, why, what to confirm. This is the channel that actually reaches Claude. |
| `conversation_config_override` | Applied to the ElevenLabs-side agent config for this call | **`first_message` and `language` only.** `agent.prompt.prompt` is discarded by `el/chat`. |

Send the same correlation id through **all three** — belt and braces costs
nothing and the inbound experience already proved that "where exactly does
this key land" is the flakiest part of this integration.

**Overrides must be pre-authorised.** Anything under
`conversation_config_override` is silently ignored unless the corresponding
toggle is on in the agent's **Security** tab (or
`platform_settings.overrides.conversation_config_override.*` = `true` via the
API). `first_message` and `language` are already enabled on the inbound agent
per the setup doc; a new outbound agent needs them enabled again, plus
**Custom LLM extra body**. From the overrides doc: *"Omit any fields you don't
want to override rather than setting them to empty strings or null values."*

**System dynamic variables cannot be sent.** Anything prefixed `system__` is
reserved and rejected in the client-initiation payload. They are populated by
ElevenLabs and are readable: `system__caller_id`, `system__called_number`,
`system__call_sid` (Twilio only), `system__conversation_id`,
`system__call_duration_secs`, `system__time_utc`, `system__agent_id`,
`system__agent_turns`, and others. There is **no `system__call_direction`** —
direction is not exposed as a dynamic variable, only in the conversation
metadata (`metadata.phone_call.direction`, which we see post-call, not
during).

### 2.2 The concrete dispatch payload we should send

```json
{
  "agent_id": "agent_<OUTBOUND_AGENT_ID>",
  "agent_phone_number_id": "phone_<...>",
  "to_number": "+15145550188",
  "call_recording_enabled": false,
  "telephony_call_config": {
    "ringing_timeout_secs": 30,
    "twilio_call_recording_enabled": false
  },
  "conversation_initiation_client_data": {
    "conversation_config_override": {
      "agent": {
        "first_message": "Bonjour, est-ce que je parle à Madame Tremblay? Ici Ana, de Renovision AnA.",
        "language": "fr"
      }
    },
    "custom_llm_extra_body": {
      "mode": "outbound",
      "call_sid": "task_9f2c1ab74e6d4f0e9b3a5c8d10e2f7a4",
      "task_id": "9f2c1ab7-4e6d-4f0e-9b3a-5c8d10e2f7a4",
      "contact_name": "Madame Tremblay",
      "objective": "confirmer la visite de demain à neuf heures",
      "locale": "fr",
      "facts": {
        "appointment_at": "2026-08-03T09:00:00-04:00",
        "address": "1240 rue Saint-Denis, Montréal"
      }
    },
    "dynamic_variables": {
      "call_sid": "task_9f2c1ab74e6d4f0e9b3a5c8d10e2f7a4",
      "task_id": "9f2c1ab7-4e6d-4f0e-9b3a-5c8d10e2f7a4",
      "contact_name": "Madame Tremblay",
      "appointment_time": "neuf heures demain matin"
    }
  }
}
```

Two deliberate choices in there:

- **`ringing_timeout_secs: 30`, not the 60 default.** Sixty seconds of ringing
  on a Quebec mobile lands in voicemail long before it times out; thirty gets
  the no-answer verdict back to the queue a half-minute sooner and costs
  nothing real.
- **`dynamic_variables.contact_name` / `appointment_time`** are there so the
  *voicemail message* configured on the agent can interpolate them —
  ElevenLabs' voicemail-detection tool supports a custom message with
  `{{variable}}` placeholders, and that message is rendered by ElevenLabs, not
  by us, so it can only see dynamic variables.

### 2.3 The correlation id trick

`calls.call_sid` is `text unique` and every existing code path — `startCall`,
`appendTurns`, `endCall`, `extractCallSid` in both `el/chat` and
`el/completed` — is keyed on it. For inbound, Twilio supplies it before the
conversation begins. For outbound we do not learn the real `callSid` until
*after* the POST returns, which is after `conversation_initiation_client_data`
has already been sent.

So **generate the key ourselves**: `task_<uuid-with-dashes-stripped>`, stored
on the task row as `correlation_id`, inserted as `calls.call_sid` before
dispatch, and passed in `custom_llm_extra_body.call_sid` /
`dynamic_variables.call_sid`. The `task_` prefix makes it unmistakable in the
database that this is not a Twilio SID. The real Twilio `callSid` and the
ElevenLabs `conversation_id` are written to *separate columns* on both the
task and the call row once the POST returns.

The payoff: `el/chat` and `el/completed` need **zero changes to their
extraction logic**, and there is no per-turn Supabase lookup to resolve a
task id into a call key.

### 2.4 Does `el/init` fire for outbound? Defend against both answers.

Documented answer: no — inbound only. But this is exactly the kind of thing
the docs under-specify, and if it *does* fire, `el/init` would today:

- read `body.caller_id` (which for an outbound call is either our own number
  or absent), look it up with `callerLocale()`, and get the wrong locale;
- call `startCall()` with the ElevenLabs-supplied Twilio SID, creating a
  **second** `calls` row for a conversation that already has one;
- return `first_message: greeting(...)` — the *receptionist's* greeting — which
  would **override** the outbound `first_message` we sent at dispatch,
  because the webhook response is applied after the API payload.

That last one is the dangerous failure: Ana would ring Madame Tremblay and
open with "Renovision AnA, comment puis-je vous aider?". So guard it, cheaply.

**Primary guard: a second agent** (see §3). If outbound runs on
`agent_outbound_*`, the conversation-initiation webhook is configured
per-agent — point the outbound agent at **no** initiation webhook at all, and
the question is closed by construction.

**Belt-and-braces guard in code**, in case someone later points both agents at
the same URL: `el/init` should bail out early when the payload is not an
inbound customer call.

```ts
// src/app/api/voice/el/init/route.ts
const INBOUND_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;      // agent_6801kz0da1ygfkt9ds7yc90btqxr
const OUTBOUND_AGENT_ID = process.env.ELEVENLABS_OUTBOUND_AGENT_ID;

const agentId: string | undefined = body?.agent_id;
if (OUTBOUND_AGENT_ID && agentId === OUTBOUND_AGENT_ID) {
  // Outbound already carried its own first_message and context at dispatch.
  // Returning anything here would overwrite it with the receptionist greeting.
  return Response.json({ type: "conversation_initiation_client_data" });
}
```

Returning the bare envelope with no `conversation_config_override` is the
documented no-op ("omit any fields you don't want to override").

A weaker fallback discriminator, if `agent_id` ever turns out to be absent:
`body.called_number` equals our own Twilio number for inbound and the
*customer's* number for outbound. Don't rely on it as the primary check.

---

## 3. A different persona for outbound — recommendation

**Recommendation: a second ElevenLabs agent ("Ana — appels sortants"), and the
persona itself selected inside `el/chat` from `elevenlabs_extra_body.mode`.**

Not "a second agent *or* an override" — both, because they do different jobs.
The second agent is a *configuration* boundary; the mode flag is what actually
changes what Ana says.

### Why not just override the prompt at call-creation time

Because it does nothing. `el/chat/route.ts` builds its own system message from
`systemPrompt()` in `src/lib/voice/agent.ts` and drops whatever ElevenLabs
sent. `conversation_config_override.agent.prompt.prompt` would have to be
plumbed through — read out of the request, trusted, and substituted — and that
means a string sent over the wire becomes the agent's instructions. For a
prompt that's already in our codebase, that's strictly worse than a boolean.

### Why a second agent rather than one agent for both directions

1. **Analysis config is per-agent.** The whole of §4 — data collection fields
   and evaluation criteria — is agent-level. `did_human_answer`,
   `outcome`, `confirmed_time` are meaningless on an inbound enquiry; running
   them against every inbound call produces `unknown` on every row, burns
   analysis budget, and clutters the conversation history. Limits are 25 data
   collection items per agent (40 on Trial/Enterprise) and 30 evaluation
   criteria per agent, so they're shared budgets too.
2. **`voicemail_detection` is a per-agent tool toggle**, and only means
   anything outbound.
3. **It closes the `el/init` question by construction** (§2.4) — the
   initiation webhook is configured per-agent.
4. **`agent_id` becomes a free, always-present direction discriminator** in
   both the chat request and the post-call webhook.
5. **Blast radius.** The inbound agent answers the business line. Iterating on
   outbound persona, voicemail scripts, and analysis fields should not be able
   to break the thing customers call.

The usual cost of a second agent — config drift — is unusually low here,
because with a Custom LLM almost nothing lives in the dashboard. The two
agents share the same Custom LLM URL, the same secret, the same two voices.
What differs is exactly what *should* differ: tools, analysis, first message,
initiation webhook.

### What the mode flag drives

In `src/lib/voice/agent.ts`, add an `outboundSystemPrompt(locale, brief)`
alongside `systemPrompt()` and `ownerSystemPrompt()`. Its shape is different
in kind from the receptionist's, not just in tone:

- Ana states who she is and why she is calling in the first two sentences.
- She has **one objective**, supplied per call, and does not take enquiries.
  ("If they ask about a quote, tell them the estimator will call — do not
  quote, do not book new work.")
- She confirms understanding out loud before ending, so the transcript
  contains an unambiguous sentence for the analysis LLM to score.
- She ends the call herself (`end_call`) rather than waiting to be hung up on.
- Explicitly: **never leave a message with a third party.** "Is this Madame
  Tremblay?" — if no, ask when to call back and end.
- The pricing guardrail from the receptionist prompt carries over verbatim.

The owner-mode fork in `el/chat` stays untouched. Outbound is a third branch,
not a variation of either existing one, and `mode === "outbound"` should also
force `ownerToolsFor()` to return `[]` — an outbound call must never be able
to reach the CRM tools, whatever number it happens to be dialling. (Consider:
if the owner queues a call to *his own* number, `caller_phone` is absent on
outbound but the number he's calling is on `OWNER_PHONE_NUMBERS`. Make sure
`extractCallerPhone()` cannot pick up the *destination* number on an outbound
call — today it reads `dynamic_variables.caller_phone`, which we simply must
not set for outbound. Assert it rather than assume it.)

---

## 4. Structured outcomes — the important one

### 4.1 Data collection: define the fields, get them back typed

Configured per agent under **Analysis → Data collection**. Each item is an
identifier, a data type (`string` | `boolean` | `integer` | `number`), and a
description that is the extraction prompt for ElevenLabs' analysis LLM. It
runs after the call, over the transcript, independently of our Custom LLM.

Limits: 25 items per agent (40 on Trial and Enterprise).

They arrive in the post-call webhook at `data.analysis.data_collection_results`,
keyed by identifier. The exact shape, from the conversation API reference:

```json
"data_collection_results": {
  "collection_001": {
    "data_collection_id": "collection_001",
    "value": "collected_value",
    "json_schema": {
      "type": "string",
      "description": "A field description",
      "enum": null,
      "is_system_provided": false,
      "dynamic_variable": "",
      "allowed_values_dynamic_variable": "",
      "constant_value": "",
      "is_omitted": false
    },
    "rationale": "Why this value was collected"
  }
}
```

There is also a `data_collection_results_list` array with the same objects, if
order matters. Note `json_schema.enum` — the type supports an enumeration, so
`outcome` can be constrained to a fixed vocabulary rather than free text.
**Use it.** An LLM asked for "the outcome" will invent "customer confirmed but
seemed hesitant"; an LLM given an enum returns one of your values.

**Recommended fields on the outbound agent:**

| Identifier | Type | Description (the extraction prompt) |
|---|---|---|
| `human_answered` | boolean | True only if a live person spoke. False for voicemail, automated systems, or a call where nobody said anything. |
| `reached_intended_person` | boolean | True only if the person who spoke confirmed they are the person we asked for by name. False if a family member, colleague, or wrong number. |
| `outcome` | string (enum: `confirmed`, `declined`, `rescheduled`, `callback_requested`, `wrong_number`, `voicemail`, `no_contact`, `unclear`) | The single outcome of the call's objective. `confirmed` only if the person explicitly agreed. `unclear` if the transcript does not settle it — do not guess. |
| `reschedule_requested_time` | string | If they asked to move the appointment, the new time in their own words, otherwise empty. |
| `callback_number` | string | A different number they gave to be reached on, in digits, otherwise empty. |
| `customer_note` | string | Anything they said the business needs to know, in one sentence, in the language they spoke. Empty if nothing. |

Six fields, well inside the limit, and `outcome` alone answers the owner's
actual question.

### 4.2 Evaluation criteria: did the call do its job

Also per agent, under **Analysis → Evaluation criteria**. Each is an
identifier plus a prompt; the result is `success` / `failure` / `unknown` with
a rationale. Limit 30 per agent. `unknown` is documented as the answer for
incomplete conversations, ambiguous responses, or missing information — which
is precisely what a voicemail or a two-second hangup produces, so it is a
useful signal rather than an annoyance.

```json
"evaluation_criteria_results": {
  "criteria_001": {
    "criteria_id": "criteria_001",
    "result": "success",
    "rationale": "Criteria was met",
    "scoring_mode": "binary",
    "score": null,
    "max_score": null
  }
}
```

There is a `scoring_mode` of `binary` or `numeric_uniform` with `score` /
`max_score` for graded criteria; binary is right for us. The aggregate lands
alongside as `analysis.call_successful` (`"success"`) and
`analysis.call_success_score`.

**Recommended criteria (two, no more):**

- `objective_stated` — "Did the agent clearly state who she was calling from
  and why, within the first three turns?" (This is a *prompt-quality* check.
  It's how you find out the persona is drifting without listening to calls.)
- `objective_resolved` — "Did the call reach a definite answer on its stated
  objective — an explicit yes, an explicit no, or an agreed new time?"

`transcript_summary` and `call_summary_title` come back for free in the same
`analysis` object and are worth storing on the call row.

### 4.3 Voicemail / answering-machine detection

There are two mechanisms and they answer different questions. **Use both.**

**(a) ElevenLabs' `voicemail_detection` system tool — the primary one.**
Enable it under the outbound agent's **Tools → System tools**. Its schema:

```json
{
  "type": "function",
  "function": {
    "name": "voicemail_detection",
    "parameters": {
      "type": "object",
      "properties": {
        "reason": { "type": "string" }
      },
      "required": ["reason"]
    }
  }
}
```

and the agent-config form is:

```json
{ "type": "system", "name": "voicemail_detection", "description": "" }
```

On invocation, ElevenLabs either plays a configured voicemail message (which
supports `{{dynamic_variable}}` interpolation) or terminates immediately, and
the call is ended automatically. Usage shows up in the conversation metadata
as `metadata.features_usage.voicemail_detection: { enabled, used }` — which is
the cleanest machine-readable "this was voicemail" signal available, and it
comes back on the conversation object.

**Because we run a Custom LLM, ElevenLabs will not invoke this tool for us.**
`el/chat` must emit it, exactly as it already emits `language_detection`:

```ts
send(sseChunk({
  role: "assistant",
  tool_calls: [{
    index: 0,
    id: `call_vm_${Date.now()}`,
    type: "function",
    function: { name: "voicemail_detection", arguments: "" },
  }],
}));
send(sseChunk({
  tool_calls: [{
    index: 0,
    function: {
      arguments: JSON.stringify({ reason: "automated greeting, asked to leave a message" }),
    },
  }],
}));
send(sseChunk({}, "tool_calls"));
send("data: [DONE]\n\n");
```

The decision of *when* is a small pure function — call it
`looksLikeVoicemail(text, turnIndex)` in a new `src/lib/voice/voicemail.ts`,
unit-tested like `locale.ts` and `escalation.ts` are. It should only fire on
the **first one or two turns** (a voicemail greeting is the opening of the
call, never turn nine) and match, in French and English: "laissez un message",
"après le bip"/"après la tonalité", "boîte vocale", "n'est pas disponible",
"leave a message", "after the tone/beep", "is not available", "you have
reached", plus the giveaway structural signal — a long single first utterance
with no pause, arriving before Ana has been answered. Keep the bar
conservative: a false positive hangs up on a real customer, which is much
worse than leaving a message on a human's answering service.

Belt and braces: `voicemail_detection` should also be listed in the
system-prompt instructions so Sonnet/Haiku can reach for it in cases the
heuristic misses — but the heuristic is what makes it reliable, because the
Custom LLM's own tool-calling is not currently wired for anything except
`language_detection`.

**(b) Twilio AMD — not applicable, don't reach for it.** Twilio's
`machine_detection` is a parameter of `POST /Calls` on Twilio's own API. In
the native integration, *ElevenLabs* places the call through the Twilio
credentials we handed it; we never touch Twilio's Calls API, and the
ElevenLabs outbound endpoint exposes no AMD parameter (only
`ringing_timeout_secs` and recording flags). AMD would only become available
via the "register call" flow, where you dial with your own Twilio client and
then register the leg with ElevenLabs — which would mean giving up the native
integration and re-introducing infrastructure. Not worth it for a signal the
system tool already provides.

**(c) The negative signal worth knowing:** the `call_initiation_failure`
webhook is explicitly **not** sent when a call reaches voicemail, because from
the telephony layer's point of view the call connected successfully. So
"voicemail" and "answered by a human" are indistinguishable at the initiation
layer — the distinction only exists in the transcript and the
`voicemail_detection` tool. That's why (a) matters.

### 4.4 Mapping analysis onto our task outcome

Resolve in this order, first match wins:

1. `call_initiation_failure` webhook → `busy` / `no-answer` / `unknown`.
2. `metadata.features_usage.voicemail_detection.used === true`, or
   `data_collection_results.outcome.value === "voicemail"`, or
   `human_answered.value === false` → `voicemail`.
3. `data_collection_results.outcome.value` → straight through.
4. Nothing usable (no analysis, empty transcript) → `unclear`, and let the
   owner read the transcript.

Never infer an outcome from the transcript in our own code. Two LLMs
disagreeing about whether Madame Tremblay confirmed is a bug nobody can
debug; one LLM with a typed enum is a field you can trust or ignore.

---

## 5. The post-call webhook for outbound

**Same webhook, same endpoint, same payload shape.** Post-call webhooks are
configured at workspace level in ElevenAgents settings and apply to all
agents, and individual agents can override with an agent-specific webhook
config. Recommendation: **leave it workspace-level and route both directions
into `el/completed`** — the payload carries `agent_id`, so one endpoint can
fork, and one HMAC secret is one thing to rotate.

The documented `post_call_transcription` payload:

```json
{
  "type": "post_call_transcription",
  "event_timestamp": 1739537297,
  "data": {
    "agent_id": "xyz",
    "conversation_id": "abc",
    "status": "done",
    "user_id": "user123",
    "transcript": [
      {
        "role": "agent",
        "message": "Hey there angelo. How are you?",
        "tool_calls": null,
        "tool_results": null,
        "feedback": null,
        "time_in_call_secs": 0,
        "conversation_turn_metrics": null
      }
    ],
    "metadata": {
      "start_time_unix_secs": 1739537297,
      "call_duration_secs": 22,
      "cost": 296,
      "deletion_settings": { "...": "..." },
      "feedback": { "overall_score": null, "likes": 0, "dislikes": 0 },
      "authorization_method": "authorization_header",
      "charging": { "dev_discount": true },
      "termination_reason": ""
    },
    "analysis": {
      "evaluation_criteria_results": {},
      "data_collection_results": {},
      "call_successful": "success",
      "transcript_summary": "The conversation begins with..."
    },
    "conversation_initiation_client_data": {
      "conversation_config_override": {
        "agent": { "prompt": null, "first_message": null, "language": "en" },
        "tts": { "voice_id": null }
      },
      "custom_llm_extra_body": {},
      "dynamic_variables": { "user_name": "angelo" },
      "branch_id": null,
      "environment": null
    }
  }
}
```

The richer conversation object (same `analysis` and `metadata` shape, fetched
via `GET /v1/convai/conversations/{conversation_id}`) additionally carries:

```json
"metadata": {
  "phone_call": {
    "type": "twilio",
    "direction": "inbound",
    "phone_number_id": "pn_123",
    "agent_number": "+1234567890",
    "external_number": "+0987654321",
    "stream_sid": "stream_sid_value",
    "call_sid": "call_sid_value"
  },
  "batch_call": null,
  "error": null,
  "warnings": [],
  "features_usage": {
    "voicemail_detection": { "enabled": false, "used": false },
    "language_detection": { "enabled": false, "used": false }
  }
}
```

`metadata.phone_call.direction` is `"inbound"` | `"outbound"` and
`features_usage.voicemail_detection.used` is the voicemail flag. **Whether
these two appear in the *webhook's* metadata or only on the conversation
object is unverified** — the documented webhook example is an older,
thinner sample. If they're missing, one `GET /v1/convai/conversations/{id}`
inside `el/completed` fills the gap, and that call is off the hot path
(the customer has already hung up).

`status` enum on the conversation: `initiated`, `in-progress`, `processing`,
`done`, `failed`. `el/completed` currently maps anything other than `"done"`
to `failed`, which stays correct.

### 5.1 What round-trips reliably

**`dynamic_variables`.** They come back at
`data.conversation_initiation_client_data.dynamic_variables`. Note the
nesting: `el/completed`'s `extractCallSid()` checks `data.dynamic_variables`
first and the nested path second — the *nested* path is the documented one, so
the fallback is doing the real work. Leave both; document which one fires
after the first outbound call.

`custom_llm_extra_body` is also echoed in the same object, giving a second
path to the correlation id, and `data.conversation_id` gives a third.

Historical note worth keeping: on 2026-02-10 ElevenLabs shipped a regression
that **dropped `conversation_id` from the post-call webhook** for about four
hours, and their own workaround was to read
`conversation_initiation_client_data.dynamic_variables.system__conversation_id`.
Two useful facts fall out of that: `system__*` variables *are* present in the
echoed `dynamic_variables`, and correlating on `conversation_id` alone is not
bulletproof. Our own `task_*` correlation id in `dynamic_variables` is the
resilient key.

### 5.2 Webhook delivery semantics

- Must return **200**; anything else counts as a failure.
- **Auto-disabled after 10 or more consecutive failures** when the last
  success was over 7 days ago (or never). This is the failure mode that
  silently kills the whole feature — if `el/completed` starts 500ing, the
  webhook turns itself off and transcripts stop arriving with no error
  anywhere on our side. `el/completed` already returns 200 on malformed
  bodies and swallows Supabase errors, which is exactly right; keep that
  property when adding outbound handling.
- HMAC: `ElevenLabs-Signature: t=<unix>,v0=<hex>`, signed payload
  `${timestamp}.${rawBody}`. Already implemented correctly in `el/completed`.
- No retries at all under HIPAA mode (not our configuration, but note it).

---

## 6. Failure modes

| Situation | What we observe | Retryable |
|---|---|---|
| Bad `agent_id` / `to_number` / missing `agent_phone_number_id` | Non-2xx from `POST .../outbound-call`, or `{"success": false, "message": "...", "conversation_id": null, "callSid": null}` | **No.** Config or data error. Fail the task, surface the message. |
| Rate/concurrency limit | HTTP **429**, body error code `rate_limit_exceeded` or `concurrent_limit_exceeded` | **Yes**, with exponential backoff. Not an attempt — don't increment `attempts`. |
| Line busy | `call_initiation_failure` webhook, `failure_reason: "busy"`. Twilio metadata: `CallStatus: "busy"`, `SipResponseCode: "486"` | **Yes.** Short backoff (~15 min). |
| No answer / rang out | `call_initiation_failure`, `failure_reason: "no-answer"` (also covers the recipient declining) | **Yes.** Longer backoff (~2 h), fewer attempts. |
| Other connection failure | `call_initiation_failure`, `failure_reason: "unknown"` | **Yes**, once. |
| Invalid / disconnected number | Most often surfaces as `call_initiation_failure` with a SIP code in `metadata.body.sip_status_code` (e.g. 404, 484, 603) or Twilio `CallStatus: "failed"` | **No** on 404/484/603 — a number that doesn't exist won't start existing. Mark `wrong_number`. |
| Reached voicemail | **No** initiation-failure webhook — the call connected. A normal `post_call_transcription` arrives; `voicemail_detection` used and/or `outcome: "voicemail"` | Depends: retry once at a different hour if a message was *not* left; don't retry if it was. |
| Customer hangs up immediately | Normal `post_call_transcription`, `status: "done"`, tiny `call_duration_secs`, one-or-zero-turn transcript, analysis mostly `unknown` | **Once.** Guard on `call_duration_secs < 5 && transcript.length <= 1` — the existing `calls` table already has several such 1-second rows from ElevenLabs history, so this shape is real. |
| Our `el/chat` 500s mid-call | ElevenLabs falls back to the agent's **backup LLM** (this is why the stale dashboard prompt matters). Call completes but Ana is off-script | **No** auto-retry — flag for the owner. Detectable if the transcript has turns our Supabase row doesn't. |
| `el/completed` never arrives | Task sits in `dialing`/`in_progress` forever | The **lease sweep** in §7 is the only backstop. Mandatory, not optional. |

The two failure-reason enums to code against:

```
failure_reason ∈ { "busy", "no-answer", "unknown" }
```

Note the hyphen in `"no-answer"` (Twilio's spelling), not `no_answer`.

Both webhook types hit the **same endpoint**, so `el/completed` must fork on
`payload.type`:

```ts
if (payload.type === "post_call_transcription") { /* existing path + outcome mapping */ }
else if (payload.type === "call_initiation_failure") { /* requeue or fail the task */ }
else if (payload.type === "post_call_audio") { return new Response("", { status: 200 }); }
else { return new Response("", { status: 200 }); }
```

Today the route returns 200 and drops anything that isn't
`post_call_transcription`, which means `call_initiation_failure` events are
already being silently discarded if that event type is enabled. That's the
single most important edit in `el/completed`.

**How to retry properly.** Never call the outbound endpoint twice for one
attempt: there is no idempotency key on this API, and a duplicate POST is a
duplicate ring on a customer's phone. Retry means *a new attempt on the task
row*, guarded by:

- `attempts < max_attempts` (default 3),
- `not_before` pushed out by the backoff for that failure class,
- a **claim** (`status = 'dialing'`, `lease_until = now() + 5 min`) taken with
  a conditional update *before* the POST, so two overlapping cron runs cannot
  both dial,
- calling-hours and per-day caps checked at claim time, not at queue time.

---

## 7. Concurrency, rate limits, cost

**Concurrent calls, by plan** (ElevenAgents pricing page, Aug 2026): Free 4,
Starter 6, Creator 10, Pro 20, Scale 30, Business 40. We are on **Starter
($6/mo, 75 included minutes) → 6 concurrent calls.** That budget is shared
with inbound. Reserve headroom: **cap outbound at 2 simultaneous** so a
customer calling in is never the call that gets turned away.

**Rate limits are concurrency, not requests-per-minute.** ElevenLabs' own
guidance is that voice rate limiting is concurrency control rather than RPM
counting. A 429 carries `rate_limit_exceeded` (too many requests) or
`concurrent_limit_exceeded` (too many simultaneous). Handle both with
exponential backoff; only the second is a reason to stop dispatching for the
rest of the cron run.

**Burst pricing** exists — up to 3× the concurrency limit, charged at double
rate ($0.16/min instead of $0.08/min). Leave it **off**: for a queue that has
all day to drain, paying double to avoid waiting five minutes is a bad trade,
and it turns a runaway loop into a runaway bill.

**Cost per outbound minute, all-in:**

| Component | Rate |
|---|---|
| ElevenLabs agent minutes | $0.08/min after the 75 included (Starter) |
| LLM (Claude via our Custom LLM) | Billed by Anthropic, not ElevenLabs — Haiku 4.5 on short calls is fractions of a cent |
| Twilio outbound (CA/US) | Billed by Twilio at cost, roughly $0.013–0.014/min |

**≈ $0.095/min**, so a 90-second confirmation call is about **15 cents**. Even
at fifty calls a month that is under $8, and the 75 included minutes cover the
first ~50 such calls outright. Cost is not a constraint here; the constraint
is that every one of these calls is a real phone ringing in someone's kitchen.

---

## 8. Scheduling

**Partially wrong assumption — correct it.** ElevenLabs has no general
scheduler for single calls (the `POST .../twilio/outbound-call` endpoint fires
immediately; there is no `send_at`), **but batch calling does**:
`scheduled_time_unix` plus `timezone` on `POST /v1/convai/batch-calling/submit`
will hold a batch until a wall-clock time, and `target_concurrency_limit`
throttles it.

**Still recommend Supabase queue + Vercel Cron.** Reasons, in order of weight:

1. **The queue is a CRM object.** The owner needs to see "you asked me to call
   Madame Tremblay, here's what happened" in `/admin`, alongside the
   transcript. A batch call is a black box in someone else's dashboard.
2. **Retries with per-failure-class backoff.** Batch calling exposes a
   `retry_count` in its status but no documented retry *policy* we can
   configure; our rules (§6) are the whole value of the feature.
3. **Cancellation and edit.** The owner changes his mind; the appointment
   moves. A row we own is trivially cancellable — a submitted batch is not
   documented to be.
4. **Calling hours and daily caps** are business rules that belong next to the
   business data.
5. **We already run Vercel Cron** (`vercel.json`, two jobs) with a
   `CRON_SECRET` convention and a house pattern in
   `src/app/api/cron/followups/route.ts`. Adding a third is ~40 lines.

Where batch calling *would* win: a hundred-recipient campaign. That is not
this feature and may never be.

**Cron cadence.** `*/10 * * * *` — every ten minutes. Vercel's Hobby plan
allows only daily crons; **Pro is required for sub-daily schedules**, and the
project already runs two dailies, so confirm the plan before assuming
`*/10` will be accepted. If it isn't, a daily drain at, say, 12:00 UTC (8am
Montreal) still works for "confirm tomorrow's visit" — it just makes
"call her back in an hour" impossible. Worth checking early; it's the one
external constraint that could reshape the feature.

---

## 9. Recommended architecture, end to end

### The flow, numbered

1. **The owner dictates.** He calls the business line, authenticates with
   number + PIN (unchanged, `src/lib/voice/owner.ts`), and says *"call Madame
   Tremblay and confirm her visit tomorrow at nine."*

2. **Ana captures it as a call task.** A new owner tool `schedule_call` in
   `src/lib/voice/ownerTools.ts` resolves the name against clients/leads,
   reads back the number it found, and inserts a `call_tasks` row with
   `status = 'pending_approval'`, `correlation_id = 'task_' || <uuid>`,
   `objective` in the owner's own words, `not_before` from any time he named.
   Ana repeats the whole thing back — number included — before saving.

3. **The owner releases it.** `/admin/tasks` (or a new `/admin/callouts`)
   shows pending call tasks with a single **Call** button that flips
   `pending_approval → queued`. **See §10 — this gate is deliberate.**

4. **Cron drains the queue.** `GET /api/cron/outbound` every 10 minutes,
   `CRON_SECRET`-gated like the others. It selects `queued` tasks where
   `not_before <= now()`, the Montreal local hour is within 08:00–20:00, and
   fewer than `OUTBOUND_MAX_CONCURRENT` (2) tasks are currently `dialing` or
   `in_progress`.

5. **Claim, then dial.** For each task: conditional update to
   `status='dialing', attempts=attempts+1, lease_until=now()+interval '5 minutes'`
   with `where status='queued'` (the `UPDATE ... RETURNING` is the lock — if
   zero rows come back, another run got it). Insert the `calls` row via
   `startCall({ callSid: correlation_id, from: OUR_NUMBER, to: to_number,
   locale })`. Then POST the ElevenLabs endpoint with the §2.2 payload.

6. **Record what came back.** Write `el_conversation_id` and
   `provider_call_sid` onto the task and the call row. On a non-2xx or
   `success: false`, apply §6's retry rules immediately.

7. **Ana speaks.** ElevenLabs dials. `el/chat` is hit per turn with
   `elevenlabs_extra_body.mode === "outbound"` and the brief; it takes the
   outbound branch, uses `outboundSystemPrompt()`, disables owner tools,
   watches for voicemail, and writes the transcript to the same `calls` row
   the whole time — because `call_sid` is our correlation id.

8. **The call ends.** Post-call webhook → `el/completed` → existing
   `endCall()` closes the transcript, **plus** new code maps
   `data.analysis` onto `call_tasks.outcome` / `outcome_data` and sets
   `status = 'completed'`.

9. **Or it never connects.** `call_initiation_failure` → same endpoint →
   `busy` / `no-answer` / `unknown` → requeue with backoff if
   `attempts < max_attempts`, else `status='failed'`, `outcome='unreachable'`.

10. **The owner sees it.** `/admin` shows the task with its outcome badge and
    a link to the transcript. Next time he calls in, `business_snapshot`
    includes a line: *"Two callouts done since yesterday: one confirmed, one
    went to voicemail."*

### Schema sketch — `supabase/migrations/0018_call_tasks.sql`

House style: run by hand in the Supabase SQL editor, degrade gracefully until
it is (see `MigrationPendingError` in `src/lib/crm/db.ts`).

```sql
-- Calls the business makes, rather than receives.
--
-- Queued rather than placed directly, for the same reason the owner's dictated
-- notes are a table: he is on a roof when he remembers, and the person he wants
-- called is at work. The queue is also the audit trail — a phone call placed in
-- the business's name is the most consequential thing this system does, and it
-- has to be possible to answer "who asked for that, and what was said" months
-- later.

create table if not exists public.call_tasks (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Our own key for the conversation, minted BEFORE the call is placed.
  -- ElevenLabs' outbound endpoint wants conversation_initiation_client_data in
  -- the same request that returns the Twilio SID, so the SID cannot be the
  -- correlation id. This is what goes into calls.call_sid, into
  -- custom_llm_extra_body.call_sid, and into dynamic_variables.call_sid — which
  -- means every existing extraction path (el/chat, el/completed) works
  -- unchanged. The task_ prefix exists so nobody mistakes it for a Twilio SID.
  correlation_id text not null unique,

  -- Who, and how we know who.
  to_number    text not null check (to_number ~ '^\+[1-9][0-9]{7,14}$'),
  contact_name text,
  client_id    uuid references public.clients (id) on delete set null,
  lead_id      uuid references public.leads   (id) on delete set null,
  job_id       uuid references public.jobs    (id) on delete set null,

  -- What Ana is for on this call, in the owner's own words. Free text for the
  -- same reason owner_tasks.body is: parsing a dictated sentence into fields
  -- invents structure that was never said.
  objective text not null check (length(btrim(objective)) > 0),

  -- Structured facts Ana may state — appointment time, address. Kept separate
  -- from `objective` because these are quoted verbatim to a customer and must
  -- come from the CRM, never from ASR.
  facts jsonb not null default '{}'::jsonb,

  locale        text not null default 'fr' check (locale in ('fr','en')),
  first_message text,

  -- pending_approval — dictated, not yet released by a human
  -- queued          — released; the cron may dial it
  -- dialing         — claimed by a cron run, POST in flight or ringing
  -- in_progress     — the conversation is live
  -- completed       — the call happened; see `outcome`
  -- failed          — attempts exhausted, or a permanent error
  -- cancelled       — the owner called it off
  status text not null default 'pending_approval'
    check (status in ('pending_approval','queued','dialing','in_progress',
                      'completed','failed','cancelled')),

  -- What actually happened. Mirrors the `outcome` data-collection enum on the
  -- ElevenLabs agent — deliberately the same vocabulary on both sides so the
  -- mapping is an assignment, not a translation.
  outcome text check (outcome in ('confirmed','declined','rescheduled',
                                  'callback_requested','wrong_number','voicemail',
                                  'no_contact','unreachable','unclear')),
  outcome_detail text,                        -- transcript_summary, or the failure message
  outcome_data   jsonb,                       -- the whole analysis block, as received

  attempts     integer not null default 0,
  max_attempts integer not null default 3,
  not_before   timestamptz not null default now(),
  -- Set when a cron run claims the row; a later run may re-claim past it. This
  -- is the ONLY thing that rescues a task whose post-call webhook never
  -- arrives — without it a dropped webhook strands the row in `dialing`
  -- forever and the owner is never told the call didn't happen.
  lease_until  timestamptz,
  last_error   text,

  -- ElevenLabs' and Twilio's own identifiers, learned only after dispatch.
  el_conversation_id text,
  provider_call_sid  text,

  -- Provenance: which owner-mode call this was dictated on. Plain text, not a
  -- foreign key, because calls are purged at 24 months (0009) and the record
  -- that a customer was telephoned must outlive the transcript of the request.
  dictated_on_call_sid text,
  approved_at timestamptz,
  approved_by text
);

-- The cron's only query: what may be dialled right now.
create index if not exists call_tasks_dispatch_idx
  on public.call_tasks (not_before)
  where status = 'queued';

-- The lease sweep.
create index if not exists call_tasks_inflight_idx
  on public.call_tasks (lease_until)
  where status in ('dialing','in_progress');

-- The correlation lookup, from the post-call webhook.
create index if not exists call_tasks_correlation_idx on public.call_tasks (correlation_id);
create index if not exists call_tasks_conversation_idx on public.call_tasks (el_conversation_id);

-- The admin list.
create index if not exists call_tasks_recent_idx on public.call_tasks (created_at desc);

alter table public.call_tasks enable row level security;
grant all on public.call_tasks to service_role;

drop trigger if exists call_tasks_touch_updated_at on public.call_tasks;
create trigger call_tasks_touch_updated_at
  before update on public.call_tasks
  for each row execute function public.touch_updated_at();

-- Direction on the transcript itself, so /admin/calls can tell the two apart
-- and callerLocale() can be taught to ignore outbound rows (a number we dialled
-- says nothing about which language that person prefers to be greeted in).
alter table public.calls add column if not exists direction text not null default 'inbound'
  check (direction in ('inbound','outbound'));
alter table public.calls add column if not exists el_conversation_id text;
alter table public.calls add column if not exists call_task_id uuid
  references public.call_tasks (id) on delete set null;

create index if not exists calls_direction_idx on public.calls (direction);
```

**Status lifecycle**

```
                      owner dictates
                            │
                    pending_approval
                            │  (human clicks Call in /admin)
                            ▼
        ┌───────────────► queued ◄───────────────┐
        │                   │                    │
        │          cron claims (conditional      │ backoff, attempts < max
        │          UPDATE ... WHERE status='queued')
        │                   ▼                    │
        │                dialing ────────────────┤ 429 / busy / no-answer
        │                   │                    │ / lease expired
        │        first chat turn arrives         │
        │                   ▼                    │
        │              in_progress ──────────────┘
        │                   │
        │        post_call_transcription
        │                   ▼
        │              completed (outcome set)
        │
        └── attempts = max, or permanent error ──► failed (outcome='unreachable'
                                                            or 'wrong_number')

  any non-terminal state ──(owner)──► cancelled
```

**Backoff table** (put it in code, not the schema):

| Failure class | Backoff | Counts as an attempt |
|---|---|---|
| `429` / concurrency | 5 min | no |
| `busy` | 15 min | yes |
| `no-answer` | 2 h | yes |
| `unknown` initiation failure | 30 min | yes |
| immediate hangup (<5 s, ≤1 turn) | 3 h | yes |
| voicemail, no message left | next day, 10:00 local | yes |
| voicemail, message left | — | terminal, `outcome='voicemail'` |
| invalid number (SIP 404/484/603) | — | terminal, `outcome='wrong_number'` |

---

## 10. The approval gate — read this before shortcutting it

`Docs/Voice-Owner-Mode.md` is emphatic that owner mode has exactly one write,
that the write is benign, and that this boundary — not the spoken PIN — is the
real security control: *"the worst case for a false positive is that someone
hears business figures and adds a junk to-do."*

**Placing a phone call breaks that property.** A caller who spoofs the owner's
number and guesses the PIN could make the business telephone anyone, in the
business's voice, saying whatever the objective field says. That is not "a
junk to-do"; it is outbound capability handed to an attacker, and it is
reputational and potentially TCPA/CASL-shaped.

The same document already prescribes the answer for exactly this class of
capability: **voice proposes, a second channel approves.** So:

- `schedule_call` writes `status = 'pending_approval'`. Always. No env flag to
  skip it in v1.
- Release happens in `/admin`, which is already password-protected, from a
  session where somebody actually authenticated.
- Additionally, and independently: **the destination number must already exist
  in the CRM** (a `clients.phone`, `leads.phone`, or a number that has called
  us before). Ana cannot be dictated an arbitrary number to dial. This is a
  hard check in `schedule_call`, not a prompt instruction — same principle as
  `ownerToolsFor()` returning `[]`.
- A per-day dispatch cap (`OUTBOUND_MAX_PER_DAY`, default 20) in the cron, so
  that a bug in the queue drains into a bounded number of real phone calls
  rather than an unbounded one.

If the owner later wants auto-release for known clients, that's a deliberate
decision to write down in `Docs/Owner-Decisions-Needed.md`, not a default.

---

## 11. Precise code changes, by file

### New files

**`supabase/migrations/0018_call_tasks.sql`** — §9. Run by hand.

**`src/lib/crm/callTasks.ts`** — the data layer, modelled on
`src/lib/crm/tasks.ts` (same `TaskWriteResult` / `MigrationPendingError`
discipline, same fail-soft posture).

```ts
export type CallTaskStatus = "pending_approval" | "queued" | "dialing"
  | "in_progress" | "completed" | "failed" | "cancelled";
export type CallOutcome = "confirmed" | "declined" | "rescheduled"
  | "callback_requested" | "wrong_number" | "voicemail" | "no_contact"
  | "unreachable" | "unclear";
export type CallTask = { /* one field per column */ };

export function mintCorrelationId(): string;             // `task_${randomUUID().replace(/-/g,"")}`
export async function createCallTask(input): Promise<TaskWriteResult>;
export async function approveCallTask(id: string): Promise<TaskUpdateResult>;
export async function cancelCallTask(id: string): Promise<TaskUpdateResult>;
/** Conditional UPDATE ... WHERE status='queued' RETURNING * — zero rows means lost the race. */
export async function claimDueCallTasks(limit: number): Promise<CallTask[]>;
export async function recordDispatch(id, { conversationId, providerCallSid }): Promise<void>;
export async function requeueCallTask(id, { backoffMs, error, countsAsAttempt }): Promise<void>;
export async function completeCallTask(id, { outcome, detail, data }): Promise<void>;
export async function failCallTask(id, { outcome, error }): Promise<void>;
export async function findCallTaskByCorrelation(correlationId): Promise<CallTask | null>;
export async function sweepExpiredLeases(): Promise<number>;
export async function listCallTasks(limit?): Promise<CallTask[]>;
```

**`src/lib/voice/outbound.ts`** — the ElevenLabs client. No SDK; `fetch`, in
the house style (Twilio and Meta webhooks are hand-rolled here too).

```ts
export type OutboundDispatch =
  | { ok: true; conversationId: string | null; providerCallSid: string | null }
  | { ok: false; retryable: boolean; status: number; message: string };

export async function placeOutboundCall(task: CallTask): Promise<OutboundDispatch>;
```

- Reads `ELEVENLABS_API_KEY`, `ELEVENLABS_OUTBOUND_AGENT_ID`,
  `ELEVENLABS_PHONE_NUMBER_ID`; returns `{ ok:false, retryable:false }` if any
  is missing, and logs — same fail-closed posture as the webhook secrets.
- Builds exactly the §2.2 body.
- `retryable = status === 429 || status >= 500`.
- 10-second `AbortSignal.timeout` — a hung dispatch must not eat the cron's
  execution budget.

**`src/lib/voice/voicemail.ts`** + **`voicemail.test.ts`** — the
`looksLikeVoicemail(text, { turnIndex, locale })` heuristic from §4.3. Pure
function, bilingual fixtures, tested like `locale.ts`.

**`src/app/api/cron/outbound/route.ts`** — copy the shape of
`src/app/api/cron/followups/route.ts` verbatim: `CRON_SECRET` bearer check,
503 when unset, per-category try/catch, JSON summary. Body:

1. `sweepExpiredLeases()` first — reclaim before dispatching.
2. Calling-hours check (`America/Toronto`, 08:00–20:00). Return early
   otherwise, reporting `{ skipped: "outside calling hours" }`.
3. Daily cap check.
4. `claimDueCallTasks(min(OUTBOUND_MAX_CONCURRENT - inflight, remainingToday))`.
5. For each: `startCall({ callSid: task.correlation_id, ... })`, then
   `placeOutboundCall(task)`, then `recordDispatch` / `requeueCallTask` /
   `failCallTask`.
6. Return a per-task summary.

**`src/app/admin/callouts/page.tsx`** (+ actions in
`src/app/admin/actions.ts`) — pending list with **Call** / **Cancel**, and a
history list with outcome badges linking to `/admin/calls`.

### Edited files

**`vercel.json`** — add:
```json
{ "path": "/api/cron/outbound", "schedule": "*/10 * * * *" }
```
(Verify the plan allows sub-daily — §8.)

**`src/app/api/voice/el/init/route.ts`** — the outbound guard from §2.4:
early-return a bare `{ "type": "conversation_initiation_client_data" }` when
`body.agent_id === process.env.ELEVENLABS_OUTBOUND_AGENT_ID`. ~8 lines.
Belt-and-braces only; the outbound agent should have no initiation webhook
configured at all.

**`src/app/api/voice/el/chat/route.ts`** — three changes:

1. Read the outbound brief: `const brief = extractOutboundBrief(body)` from
   `elevenlabs_extra_body` (`mode`, `task_id`, `contact_name`, `objective`,
   `locale`, `facts`). `mode === "outbound"` is the fork.
2. **When outbound, force `session = { authenticated: false, eligible: false }`**
   before the owner fork — an outbound call must never reach CRM tools. Also
   ensure `extractCallerPhone()` returns `null` outbound (we simply do not set
   `caller_phone` in the outbound payload; assert it rather than trusting it).
3. Add the outbound branch: `outboundReplyToStream(turns, { locale, brief },
   onDelta)`, and before generating, run `looksLikeVoicemail()` on the spoken
   text — if it fires, emit the `voicemail_detection` tool call (§4.3) and
   return, mirroring the `language_detection` block exactly, including the
   `isToolResultTurn` suppression.

Everything else in that file — SSE shape, transcript writes, escalation,
MAX_TURNS — is unchanged, because `call_sid` resolves the same way it always
did.

**`src/lib/voice/agent.ts`** — add `outboundSystemPrompt(locale, brief)` and
`outboundReplyToStream(...)` alongside the existing pair. Keep the pricing
guardrail. Add `outboundGreeting(locale, brief)` used at *dispatch* time to
render `first_message` (it is spoken by ElevenLabs, not generated by Claude).

**`src/lib/voice/ownerTools.ts`** — add the `schedule_call` tool:

```ts
{
  name: "schedule_call",
  description:
    "Queue an outbound call for Ana to place on the owner's behalf — confirming a visit, chasing a decision, checking a customer is home. The call is NOT placed immediately: it is saved for the owner to release from the admin. Only people already in the CRM can be called. Always read the number back before saving.",
  input_schema: {
    type: "object",
    properties: {
      contact_name: { type: "string", description: "Who to call, as the owner said it." },
      objective: { type: "string", description: "What Ana must accomplish, in the owner's own words." },
      not_before: { type: "string", description: "Earliest time to call, ISO 8601. Optional." },
    },
    required: ["contact_name", "objective"],
    additionalProperties: false,
  },
}
```

Note there is **no `to_number` parameter** — the handler resolves the name
against clients/leads and refuses if it finds nothing or finds several. A
number spoken over ASR into a dialler is a wrong-number waiting to happen, and
it is also the hole through which arbitrary dialling would arrive.

The handler follows `capture_task`'s error discipline exactly: on
`migration_pending` / `unconfigured` / write failure, return a string that
**tells the owner plainly it was not saved**. Also extend `business_snapshot`
with a callouts line.

Update `src/lib/voice/ownerTools.test.ts` and the `OWNER_TOOL_NAMES` assertions.

**`src/app/api/voice/el/completed/route.ts`** — the biggest edit:

1. Fork on `payload.type` (§6). Handle `call_initiation_failure`; keep
   returning 200 for everything unrecognised.
2. On `post_call_transcription`, after the existing `endCall()`: look up the
   task by correlation id, map `data.analysis` per §4.4, call
   `completeCallTask`. If `metadata.phone_call` / `features_usage` are absent
   from the webhook payload, optionally `GET /v1/convai/conversations/{id}` to
   fill them — off the hot path, wrapped in try/catch.
3. Store `data.analysis.transcript_summary` on the `calls` row (add a
   `summary` column, or reuse `notes`).
4. **Keep returning 200 on every path.** Auto-disable after 10 consecutive
   failures (§5.2) is the quiet catastrophe.

**`src/lib/crm/calls.ts`** — add `direction`, `el_conversation_id`,
`call_task_id` to `StoredCall`; accept `direction` in `startCall`; teach
`callerLocale()` to filter `direction = 'inbound'` (a number *we* dialled tells
us nothing about how that person wants to be greeted).

**`src/app/admin/calls`** — show a direction badge and the outcome.

**`Docs/Voice-ElevenLabs-Setup.md`** — a section for the second agent, its
dashboard config, and the four new env vars.

### New environment variables (Vercel)

| Variable | Purpose |
|---|---|
| `ELEVENLABS_API_KEY` | `xi-api-key` for the outbound REST call. **The first ElevenLabs credential we hold that can spend money and dial phones** — scope it as narrowly as the dashboard allows. |
| `ELEVENLABS_OUTBOUND_AGENT_ID` | The second agent. Also the `el/init` discriminator. |
| `ELEVENLABS_PHONE_NUMBER_ID` | From `GET /v1/convai/phone-numbers`. |
| `OUTBOUND_MAX_CONCURRENT` | Default 2, of the plan's 6. |
| `OUTBOUND_MAX_PER_DAY` | Default 20. Bounds a runaway queue. |
| `OUTBOUND_CALLING_HOURS` | Default `08:00-20:00`, `America/Toronto`. |

### Dashboard work on the new agent

1. Duplicate the inbound agent, name it "Ana — appels sortants".
2. **LLM → Custom LLM**: same URL `/api/voice/el/chat`, same
   `ELEVENLABS_CUSTOM_LLM_SECRET`. Set **Model ID** to `ana-outbound-v1` — a
   free second signal in `body.model` if `elevenlabs_extra_body` ever fails
   the way `call_sid` did on inbound.
3. **Tools → System tools**: enable `end_call`, `language_detection`,
   **`voicemail_detection`** (with a bilingual custom message using
   `{{contact_name}}` / `{{appointment_time}}`).
4. **Security tab**: enable overrides for `first_message`, `language`, and
   **Custom LLM extra body**. Leave `prompt` override **off** — it does
   nothing for us and an enabled override is attack surface.
5. **Security tab**: leave the conversation-initiation webhook **empty**.
6. **Analysis tab**: the six data-collection fields and two evaluation
   criteria from §4.
7. **Voices**: same Melanie (fr) / Sarah (en override).
8. Leave the dashboard system prompt as a *sane outbound backup* — unlike
   inbound, where it's inert and stale, this one is what a customer hears if
   `el/chat` 500s mid-call, and an outbound call falling back to a
   receptionist script is confusing rather than merely wrong.

---

## 12. Unverified — confirm on the first real outbound call

Place one test call to the owner's own mobile before anything reaches a
customer, with verbose logging on `el/chat` and `el/completed`.

1. **Does `el/init` fire for an outbound call at all?** Docs say inbound only.
   Log every hit with `agent_id` and `direction`-ish fields. If it *does*
   fire, confirm the §2.4 guard prevents the greeting override — and check
   whether the webhook response *replaces* or *merges with* the
   `conversation_initiation_client_data` sent at dispatch. This is the single
   highest-value observation of the test call.
2. **Does `custom_llm_extra_body` arrive as top-level `elevenlabs_extra_body`
   in the chat request?** This is the whole context channel. Inbound already
   proved `call_sid` extraction is the flakiest part of this integration —
   log the full request body keys on turn one. If it fails, the fallback is
   `dynamic_variables` (already checked by `extractCallSid`), and if *that*
   fails, a single Supabase lookup by `system__conversation_id`.
3. **Which path does the correlation id come back on in the post-call
   webhook** — `data.dynamic_variables.call_sid` or
   `data.conversation_initiation_client_data.dynamic_variables.call_sid`? The
   documented payload says the latter. Log which branch of `extractCallSid`
   fires and delete the dead one.
4. **Does the webhook `metadata` include `phone_call.direction` and
   `features_usage.voicemail_detection`?** The documented webhook example is
   thinner than the conversation object. If absent, wire the
   `GET /v1/convai/conversations/{id}` fallback.
5. **Is `call_initiation_failure` actually delivered to our workspace webhook
   URL, or does it need separate enabling?** Test by dialling a number that is
   switched off. Confirm the exact `failure_reason` string — and specifically
   confirm the hyphen in `"no-answer"`.
6. **Does `conversation_config_override.agent.first_message` actually take
   effect** on an outbound call, or does the agent's dashboard first message
   win? Make the override text obviously distinct so there's no ambiguity.
7. **Does `voicemail_detection` work at all through a Custom LLM?** Call a
   number you know goes straight to voicemail. Confirm (a) our tool call is
   accepted in the same SSE shape `language_detection` uses, (b) the
   configured voicemail message is spoken, (c) the call is terminated,
   (d) `features_usage.voicemail_detection.used` comes back `true`.
8. **Do data collection and evaluation criteria run on a Custom LLM agent?**
   No reason they shouldn't — the analysis LLM is ElevenLabs' own and reads
   the finished transcript — but nothing in the docs states it explicitly.
   Verify non-empty `analysis.data_collection_results`.
9. **Whether `analysis` is populated at the moment the webhook fires.** The
   docs say the webhook is sent "after analysis is complete", but a
   `status: "processing"` payload with an empty `analysis` would silently
   produce `outcome: 'unclear'` on every call. Log `status` and whether
   `analysis` is empty.
10. **Does `ringing_timeout_secs: 30` behave** — and does timing out produce
    `failure_reason: "no-answer"` or something else?
11. **Twilio caller-ID presentation.** Confirm the customer sees the business
    number, not a Twilio default or "unknown". Anonymous outbound from a
    contractor gets ignored.
12. **Does Vercel accept `*/10 * * * *`** on the current plan (§8).
13. **Whether outbound calls consume the same concurrency pool as inbound**
    on the Starter plan's 6, and what a `concurrent_limit_exceeded` body
    actually looks like.

Until items 2, 3, 5 and 7 are confirmed, treat the outbound path as
experimental and keep `OUTBOUND_MAX_PER_DAY` at 1.

---

## Sources

Read 2026-08-02.

- [Outbound call via Twilio — API reference](https://elevenlabs.io/docs/api-reference/twilio/outbound-call)
- [Outbound call via SIP trunk — API reference](https://elevenlabs.io/docs/api-reference/sip-trunk/outbound-call)
- [Create batch call — API reference](https://elevenlabs.io/docs/api-reference/batch-calling/create)
- [Batch calls](https://elevenlabs.io/docs/eleven-agents/phone-numbers/batch-calls)
- [List phone numbers — API reference](https://elevenlabs.io/docs/api-reference/phone-numbers/list)
- [Get conversation details — API reference](https://elevenlabs.io/docs/api-reference/conversations/get)
- [Post-call webhooks](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks)
- [Webhooks (workspace configuration)](https://elevenlabs.io/docs/eleven-api/resources/webhooks)
- [Twilio personalization (conversation initiation webhook)](https://elevenlabs.io/docs/eleven-agents/customization/personalization/twilio-personalization)
- [Personalization overview](https://elevenlabs.io/docs/eleven-agents/customization/personalization)
- [Dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables)
- [Overrides](https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides)
- [Custom LLM](https://elevenlabs.io/docs/eleven-agents/customization/llm/custom-llm)
- [System tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools)
- [Voicemail detection](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/voicemail-detection)
- [Data collection](https://elevenlabs.io/docs/eleven-agents/customization/agent-analysis/data-collection)
- [Success evaluation](https://elevenlabs.io/docs/eleven-agents/customization/agent-analysis/success-evaluation)
- [Twilio native integration](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration)
- [Register Twilio calls](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/register-call)
- [ElevenAgents pricing](https://elevenlabs.io/pricing/agents)
- [Burst pricing](https://elevenlabs.io/docs/agents-platform/guides/burst-pricing)
- [API error code 429](https://elevenlabs.io/docs/help-center/technical/api-error-code-429)
- [Status incident: post-call webhook missing conversation_id (2026-02-10)](https://status.elevenlabs.io/incidents/01KH4K0275FWV2B11DSAR12BRY)
- [elevenlabs/skills — agents/references/outbound-calls.md](https://github.com/elevenlabs/skills/blob/main/agents/references/outbound-calls.md)
