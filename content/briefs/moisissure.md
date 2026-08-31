# Brief — Moisissure / mould remediation

**Backlog item:** #7 from `Docs/Content-Backlog.md`, previously `blocked`
**Shape:** new route. The backlog names `/services/moisissure`; see the slug note.
**Slug:** proposed `mould-remediation` — **not** `moisissure`. See below.
**Target date:** the seasonal window is Jul–Oct and today is 30 August. It is
open, and it closes.

**Blocker cleared 2026-08-30:** the owner confirms Renovision performs mould
remediation itself rather than referring it out. That was the question the
backlog said had to be answered before this page could exist, and it is the
right question — we do not build a page for work we don't do.

## Slug note

The backlog specifies `/services/moisissure`. Every other service page uses an
English slug (`water-damage`, `sewer-backup`, `water-damage/ceiling`) because
routing serves both languages from one path, and a French slug puts
`/en/services/moisissure` in front of English readers. The same argument settled
`sewer-backup`. Recommending `mould-remediation` for consistency, with the
French carried by the title, H1 and schema as it is everywhere else. Owner can
overrule — it is a genuine trade-off, not a rule.

## The query

**Primary:** « décontamination moisissure Laval »
**Secondary:** « enlever moisissure sous-sol » · « moisissure après dégât
d'eau » · « traitement moisissure Montréal » · "mould removal Laval"

**Intent:** research shading into alarm — someone has found something black and
wants to know how bad it is
**Who types it:** a homeowner who has just pulled up a baseboard, or someone
whose water damage was dried three months ago and now smells something.

## What's ranking now, and what it misses

Live sweep 2026-08-30. **This is the most contested SERP in the backlog.**

1. **ÉcoRénov** — three ranking pages (basement decontamination, mould
   treatment, mould decontamination). Also offers asbestos decontamination.
2. **Soluplus** — three ranking pages, branded « Expert Certifié ».
3. **Sporetek** — Laval, Rive-Nord and Montréal, offering air testing.
4. **decontamination-moisissure-entretoit.ca** — an exact-match domain for attic
   mould specifically.

These are specialists, several claiming certification and air testing. We should
be honest that we are not going to out-authority them on decontamination as a
discipline.

**The gap we're filling:** every one of them treats mould as a standalone
problem to remove. None of them is the trade that caused-and-cures it end to
end. Mould is almost always a *consequence* — of a leak, a backup, an
infiltration — and the specialist who removes it hands the room back stripped:
no drywall, no insulation, no floor. That second call is ours anyway.

We also already own the adjacent ground: the 24-to-48-hour EPA benchmark runs
through `/services/water-damage`, the ceiling page, the sewer-backup page and
the hidden-mould-timeline post. This page is the missing node in a cluster we
have already built, which is a different proposition from entering a category
cold.

## Our angle

Find the water first. Everything on this page follows from one sentence we
already publish elsewhere: *we document where the water got in, not only what it
damaged.* Mould removed without fixing the source comes back, and the specialist
pages are conspicuously quiet about that because the source is not their job.

Then: remove, and put the room back. One crew, one file, one invoice.

## Outline

| Section | Content |
|---|---|
| intro | What you found, and the question you actually have: how bad is it |
| process ×4 | Find the source · contain · remove what's contaminated · dry, verify, rebuild |
| includes ×4 | Source diagnosis · controlled removal · documentation for the claim · full rebuild |
| localContext | Why it comes back when the source isn't fixed; the finished-basement and attic profiles in this housing stock; **and where we stop** |
| faq | Harvested from the SERP: is it dangerous · can I clean it myself · will it come back · do you test the air |

## Facts to cite

| Claim | Source |
|---|---|
| Wet material very likely grows mould within 24–48 h | US EPA, already cited across the site |
| Finished-basement damage hides behind subfloor and insulation | Established on the existing area pages |

No statistics beyond that, and no health claims. Mould and health is a medical
question and this is a contractor's page — the honest line is that we are not
the people to tell you what it is doing to you.

## Links

**Inbound:** `/services/water-damage` (its `alsoSee` is free), and the
hidden-mould-timeline post is the natural feeder.
**Outbound:** `/services/water-damage`, `/services/basements`, and the
mould-timeline post.

**Sitemap:** new route, so it goes in the `routes` array by hand, and
`MARKETING_LAST_UPDATED` is already today.

## Blockers — three narrow owner answers, and they shape the page

The competitors claim certification and air testing. I will not imply either.
Before drafting the copy that touches them:

1. **Certification.** Any mould-specific credential — IICRC, or a training
   certificate? If none, the page says nothing about certification. That is
   fine; it is not fine to be vague in a way that reads as a claim.
2. **Air testing.** Do we sample, or is that referred to a hygienist? Sporetek
   sells it, so a reader may expect it. Either answer works; silence doesn't.
3. **Asbestos.** In pre-1990 stock, disturbing suspect material is a different
   regime with its own rules. Do we stop and refer when we suspect it? The
   honest answer is almost certainly yes, and saying so is a trust signal rather
   than a weakness — but I am not putting words in your mouth about how you
   handle a regulated hazard.

Everything else in the draft can be written now and is not waiting on these.
