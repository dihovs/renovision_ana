# Brief — Terrebonne area page

**Backlog item:** #6 from `Docs/Content-Backlog.md`
**Shape:** new area page (`/service-areas/terrebonne`), tenth in `serviceAreas.ts`
**Slug:** `terrebonne`
**Target date:** non-seasonal, but it should precede the January window. There
is also a standing reason to hurry: `LocalBusinessSchema` already claims
Terrebonne in `areaServed` with no page behind it, so we are currently telling
Google we serve somewhere we cannot demonstrate serving.

## The query

**Primary:** « dégât d'eau Terrebonne »
**Secondary:** « après-sinistre Terrebonne » · « rénovation Terrebonne » ·
« dégât d'eau Lachenaie » · « infiltration d'eau Terrebonne »

**Intent:** emergency, with a research tail
**Who types it:** a homeowner on the Rive-Nord. Unlike the Laval sector queries,
this one autocompletes — Terrebonne is a city people name, not a borough they
have to be told about.

## What's ranking now, and what it misses

Live sweep 2026-08-30. **This SERP is contested, unlike the Laval sectors.**
Being honest about that is the point of the brief:

1. **Solution Gestion Sinistre** — `/zone/terrebonne`, "Urgence 24/7", Lachenaie
   named. A real competitor with a real page.
2. **DécontaXpert** — `/decontamination/villes/terrebonne/degat-eau`.
3. **Aquanet, Prodécontamination, Assainiteck** — decontamination and
   infiltration specialists, each with Terrebonne coverage.
4. **Patch'n Paint** — « après-sinistre Laval et Terrebonne », the closest thing
   to a direct competitor because it does repair rather than only cleanup.
5. **Plomberie NGS, Yan & Sindy** — plumbing and post-disaster cleaning.

**The gap we're filling:** two things, and neither is "we'd cover it better".

First, look at those URLs — `/zone/terrebonne`, `/villes/terrebonne/degat-eau`.
They are template city pages, swapped per municipality. That is precisely the
pattern our nine existing area pages were built to beat, and the one this repo's
own rules forbid us from copying. A page with real Terrebonne facts is a
different object from a page with Terrebonne substituted into a slot.

Second, almost every result stops at drying and decontamination. The rebuild —
gypse, plancher, peinture — is a separate call to a separate trade. We do both,
which is the same argument that works everywhere else on this site, and only
Patch'n Paint competes on it here.

## Our angle

Terrebonne is not one housing stock, it is three, and the reason is
administrative: Lachenaie, La Plaine and Terrebonne merged into one city on
22 August 2001. A page that knows that can talk about Vieux-Terrebonne's
nineteenth-century core and the suburban build-out of the former La Plaine as
different jobs — which is exactly what a template city page cannot do.

## Outline

Same shape as the existing nine — `context` (sourced facts), then
`whatThisMeans` (trade read on that housing type), then FAQ.

| Section | Content |
|---|---|
| `tagline` / H1 | Rénovation et restauration après dégât d'eau à Terrebonne |
| `context` ×2 | The 2001 merger of three municipalities and what each was; the Rivière des Mille-Îles and the Île-des-Moulins heritage core |
| `whatThisMeans` ×3 | Three eras in one city · the finished-basement suburban stock · what the river frontage means for infiltration |
| `faq` ×2 | Do you cover Lachenaie and La Plaine · how fast can you get to Terrebonne |

## Facts to cite

| Claim | Source |
|---|---|
| Lachenaie (founded 1683), La Plaine (1830) and Terrebonne (incorporated 1860) merged 22 August 2001 | Wikipedia — Terrebonne, Quebec |
| Population 119,944 (2021 Census); 10th largest city in Quebec | same |
| Situated on the Rivière des Mille-Îles | same |
| Île-des-Moulins: saw and flour mills built 1804 and 1846, Moulin neuf 1850; classified a historic site of national interest in 1973 | same |

**One figure deliberately excluded.** The source offers 43,149 (2001) rising to
106,322 (2011) and calls it a 146% increase. It is not housing growth: the 2001
census predates the August 2001 merger, so the jump is mostly three
municipalities becoming one on paper. Quoting it as suburban expansion would be
a real error, and it is the kind of thing that reads plausibly enough to survive
review. Left out.

Everything in `whatThisMeans` is written as general expertise about a housing
era, never as a claim about an address — the standing rule for that field.

## Links

**Inbound:** `/service-areas` index picks it up automatically from the array.
Lateral links from **Sainte-Rose** and **Duvernay**, the two existing areas
directly across the Rivière des Mille-Îles — which means adding `terrebonne` to
their `neighbors` so the link is reciprocal rather than one-way.

**Outbound:** its own `relatedServices`, curated for this stock: water damage,
basements, kitchen & bath, renovations, drywall, painting. **Not** sewer backup
— that page's local content is built on Ville de Montréal's by-law, which does
not apply here, and the same restraint already applies to the Laval sectors.

**Sitemap:** nothing to add by hand. Area entries are generated from the
`serviceAreas` array; `AREAS_LAST_UPDATED` is already today's date.

## Blockers

None for the page itself.

One thing worth the owner's eye, separate from this item: `areaServed` in
`LocalBusinessSchema` also claims **Longueuil**, **Île-Perrot** and the **West
Island** with no pages behind them. Terrebonne fixes one of four. The others are
either future pages or should come out of the schema.
