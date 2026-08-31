# Ana — capability work orders

Sequenced work for Claude Code. Say "do ANA-01".

**This is not `ORDERS.md`.** That file is the magicplan / floor-plan workstream and runs
`ORD-nn`. This one runs `ANA-nn`. Do not interleave the commits.

**Rules**

- One order at a time. Do not start the next until "Done when" holds.
- Commit per order, message prefixed with the id. Stage by path — the tree carries unrelated
  uncommitted work (estimator rules, report strings, affected areas, `0045_ceiling_areas.sql`).
- If an order's premise is wrong, **stop and report**. Do not improvise a substitute.
- Branch `mobile-app`. Never `main`.
- Stop for review after each order.

---

## What the owner actually asked for (30 Aug 2026)

Not "more tools". A specific, recurring waste of his day:

> Someone messages on **Teams**. They follow up by **email**. He relays it to the crew on
> **WhatsApp**. The customer tells the crew something, which comes back to him on WhatsApp.
> Now the job's history is in four places and he has to go around and reassemble it.

So: Teams messages, Outlook, OneDrive, QuickBooks, WhatsApp Business — **one place**, and
Ana does the work he gives her. Explicitly **not** Teams voice calls.

---

## Progress

| Order | What | Status |
|---|---|---|
| **Part 1 — foundations** | | |
| ANA-01 | The write boundary, stated in code | ✅ done — `6cb05d1` |
| ANA-02 | Identity: one person across five systems | ✅ done `8731b15` — 0046 unapplied (owner: batch with 0044) |
| ANA-03 | Channels, plural | ✅ done |
| **Part 2 — Microsoft, one integration** | | |
| ANA-04 | The Graph connection, scoped to exclude voice | ✅ code done — owner: Entra registration + env vars + migration 0047, see Docs/Microsoft-Graph-Setup.md |
| ANA-05 | Teams chat | ✅ done — sync runs once Microsoft is connected |
| ANA-06 | Outlook mail | ⬜ not started |
| ANA-07 | OneDrive, searched not synced | ⬜ not started |
| **Part 3 — one place** | | |
| ANA-08 | `record_brief` across every channel | ⬜ not started |
| ANA-09 | `search_messages`, widened | ⬜ not started |
| **Part 4 — doing the work** | | |
| ANA-10 | Close the task loop | ⬜ not started |
| ANA-11 | What is slipping | ⬜ not started |
| ANA-12 | What do we charge | ⬜ not started |
| ANA-13 | Did this job make money | ⬜ not started |
| ANA-14 | Moisture readings | ⬜ not started |
| ANA-15 | Draft an estimate, never send it | ⬜ not started |
| ANA-16 | Draft an invoice, never send it | ⬜ not started |
| ANA-17 | Draft an email reply, never send it | ⬜ not started |
| ANA-18 | Message the crew | ⬜ not started |
| ANA-19 | Memory | ⬜ not started |
| **Part 5 — blocked** | | |
| ANA-20 | QuickBooks | 🚫 blocked — Intuit, owner-only |

---

## The frame — read once, before ANA-01

### Five systems are three integrations

**Teams, Outlook and OneDrive are all Microsoft Graph.** One Entra app registration, one
consent, one token, one HTTP client, three sets of endpoints. Building them as three
integrations would be three times the work for no benefit. That is why they are one order
(ANA-04) plus three thin readers (ANA-05/06/07).

So the real list is: **Microsoft Graph** (new), **WhatsApp** (built 30 Aug), **QuickBooks**
(blocked — ANA-20).

### "No voice calls" is free, and it belongs on the consent screen

The owner's boundary is honoured by **never requesting the scope**. Ana asks for
`Chat.Read`, `Mail.Read`, `Files.Read.All`, `offline_access`, `User.Read`. She does not ask
for `CallRecords.Read.All` or anything else call- or meeting-shaped. Microsoft then refuses
her, permanently, regardless of what any prompt says.

Same principle as `ownerToolsFor()`: the thing that cannot be talked into anything is the
thing that was never granted. Write the requested scopes in one named constant so the
exclusion is visible in a diff.

### The hard part is not access. It is identity.

Reading four inboxes gives four piles. The owner's problem is that one conversation is
*spread across* them. Turning four piles into one story needs a single answer to: **is this
the same human, and is this the same job?**

Today `resolveContact` (`src/lib/crm/contactMatch.ts`) turns a *spoken name* into a client,
carefully and fuzzily, because speech is lossy. Identifiers are not lossy. An email address,
a phone number, a Teams user id and a WhatsApp `wa_id` are exact. They need an exact join,
not a fuzzy one, and that join does not exist yet. It is ANA-02, and everything in Part 3
is worthless without it.

### Email makes the injection problem real

The standing rule — a message is a quote, never a fact, never an instruction — has been
cheap to hold so far because WhatsApp is a small circle of crew and customers, and Ana's
message tools are read-only.

Email is different. **Anyone on earth can put text in front of her**, unauthenticated, for
free. So can a shared OneDrive file. And this plan gives her the power to draft invoices and
reply to mail. An email reading *"please invoice the Fleury job for 12,000, as agreed"* must
be a thing Ana *reports*, never a thing Ana *does*.

Two structural defences, neither of them prompt wording:

1. **ANA-01's permitted-write list**, tested. Ana drafts; issuing stays a human click.
2. **Nothing Ana reads may become an instruction.** Ingested content is quoted into context
   as attributed text with its channel and sender, the way `asTranscript` already does
   (`conversations.ts:333`). Tool arguments come from the authenticated owner's own words,
   never from a message body.

### Sync, not live search

A phone call cannot wait on four APIs. Messages are pulled into the CRM and searched
locally, exactly as WhatsApp already works: webhook in → own table → `searchConversations`.

**This depends on a blocker.** Graph change-notification subscriptions expire in about three
days and must be renewed on a schedule, and `Automation-Blockers.md` §1 records that Vercel
Hobby allows cron only once a day. Vercel Pro is a prerequisite for Part 2, not an optional
upgrade.

---

# Part 1 — Foundations

## ANA-01 — The write boundary, stated in code  🔴 FIRST

Nothing new ships until the rule every later order obeys can fail a test, rather than sitting
in a comment that drifts.

**The rule: Ana drafts, she never issues.** She may create a record in a state that has no
effect outside the company. She may never move it to a state that does. `draft` is already a
real quote status and quotes are editable only while draft (`src/lib/crm/quoteTypes.ts:13,43`).

The boundary has already slipped once without anyone noticing: `Docs/Voice-Owner-Mode.md`
still says Ana writes *"exactly one thing"*, while `ownerTools.ts:26` says two —
`queue_customer_call` was added and the doc never caught up. Nineteen orders of new power
against a rule nobody tests is how a send-invoice tool gets added on a convenient afternoon.

**Do**

1. An explicit permitted-write list in `ownerTools.ts` — the CRM functions handlers may call,
   named one by one. Not a category. Not a prefix rule. A list.
2. Tests asserting the forbidden set is unreachable from any handler: `sendQuote`,
   `sendInvoice`, `recordPayment`, `deletePayment`, `setQuoteStatus`, `setInvoiceStatus`, and
   every `delete*` / `setArchived` in `src/lib/crm/`. Extend `ownerTools.test.ts`.
3. Rewrite the `ownerTools.ts` header comment to state draft-not-issue.
4. Correct `Docs/Voice-Owner-Mode.md` §"What she can and cannot do", which is wrong today.

**Done when** a test fails if someone wires `sendInvoice` into a handler, and both documents
agree with the code.

**Do not** implement this as prompt wording.

---

## ANA-02 — Identity: one person across five systems  ⭐ the spine

The order that makes "one place" possible. Everything in Part 3 reads from here.

Today each channel keeps its own contacts (`whatsapp_contacts`, 0010) and messages resolve to
a job by channel-specific rules. There is no row that says *this email address, this phone
number and this Teams user are one human, and that human is client X*.

**Do**

1. A `people` table — one row per human — and an `identities` table: `(person_id, kind, value)`
   where kind is `email` | `phone` | `teams_user_id` | `whatsapp_wa_id` | `ms_upn`. Value
   normalised on write (E.164 for phones, lowercased for email). Unique on `(kind, value)`.
2. `person_id` (nullable) on every message table, plus `job_id` where it is not there already.
3. `resolvePerson(kind, value)` — an **exact** lookup, and a deliberate non-match when the
   identifier is unknown, creating an unlinked person rather than guessing.
4. Link `people` to CRM `clients`, one client to many people (a company has staff).
5. Backfill from existing `whatsapp_contacts` and `sms_messages`.

**Done when** one client record can name every address, number and account the same humans
reach him from, and a new message lands attached to a person rather than orphaned.

**Do not** fold this into `contactMatch.ts`. That module resolves *spoken names* and is tuned
to fail towards asking, correctly. Identifiers are exact and must not inherit fuzziness.

---

## ANA-03 — Channels, plural

`ConversationChannel` is `"whatsapp" | "sms"` (`conversations.ts:26`) and
`searchConversations` fans out to one search function per channel and merges. The shape
already anticipates more than one — it just has to actually take more.

**Do** — widen the union to `whatsapp | sms | teams | email`, generalise the fan-out so a
channel is registered rather than hard-coded, and keep per-channel tables as the system of
record. Each channel has fields the others do not (`wamid` and `billing_category` for
WhatsApp; `internetMessageId` and thread id for mail) and flattening them loses information.
`asTranscript` labels every line with its channel, so the owner always hears where something
was said.

**Done when** `searchConversations` returns a correctly ordered, correctly capped merge across
four channels, and adding a fifth means adding a reader, not editing a switch in six places.

**Do not** migrate WhatsApp and SMS into one table. Revisit only if the fan-out measurably hurts.

**Shipped.** `CHANNEL_READERS` is the registry and the only place the list is
written; `IMPLEMENTED_CHANNELS` derives from it, and `search_messages`'s enum
derives from that — so Ana cannot be offered a channel with nothing behind it.
`channelsFor()` drops an unbuilt channel rather than throwing mid-call, and
`asTranscript` now labels every line including WhatsApp, which used to be the
implied default. Ten tests, mutation-checked: removing the filter fails two of
them by name.

**The failure mode these tests exist for:** a channel offered without a reader
answers "nothing was said about the boiler" when the truth is "nobody built
that yet" — indistinguishable from a real answer, which is the one thing a
search tool must never be.

---

# Part 2 — Microsoft: one integration, three sources

## ANA-04 — The Graph connection, scoped to exclude voice  🔑 ⚠️ owner action first

**Premise check:** there is **no OAuth infrastructure in this repo**. WhatsApp uses a static
permanent token; `readSetting`/`writeSetting` (`crm/settings.ts:163`) is a plain key/value
store. Refresh-token handling is genuinely new plumbing, and tokens need their own encrypted
storage — not the settings table.

**Owner must do first** (nobody else can):

- Register an application in Entra ID (Azure AD) on the Microsoft 365 tenant.
- Confirm he can consent — some Graph scopes need a tenant administrator. If he is not the
  admin, that is a blocker to record in `Automation-Blockers.md` before any code is written.
- Vercel Pro (blocker §1) — subscription renewal needs cron more often than daily.

**Do** — one Graph client: delegated auth (acting as him, not as the tenant), authorisation
code flow with `offline_access`, encrypted refresh-token storage, silent renewal, and one
named constant listing every requested scope:

`Chat.Read` · `Mail.Read` · `Files.Read.All` · `User.Read` · `offline_access`

**`ChannelMessage.Read.All` is deliberately absent.** The owner confirmed on 30 Aug 2026
that people message him in **direct 1:1 chats**, not team channels, so `Chat.Read` covers it.
That is the narrower grant and it needs no extra consent. If channels are ever wanted, it is
a new decision and a new scope, not a quiet addition here.

and a comment recording that call and meeting scopes are **deliberately absent at the owner's
instruction**, so the next person to touch this file knows the omission is a decision.

**Done when** the CRM holds a renewable delegated token, a health check reports the granted
scopes, and the consent screen shows no access to calls.

**Do not** request application-level permissions "to make it simpler". Delegated access is
exactly the boundary the owner described: his Teams, his mail, his files.

**Shipped.** `src/lib/microsoft/` — `scopes.ts` (the boundary: GRAPH_SCOPES requested,
FORBIDDEN_SCOPES pinned by test; the authorize URL itself is tested to carry no call
scope), `tokens.ts` (AES-256-GCM at rest, refuses to store plaintext when the key is
missing), `auth.ts` (auth-code + PKCE, single tenant, silent refresh, invalid_grant
invalidates rather than retries). Routes: `/api/v1/microsoft/{connect,callback,status}` —
status reports granted-vs-requested so a narrowed grant cannot pass silently. Migration
0047 (one-row table, RLS + service_role grant per the 0040/0046 lesson). 23 tests;
mutation-checked: adding `CallRecords.Read.All` fails four of them.

**Remaining, owner-only:** the seven steps in `Docs/Microsoft-Graph-Setup.md` —
Entra registration, secret, the five delegated permissions + admin consent, the four
env vars in Vercel, migration 0047, then /connect and /status.

---

## ANA-05 — Teams chat

**Do** — read 1:1 and group chat messages via Graph, store in `teams_messages`, resolve the
sender through `resolvePerson('teams_user_id', …)` from ANA-02, and keep current with change
notifications plus a delta backfill. **1:1 chats only** — confirmed 30 Aug 2026. No channel ingest, and no scope for it.

**Done when** a Teams message from a customer is searchable by Ana and attached to the right
person.

**Do not** ingest call records, transcripts, recordings or meeting artefacts. The scope was
never requested; do not add it here.

**Shipped.** Migration 0048 (`teams_messages`, RLS + grants, applied 31 Aug 2026);
`src/lib/microsoft/teams.ts` — polled sync on the 15-minute cron
(`/api/cron/microsoft-sync`), not webhooks: a Graph subscription expires every ~3 days
and needs its own renewal job and validation endpoint, and 15-minute latency is well
inside "Ana, what did he say". Skips, each tested by name: meeting chats (the chat
surface of a call), systemEventMessage rows (where call events live), bots, deleted
messages, reaction-only messages. Inbound senders resolve through
`personForIdentity('teams_user_id', …)`. The `teams` reader is registered in
CHANNEL_READERS, so IMPLEMENTED_CHANNELS and the search_messages enum picked it up
without an edit — the ANA-03 registry doing its job. Waits on: ANA-04's owner steps.

---

## ANA-06 — Outlook mail

**Do** — read the owner's mailbox via Graph, store the parts that answer questions (from, to,
subject, sent time, thread id, plain-text body, attachment names — not attachment bytes),
resolve sender and recipients to people, and file against a job where the thread already
resolves to one.

**Done when** the email half of a conversation that started on Teams appears in the same
answer as the Teams half.

**Do not** store whole mailboxes indefinitely, and do not ingest bodies without the ANA-01
quoting discipline. This is the widest untrusted input in the system.

---

## ANA-07 — OneDrive, searched not synced

Files are large and mostly irrelevant to a spoken question. Syncing a drive to answer "did he
send me the plan" is the wrong trade.

**Do** — a `find_file` tool over Graph search: name, folder, modified date, who shared it, and
a link. Fetch content only for a named file, on demand, and only for text and PDF.

**Done when** *"did the adjuster send anything for Fleury"* names the file and when it arrived.

**Do not** index the drive, and do not open a file just because a message mentioned it.

---

# Part 3 — One place

## ANA-08 — `record_brief` across every channel  ⭐ the payoff

This is the order the owner actually described. Everything before it exists to make it possible.

`buildContext()` (`src/lib/crm/assistant.ts:37`) already assembles everything about one lead,
job or client — server-side from the record id, never from anything the caller sends — and
already quotes WhatsApp and SMS. It powers the admin Ask-Claude box. Ana cannot reach it, and
it does not yet see Teams, email or files.

**Do** — widen `buildContext` to every channel from ANA-03 joined through the people from
ANA-02, then expose it to Ana as `record_brief`, taking a job number or a name resolved via
`resolveContact`. Several matches is a question Ana asks, never a guess the model makes.

**Done when** *"what's the story on the Fleury job"* returns, in one call and one timeline:
the quote, the jobs, the schedule, the money, the Teams messages, the emails, what the crew
said on WhatsApp, and the files — each line saying which channel it came from and who said it.

**Do not** write new SQL. A missing field is added to `buildContext`, so the screen and the
phone can never disagree.

---

## ANA-09 — `search_messages`, widened

`search_messages` searches WhatsApp and SMS. After ANA-03 it should search everything, with
the channel filter widened and the existing `MAX_MESSAGES` cap kept — a spoken answer is still
a breath long.

**Done when** *"has anyone mentioned the boiler"* finds it whether it was said on WhatsApp, in
Teams, or in an email.

---

# Part 4 — Doing the work

## ANA-10 — Close the task loop

She writes tasks and cannot read one back, which makes `capture_task` a place notes go to be
forgotten. `listOpenOwnerTasks` and `setOwnerTaskDone` exist (`crm/tasks.ts:90,198`).

**Do** — `my_tasks` and `complete_task`, matched against open tasks by what he says, never by
an id he would have to read aloud.

**Done when** he can dictate a task Monday, hear it back Tuesday, and close it.

**Do not** guess between two similar tasks. Read both, ask which.

---

## ANA-11 — What is slipping

`followups.ts:40-42` already encodes the thresholds — a quote stales at 5 days, an invoice
reminds at 3 and 14. Nothing tells the owner *which* records tripped them.

**Do** — `whats_slipping`: stale quotes, overdue invoices, and jobs with no inbound message in
N days across every channel from ANA-03.

**Done when** it names the records, oldest first, with how long each has been quiet.

---

## ANA-12 — What do we charge

`crm/priceBook.ts`. Standing in a client's kitchen, he quotes from memory.

**Do** — `price_lookup` over `listPriceBook`, priced through the existing money-to-words
formatter.

**Done when** *"what do we charge for laminate"* answers with item, unit and price, and says so
when several match.

**Do not** total anything. It reads the book. Pricing a job is ANA-15.

---

## ANA-13 — Did this job make money

`crm/expenses.ts` has expenses and time entries; the quote has what was promised; the invoice
has what was billed. Nothing puts the three side by side, on any surface.

**Do** — `job_margin`: quoted, invoiced, spent, hours, and the gap.

**Done when** it gives the three numbers and the difference, and says plainly when costs have
not been entered rather than implying a profit that is only missing data.

**Do not** invent an overhead allocation. Report what is recorded.

---

## ANA-14 — Moisture readings: read, then dictate

The most phone-shaped thing in the CRM. `crm/dryingLog.ts:96,127`. A restoration job needs a
daily reading, taken by someone in a wet basement with a meter in one hand.

Ana's first write beyond a to-do, and the right first one: self-evidently owner-initiated, no
outside effect, and a wrong number is fixed by taking another.

**Do** — `moisture_readings` and `log_moisture_reading`, repeating the reading back before
writing, as `capture_task` does.

**Do not** add equipment placement. Reading a number is dictation; placing a dehumidifier is a
plan edit.

---

## ANA-15 — Draft an estimate, never send it

**Premise check: ANA-01 must be done. If it is not, stop.**

**Do** — `draft_estimate` over `createQuote` (`crm/quotes.ts:370`), in `draft`, against a
resolved client, from price-book items and quantities he dictates. It lands in the admin for
him to open, check and send himself.

**Done when** a dictated estimate appears as a draft, priced by the same code the screen uses,
and `sendQuote` appears nowhere in Ana's reachable set.

**Do not** call `sendQuote`, `setQuoteStatus` or `approveQuoteByToken`. The ANA-01 test should
already be stopping you.

---

## ANA-16 — Draft an invoice, never send it

`createInvoiceFromJob` (`crm/invoices.ts:344`) and `createInvoiceFromQuote` (`:564`) exist and
both already do the tax work. This order adds no arithmetic.

**Done when** *"invoice the Fleury job"* puts a draft in `/admin/invoices` and nothing reaches
anyone.

**Do not** touch `sendInvoice`, `recordPayment` or `setInvoiceStatus`. An invoice leaving the
building is a human action, permanently.

---

## ANA-17 — Draft an email reply, never send it

Once Ana reads Outlook, replying is the obvious next ask, and it is the most dangerous tool in
this document: it turns an untrusted inbound message into an outbound one under the owner's
name.

**Do** — `draft_reply`, creating a **draft** in his mailbox via Graph (`Mail.ReadWrite`, added
in a visible diff to the ANA-04 scope constant). He opens Outlook and presses send.

**Done when** a dictated reply is waiting as a draft on the right thread, and no code path can
send mail.

**Do not** request `Mail.Send`. Not for convenience, not for a "confirmed" send, not ever
without the owner explicitly reversing this line.

---

## ANA-18 — Message the crew

Ana can phone a *customer* (`queue_customer_call`) but cannot message the *crew* — backwards
for a man in a truck at 6am. `dispatchJob` (`crm/dispatch.ts:143`) already sends crew WhatsApp.

Reaches outside, so it gets `queue_customer_call`'s treatment, not a looser one.

**Do** — `notify_crew` through `dispatchJob`: job resolved from the CRM, recipients read off
the job's assigned crew, no destination argument of any kind, message repeated back first.

**Blocked in production** until the Meta console steps are done (phone number id, permanent
System User token, the two utility templates, migration `0044`). Code can be built and tested;
dispatch already refuses rather than half-sends.

**Done when** the crew gets the same message the "Notify crew" panel sends, and no argument
anywhere accepts a phone number.

---

## ANA-19 — Memory  ⚠️ decide the shape before building

Nothing persists. Every call starts blank.

The question is not storage — it is what deserves to be remembered. A fact about a client
("the Fleury basement floods every spring") is durable and useful. A decision from a call is
durable and contestable. A summary of what was said is neither, and will rot.

**Memory is where injection lands.** If anything Ana *reads* can become something Ana
*remembers*, an email becomes a permanent instruction in one hop. Memory is written only from
the owner's own dictated words in an authenticated session — never from a tool result, never
from a message body, never from a file.

**Do** — a written proposal first: what kinds, written by whom, read when, and how he sees and
deletes what she kept. Then build it.

**Done when** he can say "remember that" and hear it back on a later call, and there is no path
from ingested content into the store.

---

# Part 5 — Blocked

## ANA-20 — QuickBooks  🚫 owner-only, not scheduled

**Do not start.** `Automation-Blockers.md` §3: *"Do not let anyone build the QuickBooks
integration until this is resolved."*

Verified 30 Aug 2026:

- No QBO API integration exists. Invoices reach QuickBooks as a **CSV file**
  (`crm/quickbooksCsv.ts`, `/admin/invoices/export`), one direction, push only.
- Intuit's App Partner Program excludes Quebec. The company is in Laval.
- The ticket asking whether a Quebec business can get production keys for a private app on its
  own company file **has never been sent**. `Docs/intuit-ticket-draft.md` is drafted and needs
  the legal entity name and NEQ. Expect 3–10 business days after that.
- That draft scopes the ask as *"our CRM pushes invoices into QBO. We read nothing back."*
  Reading anything back is the opposite direction. **The ticket must be reworded before it is
  sent**, or the answer will not cover what is now wanted.

**Check the premise too.** Quotes and estimates live in the CRM (`crm/quotes.ts`); QuickBooks
holds the bookkeeping copy the CSV put there. Which records exist *only* in QuickBooks? If the
honest answer is "payments and reconciliation", say so — that is a different and smaller ask
than "find my estimates", and it may be answerable from the CRM plus bank data instead.

**Owner action:** fill the two blanks, widen the scope line, send it, record the answer in
`Automation-Blockers.md` §3 — including a "no".

---

## Open questions

1. **Is the owner the Microsoft 365 tenant administrator?** Gates ANA-04.
2. **Teams: 1:1 chats, or team channels too?** Changes the scope list and the ingest.
3. **Which mailbox?** One address, or several — aliases and a shared info@ are different work.
4. **What is OneDrive for** — client documents, photos, adjuster reports? ANA-07 is scoped for
   finding documents, not photo libraries.
5. **Should these tools also serve the admin chat box?** They are plain `Anthropic.Tool`
   objects, so re-serving them through `crm/assistant.ts` is cheap. Not in any order above.
