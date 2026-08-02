# Decisions only Artush can make

Collected from the deep audit pass on 2026-08-02 (SEO audit, dead-code audit,
bilingual voice research). Everything here is blocked on a fact about the
business or a judgement call about how it wants to present itself — none of it
can be settled by reading the code.

Ordered by how much damage the current state can do.

---

## 1. Is the company registered for GST/QST? *(legal + money)*

**The site currently answers this question two different ways.**

- The CRM says **no**. `DEFAULT_COMPANY.taxRegistered` is `false`, and
  `src/lib/crm/settings.ts` gates every invoice through `canChargeTax()`. Its
  comment spells out the reasoning: under the $30,000 small-supplier
  threshold, "collecting them anyway means taking money you have no authority
  to take."
- The public chat estimator says **yes**. `src/lib/estimator/calculate.ts`
  hardcodes `GST_RATE = 0.05` and `QST_RATE = 0.09975` and applies them
  unconditionally, so `/api/chat` quotes GST and QST to every customer who
  uses the estimator.

So the CRM refuses to put tax on an invoice while the public estimator quotes
it. One of those is wrong, and which one depends on a fact about the business.

**What's needed:** confirm whether Renovision AnA is registered.

- *If registered* — set `taxRegistered: true` and make the estimator read the
  setting instead of its own hardcoded constants.
- *If not registered* — the estimator must stop showing GST/QST lines.

Either way the two implementations should be consolidated onto
`money.ts` + `canChargeTax()`, so they can't silently disagree again. That's a
small change once the answer is known; I did not guess at it.

---

## 2. What actually happens when someone calls after hours?

Three claims are live on the site right now and they don't agree:

| Where | Claim |
|---|---|
| `LocalBusinessSchema` (structured data Google reads) | Mon–Fri, 08:00–18:00 |
| Header band | "7 jours sur 7" |
| Water-damage page metadata | same 7-day availability |

Recorded owner facts say calls go to voicemail after hours. For a water-damage
business the honest version of this matters more than the flattering one — a
burst pipe at 11pm is the exact moment a false availability claim costs trust.

**What's needed:** are evenings and weekends answered, returned within some
window, or voicemail until morning? Then all three get the same true answer.

There is also a `// TODO(owner): correct these if the real hours differ.` sitting
in the schema component. Business hours are published to Google from there, so
it should be closed rather than carried.

---

## 3. How should "Renovision AnA" be pronounced?

On the test call the voice read the company name as "Renova Vision N-A". I've
stopped Ana from repeating the name at the end of the call, which removes the
worst instance — but she still says it in the greeting, which is the first thing
every caller hears.

**What's needed:** say the company name out loud the way you want it said. Most
likely candidates are "Réno-vision Ana" or spelling it "A-N-A". Once I know, I
can spell it phonetically in the text sent to the voice so it comes out right
every time.

---

## 4. Is `kitchen-concept.jpg` a real project?

It's used in the gallery as an "after" photo. If it's a render or stock image
rather than a completed Renovision AnA job, it needs to be labelled or replaced
— a fabricated "after" is the kind of thing that undoes the honest positioning
the rest of the site now has.

---

## 5. Access I don't have

| Needed | Unblocks |
|---|---|
| Google Search Console property (DNS TXT verification) | All ranking/impression measurement. Nothing can be validated without it. |
| Google Business Profile dashboard | ~32% of local ranking weight — categories, service list, and whether the service-area polygon actually covers the Rive-Nord towns the site's schema claims |
| Confirmation of real review counts and sources | Competitors show 2–41 reviews; the real count here is 15. Directory profiles are unclaimed. |

---

## 6. When can the old phone path be deleted?

The original turn-based Twilio path (`/api/voice/incoming`, `/turn`, `/status`)
is kept deliberately as the rollback if ElevenLabs misbehaves — roughly 500
lines. It stays until the live ElevenLabs path has been confirmed working on
real calls, including the items still marked UNVERIFIED in
`src/app/api/voice/el/chat/route.ts`.

**What's needed:** a few real calls that exercise French, English, a language
switch mid-call, and a hangup, with the transcripts landing in `/admin/calls`.
After that this is safe to remove and I'll do it in one commit.

Note: `Docs/Automation-Blockers.md` described a rollback procedure that no
longer works (ElevenLabs owns the number now and rewrote the Voice URL on
import). That doc is being corrected in this same pass.
