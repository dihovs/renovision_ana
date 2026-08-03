# Sending WhatsApp *out* to the crew

Research for the "job scheduled → tell the crew" path. Inbound already works
(`src/app/api/whatsapp/webhook/route.ts`); nothing goes out yet.

Everything below was read on **2 August 2026**. Graph API version current on that
date: **v26.0**, released 29 July 2026. Where a Meta page carried its own
"Updated" stamp it is quoted. Anything I could not confirm is in
[§13 Unverified](#13-unverified) rather than stated as fact.

---

## 1. Recommendation

**Send one WhatsApp utility template per crew member per dispatch. Put nothing
in it but the job number, the arrival window, the street, and a button. The
button opens the per-job crew page that migration `0020_crew_tokens.sql`
already designs. Everything real — the task list, the photos, the access notes
— lives on that page, not in the message.**

Do not send the tasks as WhatsApp text. Do not send the photos as WhatsApp
media. Send a doorbell, and put the house behind it.

### Why this shape

**The repo already chose it, and already built it.** `supabase/migrations/0020_crew_tokens.sql`
plus `src/lib/crm/crewView.ts` and `src/app/crew/[token]/` are a complete,
working per-job crew page: opaque 32-byte token, 90-day TTL, 7-day grace after
completion, revoke, `last_viewed_at`, checklist toggles, visit-done — and a
column allowlist that keeps every `*_cents` field from ever leaving Postgres on
that path. The "never pricing" rule is already enforced there, in one reviewable
file, with a test asserting it.

**So the crew page half of this recommendation is done.** What is missing is only
the doorbell. That changes the size of this work considerably and it is why §13
is much shorter than it would otherwise be.

**Templates are unavoidable, so minimise how much rides on them.** A dispatch is
by definition unprompted — the crew has not messaged you in the last 24 hours,
so free-form is refused with error `131047` (§3.4). You must use a pre-approved
template. Every distinct thing you might want to say is a separate template
submission and a separate 24-hour Meta review. If the tasks are in the message,
every new shape of job is a new template. If the tasks are on the page, **two
templates cover the business forever** and their text never changes again.

**It keeps pricing out by construction, not by discipline.** The rule is "never
pricing." A template with a `{{tasks}}` variable is one careless
`job_line_items` select away from putting `unit_price_cents` on a
subcontractor's phone. A template whose only variables are a job number, a time,
a street and a token *cannot* leak a price — there is no field for one to travel
in. The crew page then enforces the same rule in exactly one file that can be
read and reviewed.

**Photos are the killer argument.** Sending six job photos over the Cloud API
outside the 24-hour window means six media-header template messages, each one
billed, each one needing its own upload or public URL (§5), each one landing as
a separate buzz on a phone. On the crew page they are six signed URLs from the
bucket `src/lib/whatsapp/store.ts` already writes to, free, and — because
`signMediaUrls()` signs per request and never persists — they expire on their
own.

**Cost is not a factor and should not be treated as one.** Three crew, twenty
jobs a month, is about **$0.20 USD/month** today and still under **$1/month**
after Meta's October 2026 change (§4). The real cost of this feature is the
owner's time in Meta's console, which is why the design deliberately spends that
time twice and never again.

### What I am recommending against, and why

- **Not free-form-only, with the crew texting in first to open a window.** It
  works — a crew reply genuinely opens 24 hours of free-form (§3.5) — but it
  inverts the dependency. Dispatch would only function if the crew remembered to
  message first, which is precisely the discipline you are automating away. Keep
  it as an *opportunistic optimisation*: if a window happens to be open, skip the
  template and send free-form. Never as the mechanism.

- **Not the Groups API.** It shipped and it looks perfect for this — up to 8
  participants, `recipient_type: "group"`, one message reaches the crew. It
  requires an **Official Business Account**, the verified-badge tier Meta grants
  on notability. A one-person renovation company in Laval will not get one.
  Ruled out on eligibility, not on merit. Revisit only if an OBA ever lands.

- **Not SMS instead.** The full comparison is §8, and it is closer than the price
  gap suggests. The finding that settles it: SMS's supposed advantage is avoiding
  an approval queue, and that is false. A Canadian A2P campaign review currently
  runs **10–15 days**; a Meta template review is documented at **up to 24 hours**.
  SMS also costs ~5× per message, probably needs a new number the crew must save,
  and gives worse delivery proof. It is the right *fallback* and the wrong plan.

### One thing to build regardless

Put a **"C'est reçu / Got it"** button on the crew page and record the tap. A tap
is the only signal that a human actually read the dispatch — better than any
carrier or platform receipt — and having it makes the choice of envelope much less
consequential.

### The one-line version

Two utility templates and a send module. The crew page they point at is already
built.

---

## 2. Sending: exact request shapes

### 2.1 Endpoint

```
POST https://graph.facebook.com/v26.0/<PHONE_NUMBER_ID>/messages
```

`<PHONE_NUMBER_ID>` is the **business phone number ID**, not the phone number and
not the WABA ID. It is a numeric string from the Meta app dashboard, and it is
**not currently in the repo's env** — it must be added (§11).

Headers, all requests:

```
Authorization: Bearer <WHATSAPP_ACCESS_TOKEN>
Content-Type: application/json
```

> **Version note.** `src/app/api/whatsapp/webhook/route.ts:28` pins
> `GRAPH_VERSION = "v21.0"`. v21.0 shipped October 2024 and, on Meta's two-year
> cadence, expires around **January 2027**. It still works today. Bump it to
> `v26.0` as part of this work rather than discovering it on the day it stops.

### 2.2 Text message (free-form — only valid inside an open 24h window)

```jsonc
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "15551234567",              // E.164 without the leading +
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "On my way, 20 minutes out."
  },
  "biz_opaque_callback_data": "job:9f1c...:dispatch"
}
```

`preview_url: false` matters when the body contains a crew link — a link preview
would render an unfurled card of an internal page in the chat list.

### 2.3 Template message — the dispatch (this is the one you will actually send)

Assuming the templates in §9, created with `parameter_format: "named"` and a
URL button carrying a dynamic suffix:

```jsonc
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "15551234567",
  "type": "template",
  "template": {
    "name": "job_scheduled",
    "language": { "code": "fr" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "parameter_name": "job_number",     "text": "1042" },
          { "type": "text", "parameter_name": "arrival_window", "text": "lundi 4 août, 8 h – 10 h" },
          { "type": "text", "parameter_name": "street",         "text": "1450 rue Fleury Est, Montréal" }
        ]
      },
      {
        "type": "button",
        "sub_type": "url",
        "index": "0",
        "parameters": [
          { "type": "text", "text": "a3f9c2...e81b" }   // the crew token — suffix only
        ]
      }
    ]
  },
  "biz_opaque_callback_data": "dispatch:<job_id>:<contact_id>"
}
```

Three things about that button component that are easy to get wrong:

- `index` is a **string**, `"0"`, not the number `0`.
- The button parameter is the **suffix only**. The base URL
  (`https://www.renovisionana.ca/crew/`) is baked into the approved template and
  cannot be changed at send time without a fresh approval. That is a feature: the
  hostname is un-spoofable by anything downstream.
- Button parameters use positional `text`, not `parameter_name`, even when the
  body uses named parameters.

Positional form (if you submit with `parameter_format: "positional"`, the
default) is the same minus `parameter_name`, and order is then load-bearing:

```jsonc
{ "type": "body", "parameters": [
  { "type": "text", "text": "1042" },
  { "type": "text", "text": "lundi 4 août, 8 h – 10 h" },
  { "type": "text", "text": "1450 rue Fleury Est, Montréal" }
]}
```

Named is worth the extra field. A positional template silently sends the address
into the time slot the day someone reorders the array.

### 2.4 Success response

```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    { "input": "15551234567", "wa_id": "15551234567" }
  ],
  "messages": [
    { "id": "wamid.HBgLMTY0NjcwNDM1OTUVAgARGBI4MjZGRDA0OUE2OTQ3RkEyMzcA" }
  ]
}
```

**`messages[0].id` — the `wamid.` string — is the only handle you get.** It is
what every later status webhook is keyed by, and it is what
`whatsapp_messages.wa_message_id` already stores (unique, per migration 0010).
Persist it in the same transaction as the send or you cannot correlate anything.

A 200 here means *Meta accepted it*, not that anyone received it. Delivery
failures arrive later, on the webhook, as a `failed` status (§6.2). Both paths
must be handled; a send that returns 200 and then fails silently is the default
outcome of only checking the response.

### 2.5 `biz_opaque_callback_data`

An arbitrary string you set on the send, echoed back verbatim on every status
webhook for that message. This is the clean way to correlate a status to a job
without a lookup — see §6.3 for the recommendation on whether to rely on it.

---

## 3. The 24-hour window and templates

### 3.1 The rule

An inbound message from a user opens a **24-hour customer service window**,
measured from their *last* inbound message. Inside it you may send free-form
messages of any type. Outside it, **only an approved template**. A crew dispatch
is unprompted by definition and therefore lands outside the window essentially
always.

### 3.2 Creating templates

Two routes; the owner should use the first, the repo should never use either at
runtime.

**WhatsApp Manager** (`business.facebook.com` → WhatsApp Manager → Message
templates). A form. This is the owner path, and the §10 checklist assumes it.

**Business Management API**, for reference:

```
POST https://graph.facebook.com/v26.0/<WABA_ID>/message_templates
```

```jsonc
{
  "name": "job_scheduled",          // lowercase, digits, underscores; ≤512 chars
  "category": "UTILITY",
  "language": "fr",
  "parameter_format": "NAMED",
  "components": [ /* HEADER / BODY / FOOTER / BUTTONS */ ]
}
```

Rate limit: 100 templates per WABA per hour. Every component with a variable
must carry an `example` block of sample values — a template submitted without
samples is rejected, because a human reviewer cannot judge
`{{arrival_window}}` without seeing what goes in it.

### 3.3 Categories, approval, and the category you want

Three categories: **AUTHENTICATION**, **MARKETING**, **UTILITY**.

**A crew dispatch is UTILITY.** It is a transactional notification about a
specific agreed-upon job. Nothing about it is promotional.

Review is automated and Meta documents **up to 24 hours**. In practice a short,
plain utility template is usually approved in minutes. Budget a day; you will
usually get lunchtime.

Statuses: `PENDING` / In-Review → `APPROVED` (shown as *Active – High/Medium/Low
Quality*), `REJECTED`, `PAUSED`, `DISABLED`. Only `APPROVED` can be sent.

**The recategorisation trap.** Since 1 June 2024 Meta re-examines template
categories monthly and will silently move a template it judges miscategorised.
Utility → Marketing is a **7.4×** price jump ($0.0034 → $0.0250) and a quality
mark on the account. You have 60 days to appeal via Business Support → Template
Category Updates → Request Review. The defence is textual: no adjectives, no
invitation, no offer, no exclamation marks, nothing that reads like it is
selling. The §9 templates are written deliberately flat for this reason, and
they should stay that way even though they read like a parking ticket.

### 3.4 What happens if you send free-form outside the window

HTTP 400, and:

```json
{
  "error": {
    "message": "(#131047) Re-engagement message",
    "type": "OAuthException",
    "code": 131047,
    "error_data": {
      "messaging_product": "whatsapp",
      "details": "Message failed to send because more than 24 hours have passed since the customer last replied to this number."
    },
    "error_subcode": 2494047,
    "fbtrace_id": "..."
  }
}
```

The message is **not delivered and not queued**. There is no partial state — it
simply did not happen. Meta's own guidance is to branch on `error.code`, never on
`error.message` or the HTTP status.

### 3.5 Can templates be avoided for internal staff? Honestly: no.

I looked for an exemption and there is none. Meta's rules key on the *channel*,
not on the relationship — there is no "employee", "internal", or "staff"
classification anywhere in the platform. Three near-misses:

**Crew replies first.** Genuinely works. Any inbound message from them opens 24
hours of free-form, and free-form inside the window is free today. But making
dispatch *depend* on it means dispatch fails on the mornings the crew forgets,
which is most of them. **Use it as an optimisation, not a mechanism:** check for
an inbound message from that contact within 24h and, if there is one, send text
instead of the template. Same code path, one branch, saves a fraction of a cent
and — more usefully — lets the message be longer and less stilted.

**WhatsApp Groups API.** Real, shipped, and would be ideal: `recipient_type:
"group"`, up to 8 participants, one send reaches the crew. Requires an **Official
Business Account**. That is the verified-badge tier Meta grants on public
notability, not something a small contractor applies for and receives. Ruled out.

**A different channel entirely.** This is the serious version of the question,
and §8 answers it. Short version: the channel is not the problem, and moving the
*content* off the channel — which is what the token link does — dissolves most of
what makes the channel annoying.

**One template covers all jobs.** Worth stating plainly because it is the thing
that makes this tolerable: templates are approved once, by *shape*, not per
message. Two approvals total. New crew, new job, new address, new time — all
just parameter values. You will not touch Meta's console again.

---

## 4. Cost

### 4.1 The model, as of 2 August 2026

**Per-message, not per-conversation** — Meta switched on 1 July 2025. You are
charged when a **template message is delivered**. Rate depends on the template
*category* and the *recipient's country code*.

| | Today (2 Aug 2026) |
|---|---|
| Utility template, outside a window | **charged** |
| Utility template, inside an open window | free |
| Marketing template | charged, always |
| Free-form / service message, inside window | free |
| Inbound messages from the crew | never charged |

**The old 1,000-free-conversations tier no longer exists.** It was removed on
1 November 2024 when all in-window non-template messages became free. There is
no monthly allowance in the current model.

> **Change landing in 8 weeks.** Meta has announced that from **1 October
> 2026**, both service (free-form) messages *and* utility templates sent inside
> an open window become billable. Meta states service rates will match utility
> rates by market. Rates are to be published by 1 September 2026. Budget for it;
> at this volume it changes cents into slightly more cents.

### 4.2 Canada rates

Canada (+1) is billed on Meta's **North America** rate card. From the official
USD rate-card CSV, headed *effective July 1, 2026*:

| Category | USD per delivered message |
|---|---|
| **Utility** | **$0.0034** |
| Authentication | $0.0034 |
| Marketing | $0.0250 |

Volume tiers exist but start at 80,000 messages/month. Irrelevant here — list
rate applies. Twilio's public WhatsApp pricing independently lists North America
utility at $0.0034, which is a useful cross-check.

### 4.3 Three crew, twenty jobs a month

| Line | Messages/mo | Rate | Cost |
|---|---|---|---|
| Dispatch: 20 jobs × 3 crew | 60 | $0.0034 | $0.204 |
| Schedule changes, say 30% of jobs × 3 | 18 | $0.0034 | $0.061 |
| **Total today** | **78** | | **≈ $0.27 USD/month** |

After 1 October 2026, add in-window replies. Even at a generous 200 service
messages a month at the utility rate, that is **$0.68**, for a total under
**$1.00 USD/month**.

**Roughly three Canadian dollars a year.** Meta's per-message pricing is not a
consideration in this decision and should not be presented to the owner as one.
The costs that matter are the console setup (§10) and the template-approval
dependency (§3.3).

---

## 5. Media

Included for completeness. **The recommendation is to send none of it** — photos
belong on the crew page — but the constraints explain why.

### 5.1 Upload, then send by id

```
POST https://graph.facebook.com/v26.0/<PHONE_NUMBER_ID>/media
Authorization: Bearer <TOKEN>
Content-Type: multipart/form-data
```

Fields: `messaging_product=whatsapp`, `type=<mime>`, `file=@path;type=<mime>`.

```json
{ "id": "1234567890123456" }
```

Uploaded media ids are valid **30 days**. (Ids from *inbound* webhooks — what
`downloadMedia()` in the webhook route already resolves — last **7 days**.)

Then:

```jsonc
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "15551234567",
  "type": "image",
  "image": { "id": "1234567890123456", "caption": "Salle de bain — avant" }
}
```

### 5.2 Or send by link

```jsonc
{ "type": "image", "image": { "link": "https://...", "caption": "..." } }
```

Meta fetches the URL itself, so it must be **publicly reachable with no auth**.
That disqualifies the Supabase signed URLs the project already uses — a signed
URL would work until it expired, which is exactly the class of bug the codebase
already avoids in `signMediaUrls()`. Upload-by-id is the correct choice if media
must be sent at all.

### 5.3 Limits

| Type | Formats | Max |
|---|---|---|
| Image | JPEG, PNG (8-bit, RGB/RGBA) | **5 MB** |
| Video | MP4, 3GPP (H.264 + AAC) | 16 MB |
| Audio | AAC, AMR, MP3, M4A, OGG | 16 MB |
| Document | PDF, Office, TXT | 100 MB |
| Sticker | WebP | 100 KB static / 500 KB animated |

Caption: 1024 characters.

**5 MB is the number that bites.** A modern phone camera clears it regularly, so
anything sending images out needs a resize step — one more reason not to.

### 5.4 Several photos for one job

There is no multi-attachment message and no album. **One API call per photo**,
each a separate message, each its own `wamid`, each its own buzz. Outside the
24-hour window each one must additionally be a *media-header template* message
and each is **separately billed**.

Six photos for one job = six template sends. On the crew page: one link, six
`<img>` tags, zero cents. This is the whole argument for the recommendation in a
single line.

---

## 6. Delivery status

### 6.1 It already works

`src/app/api/whatsapp/webhook/route.ts` reads `value.statuses[]` and calls
`updateStatus()`, which writes `status` onto `whatsapp_messages` matched on
`wa_message_id`. Outbound tracking needs **no new webhook and no new
subscription** — the existing `messages` field covers both directions. What is
missing is that nothing writes an outbound row for a status to land on, and
failures are discarded.

### 6.2 Payloads

Up to three per message — `sent`, `delivered`, `read` — plus `failed` instead.

```jsonc
{
  "entry": [{
    "id": "<WABA_ID>",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "display_phone_number": "15550001111", "phone_number_id": "<PHONE_NUMBER_ID>" },
        "statuses": [{
          "id": "wamid.HBgLMTY0NjcwNDM1OTUVAgARGBI4MjZGRDA0OUE2OTQ3RkEyMzcA",
          "status": "delivered",
          "timestamp": "1754150400",
          "recipient_id": "15551234567",
          "conversation": {
            "id": "abc123...",
            "origin": { "type": "utility" }
          },
          "pricing": { "billable": true, "pricing_model": "PMP", "category": "utility" },
          "biz_opaque_callback_data": "dispatch:<job_id>:<contact_id>"
        }]
      }
    }]
  }]
}
```

A `failed` status carries an `errors` array instead of `pricing`:

```jsonc
{
  "id": "wamid....",
  "status": "failed",
  "timestamp": "1754150400",
  "recipient_id": "15551234567",
  "errors": [{
    "code": 131026,
    "title": "Message undeliverable",
    "message": "Message undeliverable",
    "error_data": { "details": "Message Undeliverable." }
  }]
}
```

**`131026` is deliberately vague.** Meta will not tell you which of "not on
WhatsApp", "blocked you", or "hasn't accepted the ToS" it was, for privacy
reasons. Treat all three the same: the crew member did not get it, tell the owner
(§7).

`read` requires the recipient to have read receipts on. Absence of `read` means
nothing; absence of `delivered` means something.

### 6.3 Correlating a status back to a job

Two routes, and I recommend using the first as the source of truth:

**Primary — the `wamid`.** Persist `messages[0].id` from the send response into
`whatsapp_messages.wa_message_id` (unique index already exists) with `job_id`
set. Every status webhook keys on it. The existing `updateStatus()` already does
the lookup; it just needs the row to exist. This is a database join you control
and it survives Meta changing their mind about anything.

**Secondary — `biz_opaque_callback_data`.** Set it anyway
(`dispatch:<job_id>:<contact_id>`), because it makes the raw webhook readable when
something has gone wrong at 7am and it costs nothing. But do not make it
load-bearing: it is echoed on statuses, not on the send response, and it is a
Meta field whose exact echo semantics I could not confirm from primary
documentation (§13).

There is a write ordering hazard worth naming: Meta's `sent` webhook can arrive
**before** your own `await` on the send response has resolved and written the
row. `updateStatus()` would then update zero rows and the status is lost. Either
insert the outbound row *before* the API call and patch in the `wamid` after, or
make the status write an upsert. The former is cleaner and matches how the
inbound path already treats retries.

---

## 7. Numbers and identity

**Yes, one WhatsApp Business number can message both staff and customers.** There
is no platform-level separation and no per-recipient classification. Every
distinction is one you build.

Reasons to consider a second number, honestly weighed:

| | Argument |
|---|---|
| **Against splitting** | A second number is a second phone number to buy, a second registration, a second display-name review, a second webhook config, and a second access token. Messaging limits and quality ratings are pooled at the **business portfolio** level anyway, so a split does not isolate reputational risk the way people assume. |
| **Against splitting** | The crew already messages the existing number inbound. Moving them means telling every subcontractor to save a new contact, which is exactly the kind of change that produces photos sent to the old number for a year. |
| **For splitting** | Customer-facing display name and profile differ in tone from an internal dispatch line. |
| **For splitting** | Blast radius: a template quality problem on the customer line cannot pause crew dispatch. |

**Recommendation: one number.** The split solves a problem this business does
not have yet, at a cost it feels immediately. `whatsapp_contacts.role` already
distinguishes `subcontractor` from `client` in migration 0010 — that column is
the separation, and it is enough. Revisit if the crew ever exceeds a handful of
people or if customer volume makes the shared quality rating uncomfortable.

One thing that *is* worth doing regardless: `whatsapp_contacts.opted_in_at`
exists and is currently unused. Business-initiated messaging expects documented
consent. Set it when a subcontractor is onboarded and refuse to dispatch to a
contact where it is null — cheap, and it makes the consent story auditable.

---

## 8. The honest comparison

### 8.1 SMS via Twilio

This is a genuine contender and deserves the numbers rather than a wave.

**Rates** (twilio.com/en-us/sms/pricing/ca — Twilio publishes no effective date
and warns prices change without notice):

| | Outbound | Inbound |
|---|---|---|
| Canadian long code SMS | $0.0083/segment | $0.0083 |
| Long code MMS | $0.0220 | $0.0165 |

Canadian carrier pass-through is added on top of outbound SMS — Bell +$0.0087,
Rogers +$0.0084, Telus +$0.0073 — so a realistic delivered segment is
**~$0.0156–0.0170**, roughly **5× a WhatsApp utility template**. Plus ~$1.15/month
number rental and a $0.001 fee on each failed message.

Segments are 160 GSM-7 characters, 153 each when concatenated. **French accents
are a trap**: `é à è ç ù` are in GSM-7, but `œ`, a curly apostrophe `’`, and em
dashes are not, and one of them silently flips the whole message to UCS-2 and 70
characters — doubling the cost of every dispatch. Twilio's Messaging Service
"Smart Encoding" fixes this; a bare `Messages.json` send does not.

**Registration.** A2P 10DLC is a US carrier programme; Canadian carriers do not
run it and there is no formal Canadian registry. But two things bite:

- Sending to Quebec **from a US long code** is cross-border A2P, which Canadian
  carriers filter aggressively. Twilio's own Canada guidelines say so. Not viable.
- A **Canadian** long code needs no registration to send Canada-domestic — except
  that numbers bought after a March 2025 policy change reportedly need A2P
  registration or Twilio "persona verification" first. If registration is
  required: ~$4–4.50 one-time brand, $15 vetting, $2/month campaign, and
  **campaign review currently runs 10–15 days**.

That last number is the important one. **The headline reason to prefer SMS is
"no approval queue," and it is not actually true.** You would be trading Meta's
documented 24-hour template review for Twilio/TCR's 10–15 day campaign review.

**API shape**, for the fallback path:

```
POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
Authorization: Basic base64(AccountSid:AuthToken)   # prefer an API key/secret
Content-Type: application/x-www-form-urlencoded
```

Params: `To`, `MessagingServiceSid` (not `From`), `Body`, `StatusCallback`, and
`ValidityPeriod=3600` — set that last one, so a stale arrival-window text does
not land eight hours late. Response 201; **`sid`** (`SM…`, 34 chars) is the
tracking handle, the analogue of `wamid`.

Status callback is form-encoded POST with `MessageSid`, `MessageStatus`,
`ErrorCode`. Validate with `twilio.validateRequest` — the repo already does
exactly this in `src/lib/voice/twiml.ts` and `src/app/api/voice/status/route.ts`,
so the helper exists.

**Delivery receipts are weaker than WhatsApp's.** Statuses run `queued` →
`sending` → `sent` → `delivered`/`undelivered`. But `sent` only means a Canadian
carrier accepted it; a meaningful share of messages stall at `sent` forever, and
carrier spam filtering usually produces silence rather than `undelivered`. You
cannot build "the crew was notified" on `delivered`. WhatsApp's `delivered` and
`read` are, by contrast, real handset events.

**Two repo facts that raise the cost of this path:**

- `.env.local.example` has `TWILIO_AUTH_TOKEN` but **no `TWILIO_ACCOUNT_SID`** —
  the token is only used today to validate inbound webhook signatures. Sending
  needs a SID plus an API key.
- The business phone number appears to live in **ElevenLabs**
  (`ELEVENLABS_PHONE_NUMBER_ID`), not Twilio. If it was imported from Twilio it
  can still send SMS; if it is ElevenLabs-native, SMS means **buying a new
  Quebec long code**, which is a new number the crew has to save.

**CASL: not an obstacle, either way.** Job dispatches are almost certainly not
commercial electronic messages at all — nothing in them encourages participation
in a commercial activity, which is what CASL keys on. And even if they were,
*Electronic Commerce Protection Regulations* (SOR/2013-221) s. 3(a)(ii) expressly
exempts messages sent to a representative or consultant of another organisation
with which you have a relationship, concerning that organisation's activities. A
subcontractor is squarely that. No consent, no unsubscribe, no sender ID required
by statute. Keep the "never pricing" rule and it stays true. (Carrier rules are
separate: if you ever do send SMS, handle STOP/ARRÊT anyway.)

### 8.2 Token link, delivered by anything

Not really a competitor — it is the other half of the recommendation. The link
is the payload; WhatsApp or SMS is just the envelope. Its virtues are the ones
migration 0020 already argues for: revocable, expiring, per-job, carries photos
for free, and — the one that matters most here — **changing what the crew sees
never requires Meta's approval**. Template text is frozen; page content is a
deploy.

### 8.3 Verdict

Side by side, 78 dispatch messages a month:

| | WhatsApp + link | SMS + link |
|---|---|---|
| Traffic | $0.27/mo | ~$1.29/mo |
| Number | **already have it** | ~$1.15/mo, probably a **new** one |
| Recurring total | **~$0.27** | ~$2.44–4.44 |
| One-time setup | 2 template approvals, ≤24h each | possible A2P registration, **10–15 days**, ~$19 |
| Adding a crew member | DB row | DB row |
| Photos | free, on the page | free, on the page |
| Real delivery proof | `delivered` + `read`, handset-level | `sent` often terminal; unreliable |
| Ongoing Meta/Twilio admin | recategorisation watch | STOP/ARRÊT handling |

**Recommendation stands: WhatsApp template + crew link.** The reasoning, in
order of weight:

- **The "avoid the approval queue" argument for SMS does not survive contact with
  the facts.** Meta reviews a template in up to 24 hours. Twilio's Canadian A2P
  campaign review is currently 10–15 days. If bureaucracy is the thing to
  minimise — and for a one-person business it is — WhatsApp is the *less*
  bureaucratic option, which is the opposite of the intuition.
- **The crew is already there.** They send photos in over WhatsApp today. A
  dispatch landing in the same thread as their own photos is coherent; one
  landing in a separate SMS inbox is a second place to look. And it uses the
  number they have already saved.
- **Crews change; templates don't.** Adding a subcontractor is a row in
  `whatsapp_contacts` — no Meta involvement. Template approval is per *shape*, not
  per person, so crew turnover never touches Meta. This is the direct answer to
  the worry that approvals make the system brittle as people come and go.
- **The strongest objection to WhatsApp dissolves under the link design.** The
  real problem with templates is that a variable-length task list does not fit a
  fixed template. True — and it is exactly why the tasks are not in the message.
  Once the payload moves to the page, the template is three short fields that
  never change again.
- **Delivery proof is better.** WhatsApp gives handset-level `delivered` and
  `read`. Canadian SMS frequently stalls at `sent` with no further signal.

**Do this regardless of channel:** put a "C'est reçu / Got it" button on the crew
page and record the tap. That is the only acknowledgement that actually means a
human read it — better than any delivery receipt on either channel — and it makes
the choice of envelope less consequential.

**SMS is the fallback, not the plan.** On a `failed` status (§6.2), or for a
contact not on WhatsApp, fall back to SMS. Same crew link, different envelope —
which is precisely why the link design makes the fallback cheap to build. Note it
is not free: it needs `TWILIO_ACCOUNT_SID`, an API key, and possibly a new
Canadian number (§8.1). Build it when the first `131026` arrives, not before.

---

## 9. Templates, ready to submit

Both **UTILITY**, both with `parameter_format: NAMED`, both in **`fr`** and
**`en`**. Meta has no `fr_CA`; use `fr`. One template *name* holds both language
versions — submit the French text under `fr` and the English under `en` with the
same name, then pick the code at send time.

**Rules the parameter values must obey**, or the send fails with `132012`:
no newlines, no tabs, no more than 4 consecutive spaces, and **no URLs inside a
body parameter**. The link travels in the button suffix precisely to stay clear
of that last rule.

Deliberately flat prose — see §3.3 on recategorisation.

### 9.1 `job_scheduled`

**Body (fr)**

```
Chantier {{job_number}} confirmé.
Arrivée : {{arrival_window}}
Adresse : {{street}}
Les tâches, les accès et les photos sont sur la fiche de chantier.
```

**Body (en)**

```
Job {{job_number}} confirmed.
Arrival: {{arrival_window}}
Address: {{street}}
Tasks, access notes and photos are on the job sheet.
```

**Footer** (fr) `Renovision AnA` · (en) `Renovision AnA`

**Button** — type `URL`, dynamic

- Text (fr): `Ouvrir la fiche` · (en): `Open job sheet`
- Base URL: `https://www.renovisionana.ca/crew/{{1}}`

**Examples to supply on submission** (required)

- `job_number`: `1042`
- `arrival_window` (fr): `lundi 4 août, 8 h – 10 h` · (en): `Monday Aug 4, 8–10 AM`
- `street` (fr): `1450 rue Fleury Est, Montréal` · (en): `1450 Fleury St East, Montreal`
- Button suffix: `a3f9c2b17d4e5f6081a2b3c4d5e6f708`

### 9.2 `schedule_changed`

**Body (fr)**

```
Chantier {{job_number}} : l'horaire a changé.
Nouvelle arrivée : {{arrival_window}}
Adresse : {{street}}
La fiche de chantier est à jour.
```

**Body (en)**

```
Job {{job_number}}: the schedule has changed.
New arrival: {{arrival_window}}
Address: {{street}}
The job sheet is up to date.
```

**Footer / Button** — identical to §9.1, so both templates resolve to the same
crew page and the sending code differs only in the template name.

### 9.3 Notes on the wording

- The job number leads because it is what the crew and the owner both say out
  loud, and it is what `inferJobId()` in `store.ts` already parses out of inbound
  replies (`/(?:#|job\s*|travail\s*)(\d{3,6})/i`). A reply quoting the dispatch
  will file itself against the right job for free.
- No price, no client name, no phone number. The street is included because a
  crew member deciding whether to accept needs to know where; everything more
  specific — unit number, lockbox code, access notes — is behind the token.
- `{{arrival_window}}` is pre-formatted server-side into one line. Do not pass a
  raw timestamp and do not let it contain a newline.

---

## 10. Owner checklist — Meta console

Do these in order. Steps 1–7 are once, ever. Step 8 is twice, ever.

1. **Confirm the WhatsApp Business Account** at
   `business.facebook.com` → **WhatsApp Manager**. The inbound webhook already
   works, so this exists — you are only opening it to find IDs.
2. **Copy the Phone number ID.** WhatsApp Manager → **API Setup** → the numeric
   **Phone number ID** under your business number. This is *not* the phone
   number. Save it as `WHATSAPP_PHONE_NUMBER_ID`.
3. **Copy the WhatsApp Business Account ID** from the same screen. Save it as
   `WHATSAPP_WABA_ID`. Only needed if templates are ever managed by API; grab it
   while you are there.
4. **Complete Business Verification** if it is not already done: Business
   Settings → **Security Centre** → Start Verification. This lifts the messaging
   limit from 250 to 2,000 unique recipients per 24 hours. Three crew members
   will never approach 250, so this is **not urgent** — but verification is also
   what makes the account look real to Meta's quality systems, and it takes days
   when you need it and minutes when you don't.
5. **Create a permanent access token.** This is the important one, and the
   current `WHATSAPP_ACCESS_TOKEN` may well be the wrong kind (§12.4):
   - Business Settings → **Users** → **System Users** → *Add*
   - Name it something like `renovision-server`, role **Admin**
   - **Add Assets** → select the WhatsApp Business Account → grant **Full
     control**
   - **Generate New Token** → select your app → scopes **`whatsapp_business_messaging`**
     and **`whatsapp_business_management`** → **Expiration: Never**
   - Copy it now. It is shown once. Put it in `WHATSAPP_ACCESS_TOKEN`.
6. **Verify the webhook is subscribed to `messages`.** WhatsApp Manager →
   **Configuration** → Webhooks → the `messages` field must be ticked. It already
   is, or inbound would not work — confirm rather than assume, because outbound
   status callbacks ride the same subscription.
7. **Add the crew to `whatsapp_contacts`** with `role = 'subcontractor'` and
   `opted_in_at` set. Ask each of them, in person, whether it is fine to send job
   details to their WhatsApp, and record the date. Ninety seconds; it is the
   whole consent record.
8. **Submit the two templates.** WhatsApp Manager → **Message templates** →
   *Create template*:
   - Category **Utility** (it will try to guess; correct it)
   - Name `job_scheduled`, language **French**, paste §9.1 fr
   - Add the URL button, set it to **dynamic**, base
     `https://www.renovisionana.ca/crew/`
   - Fill every sample field — submission fails without them
   - Submit, then **Add language** → English → paste §9.1 en
   - Repeat for `schedule_changed` (§9.2)
   - Wait for **Active**. Documented as up to 24 hours; usually much less.
9. **If a template is rejected**, the reason appears next to it. Almost always
   it is a missing sample or a body that reads promotional. Edit and resubmit —
   rejection is not a strike, and there is no penalty for resubmitting.

---

## 11. Environment variables

Add to `.env.local.example` (and to Vercel):

```bash
# The numeric Phone number ID from WhatsApp Manager → API Setup. NOT the phone
# number. Unset, nothing can be sent; inbound still works.
WHATSAPP_PHONE_NUMBER_ID=

# WhatsApp Business Account ID. Only needed to manage templates by API; the
# owner creates them in the console, so this is optional today.
WHATSAPP_WABA_ID=

# Base URL for crew links, baked into the approved template's button. Changing
# it requires re-approving both templates, so it is config, not a constant.
CREW_LINK_BASE_URL=https://www.renovisionana.ca/crew
```

Already present and reused as-is: `WHATSAPP_ACCESS_TOKEN` (but see §12.4 — it
must be a **System User permanent token**, not a 24-hour test token),
`WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`.

---

## 12. Failure modes

### 12.1 The number is not on WhatsApp

**There is no way to check in advance.** The old On-Premise API had a `/contacts`
endpoint; the Cloud API has no equivalent, and the third-party "number checkers"
that fill the gap work by driving an unofficial client — not something to put in
this stack.

So: send, and treat the `failed` webhook as the check. `131026` covers it. Record
the failure against the contact, and fall back to SMS.

### 12.2 A crew member blocks the business

Indistinguishable from 12.1 — also `131026`, deliberately. Meta will not
disambiguate. Same handling: mark the contact, notify the owner, fall back.

The signal worth acting on is *repetition*. One failure is a flat battery; three
in a row to the same contact is someone who has left. Surface it in the admin UI
rather than retrying.

### 12.3 Template rejected, paused, or recategorised

- **Rejected** — never went live; fix the text and resubmit. No penalty.
- **Paused** — quality dropped, usually from blocks or "report" taps. Sends fail
  with `132001`. Auto-resumes after a cooling period. At three recipients who
  expect the messages this is close to impossible, which is one more argument for
  keeping crew traffic on templates that only crew receive.
- **Recategorised** to Marketing — sends keep working at 7.4× the price. Meta
  does not shout about it. Worth a note in the admin UI reading
  `pricing.category` off the status webhook (§6.2) and flagging when a dispatch
  bills as `marketing`. That field is already in the payload; nothing else in the
  system will ever tell you.
- **`132000`** — parameter count mismatch. Means the template was edited in the
  console without the code being updated. Guard by keeping the template name and
  its parameter list in one file.

### 12.4 Access token expiry — the one most likely to bite

Meta issues several kinds and only one is right:

| Kind | Lifetime | Use |
|---|---|---|
| Temporary / test token from the app dashboard | **24 hours** | Testing only |
| User access token | ~60 days | No |
| **System User token, Expiration: Never** | **Permanent** | **This one** |

The 24-hour token is the default the dashboard offers, and it is what most
people copy first. **`WHATSAPP_ACCESS_TOKEN` may currently be one of those** —
inbound media downloads would have started failing silently 24 hours after it was
set (`downloadMedia()` logs and swallows, per its comment). Worth checking before
anything else: if inbound photos have ever mysteriously stopped arriving, this is
why.

Symptom: `code: 190`, *"Access token expired"*. Handle it loudly — a dispatch
system that silently stops dispatching is worse than one that crashes. Log at
error level and surface it in the admin UI; do not swallow it the way the media
path does.

### 12.5 Other codes worth branching on

| Code | Meaning | Response |
|---|---|---|
| `131047` | Outside 24h window, free-form refused | Send the template instead |
| `131026` | Undeliverable (not on WA / blocked / ToS) | Mark contact, fall back to SMS |
| `132001` | Template missing, unapproved, or paused | Alert owner; do not retry |
| `132000` | Wrong number of parameters | Code/template drift; alert |
| `132012` | Bad parameter format (newline/tab/URL) | Sanitise before sending |
| `131056` | Too many messages to one recipient too fast | Back off |
| `190` | Token expired | Alert loudly (§12.4) |
| `368` | Account restricted for policy violation | Stop; owner must resolve |
| `80007` | WABA rate limit | Back off; unreachable at this volume |

### 12.6 Webhook duplicate deliveries

Already handled — `recordMessage()` upserts on `wa_message_id`. The outbound path
must use the same discipline; see the ordering hazard in §6.3.

---

## 13. Precise code changes

The crew page and its token module already exist (see below). Everything on the
sending side does not. Plan by path.

> Checked against the working tree on 2 Aug 2026, which had substantial
> uncommitted work in it — `src/app/crew/`, `src/lib/crm/crewView.ts` and
> `supabase/migrations/0020_crew_tokens.sql` were all untracked. Re-check before
> starting; some of this may have moved.

**New — `supabase/migrations/0021_whatsapp_dispatch.sql`**
Note that `0019` is absent and `0020_crew_tokens.sql` is unapplied in code; this
is additive to both.
- `whatsapp_messages`: add `template_name text`, `error_code integer`,
  `error_detail text`, `billing_category text` (from `pricing.category`, to catch
  §12.3 recategorisation).
- New `job_dispatches` — `job_id`, `contact_id`, `kind`
  (`'scheduled' | 'schedule_changed'`), `wa_message_id`, `channel`
  (`'whatsapp' | 'sms'`), `sent_at`, `delivered_at`, `failed_at`, `error_code`.
  Unique on `(job_id, contact_id, kind, sent_at)` so a double-click on "notify
  crew" does not buzz three phones twice.
- `job_crew_tokens`: add `acknowledged_at timestamptz` for the "Got it" tap
  (§8.3). If the per-contact split below is adopted, this belongs on the
  per-contact row instead, where it can say *who*.
- RLS on, no policies, `grant all ... to service_role` — matching every other
  migration here.

**New — `src/lib/whatsapp/send.ts`**
The only module that talks to `/messages`. `sendText()`, `sendTemplate()`,
`uploadMedia()`. Owns `GRAPH_VERSION`, reads `WHATSAPP_PHONE_NUMBER_ID`, returns
a discriminated `{ ok: true, wamid } | { ok: false, code, detail }` rather than
throwing — every caller has to make a fallback decision, and an exception makes
that easy to skip. Never logs the token.

**New — `src/lib/whatsapp/templates.ts`**
Template names, their parameter lists, and the builders that produce the
`components` array. One file so §12.3's `132000` drift is a compile error rather
than a runtime one. Exports `jobScheduled()` and `scheduleChanged()`.

**Already exists — do not rebuild.** `src/lib/crm/crewView.ts` provides
`ensureCrewToken(jobId)` (mints `randomBytes(32).toString("hex")`, 90-day TTL,
re-mints on expiry), `getCrewJob(token)`, `revokeCrewToken(jobId)`, and the
column allowlist. `src/app/crew/[token]/page.tsx` renders it — `robots: { index:
false, follow: false }`, `force-dynamic`, bilingual FR-first, with checklist and
visit-done actions in `actions.ts` / `CrewActions.tsx`. Dispatch calls
`ensureCrewToken` and sends the result as the button suffix. Nothing else.

Two gaps worth closing while you are here, both small:

- **`Referrer-Policy: no-referrer` is not set.** `next.config.ts` has no `headers()`
  entry at all, and the crew page links out to Maps for the address — so the token
  currently travels to Google in the `Referer` header. Add a `/crew/:token*`
  source with `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`,
  and `X-Robots-Tag: noindex, nofollow, noarchive`. This is the one real
  weakness in an otherwise careful piece of work.
- **No arrival acknowledgement.** `VisitDoneButton` marks work *finished*, which
  is a different question from "did anyone read the dispatch." A "C'est reçu /
  Got it" tap writing `acknowledged_at` (§8.3) can reuse the existing Server
  Action pattern almost verbatim.

Also worth checking: `loadPhotos` signs project files via `signProjectFileUrls`.
Inbound WhatsApp photos live in the separate `whatsapp-media` bucket
(`src/lib/whatsapp/store.ts`). If the crew should see photos a subcontractor sent
in, that is a second source the crew payload does not currently read.

> **A limitation to know about, now that dispatch will send these links to three
> people at once.** The token is keyed on `job_id` — one link per job, shared by
> the whole crew. The blast-radius reasoning in the migration is sound, but it
> means `last_viewed_at`, and any acknowledgement built on top of it, can only
> say *someone* opened it, never *who*. With one crew member that distinction did
> not exist; with three it is the whole question.
>
> If per-person accountability matters, the change is `(job_id, contact_id)` as
> the primary key and one token minted per crew member — same table, same expiry
> logic, three rows instead of one, and `ensureCrewToken` grows a second
> argument. It is a contained change today and a migration with live links in the
> wild later, so it is worth deciding before dispatch ships rather than after.
>
> Optional hardening, not required: store `sha256(token)` rather than the token,
> so a database leak does not hand over live links. `clients.hub_token` stores
> plaintext today, so doing this only for crew links makes the codebase
> inconsistent — a judgement call, and the content behind a crew link is less
> sensitive than behind a hub link.

**New — `src/lib/crm/dispatch.ts`**
The orchestration, and the only new moving part. Call `ensureCrewToken(jobId)`
from `crewView.ts` once, then for each assigned crew contact: refuse if
`opted_in_at` is null; check for an inbound message within 24h and send free-form
if so, template otherwise (§3.5); insert the `job_dispatches` row *before* the
API call (§6.3); patch in the `wamid`; on `ok: false` record the code and hand off
to SMS. Formats `arrival_window` from the job's next `visits` row into a single
line with no newline, tab, or run of spaces (§9).

Note there is no `crew_contacts` join table yet — "assigned crew" is not modelled
anywhere. Either add `job_crew (job_id, contact_id)` to migration 0021, or start
by dispatching to every `whatsapp_contacts` row with `role = 'subcontractor'` and
a non-null `opted_in_at`. At three people the second is honest and takes an hour;
the first is where it ends up.

**Edit — `src/app/api/whatsapp/webhook/route.ts`**
- `GRAPH_VERSION` → `"v26.0"` (line 28), or better, import it from `send.ts` so
  there is one version string.
- Widen the `statuses` type: add `errors`, `pricing`, `biz_opaque_callback_data`,
  `recipient_id`, `timestamp`.
- `updateStatus()` → persist `errors[0].code` / `.error_data.details` and
  `pricing.category`, and mirror terminal states onto `job_dispatches`.
- Make the status write an upsert, or accept the ordering fix in `dispatch.ts`.

**Edit — `src/lib/whatsapp/store.ts`**
Add `recordOutbound()` — same upsert discipline as `recordMessage()`, but
`direction: "outbound"` and `needs_filing: false` — plus a
`hasRecentInboundFrom(contactId)` helper for the 24-hour-window check.

**Edit — `.env.local.example`** — §11, in the existing WhatsApp block, with the
comment style the file already uses.

**Edit — `src/app/admin/jobs/[id]/`** — a "Notify crew" action, plus per-crew
delivery state, plus the recategorisation flag from §12.3.

---

## 14. Unverified

Things I could not confirm from primary sources. Check before relying on them.

1. **October 2026 service-message rates.** Meta has announced the change and
   stated service rates will match utility rates, but the numbers are not
   published — they are promised by 1 September 2026. The $0.0034 used in §4.3
   for post-October service messages is Meta's stated intent, not a published
   rate.

2. **`biz_opaque_callback_data` specifics.** I could not load Meta's messages API
   reference page (it 500s and the newer `/documentation/` path returns
   navigation chrome only). The field is real and widely used, but I have **not**
   verified its maximum length, whether it is echoed on *every* status or only
   some, or whether it appears on the send response. §6.3 recommends not making
   it load-bearing for exactly this reason.

3. **Exact `sent` / `read` status payloads.** Meta's docs published a complete
   example only for `delivered`. The `sent`/`read` shapes in §6.2 are inferred
   from the `delivered` shape and third-party reproductions. Field *names* are
   consistent across sources; treat the exact set present on each as unconfirmed
   and code defensively.

4. **Whether the current `WHATSAPP_ACCESS_TOKEN` is a permanent System User
   token.** Cannot be determined from the repo. §12.4 explains how to tell and
   why it matters.

5. **Graph v21.0's exact expiry date.** v21.0 is not in the changelog table I
   read (which starts at v22.0). January 2027 is extrapolated from Meta's
   two-year cadence, not read.

6. **Template approval time in practice.** Meta documents "up to 24 hours."
   "Usually minutes" is the consistent third-party report, not a Meta commitment.

7. **`fr` vs `fr_CA`.** Confirmed from a reseller's published language table, not
   from Meta's own list, which I could not load. If `fr` is rejected at
   submission the console will offer the valid alternatives.

8. **Groups API OBA requirement.** Meta's Groups overview states it plainly, but
   I did not find documentation on whether an OBA can be *applied* for by a small
   business or is granted only on notability. If the owner ever obtains one, the
   Groups path is worth revisiting — it would collapse three sends into one.

Unverified in the SMS comparison (§8.1), all of which would need confirming in
the Twilio console before that path is built. None of them change the
recommendation:

9. **The March 2025 Canadian-10DLC registration cutover.** Found only in reseller
   documentation, not on a first-party Twilio page — Twilio's help centre is
   JS-rendered and returns 403 to fetchers. This is the fact behind "SMS may need
   a 10–15 day campaign review," so if the recommendation is ever revisited on
   the strength of that argument, verify it first.
10. **Twilio Canadian local number monthly rental** (~$1.15 used in §8.3).
11. **A2P Sole Proprietor brand fee** — sources give $4.00 and $4.50.
12. **Whether the business phone number is Twilio-imported or ElevenLabs-native.**
    Determines whether the SMS fallback needs a new number. Answerable from the
    ElevenLabs dashboard, not from the repo.
