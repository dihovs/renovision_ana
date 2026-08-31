# Brief — Dégât d'eau au plafond

**Backlog item:** #1 from `Docs/Content-Backlog.md`
**Shape:** new route (`/services/water-damage/ceiling`)
**Slug:** `ceiling` (nested under `/services/water-damage`)
**Target date:** non-seasonal, but ship before the January burst-pipe window —
ceiling damage from an upstairs failure peaks with cold-snap plumbing failures,
and a page that indexes in November is ranking by January.

## The query

**Primary:** « dégât d'eau plafond réparation Montréal »
**Secondary:** « dégât d'eau plafond qui doit payer » · « réparer plafond après
dégât d'eau » · « tache d'eau plafond » · « dégât d'eau vient du condo au-dessus »
· "ceiling water damage repair Montreal"

**Intent:** emergency, shading into regulatory (who pays)
**Who types it:** a homeowner or condo owner looking up at a stain that was not
there yesterday. Often a tenant or a unit owner where the leak is someone else's.

## What's ranking now, and what it misses

Live sweep 2026-08-30:

1. **Macif** (`macif.fr`) — a **French** mutuelle. Answers the French claim
   procedure. Everything procedural on it is wrong here: French insurer, French
   forms, French law.
2. **Habitatpresto** (`habitatpresto.com`) — a **French** lead site. Same
   problem, plus prices in € and m².
3. **Quebec trades** — Soluplus, EM2M, Beau-frère à louer, KBS Nettoyage,
   Plomberie REN-GA. Real and local, but each covers one slice: the plumber
   stops at the leak, the cleaner stops at drying, EM2M is closest (murs et
   plafonds) but does not touch the claim or the "who pays" question.

**PAA on this SERP** (from the audit sweep, consistent with today's results):
*que faire si le plafond est endommagé · comment le réparer · comment le faire
sécher · qui doit payer quand ça vient du condo au-dessus*

**The gap we're filling:** the two results a Montrealer sees first are French
insurance sites describing a French claim process, and no Quebec result answers
the question the searcher actually has — who pays when the water came from the
unit above, and what happens to the ceiling afterwards.

## Our angle

We are the trade that arrives after the plumber has stopped the leak and the
question becomes what to do with the ceiling. That lets us answer the whole arc
— dry it, decide whether it gets patched or replaced, and put it back — in one
page, which none of the five local results do.

The "who pays" question is answered with the Quebec framework: the syndicate's
insurance, the unit owner's, and the deductible split. Cost is answered from our
own price book in $/pi², which is precisely what the two French pages ranking
above us cannot do without being wrong.

## Outline

| Section | Type | Content |
|---|---|---|
| H1 | — | Dégât d'eau au plafond : quoi faire, qui paie, et comment on le refait |
| | paragraph | The hook: a stain that wasn't there yesterday. Not the service. |
| | heading | Les six premières heures |
| | list | Kill power to the room at the panel · basin under the drip · do NOT pierce a bulging ceiling without a container ready · photograph before anything moves · find the source or call whoever owns it |
| | heading | D'où vient l'eau, et pourquoi ça change tout |
| | paragraph | Upstairs unit vs roof vs pipe in the ceiling void — different owners, different insurers |
| | heading | Qui paie quand ça vient du logement au-dessus |
| | paragraph | Quebec framework — syndicate vs unit owner, deductible, loi 16/141, TAL for tenants |
| | linkParagraph | → `/services/water-damage` for the wider restoration scope |
| | heading | Réparer ou remplacer : comment on tranche |
| | paragraph | Stain-only vs saturated board; the moisture reading decides, not the look |
| | heading | Ce que ça coûte |
| | stats | $/pi² from the price book — patch route vs full replacement |
| | heading | Questions fréquentes |
| | (faq) | The four PAA questions, verbatim as headings |
| | linkParagraph | → `/services/drywall` and `/services/painting` |

## Facts to cite

| Claim | Source | URL |
|---|---|---|
| Wet material very likely grows mould in 24–48 h | US EPA, already cited across the site | (as used on `/services/water-damage`) |
| Backwater valve mandatory in Montréal; since 2011; keep accessible | Ville de Montréal | https://montreal.ca/articles/clapet-antiretour-la-cle-pour-prevenir-refoulement-degout-et-inondation-27249 |
| Syndicate contingency-fund study required by Aug 2028 | Loi 16 — already cited on the LaSalle area page | (as used in `serviceAreas.ts`) |
| Remove drywall ceiling — $3.25/pi² | Estimator price book `DEM-CEILING` | internal |
| Install ½" drywall — $4.25/pi² | `DW-INST-12` | internal |
| Moisture-resistant board — $5.45/pi² | `DW-MR` | internal |
| Tape & plaster level 4 — $5.95/pi² | `DW-TAPE-L4` | internal |
| Skim coat — $5.15/pi² | `DW-SKIM` | internal |
| Prime new drywall — $1.15/pi² | `PNT-PRIME-NEW` | internal |
| Paint ceiling, two coats — $2.35/pi² | `PNT-CEIL-2` | internal |
| Medium patch 1–4 pi² — $245 · large patch 4–16 pi² — $495 | `DW-PATCH-MD`, `DW-PATCH-LG` | internal |

Derived, and stated as ranges rather than quotes:
- **Patch route** (stain only, board sound): skim + prime + paint ≈ **$8.65/pi²**
- **Full replacement**: remove + ½" board + tape L4 + prime + paint ≈ **$16.95/pi²**
- **With moisture-resistant board**: ≈ **$18.15/pi²**

## Links

**Inbound:** `/services/water-damage` — a `linkParagraph` in its local-context
block, since a reader there whose damage is specifically a ceiling should land
here. Also from `/services/drywall`, where ceilings are currently mentioned in
passing.

**Outbound:** `/services/water-damage` (parent), `/services/drywall`,
`/services/painting`. Deliberately *not* every service — this is the pattern the
manual warns about.

## Blockers

**One owner question, and it gates the "who pays" section.** I can state the
Quebec framework in general terms — syndicate policy versus unit-owner policy,
and who carries the deductible — but I will not write anything that reads as
advice about a specific claim or names what an insurer will do in a given case.
Confirm you want the general framework only, with a line telling the reader to
check their own declaration and policy. That is the safe and honest version.

No photos needed — the `heroStat` graphic carries it, and we have no ceiling
photo of our own that isn't a stock bathroom.
