# Xactimate conventions, from the owner's own claims

**Written 23 Aug 2026.** The owner's instruction for the estimator: *"our theme,
design language, but as detailed as Xactimate."* So: replicate Xactimate's
**structure, detail and math** — not its visual identity. This document is the
record of what "as detailed as Xactimate" concretely means, extracted from four
real estimates on claims he has access to, all French Québec Xactimate output:

| Doc | Firm | Type | Pages | What it shows |
|---|---|---|---|---|
| `1484107-3611` (Decarie) | Polygon | Catégorie 3 repair | 16 | Older column set with REMONT., condo multi-zone |
| `1515767` (Jean-Picard) | Polygon | Catégorie 3 repair | 13 | **Full CAT/SÉL/CALC column set** — the real Xactimate detail |
| `1558248` (Champs de Mars) | Polygon | Catégorie 3 repair | 53 | Minimum charges, management fee, 43 photo pages |
| `201-0001` (Jean-Picard TRAS) | Restauration CT | Urgence / dégât d'eau | 9 | **The emergency side**: per-day equipment, minimums |

Jean-Picard is a matched pair: CT's emergency mitigation and Polygon's repair
devis for the same loss — the exact two documents VinSnipe's sibling never has
to produce but **this app must**: TRAS (urgence) and repair.

Page images and full transcripts were session artifacts; the four source PDFs
are in the owner's Downloads. Everything below cites what was actually printed.

---

## 1. The money math — verified to the cent

Reverse-engineered from printed figures and checked numerically against five
lines per document. Xactimate's model, in order:

```
line base   = QTÉ × (ENLEV rate + REMPLAC rate)
line FG&P   = base × (G% + P% adjusted)        ← allocation of the document trailer
line TAXE   = (base + FG&P) × (TPS 5% + TVQ 9,975% = 14,975%)
line TOTAL  = base + FG&P + TAXE
```

Document trailer (the `Sommaire`):

```
Ligne du total des articles   Σ line bases
Généraux                      items × 10%
Profit                        (items + Généraux) × 5%     ← Polygon convention
TPS                           (items + G + P) × 5%
TVQ                           (items + G + P) × 9,975%
Valeur à neuf = Sinistre net  everything
```

Two firm-level variants, both real:

- **Polygon**: Profit is 5% **of items + Généraux** → per-line FG&P = 15,5% of base.
- **Restauration CT**: Profit is 5% **of items only** → per-line FG&P = 15,0% of base.

So the O&P basis is a **setting**, not a constant. Taxes are always computed on
items **plus O&P** — this differs from our consumer-quote `calculate.ts`, which
taxes the subtotal with no O&P trailer. Both are correct for their document:
keep the existing path for consumer quotes, add the trailer model for the
insurance estimate document type.

**Depreciation: none applied, deliberately.** All four estimates print
`Valeur à neuf = Sinistre net` with no Dépréciation/Récupérable columns.
Polygon handles it with one cover-letter paragraph (verbatim, Champs de Mars):

> *La dépréciation au niveau des composantes relatives à la présente estimation
> est laissée à la discrétion de l'assureur et/ou l'expert en sinistre étant
> l'administrateur de la réclamation.*

That paragraph — not an ACV column — is the Québec restorer convention. RCV/ACV
math is **out of scope** for parity with the owner's actual market.

---

## 2. The line item — what "Xactimate detail" actually is

Jean-Picard and Champs de Mars print the full column set, two stacked header rows:

```
CAT | SÉL | DESCRIPTION DE L'ACTIVITÉ
CALC | QTÉ | ENLEV | REMPLAC | TAXE | Frais généraux et profit | TOTAL
```

An example line, verbatim:

```
8. PCP | 1/2V | & E&R 1/2" placoplâtre résist. à l'eau, finition brute
   CALC: (4,3+4,3+6,1)*6 | 88,20 P2 | 0,62+ | 2,91 = | 53,83 | 48,27 | 413,44
```

Anatomy:

- **Item number** — creation order, continuous across the whole estimate, and
  NOT print order (Champs de Mars prints 42 before 39). Print order is room →
  trade section → removals before installs. Minimum-charge lines keep their
  original numbers even after being pulled into their own end section.
- **CAT** — trade category code. Observed: `DMO` demolition, `PNT` paint, `TLE`
  tile, `PCP` drywall, `CHP` carpentry, `ISO` insulation, `PHU` moisture
  protection, `PLB` plumbing, `FIN` finish carpentry, `PRT` doors, `ATC`
  containment, `MOS`/`NET` labour/cleaning, `RPB`/`RPV` flooring wood/vinyl,
  `ÉLE` electrical, `FQU` finish hardware, `PHN` fees.
- **SÉL** — selector within the category (`1/2V`, `MOY+`, `FV9.5`, `ZBAR`,
  `TLTRR`, `M-O`, `MN-A`, `CAMION`, `LIVR`, `GES`…).
- **Activity symbol prefixing the description** — the single most important
  structural idea:
  - `&` = **E&R** (enlever & remplacer): both ENLEV and REMPLAC rates on one line
  - `+` = install/add only (REMPLAC rate, ENLEV 0,00)
  - `-` = remove only (ENLEV rate, REMPLAC 0,00)
  - **Détacher et réinstaller** = detach & reset, written into the description,
    priced in REMPLAC (`Toilette - Détacher et réinstaller` 1,00 CH 257,31)
  - Decarie's older layout has a separate **REMONT.** column for reset
    (`Détacher & Réinitialiser Détecteur de fumée` — 57,97 in REMONT., both
    rates 0,00). Newer docs dropped the column; the description carries it.
- **CALC** — the quantity's provenance, printed: a variable (`P` plancher,
  `PLF` plafond, `M` murs, `PP` pér. plancher), a number, or a formula —
  `(4,3+4,3+6,1)*6`, `32*1,25` (seal coat = patch × 125%), `M-88,2-48` (walls
  minus tile minus untouched), `12-4,26` (labour adjustment, see §4). This IS
  our spec's §3.3 "every derived line cites its measurement" — Xactimate prints
  the arithmetic. Our rules engine can print better ones (named sources, not
  bare numbers).
- **ENLEV / REMPLAC** — unit rates printed `0,62+  2,91 =`.
- **QTÉ units**: `P2` pi², `PL`/`PI` pi lin., `CH` chaque, `HR` hour, `VG²`
  sq yd. `[*]` after QTÉ flags a bid/soumission item (`Frais de livraison`).
- **Note lines** — un-numbered, flush-left justifications under items:
  *"Peindre deux murs affectes seulement."*, *"Afin de ne pas l'endommagée
  durant les travaux autour de la baignoire."* Adjusters read these.
- **Zero-value memo lines** — `PLACOPLÂTRE  1,00 CH` all-zeros, carrying only a
  note (*"Enlever pendant urgence: Chambre: 5' X 10'-2" + 2' X 3'"*) — scope
  done during the emergency, recorded at $0 on the repair devis.

---

## 3. Document anatomy — repair devis

1. **Cover letter** on letterhead. Metadata block: Client, Propriété,
   Opérateur, Estimateur + cell, Société + courriel, **Type de devis**
   (Catégorie 3 / Dégât d'eau), Date entrée / d'affectation / d'achèvement,
   **Barème de prix** (`QCMO8X_NOV25` — region + month price list; ours is the
   price book version), Efficience au travail, Estimation ID. Then the letter:
   *SOUS TOUTES RÉSERVES ET SANS PRÉJUDICE* / *À qui de droit* / **CONSTAT**
   (who was present) / **OPINION** (cause of loss) / **DESCRIPTION DES
   TRAVAUX** or per-unit scope bullets / **INFORMATIONS PARTICULIÈRES**
   (exclusions: *"Le déplacement de contenue n'est pas inclus"*) /
   **DÉPRÉCIATION** paragraph / **TRAVAUX INCLUS** / sign-off.
2. **Body**, grouped Zone → sub-zone → room → sub-room (`Sous-pièce :
   Garde Robe (1)`). Room header = thumbnail sketch + name + `Hauteur du
   plafond` + seven measured quantities (pi² murs / plafond / murs,plafond /
   plancher, vg² rev. sol, pi lin. pér. plan. / plaf.) + **Mur manquant** rows
   (`Mur manquant - S'élève jusqu'au Sol  3' 2" X 6' 8"  Ouvre sur CUISINE`).
   We hold every one of these numbers already (`projectStatistics.ts` /
   `ProjectStatistics.swift`); openings give the Mur manquant rows.
3. **Trade sections** inside each room, fixed order: Plancher / Plafond / Murs
   / Boiseries / Plomberie / Électricité / Divers.
4. **Totals cascade**: `Totaux : <room>` (TAXE, FG&P, TOTAL only) → `Total:
   <unit>` → `Total: <zone>` → `Total des éléments : <estimate-ID>`.
5. **Frais généraux pseudo-room** at the end, formatted exactly like a room:
   debris per truckload (rate in ENLEV), masking per P2, floor protection,
   delivery `[*]`, cleaning technician HR, supervision/PM HR, **management fee
   as a rate line** (`Frais de gestion (3%)` — QTÉ 6975,96 CH × 0,03), and the
   **AJUSTEMENTS** sub-section (§4).
6. **Coûts minimaux de main-d'œuvre appliqués** — its own section: per-trade
   minimum labour lines (SÉL `MN-A`, 1,00 CH: vinyle 179,41, électrique 255,55,
   quincaillerie 125,51). Xactimate auto-extracts these when a trade's work in
   the estimate is below its minimum; they keep their original item numbers.
7. **Grand total des surfaces** — the variable dump (all measured quantities
   summed, including the roofing variables printed as 0,00 for interior work).
8. **Sommaire** (§1) + signature line over the estimator's printed name.
9. **Récap. des taxes, frais généraux et profit** — the 4-column table with
   rates in the headers.
10. **Récapitulatif par pièce** — rooms with % of the *items* total; Frais
    généraux and Coûts minimaux appear as pseudo-room rows.
11. **Récapitulatif par catégorie** — UPPERCASE trade categories with % of the
    *grand* total; items sum to 75,30% and G/P/TPS/TVQ make up the rest.
12. **Photo pages** — Polygon: ONE photo per page, caption
    `41  29-20260330_115508  Date prise : 2026-03-30` (sequence number,
    `<index>-<YYYYMMDD>_<HHMMSS>` filename, capture date — print date stays in
    the footer). CT: two per page, bare margin numbers, no captions at all.
    Polygon's is the convention to match; our photo records carry room, date
    and filename already.
13. **Sketch pages** — rotated landscape on portrait, blue north arrow + `N`,
    double-line walls, door leafs (with or without arcs), OUTER overall and
    INNER face-to-face dimension chains per wall, sub-rooms numbered `(1)`,
    stair treads with a `Haut` arrow. Our plan renderer draws most of this;
    the outer/inner dual chain is ORD-23's bounding dimensions generalized.
14. **Footer, every page**: estimate ID left, print date + `Page : N` right.
    Decimal commas, space thousands, `$` only on the two bold Sommaire lines.

## 3b. Document anatomy — TRAS / urgence (the CT doc)

Same table machinery, different skeleton — this is the document the drying log
exists for:

- Cover: `Type de devis: Dégât d'eau`; narrative letter with **date and hour of
  the call** (*"En date du : 6 juin 2026 à 15 h 30"*), arrival, cause, units
  served, and the mould-prevention justification paragraph.
- Sections **by day**: `Unité 1` (initial work: antimicrobial per P2, wet
  drywall removal per P2, cleaning HR) → `Day 1` / `Day 2` / `Day 3` → `General`
  → minimums. **Each day re-lists the equipment as its own numbered line**:
  `Déshumidificateur (par période de 24 heures) - 110-159 ppd - Pas de
  moniteur.` 1,00 CH 123,73 — one line per machine per day, with the capacity
  class in the description, plus fractional monitoring labour (`Installer,
  surveiller et enlever l'équipement (frais par heure)` 0,50 HR / 0,25 HR).
  Our `drying_log` records equipment in/out — the per-day lines fall straight
  out of it.
- `General`: debris **0,50 CH** (half a truckload — fractional loads are real),
  emergency service call flat (`pendant les heures d'ouverture` — an after-hours
  variant exists in Xactimate).
- Minimum labour charge for cleaning, own section, 1,00 CH 81,50.
- Photos document moisture readings (FLIR at 100.0) — evidence, matching
  ORD-39's reading-photo model.

---

## 4. Labour: the AJUSTEMENTS mechanism

Xactimate embeds labour inside unit prices. When the estimator judges the
embedded hours insufficient, they add hour lines under **AJUSTEMENTS** whose
CALC shows the arithmetic: `Placoplâtre Installer/Finisseur - à l'heure`,
CALC `12-4,26` → 7,74 HR — twelve hours judged needed minus 4,26 already inside
the unit prices, with the note *"Ajustement de main-d'oeuvre"*. Hourly rates
observed (QCMO8X, NOV25–JUN26): placoplâtre 100,54–100,97 · plombier 116,12 ·
électricien 111,86 · isolation 89,96–90,37 · nettoyage 53,21–53,52 · ouvrier
général 55,40 · supervision/PM 74,81–75,07.

This answers the spec's labour question (§5.2) for the insurance document: our
`laborHoursPerUnit` is the *embedded* labour; an adjustment line is a manual
hour line on top, always with a note.

---

## 5. What this changes in our schema and engine

Already right: integer-cents money, GST/QST split, per-item units, exclusions,
`quotes`/`quote_line_items` lifecycle, and — decisively — measurements that are
the same numbers the report prints.

To add (fields on the estimate line / price book, not screens):

1. **`activity`** on an estimate line: `install | remove | replace | detachReset`.
   Replace prices ENLEV+REMPLAC on one line; our demo/install code pairs
   (`FLR-DEMO-SF` + `FLR-LAM-INST`) become one E&R line with two rates.
   Detach & reset has **no codes at all today** — half of water-job plumbing
   and electrical lines in these examples are detach-reset.
2. **`calc`** on a derived line: the formula string plus the named measurement
   source — our spec §3.3 citation, now with proof that the reference product
   prints it as a column.
3. **`tradeSection`** (Plancher/Plafond/Murs/Boiseries/Plomberie/Électricité/
   Divers) for print grouping — derivable from category, override per line.
4. **Per-trade `minimumLaborChargeCents`** in the price book + the extraction
   pass that emits `MN-A` lines into their own section.
5. **Note** (free text) on any line; **zero-value memo lines** allowed.
6. **`[*]` bid-item flag**; **percentage fee lines** (management 3%).
7. **Document trailer settings**: G% (10), P% (5), profit basis
   (items+G | items), taxes on items+O&P. Separate from consumer-quote math.
8. **Per-day equipment derivation** from `drying_log`: one line per machine per
   24h period, capacity class in the description, monitoring HR per visit.
9. **Estimate document sections**: cover-letter fields (CONSTAT, OPINION,
   DESCRIPTION DES TRAVAUX, INFORMATIONS PARTICULIÈRES, the fixed DÉPRÉCIATION
   paragraph), then the render order of §3. The recaps are arithmetic we
   already do.

Explicitly NOT needed for parity: depreciation/ACV columns (§1), their icon
set or fonts (owner: our design language), the roofing variables (print 0,00),
REMONT. as a column (fold into `detachReset`).

---

## 6. Open questions — narrowed by the examples

From `Estimator-Spec.md` §5, updated:

1. **Flood cut height** — still the owner's call. The examples show measured
   patch quantities, not a standard cut; Xactimate leaves it to the estimator.
2. **Labour** — answered for the document (§4): embedded in rates, plus
   AJUSTEMENTS hour lines. Whether HIS rates keep labour embedded is his call,
   but the 128-item book's `laborHoursPerUnit` says yes.
3. **Cost/margin** — unchanged, and still the privacy fork: the public repo's
   price book is deliberately the safe subset. Margin needs a private store.
4. **Sign-off** — the examples strengthen "draft quote for review": every doc
   carries a personal signature line.
5. **Equipment** — answered (§3b): per unit-day off the drying log, exactly as
   `drying_log` records it.

New, only the owner can answer: his **O&P convention** (does he bill 10/5 like
the restorers, and profit on items+generals or items?), his **management fee**
(Polygon charges 3% on some jobs), and his **per-trade minimums**.
