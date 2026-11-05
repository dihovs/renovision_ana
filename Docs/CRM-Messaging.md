# Texting, WhatsApp and the inbox

The CRM's messaging side, for a chat that has to work on it. Voice and the
Twilio account itself are `Docs/Twilio-Wiring.md`; this is what happens to a
message.

**Nothing here has been tested live by the author of this file.** It is read off
the source on `mobile-app`, 20 Aug 2026. Where something is untested it says so.

---

## 1. The shape of it

Two independent channels that look similar and share nothing:

| | Channel | Inbound | Outbound | Storage |
|---|---|---|---|---|
| **SMS / MMS** | Twilio | `POST /api/sms/incoming` | `sendSms()` → Twilio REST | `sms_messages` |
| **WhatsApp** | Meta | its own webhook | `lib/whatsapp/send.ts` → Cloud API | `whatsapp_*` via `lib/whatsapp/store.ts` |

They are deliberately separate. WhatsApp is an **unfiled queue** whose goal is to
be emptied onto jobs; SMS is a **conversation** kept per number. Do not merge
them without being asked.

That rule is about **writing**. `lib/crm/conversations.ts` reads across both so
the assistant can answer "what did Mike say" without being asked which app it
arrived in — read-only, nothing merged, every row still labelled with its
channel. Adding a write path that spans them is still off the table.

Where things live:

```
src/app/api/whatsapp/webhook/route.ts   inbound + delivery receipts
src/lib/whatsapp/send.ts                the only caller of Meta's /messages
src/lib/whatsapp/templates.ts           the two approved templates
src/lib/crm/dispatch.ts                 who gets told, and what happens if it fails
src/lib/crm/conversations.ts            reading both channels back, for Ana
src/components/admin/NotifyCrew.tsx     the "Notify crew" panel on a job

src/app/api/sms/incoming/route.ts    the webhook
src/lib/sms/send.ts                  sendSms, opt-outs, E.164, STOP/START
src/lib/sms/media.ts                 MMS media in and out of our bucket
src/lib/sms/attribution.ts           number → client
src/lib/sms/inbox.ts                 the thread list
src/lib/phone.ts                     formatDialed, sanitisePasted
src/app/(internal)/admin/messages/   inbox page, [phone] thread, actions.ts
src/components/admin/SmsThread.tsx   the conversation UI
```

---

## 2. Compliance — read this before changing the send path

Texting a Québec business's customers is governed by **CASL**, and three
behaviours in the code exist for it. None is decoration.

**The webhook honours STOP before it stores anything.** In
`api/sms/incoming/route.ts` the opt-out is written *first*, deliberately, so a
crash later cannot leave us having received "STOP" and done nothing. CASL
s.11(2) allows ten business days; that is a ceiling for paperwork, not a target
for a system that can do it in one statement.

**Every send checks the opt-out list.** `sendSms` calls `hasOptedOut(to)` and
returns `{ sent: false, reason: "opted_out" }` rather than throwing. The list is
its own table, `sms_opt_outs`, not a column on a client — a number can opt out
without belonging to anybody.

**First contact carries a footer.** `caslFooter()` appends, in French by default:

> `— Renovision AnA. Répondez STOP pour ne plus recevoir de textos.`

Only on the first outbound message to a number (`isFirstContact()` checks for a
prior outbound row). Do not append it to every message, and do not remove it.

The webhook **always answers 200**, even on a malformed body, and returns an
empty `<Response/>`. A non-2xx makes Twilio retry, and a retry cannot fix a
malformed request. The one exception is a bad signature → **403**: an unsigned
request is not from Twilio and there is no retry to protect.

---

## 3. Photos (MMS) — mostly built, invisible at the ends

This was the owner's request on 20 Aug: *"when customers are chatting with me, I
want to be able to send and receive photos."* Most of the plumbing landed; the UI
did not.

### Built

- **Inbound.** The webhook reads `NumMedia` / `MediaUrl0…N` and calls
  `storeInboundMedia()`. Pictures are fetched **before** the row is written, so a
  message is never stored claiming media it does not have. If the download fails
  the text is still saved and an error is logged loudly — that failure is exactly
  what once looked like "MMS doesn't work".
- **Storage.** `lib/sms/media.ts` copies each file into a **private** Supabase
  bucket, `sms-media`. Twilio's own URLs expire and are guessable, so they are
  never persisted. `signSmsMedia(paths)` mints signed URLs per request, TTL one
  hour. Caps: **5 MB** a file, 15 s fetch timeout.
- **Schema.** Migration **0040** adds `sms_messages.media_paths text[] not null
  default '{}'`, plus a partial index for threads that have media.
- **Outbound API.** `sendSms({ mediaUrls })` exists and is covered by
  `send.test.ts`. The URLs must be reachable **by Twilio**, not by us — a signed
  URL from our bucket works, a bare storage path does not. An empty array is not
  the same as absent: it still sends a plain SMS.

### Outbound MMS: decided against, 20 Aug 2026

The owner chose email over MMS for sending photos: *"We'd rather not do it, and
just do email."* Cost was not the reason — see below; it is about three cents a
photo. **Do not build outbound MMS without asking him again.** `sendSms` keeps
its `mediaUrls` parameter because it is written and tested and reversing the
decision should not mean rewriting it.

The **inbound** half is a separate question and is NOT covered by that decision.
It is already live.

### Not built — this is the remaining work

- **`SmsThread.tsx` renders `message.body` and nothing else.** Photos are
  arriving and being stored right now and no screen shows them. Customers text
  photos regardless of which channel we prefer, so this is not resolved by the
  decision above: it is data being collected with no way to look at it, which is
  the one state worth nobody's defence. Either draw them or stop capturing them.
- **Nothing calls `sendSms` with `mediaUrls`** — correct, and now deliberate.

### When you build it

- Sign paths at render time, never store a signed URL — it outlives its expiry.
- `JobThread.tsx` and `admin/inbox/page.tsx` already do exactly this for
  WhatsApp: collect paths, sign in one batch, pass a `path → url` map down.
  Copy that shape rather than inventing a second one.
- **Cost is not a reason to hold this back.** Twilio Canada, Aug 2026: outbound
  MMS **$0.022**, inbound **$0.0165**, against $0.0083 either way for SMS, plus a
  carrier surcharge of roughly $0.007–0.009. So ~$0.03 to send a photo. At twenty
  jobs a month exchanging ten photos each that is **about $6/month**. The ratio
  is 2.6× SMS; the absolute is pennies, and quoting the ratio alone once made
  this look like a decision worth deferring. It is not.
- **Deliverability is the real caution**, not price. Canadian carriers are
  stricter about MMS on long codes than on SMS, and a large image can be
  rejected or downscaled. That is why `media.ts` caps at 5 MB.

---

## 4. Attribution, and saving a stranger

`findClientForPhone(phone)` matches a number to a client; `findClientIdForPhone`
is the id-only form the webhook uses. A miss is **ordinary, not an error** —
strangers texting in are half the point of the inbox, and the message is stored
either way.

The thread header shows *"Open client page"* when the number is known. When it is
not, `SaveContactForm` offers **Save as client** — it takes a name, reuses the
number straight from the thread (already E.164, already what attribution will
match on), and marks it `smsAllowed: true` because **they texted us first**,
which is express consent under CASL with the conversation itself as evidence.

It re-checks `findClientForPhone` immediately before inserting, so a double-tap
or a second tab lands on the existing client instead of creating a duplicate
that would split the thread's attribution.

---

## 5. Phone numbers

`src/lib/phone.ts`:

- **`sanitisePasted(raw)`** — keeps digits, `*`, `#`, and a leading `+`. This is
  what makes pasting `(514) 555-0188` or `+1 514-555-0188` work.
- **`formatDialed(value)`** — progressive NANP formatting for display; leaves
  anything containing `*` or `#` alone, since those are dial codes.
- **`toE164`** (in `sms/send.ts`) — the storage form. The `sms_messages.phone`
  column has a check constraint `^\+[1-9][0-9]{7,14}$`, so a non-E.164 number
  cannot be written even by accident.

**Every number input must run `sanitisePasted` on change.** `Softphone`,
`NewTextForm` and `Dialer` all do. A raw input straight into state was the
paste bug the owner reported.

---

## 6. Environment

Full table in `Docs/Twilio-Wiring.md` §"Environment variables". For messaging
specifically:

| Variable | Without it |
|---|---|
| `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` | `sendSms` returns `not_configured`; the webhook's signature check cannot run |
| `SMS_FROM_NUMBER` | falls back to `SITE_PHONE_TEL` — deliberately unset |

**Vercel injects these at build time.** Adding one does not change the running
deployment; it needs a rebuild.

---

## 7. Gotchas that have already cost time

- **Sending to our own number is refused** (`toE164(from) === to`) — it would be
  recorded as a customer reply and corrupt the thread.
- **`sendSms` never throws for outcomes the owner can act on.** It returns a
  reason: `opted_out`, `invalid_number`, `not_configured`, or a detail string.
  The server actions turn those into sentences. Keep that contract.
- **`status` is what WE know**, not a delivery receipt: `queued` when Twilio
  accepts, `failed` when it refuses, `received` for inbound. Delivery receipts
  are not wired.
- **Migrations are applied by hand** in the Supabase SQL editor, and every one
  must end `notify pgrst, 'reload schema';` or PostgREST serves a stale schema
  and the app reports a column that exists as missing.

---

## 8. Testing

`src/lib/sms/send.test.ts` and `inbox.test.ts` run under vitest with no network
— Twilio is stubbed. Run `npx vitest run src/lib/sms/`.

There is no test for the webhook route itself, and none of the MMS path has been
exercised against a real Twilio message. **Sending yourself a photo from a real
phone is the only thing that proves the inbound path**, and it has not been done.

---

## 9. Dispatch — telling the crew, and what is left to switch it on

Built 30 Aug 2026, to the design in `Docs/WhatsApp-Team-Dispatch-Research.md`.
**Nothing here has been sent to a real phone yet** — every step below that is a
Meta console step is the owner's, and until they are done `dispatchJob` returns
"WhatsApp sending is not configured yet" and sends nothing.

### What the code does

One utility template per crew member, carrying the job number, the arrival
window, the street and a button to the crew page. No tasks, no photos, no
prices — those are behind the token, where `crewView.ts`'s allowlist keeps money
out. The panel is on the job page: tick who, pick "booked" or "time changed",
send. Nobody is pre-ticked, and anybody without `opted_in_at` cannot be ticked.

If a 24-hour window happens to be open (they messaged us today), it sends
ordinary text instead of a template — same content, reads better. Never the
other way round: free-form as the mechanism would mean dispatch only works when
the crew remembered to message first.

**Only one failure falls back to SMS:** `131026`, not a WhatsApp user. A dead
token, a paused template or a rate limit are problems with us, and texting
around them would hide the thing that needs fixing.

### To switch it on

1. **Apply `supabase/migrations/0044_whatsapp_dispatch.sql`** in the Supabase SQL
   editor, ending with the `notify pgrst` line it already carries.
2. **Meta console, `Docs/WhatsApp-Team-Dispatch-Research.md` §10** — the phone
   number ID, a *permanent System User* access token (a 24-hour test token works
   for a day and then every send fails with `190`), and the two templates.
3. **Vercel env**: `WHATSAPP_PHONE_NUMBER_ID`, `CREW_LINK_BASE_URL`, and the
   permanent token in `WHATSAPP_ACCESS_TOKEN`. Vercel injects at build time —
   adding one needs a redeploy.
4. **Add the crew to `whatsapp_contacts`** with `role = 'subcontractor'` and
   `opted_in_at` set on the date each of them agreed, in person.

### Known limitation, decided deliberately

The crew token is per **job**, not per person, so `last_viewed_at` and the
`acknowledged_at` column 0044 adds can only ever say *someone* opened the link
— never who. Changing that is `(job_id, contact_id)` as the key and one token
per person: contained today, a migration with live links in the wild later.
