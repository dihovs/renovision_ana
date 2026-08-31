# Draft — `/commercial` retargeted at « gestionnaire immobilier »

**Shape:** rewrite of an existing page
**Brief:** `content/briefs/gestionnaires-immobiliers.md`
**Status:** draft — awaiting owner gate. Nothing written to `src/`.
**Scope:** four strings, one new section, one redirect, one trust bar. The
narrative, benefit cards, stats and process section are already aimed correctly
and are not touched.

---

## 1. Metadata

**FR `metaTitle`** — 40 → 52 chars, adds the geo the query carries

> Rénovation pour gestionnaires immobiliers à Montréal

**FR `metaDescription`** — unchanged. It already leads with unit turnaround, one
contact, insurer-ready documentation and 24/7, which is the right order for this
reader.

**EN `metaTitle`** — unchanged. « Renovations for Property Managers in Laval &
Montreal » already names audience and territory.

**EN `metaDescription`** — unchanged.

---

## 2. The H1 and eyebrow

The current H1 spends itself on brand voice. The area pages already settled this
argument in a comment in `translations.ts`: *the H1 is the strongest on-page
signal a local business has, so it names the trade and the territory rather than
spending its second half on brand voice.* Same reasoning, same fix.

**FR eyebrow** — unchanged: « Pour les compagnies de gestion immobilière »

**FR H1**

> Avant : Un partenaire de rénovation qui fait avancer votre portefeuille
>
> Après : **Entrepreneur en rénovation pour gestionnaires immobiliers, à Laval et Montréal**

**FR intro** — the retired H1 becomes the opening clause, where it still earns
its place:

> Un partenaire qui fait avancer votre portefeuille : un logement vacant coûte
> de l'argent chaque jour. Nous aidons les gestionnaires immobiliers à retourner
> les unités rapidement, à répondre aux urgences et à garder les locataires
> satisfaits — avec un seul point de contact et une paperasse que votre bureau
> peut réellement utiliser.

**EN H1**

> Before: A Renovation Partner That Keeps Your Portfolio Moving
>
> After: **Renovation Contractor for Property Managers in Laval and Montreal**

**EN intro**

> A partner that keeps your portfolio moving: vacant units cost money every day
> they sit empty. We help property managers turn units fast, respond to
> emergencies, and keep tenants happy — with one point of contact and paperwork
> your office can actually use.

---

## 3. New section — the intersection nobody owns

Placed after the narrative, before the benefit cards.

**FR heading:** Ce qui change quand l'immeuble est occupé

> Un entrepreneur général écrit sa page pour un propriétaire qui rénove chez
> lui. Vous, vous gérez un immeuble où les voisins du dessus travaillent de la
> maison, où le corridor est commun, et où le locataire du 3 a le droit de
> savoir quand le bruit s'arrête. C'est un métier différent, et il se planifie
> avant le premier coup de marteau.
>
> Concrètement : le confinement et les accès se décident avant la démolition,
> pas pendant. Les heures bruyantes se fixent d'avance et se communiquent. Les
> corridors et les ascenseurs se protègent, parce que les dommages aux parties
> communes deviennent votre problème, pas le nôtre. Et le chantier se referme
> chaque soir dans un état où un locataire peut passer devant sans vous appeler.
>
> Côté administratif, la même logique. Une seule facture par unité, détaillée par
> poste, dans une forme qu'un propriétaire peut approuver sans vous rappeler pour
> demander ce que signifie une ligne. Des photos datées avant et après, parce que
> c'est ce qui règle une contestation six mois plus tard. Et un seul numéro à
> composer, plutôt qu'un peintre, un poseur de plancher et une équipe de dégât
> d'eau à coordonner vous-même.

**EN heading:** What changes when the building is occupied

> A general contractor writes their page for an owner renovating their own home.
> You manage a building where the neighbours upstairs work from home, the
> corridor is shared, and the tenant in 3 is entitled to know when the noise
> stops. That is a different trade, and it gets planned before the first hammer.
>
> In practice: containment and access are decided before demolition, not during
> it. Noisy hours are set in advance and communicated. Corridors and elevators
> get protected, because damage to common areas becomes your problem, not ours.
> And the site is closed down each evening in a state a tenant can walk past
> without calling you.
>
> The same logic on the administrative side. One invoice per unit, itemised by
> line, in a form an owner can approve without calling you back to ask what a
> line means. Dated before-and-after photographs, because that is what settles a
> dispute six months later. And one number to call, rather than a painter, a
> flooring installer and a water damage crew for you to coordinate yourself.

Every statement above is how the site already describes the work elsewhere — the
containment-and-access sentence is lifted in substance from the Chomedey area
page, the documentation lines from `/services/water-damage`. Nothing new is
claimed.

---

## 4. Trust bar

`/commercial` is the only landing page of its kind without one. Insured,
insurer-approved network, one-year written warranty — the three things a manager
checks before adding a vendor. Same component, same placement as the service and
area pages: immediately before the CTA band.

---

## 5. Redirect

`/gestionnaires` → `/commercial`, permanent, in `next.config.ts`. The backlog
named that URL; a manager may type it. It should land somewhere.

Not added to the sitemap — a redirect is not a page.

---

## If this lands

1. Four strings in `CommercialContent.tsx` (two H1s, two intros) and one in
   `src/app/[lang]/commercial/page.tsx` (FR metaTitle).
2. New section in `CommercialContent.tsx`, both locales.
3. `<TrustBar />` before `<CtaBand />`.
4. `redirects()` in `next.config.ts`.
5. `MARKETING_LAST_UPDATED` bumped — this edits existing marketing copy, which
   is exactly the case the constant's comment names.
6. Backlog row 5 → `done`, with a note that it shipped as a rewrite rather than
   the new route, and why.
7. Commit alone, cherry-pick to `master`.
