# Automation stack — what Artush must do himself

**Last updated:** 2026-07-31 · Sources: 13-agent research pass, all figures verified against vendor pages that day.

Everything in this file needs the owner's identity, his credit card, or his
signature. No developer can do any of it. Ordered by *when to start*, which is
not the same as order of importance — some of these are pure waiting and should
be started immediately even though they pay off last.

---

## Do today, regardless of everything else

### 1. Vercel Pro — $20 USD/month, 10 minutes

Vercel's Hobby plan is **"restricted to non-commercial personal use only"**, and
their definition of commercial includes *"Advertising the sale of a product or
service"*. The live site advertises services, issues quotes, and processes
invoices. It is in breach today.

Three separate research agents flagged this independently. The risk is not a
surprise bill — it is enforcement against the company's only web presence.

**RESOLVED — the owner confirmed on 30 Aug 2026 that the account is on Pro, not Hobby.**
This also unblocks the Microsoft Graph sync in `Ana-Capabilities-Orders.md` ANA-04, which
needs cron more often than daily: Graph change-notification subscriptions expire in about
three days and have to be renewed on a schedule.

Dashboard → Settings → Billing → Upgrade.

Also buys: 800s max function duration (vs 300s), 1 TB transfer, and cron more
often than once a day.

---

## Start now because they are pure waiting

### 2. Meta business verification — up to 14 working days

Needed for WhatsApp. **Start it now and forget it** — Meta confirms messaging
can begin before verification completes, so this is a background task, not a
gate. It unlocks the verified display name and the 2,000-message tier.

Requires the legal entity name **exactly** as registered with the Registraire
des entreprises du Québec. A rejected submission restarts the clock, so check
the spelling character for character.

### 3. QuickBooks — ask Intuit a question before anything is built

> "The Intuit App Partner Program is available for partners based in the US, UK,
> Australia, and Canada **(excluding Quebec)**."

That is on every page of developer.intuit.com. Renovision AnA is in Laval.

**Do not let anyone build the QuickBooks integration until this is resolved.**
Open a ticket at help.developer.intuit.com asking whether a Quebec business can
register a private app and receive production keys for its own QBO company.
Expect 3–10 business days for an answer.

If the answer is no, the fallback is CSV export/import — worse, but real.

**The fallback is built** (30 Aug 2026), so this blocker no longer stops the
books getting done — it only stops the *live sync*. `/admin/invoices/export`
writes issued invoices as a QuickBooks Online invoice-import CSV, one row per
line item, with the header discount split across the tax boundary so QBO
recomputes the same tax that was charged. Code: `src/lib/crm/quickbooksCsv.ts`.
The Intuit ticket is still worth opening; nothing has been asked of them yet.
A drafted ticket is ready to send in `Docs/intuit-ticket-draft.md` — it needs the
legal entity name and NEQ filled in first.

**Two things learned on 30 Aug 2026.** The owner is an *admin* on the QuickBooks Online
company but not its owner/master admin — worth confirming that an admin can create a
developer app against the company file, because on some plans that is owner-only. And the
drafted ticket scopes the ask as "our CRM pushes invoices into QBO. We read nothing back",
which is now backwards: he wants to *read* estimates and payments back. **Reword before
sending** or the answer will not cover what is actually wanted.

---

## Before the phone agent can take a real call

### 4. Test Teams call forwarding

> **Not to be confused with Teams *messages*.** The owner asked on 30 Aug 2026 for Ana to
> read Teams chat, Outlook and OneDrive — and explicitly **not** Teams calls. That work is
> `Ana-Capabilities-Orders.md` ANA-04 to ANA-07, and it is a different question from the
> call-forwarding one below. He confirmed he administers the Microsoft 365 tenant, so the
> Entra app registration is his to make.
 — 15 minutes, do this first

Can the Teams tenant forward **+1 579-990-3077** to an external number? Forward
it to your mobile and call it.

If it cannot, the published number has to move to Twilio outright — and that
number is on the website, Google Business Profile, Facebook and Instagram.
That is a multi-week marketing job, not an engineering one. Everything else in
the voice plan is wasted work until this is answered.

### 5. Twilio: upgrade off trial, accept the AI terms, buy a number

- **Upgrade off trial.** Trial accounts cap every call at 10 minutes regardless
  of settings. During testing this looks exactly like a bug in our code.
- **Accept the AI/ML addendum** in Console → Voice → Settings → Privacy &
  Security. A hard gate; contractual terms cannot be accepted on your behalf.
- **Buy a Laval number** (450 or 514). Canada is not on Twilio's strict
  address-validation list, so it should provision immediately. If a regulatory
  bundle is requested, allow up to 3 business days and note that a P.O. box or
  virtual address will be rejected.

### 6. Set `TWILIO_AUTH_TOKEN` in Vercel

Still required. It is what proves an inbound webhook really came from Twilio;
without it the turn-based routes reject every request, which is fine while
they are idle and fatal the moment you need them.

**Superseded:** this section used to say to point the Twilio number's Voice URL
at `/api/voice/incoming`, and that no ElevenLabs account was needed. Both were
true when written and neither is now — see below.

### 6b. Rolling back to the turn-based path during an incident

Read this before you need it. **ElevenLabs now owns the number.** Importing it
rewrote the Twilio number's Voice URL to point at ElevenLabs, so the rollback
is no longer a one-line edit in the Twilio console — an import left in place
can put its own URL back.

Roll back in this order:

1. **ElevenLabs dashboard → Phone Numbers → the Laval number → remove it**
   (or detach the agent from it). Do this *first*. Editing Twilio while the
   number is still imported risks the change being overwritten.
2. **Twilio Console → Phone Numbers → the number → Configure:**
   - A call comes in → Webhook, POST →
     `https://www.renovisionana.ca/api/voice/incoming`
   - Call status changes → POST →
     `https://www.renovisionana.ca/api/voice/status`
3. **Confirm `TWILIO_AUTH_TOKEN` is set in Vercel** (section 6). If it isn't,
   every call gets a 403 and the caller hears Twilio's error, not Ana.
4. Call the number. You should hear the Polly Gabrielle voice and have to wait
   your turn — no barge-in. That is the fallback working, not a fault.

The ElevenLabs secrets can stay set throughout; the `el/*` routes simply stop
being called. Rolling forward again means re-importing the number in the
ElevenLabs dashboard, which rewrites the Voice URL back.

---

## Run the migrations

Migrations are applied by hand in the Supabase SQL editor; there is no runner.
Outstanding: **0006, 0007, 0008, 0009, 0010, 0011**, and since the 2026-07-31
overnight build wave: **0012** (expenses + time tracking), **0013** (quote
follow-ups / invoice reminders — the daily cron refuses politely until it
exists), **0014** (recurring jobs + job checklists), **0015** (Projects section
+ the private `project-files` storage bucket), **0016** (lead qualifier fields:
emergency flag, caller role, heard-about). Run them in numeric order; each
screen shows a "run the migration" notice until its table exists, nothing
crashes.

Also set **`CRON_SECRET`** in Vercel (any long random string). The daily
retention purge — the 24-month deletion the privacy policy promises — refuses
to run without it, so the promise stays unkept until this is set.

Nothing errors loudly if these are skipped — the screens show a "run the
migration" notice and the rest of the app keeps working. Which is exactly why
it is easy to forget.

---

## The RBQ licence — bigger than a settings field

Confirmed 2026-07-31: **there is no RBQ licence yet.** Consequences already
handled in software: the site no longer claims "licensed" anywhere (claims are
now insurance + the 1-year workmanship warranty, both true), and quoting stays
gated in the CRM. What software cannot do: renovation contracting in Quebec
generally requires the licence, the quote gate stays shut without it, and the
best local directories and insurer panels ask for the number. **Starting the
RBQ application is the single highest-value slow task on this list** — it
takes weeks, so start it before it blocks something urgent.

## Free ranking levers only the owner can pull (from the 2026-07-31 SEO audit)

1. **Google Business Profile** — you have 5.0★(15) on Google while the Laval
   map-pack incumbents for "dégât d'eau" sit at 3.9★(18)–4.9★(30). Set the
   primary category to water-damage restoration, add service areas and photos,
   and keep the review velocity going. Map pack ≫ organic for emergency calls.
2. **Search Console** — add the domain property, submit sitemap.xml, request
   indexing on the money pages. Flushes the old WordPress ghosts and gets the
   new French metadata indexed. (Claude can drive this with you in-browser.)
3. **Directory profiles** — soumissionrenovation.ca, 411habitation.com,
   renoquotes.com, HomeStars, Houzz, PagesJaunes: they hold 2–5 of the top 8
   on nearly every renovation SERP. Occupy them; several will want the RBQ
   number (see above).

## Before a quote can be sent at all

**Enter the RBQ licence number in Settings** (once it exists). Quoting refuses
without it: Building Act s. 57.1 requires it on every estimate, quote,
contract and statement of account, and omitting it is a penal offence. Until
it is entered, half the CRM is inert.

While you are there, decide the **GST/QST registered** toggle. Registration is
mandatory only above $30,000 of taxable supplies in a quarter or the four
before it. Below that you must **not** charge the taxes, and the system will not
let you by accident.

---

## Two decisions that are yours, not the software's

### WhatsApp: new number, or migrate your existing one?

Migrating **permanently destroys the chat history** and permanently disables the
WhatsApp Business app for that number. After migration the only way to read or
send is through software we build.

**Recommendation: buy a new number.** A few dollars a month, same day, and your
daily-driver WhatsApp keeps working.

### WhatsApp photos and Quebec Law 25

Subcontractor photos of the inside of customers' homes will pass through Meta's
servers and rest there for up to 30 days — the Cloud API decrypts every message.
That is materially weaker than the current lead-photo path, which goes straight
from the browser to Supabase in Montreal with no third party.

Under Law 25 you are the controller. This warrants a privacy assessment and a
line in the customer disclosure. Worth 30 minutes with whoever handles your
compliance — it is a business decision, not a technical detail.

**Also:** free WhatsApp service messages end **1 October 2026**. Meta publishes
replacement rates by 1 September. Small, but it stops being free.

---

## Deferred, and why

**Content automation** (HeyGen, Kling, auto-posting) is last in the plan and
should stay there — it earns least and depends on everything above.

When it comes up, the one thing only you can do is **record the HeyGen consent
video**: yourself on camera reading their consent script, plus two minutes of
720p+ training footage, same room, same camera, same lighting, back to back.
HeyGen matches the face across both and rejects mismatches.

Skip D-ID — commercial use is a $420 annual prepayment. HeyGen is pay-as-you-go.

Kling's pricing is behind a login and could not be verified. Do not commit to it.

---

## Running cost, once everything is on

| | Monthly |
|---|---|
| Vercel Pro | $20 |
| Twilio number | ~$1.15 + usage |
| Voice calls (100 × 6 min, `<Gather>`) | ~$29 |
| Anthropic (voice + widget + CRM assistant) | small, usage-based |
| WhatsApp | free until 1 Oct 2026, then small |
| Supabase | free tier is sufficient today |

The voice figure assumes ~12 turns per call at Twilio's published $0.02 per
speech recognition. **Design the prompts to gather several facts per turn** —
a 25-turn call costs $0.50 in recognition alone, and per-turn pricing punishes
one-question-at-a-time conversations.

---

## One setting only you can see: the Vercel function region

`supabase/migrations/0001_leads.sql` says the database was deliberately put in
Montreal *"to avoid a cross-border transfer assessment for every lead."* But
nothing in this repo pins where the **compute** runs, so it inherits Vercel's
default — `iad1`, Virginia.

If that is the case today, every lead already round-trips through the United
States on its way to a Montreal database, which is the exact assessment the
region choice was meant to avoid. Call transcripts are more sensitive again.

Only you can see this: **Vercel dashboard → Project → Settings → Functions →
Function Region.** Check what it says.

I have deliberately not pinned a region in code, because picking the wrong
identifier breaks every deploy and I would be guessing at which region code is
closest to Montreal. Tell me what the dashboard offers and I will set it.

There is a second, smaller reason to care: every database round trip inside a
voice turn currently crosses the border twice, which is 30–60ms of a latency
budget measured in hundreds of milliseconds.
