# Brief — Pont-Viau and Laval-des-Rapides area pages

**Backlog item:** #10 from `Docs/Content-Backlog.md`
**Shape:** two new area pages (11th and 12th entries in `serviceAreas.ts`)
**Slugs:** `pont-viau`, `laval-des-rapides`
**Target date:** P1, Nov–Dec. Area pages are evergreen rather than seasonal, so
the date is a queue position, not a weather window.

**Also closes two schema claims.** `LocalBusinessSchema` lists both sectors in
`areaServed` with no pages behind them — the same inconsistency Terrebonne had.
After these two, the remaining unbacked claims are Longueuil, Île-Perrot and the
West Island.

## The query

**Primary:** « dégât d'eau Pont-Viau » · « dégât d'eau Laval-des-Rapides »
**Secondary:** « rénovation Pont-Viau » · « entrepreneur Laval-des-Rapides » ·
« rénovation après sinistre Laval »

**Intent:** local, mixed emergency and research
**Who types it:** a homeowner who names their sector rather than their city —
the same behaviour the existing nine pages were built for.

## What's ranking now, and what it misses

Live sweep 2026-08-31: **nobody holds a sector-level page.** The results are
Laval-wide: Paul Davis (a national franchise with a `/local/laval` page),
Melianco, Terbois, Solution A9, On Side, plus a Soumission Rénovation guide and
a job posting.

**The gap we're filling:** the same one the original nine exploit. Every
competitor answers "Laval". A homeowner in Pont-Viau types Pont-Viau, and the
page that names their bridge, their build era and their river gets the click
over a franchise page that names their city. Nothing here needs re-arguing — it
is the strategy already in place, extended to two sectors that were claimed in
schema but never written.

## Our angle

Two sectors, genuinely different stories, and that distinction has to be real or
the pages become the template-swap this file forbids.

**Pont-Viau** has the richer history and it is specific: named for a bridge over
the Rivière des Prairies, itself named for Christophe Veau — a family name a
clerk misspelled into Viau. A parish in 1915, a village in 1926, a *ville* in
1947, a *cité* in 1958, and dissolution into Laval in 1965. Most of its housing
went up between 1927 and 1965, which is a four-decade build-out around a river
crossing and a directly useful fact for anyone pricing work there.

**Laval-des-Rapides** is where Renovision's own office sits — 68 boulevard
Cartier Ouest is in this sector. That is the strongest thing the page has, and
no competitor can claim it.

## Sourcing — and an honest problem with the second page

Ville de Laval publishes municipal histories for both sectors, which is what the
existing nine cite. The English page states its content is French-only, and the
French URL returns **HTTP 403** to automated fetching. A person opening it in a
browser will get through; I could not.

**Pont-Viau is well sourced without it.** Wikipedia (fr) carries the name
origin, all four status changes with dates, the 1965 dissolution, the 2011
population and the 1927–1965 construction period.

**Laval-des-Rapides is thin, and I want to flag that rather than paper over it.**
What is citable: it was a separate city until the 6 August 1965 mergers; it is
bordered by Chomedey to the north, northwest and west, Pont-Viau to the east and
northeast, and the Rivière des Prairies to the south; and Arpent's heritage
research places both sectors in the centre-south of Île Jésus as "hinge
territories" with the Island of Montreal that consolidated around an urban
vocation, accelerating post-war.

What is **not** available to me: the origin of the name, the rapids themselves,
incorporation dates, or a construction-era figure equivalent to Pont-Viau's.

That is thinner than the other ten pages, and the file's own standard is that no
area is a template-swap of another. The draft writes what is sourced and does
not pad. If you want parity, the Ville de Laval French page is the thing to
open — it is one browser visit, and I will fold it in.

| Claim | Source |
|---|---|
| Bridge named for Christophe Veau, misspelled to Viau | Wikipédia — Pont-Viau |
| Saint-Christophe parish founded 1915 | same |
| Village 6 April 1926 · Ville 10 May 1947 · Cité 6 February 1958 | same |
| Laval created 6 August 1965, dissolving the Île Jésus municipalities | same |
| Population 14,187 (2011 census) | same |
| Most residential construction 1927–1965 | same |
| Laval-des-Rapides a separate city until 6 August 1965; boundaries | Wikipedia — Laval-des-Rapides |
| Both sectors centre-south of Île Jésus, hinge territories with Montreal, post-war urban consolidation | Arpent — heritage research, Pont-Viau and Laval-des-Rapides |
| Our office at 68 boulevard Cartier Ouest is in Laval-des-Rapides | Our own published address |

## Links

**Neighbours**, reciprocal as with Terrebonne: Pont-Viau ↔ Laval-des-Rapides,
and both to Duvernay and Chomedey, which the sources give as their actual
borders.

**relatedServices**, curated per stock rather than copied: both are pre-1965
sectors on the Rivière des Prairies, so water damage leads, with basements and
the finishing trades behind it. Sewer backup is defensible in Laval now that the
by-law is stated on that page — but only where the copy earns it, per the rule
that kept Vimont out.

**Sitemap:** nothing by hand. Area entries generate from the array, and
`AREAS_LAST_UPDATED` needs bumping on the day these land.

## Blockers

None for Pont-Viau. For Laval-des-Rapides, the page can ship as drafted, but it
will read thinner than its neighbours until someone opens the Ville de Laval
page. Your call whether that is acceptable or worth ten minutes first.
