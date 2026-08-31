# Draft — Terrebonne area page

**Shape:** new entry in `src/lib/serviceAreas.ts` (tenth area)
**Brief:** `content/briefs/terrebonne.md`
**Status:** draft — awaiting owner gate. Nothing written to `src/`.

---

## Structural fields

```
slug:            "terrebonne"
neighbors:       ["sainte-rose", "duvernay"]
relatedServices: WATER_DAMAGE, BASEMENTS, KITCHEN_BATH, RENOVATIONS, DRYWALL, PAINTING
```

Not `SEWER_BACKUP`: that page's local content is Ville de Montréal's
backwater-valve by-law, which does not apply in Terrebonne. Same restraint as
the Laval sectors.

**Sources array**

```ts
sources: [
  { label: "Ville de Terrebonne", url: "https://terrebonne.ca/" },
  { label: "Terrebonne, Quebec — Wikipedia", url: "https://en.wikipedia.org/wiki/Terrebonne,_Quebec" },
],
```

---

## FR

**name:** Terrebonne
**tagline (H1):** Rénovation et restauration après dégât d'eau à Terrebonne
**metaTitle:** Dégât d'eau et rénovation à Terrebonne — 44 chars
**metaDescription** — 152 chars:

> Rénovation et dégât d'eau à Terrebonne, Lachenaie et La Plaine : sous-sols
> finis, cuisines et salles de bain, remise en état après sinistre. Répondu 24/7.

### context — sourced facts

> Terrebonne telle qu'on la connaît aujourd'hui date du 22 août 2001, quand
> trois municipalités ont fusionné : Lachenaie, fondée en 1683, La Plaine, en
> 1830, et Terrebonne elle-même, constituée en 1860. Avec 119 944 habitants au
> recensement de 2021, c'est la dixième ville en importance au Québec.

> La ville borde la rivière des Mille Îles, et son noyau ancien s'organise
> autour de l'Île-des-Moulins, où le moulin à scie et le moulin à farine ont été
> construits en 1804 et 1846, et le Moulin neuf en 1850. Le site est classé lieu
> historique d'intérêt national par le gouvernement du Québec depuis 1973.

### whatThisMeansHeading

> Ce que cela implique pour la rénovation et les dégâts d'eau à Terrebonne

### whatThisMeans — trade read

> Une ville, trois parcs immobiliers. La fusion de 2001 n'a pas uniformisé le
> bâti : le vieux Terrebonne et ses abords conservent un cadre ancien, tandis
> que les secteurs des anciennes Lachenaie et La Plaine se sont développés en
> banlieue familiale, plus récente et plus standardisée. Ce sont deux façons de
> travailler, et savoir laquelle s'applique avant de chiffrer évite les mauvaises
> surprises.

> Dans le parc de banlieue, le sous-sol fini est la norme et c'est là que
> l'essentiel des dégâts d'eau aboutit — par une conduite qui cède à l'étage,
> par une infiltration, ou par un refoulement. Le seuil de 24 à 48 heures de
> l'EPA pour la moisissure sur un matériau mouillé court dès le premier jour, et
> dans un sous-sol aménagé le dommage est presque toujours caché derrière
> quelque chose : sous-plancher sous le flottant, isolant derrière la
> fourrure. Nous ouvrons assez pour voir ce qui est réellement mouillé plutôt
> que de sécher ce qui se voit.

> La proximité de la rivière des Mille Îles change le profil des appels au
> printemps. Une infiltration ne se comporte pas comme une conduite éclatée :
> elle arrive plus lentement, par le bas ou par l'enveloppe, et elle se répète
> si la cause n'est pas traitée. Nous documentons d'où l'eau est entrée, pas
> seulement ce qu'elle a abîmé — c'est la différence entre une réparation et la
> même réparation refaite l'an prochain.

### faq

**Couvrez-vous Lachenaie et La Plaine ?**
> Oui. Les trois secteurs font partie de Terrebonne depuis 2001 et nous y
> travaillons tous. Le bâti n'est pas le même d'un secteur à l'autre, et c'est
> justement pour ça qu'on le demande avant de chiffrer.

**En combien de temps pouvez-vous venir à Terrebonne ?**
> Notre ligne est répondue 24/7 et nous planifions l'intervention à partir de
> cet appel. Nous ne promettons pas un délai fixe : quelqu'un qui garantit un
> nombre de minutes sans savoir ce qui se passe chez vous devine. Ce que nous
> pouvons dire, c'est que l'assèchement commence avant que la question de la
> responsabilité soit réglée, parce que le matériau, lui, n'attend pas.

---

## EN — translation

**tagline (H1):** Renovation and water damage restoration in Terrebonne
**metaTitle:** Water Damage & Renovation in Terrebonne — 41 chars
**metaDescription** — 155 chars:

> Renovation and water damage restoration in Terrebonne, Lachenaie and La
> Plaine: finished basements, kitchens and bathrooms, full rebuild. Answered 24/7.

### context

> Terrebonne as it exists today dates from 22 August 2001, when three
> municipalities merged: Lachenaie, founded in 1683, La Plaine in 1830, and
> Terrebonne itself, incorporated in 1860. With 119,944 residents at the 2021
> census, it is Quebec's tenth largest city.

> The city sits on the Rivière des Mille-Îles, and its historic core is built
> around Île-des-Moulins, where the saw mill and flour mill were built in 1804
> and 1846 and the Moulin neuf in 1850. The site has been classified a historic
> site of national interest by the Government of Quebec since 1973.

### whatThisMeansHeading

> What that means for renovation and water damage in Terrebonne

### whatThisMeans

> One city, three housing stocks. The 2001 merger did not standardise the
> building: old Terrebonne and its surroundings keep an older fabric, while the
> former Lachenaie and La Plaine sectors grew as newer, more standardised family
> suburbs. Those are two different ways of working, and knowing which applies
> before pricing is what avoids the unpleasant surprises.

> In the suburban stock the finished basement is the norm, and that is where most
> water damage ends up — through a line that lets go upstairs, through
> infiltration, or through a backup. The EPA's 24-to-48-hour benchmark for mould
> on wet material runs from day one, and in a finished basement the damage is
> almost always hidden behind something: subfloor under the laminate, insulation
> behind the strapping. We open up enough to see what is actually wet rather than
> drying what is visible.

> Being close to the Rivière des Mille-Îles changes the shape of spring calls.
> Infiltration doesn't behave like a burst line: it arrives more slowly, from
> below or through the envelope, and it repeats if the cause isn't addressed. We
> document where the water got in, not only what it damaged — that is the
> difference between a repair and the same repair done again next year.

### faq

**Do you cover Lachenaie and La Plaine?**
> Yes. All three sectors have been part of Terrebonne since 2001 and we work in
> all of them. The building stock isn't the same from one to the next, which is
> exactly why we ask before pricing.

**How quickly can you get to Terrebonne?**
> Our line is answered 24/7 and we plan the response from that call. We don't
> promise a fixed time: anyone guaranteeing a number of minutes without knowing
> what is happening at your address is guessing. What we can say is that drying
> starts before the liability question is settled, because the material isn't
> waiting.

---

## Facts and sources

| Claim | Source |
|---|---|
| Merger 22 Aug 2001 of Lachenaie (1683), La Plaine (1830), Terrebonne (inc. 1860) | Wikipedia — Terrebonne, Quebec |
| Population 119,944 (2021 census); 10th largest in Quebec | same |
| On the Rivière des Mille-Îles | same |
| Île-des-Moulins mills 1804 / 1846 / Moulin neuf 1850; classified 1973 | same |
| Mould likely on wet material within 24–48 h | US EPA, as already cited across the site |
| Finished-basement damage hidden behind subfloor and insulation; infiltration repeats if the cause isn't treated | Trade expertise, written as general expertise about the housing type — no claim about any address |

**Excluded deliberately:** the 43,149 → 106,322 population figures and the "146%
increase". The 2001 census predates the August 2001 merger, so that jump is
mostly three municipalities becoming one on paper, not houses being built.
Presenting it as suburban growth would be wrong, and wrong in a way that reads
plausibly.

No $/pi² on this page, so the pricing rule doesn't bind. No m², no €.

## If this lands

1. Tenth entry in `src/lib/serviceAreas.ts`.
2. `terrebonne` added to the `neighbors` of **sainte-rose** and **duvernay**, so
   the lateral link is reciprocal.
3. Sitemap needs no edit — area entries generate from the array, and
   `AREAS_LAST_UPDATED` is already today.
4. Backlog row 6 → `done`, noting the Rive-Nord hub is still queued.
5. Commit alone, cherry-pick to `master`.
