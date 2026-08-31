# Draft — the Laval backwater-valve rule, verified

**Shape:** copy change to `/services/sewer-backup`, plus the internal links it unblocks
**Status:** draft — awaiting owner gate. Nothing written to `src/`.

## What this resolves

`SewerBackupContent.tsx` carries this comment, written when the page shipped:

> *Deliberately NOT claimed: anything about Laval's own by-law. A search
> suggested Laval prohibits a backwater valve on the main building drain, which
> would be a genuinely useful thing to tell people — but it could not be
> confirmed against a primary Ville de Laval source, so the copy says we confirm
> the local requirement instead of asserting what it is. Replace this with the
> real rule once someone has read it on ville.laval.qc.ca.*

Someone has now read it. The source is Ville de Laval's own regulation sheet,
`laval.ca/wp-content/uploads/2025/02/reclamations-reglement-refoulement-egout-branchement-egouts-sanitaire-pluvial.pdf`,
citing municipal by-laws **L-113, L-2863, L-5057 and L-9618**.

## What the by-law actually says

Verbatim, from **L-5057 article 3.03.02**:

> « Des clapets antiretour doivent être installés sur tous les branchements
> d'évacuation recevant les eaux usées ou d'infiltration provenant d'appareils
> de plomberie situés en contrebas de la couronne de rue »

> « Il est interdit d'installer un clapet de quelque type que ce soit sur un
> collecteur principal. »

> « En tout temps, les clapets doivent être faciles d'accès et tenues en bon
> état de fonctionnement par des nettoyages fréquents et complets. »

And the clause that matters most to a homeowner:

> « **En cas de défaut du propriétaire d'installer un ou des clapets antiretour
> conformément aux dispositions du présent règlement ou de les entretenir
> adéquatement, la Ville n'est pas responsable des dommages causés au bâtiment
> et/ou à son contenu par suite d'inondation ou de refoulement d'égout.** »

From **L-9618 article 3**: a floor drain with an integrated valve does not
exempt the obligation to install an independent valve on the discharge branch.

**The rumour was right, and now it's sourced.** Laval does forbid a valve on the
main collector — the opposite of what someone might assume from the Montreal
rule, and precisely the kind of thing worth not guessing about.

## Why this is bigger than a correction

The Montreal paragraph on this page already argues that flooring laid over a
valve's access point is a renovation mistake. In Laval that argument gets
sharper, because the by-law ties access to liability: a valve that can't be
reached can't be "entretenu adéquatement", and the City disclaims responsibility
for backup damage where the owner is in default of installing **or maintaining**
one.

That is a genuinely local, primary-sourced fact that no competitor page carries,
and it sits exactly where our trade meets the regulation.

---

## The replacement paragraph

Currently the page's fourth `localContext` paragraph hedges:

> *Requirements differ between municipalities, and Laval's are not Montreal's.
> We confirm what applies to your address before the rebuild rather than
> assuming the Montreal rule travels across the bridge.*

**FR — replacement**

> À Laval, la règle n'est pas celle de Montréal, et elle surprend. Le règlement
> municipal L-5057 exige un clapet antiretour sur tous les branchements
> d'évacuation qui reçoivent des appareils situés sous la couronne de rue — mais
> il interdit d'en installer un, de quelque type que ce soit, sur le collecteur
> principal. Le même règlement exige que les clapets soient faciles d'accès en
> tout temps et entretenus par des nettoyages fréquents, et il précise qu'en cas
> de défaut du propriétaire de les installer ou de les entretenir adéquatement,
> la Ville n'est pas responsable des dommages causés par un refoulement. C'est
> pour cela que la trappe d'accès reste atteignable quand nous reposons un
> plancher : à Laval, un clapet inaccessible n'est pas seulement un problème
> d'entretien.

**EN — replacement**

> In Laval the rule is not Montreal's, and it surprises people. Municipal by-law
> L-5057 requires a backwater valve on every discharge connection serving
> fixtures below street crown level — but forbids installing one of any type on
> the main collector. The same by-law requires valves to be easily accessible at
> all times and maintained by frequent cleaning, and states that where an owner
> is in default of installing or properly maintaining them, the City is not
> responsible for damage caused by a backup. That is why the access hatch stays
> reachable when we put a floor back: in Laval, an unreachable valve isn't only
> a maintenance problem.

Also add to the page's source list:

```
Ville de Laval — Règlements L-113, L-2863, L-5057, L-9618 (clapets antiretour)
https://www.laval.ca/wp-content/uploads/2025/02/reclamations-reglement-refoulement-egout-branchement-egouts-sanitaire-pluvial.pdf
```

And replace the file's "NOT claimed" comment with what was found, so the next
reader sees a resolved question rather than an open one.

---

## What it unblocks

With Laval's rule stated rather than hedged, `/services/sewer-backup` can be
linked from the Laval sector pages — which has been blocked since the page
shipped, and which is the home market.

Proposed, keeping each area at six related services by dropping the least
relevant rather than growing the list:

| Area | Drop | Add |
|---|---|---|
| Chomedey | `REPAIRS` | `SEWER_BACKUP` |
| Sainte-Rose | `KITCHEN_BATH` | `SEWER_BACKUP` |
| Vimont | least relevant of its six | `SEWER_BACKUP` |
| Fabreville | least relevant of its six | `SEWER_BACKUP` |
| Duvernay | `FLOORING` | `SEWER_BACKUP` |

Terrebonne stays out: it is not Laval and not Montreal, and I have not read its
by-law. Same discipline that kept this paragraph hedged for a week.

I'd want to look at each area's actual list before finalising the drops rather
than deciding it in a table — flagging the shape here, not the final answer.

## If this lands

1. Replace the paragraph and the doc comment in `SewerBackupContent.tsx`, both
   locales; add the source.
2. Add `SEWER_BACKUP` to the five Laval sectors' `relatedServices`.
3. `AREAS_LAST_UPDATED` and `MARKETING_LAST_UPDATED` are already today.
4. Commit alone, cherry-pick to `master`.
