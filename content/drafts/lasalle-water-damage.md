# LaSalle — water damage copy for `whatThisMeans`

**Shape:** area page edit, `src/lib/serviceAreas.ts`, slug `lasalle`
**Status:** draft — awaiting owner gate. Nothing written to `src/`.
**Why this exists:** not a backlog topic. LaSalle lists `WATER_DAMAGE` and
`SEWER_BACKUP` in `relatedServices`, and its `tagline`, `metaTitle` and
`metaDescription` all promise water damage — but the `whatThisMeans` body never
mentions water. The page currently sells a service it does not discuss, which is
a defect in a shipped page rather than a new topic, so it does not jump the
queue.

---

## What changes

Add **one paragraph** to `whatThisMeans` in both locales, inserted as the third
of four (after the post-war suburban paragraph, before the condominium one — the
water sits with the housing stock it affects, not tacked on the end).

Add **one source** to the area's `sources` array.

Nothing else on the page changes. The three existing paragraphs stay as written.

---

## FR — the paragraph to add

> Le sous-sol fini est ce qui distingue le dégât d'eau ici. Le parc d'après-guerre
> a été bâti avec des sous-sols aménagés en pièces habitables, et c'est là que
> l'eau se retrouve — par infiltration, par un tuyau qui cède à l'étage, ou par
> un refoulement d'égout. Sur l'île, le clapet antiretour n'est pas optionnel :
> le règlement municipal de la Ville de Montréal le rend obligatoire, et tout
> bâtiment construit depuis 2011 doit en être muni. La Ville rappelle aussi qu'un
> clapet doit rester accessible et être entretenu environ deux fois par année —
> et qu'un plancher posé par-dessus le point d'accès est l'une des causes les
> plus fréquentes d'inaccessibilité. C'est une erreur de rénovation, pas de
> plomberie, et c'est pourquoi nous gardons la trappe atteignable quand nous
> reposons un plancher de sous-sol.

**Character count:** 848 · in line with the other paragraphs on the page
(725–795 characters).

---

## EN — translation

> The finished basement is what makes water damage different here. The post-war
> stock was built with basements finished as living space, and that is where the
> water ends up — through infiltration, through a pipe that lets go upstairs, or
> through a sewer backup. On the island a backwater valve is not optional: Ville
> de Montréal's municipal by-law makes them mandatory, and every building built
> since 2011 has to have one. The city also notes that a valve has to stay
> accessible and be serviced about twice a year — and that flooring laid over the
> access point is one of the most common reasons it isn't. That is a renovation
> mistake, not a plumbing one, and it is why we keep the hatch reachable when we
> put a basement floor back.

---

## Source to add to `sources`

```ts
{
  label: "Ville de Montréal — Clapet antiretour",
  url: "https://montreal.ca/articles/clapet-antiretour-la-cle-pour-prevenir-refoulement-degout-et-inondation-27249",
},
```

Read 2026-08-30. Supports three claims in the paragraph: mandatory under
municipal by-law, required in all buildings since 2011, and the
accessible/twice-yearly-servicing guidance including flooring as a common cause
of blocked access.

---

## Facts and where each comes from

| Claim | Source |
|---|---|
| Post-war stock has basements finished as living space | Already established in the page's own `context`, sourced to Ville de Montréal — LaSalle and Wikipedia |
| Backwater valve mandatory under Montreal by-law | Ville de Montréal (link above) |
| Required in all buildings since 2011 | Ville de Montréal (link above) |
| Must stay accessible; service ~twice yearly | Ville de Montréal (link above) |
| Flooring over the access point is a common cause of blocked access | Ville de Montréal (link above) |
| Water reaches finished basements by infiltration, upstairs failure, or backup | Trade expertise, written as general expertise about the housing type — no claim about any address |

No invented statistics. No claim about a specific building. Nothing in $/pi²
here, so the money rule doesn't apply.

---

## Knock-on changes if this lands

1. **`whatThisMeansHeading`** for LaSalle currently reads « Ce que cela implique
   pour les travaux de rénovation à LaSalle » / "What that means for renovation
   work in LaSalle" — chosen because the section had no water content. With this
   paragraph it should become the water-inclusive form the other seven areas
   use: « Ce que cela implique pour la rénovation et les dégâts d'eau à
   LaSalle » / "What that means for renovation and water damage in LaSalle".
2. **`AREAS_LAST_UPDATED`** in `src/app/sitemap.ts` bumped to the landing date.
3. **Commit alone**, then cherry-pick to `master` — owner's call, per the manual.

## What this does *not* fix

Saint-Laurent has the same shape of gap in reverse and is fine as it stands: its
copy is renovation-only *and* its `relatedServices` correctly omit water damage,
so page and promise agree. It needs nothing.
