# Brief — Gestionnaires immobiliers (rewrite of `/commercial`)

**Backlog item:** #5 from `Docs/Content-Backlog.md`
**Shape:** rewrite of an existing page (`/commercial`) — **not** the new
`/gestionnaires` route the backlog specifies
**Slug:** unchanged, `/commercial`
**Target date:** the backlog puts B2B pages in Sep–Oct because they are
non-seasonal and the window isn't fighting a weather peak. Still true.

## Why this is a rewrite and not a new page

The backlog's premise is that we have no audience page for property managers.
We do. `/commercial` is titled « Rénovation pour gestionnaires immobiliers »,
its eyebrow reads « Pour les compagnies de gestion immobilière », and its whole
narrative is written to a property manager. Adding `/gestionnaires` would put
two of our own pages in front of one query.

It also has internal authority worth inheriting rather than splitting: the
header nav, the footer, `/services/repairs`, and two blog posts all link to it.
A new page would start from nothing and take link equity away from the page
that already has some.

Owner's decision, 2026-08-30: sharpen `/commercial`, redirect `/gestionnaires`
to it.

## The query

**Primary:** « gestionnaire immobilier entrepreneur rénovation Montréal »
**Secondary:** « entrepreneur rénovation multilogement Montréal » ·
« rénovation logement locatif entre deux locataires » · « entrepreneur pour
gestion immobilière Laval »

**Intent:** B2B, comparison — not an emergency
**Who types it:** someone managing a portfolio who needs a contractor they can
call repeatedly, not once.

## What's ranking now, and what it misses

Live sweep 2026-08-30:

1. **Indeed** — job listings for property-manager *roles*. The top result is
   not a competitor at all; it is a jobs board answering a different question.
2. **Gestion Georges Coulombe** — a property-management firm that happens to
   hold a general contractor licence. Closest thing to a competitor, and it is
   selling management, not renovation services to managers.
3. **Dargis, Réno M3, Fraser Gauthier, Construction MQ, L'Entrepreneur** —
   general contractors. Good pages, none of them addressed to a manager.

**The gap we're filling:** every result is either a property manager or a
general contractor. Nobody occupies the intersection — a contractor whose page
is written to the person managing the portfolio, about the things that decide
whether they call back: vacancy days, one invoice, documentation an owner will
accept, and crews that can work beside occupied units.

That the #1 result is a jobs board is the clearest signal in the sweep. Google
has nothing better to show.

## Our angle

We already do this work and the page already says so — it just says it in brand
voice rather than in the words a manager searches. The rewrite is mostly
retargeting, not new claims: name the audience and the territory in the H1 and
the metaTitle, and add the one section the general-contractor pages structurally
cannot write — what changes when the building is occupied and the invoice has to
survive an owner's review.

## Outline — what changes

| Field | Now | After |
|---|---|---|
| `metaTitle` FR | Rénovation pour gestionnaires immobiliers | Rénovation pour gestionnaires immobiliers à Montréal |
| `metaTitle` EN | Renovations for Property Managers in Laval & Montreal | unchanged — already names audience and territory |
| H1 FR | Un partenaire de rénovation qui fait avancer votre portefeuille | Entrepreneur en rénovation pour gestionnaires immobiliers, à Laval et Montréal |
| H1 EN | A Renovation Partner That Keeps Your Portfolio Moving | Renovation Contractor for Property Managers in Laval and Montreal |
| new section | — | « Ce qui change quand l'immeuble est occupé » — the intersection nobody owns |
| trust bar | absent | present, as on every other landing page |

The H1 change follows the precedent already set and documented on the area
pages: *the H1 is the strongest on-page signal a local business has, so it names
the trade and the territory rather than spending its second half on brand
voice.* The portfolio line survives as the intro sentence, where it reads well
and costs nothing.

Everything else on the page stays. The narrative, the benefit cards, the stats
and the process section are all correctly aimed already.

## Facts to cite

No new factual claims. The new section describes how we work, and every trust
statement on the page already traces to `/safety` — comprehensive liability
insurance with certificates on request, and the one-year written workmanship
warranty. Nothing here needs an external source because nothing here is a claim
about the world.

The stats block keeps its existing values; « 48h » estimate turnaround is an
operational claim the owner has already published and I am not changing it.

## Links

**Inbound:** unchanged and already good — header nav, footer, `/services/repairs`,
two blog posts.
**Outbound:** unchanged.
**New:** `/gestionnaires` → `/commercial`, a permanent redirect in
`next.config.ts`, so the URL a manager might guess lands somewhere rather than
404ing. Costs nothing and catches the direct-navigation case.

## Blockers

None. No new claims, no owner facts needed, no pricing.
