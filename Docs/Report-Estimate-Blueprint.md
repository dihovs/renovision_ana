# Report & Estimate — Build Blueprint

**Scope:** the reporting and estimating half of a magicplan competitor, for a Quebec water‑damage restoration contractor doing direct insurance work.
**Baseline:** reverse‑engineered from the client's real magicplan export (`My New Project Report.pdf`, 20 pp, US Letter portrait 612×792 pt), plus carrier/standards research.

**Conventions used throughout**

- All page coordinates are in PDF points, **origin top‑left** (PyMuPDF convention), page 612 × 792 pt.
- `[MEASURED]` = taken directly from the real PDF. `[UNVERIFIED]` = could not be confirmed; do not build a promise on it. `[OURS]` = our own design decision, not copied from magicplan.
- Field and entity names below are **our descriptive proposals**. They are not IICRC, Verisk, or carrier nomenclature and must not be presented to an adjuster as standard terms.

---

## 0. The one‑paragraph thesis

magicplan's report is a *geometry brochure*. Across 20 pages it carries exactly one table (four cells on the cover), one per‑room data field (`"N Photos (see photos page)"`), and no claim number, no insured, no adjuster, no moisture reading, no equipment, no quantity, no price. 45% of its pages (9 of 20) are photo grids. It is a beautiful sketch delivered to an audience that is paid to reduce invoices.

Our report must keep the parts that make magicplan's output *look* professional — the page skeleton, the type scale, the dimensioned 2D plan, the photo grid — and add the parts that make a file *survive review*: identified claim, dated category/class determinations, affected‑area quantification, per‑chamber daily psychrometrics, per‑unit equipment in/out, demolition justification, a takeoff table, and a priced scope. Everything in section 1 is the layout; everything in sections 2–4 is the payload magicplan doesn't have.

---

## 1. The report, page by page

### 1.1 Document‑level constants `[MEASURED]`

| Property | Value |
|---|---|
| Page size | US Letter portrait, 612 × 792 pt, no rotation |
| Left / right margin | 56.7 pt (2 cm) each |
| Content width | 512.8 pt (x 56.7 → 569.5) |
| Typeface | Roboto Regular + Roboto Bold, everything |
| Special glyph | `▼` section marker — rendered from DejaVuSans in the original because Roboto lacks it; we must either embed a fallback or draw the triangle as a vector `[OURS]` |
| Rules | Grey #707070, light dashed, full content width |
| Dimension lines/text | Grey ≈ #7F7F7F (RGB 0.498) |
| Room floor fill | Light grey ≈ #EAEAEA (eyeballed, `[UNVERIFIED]` exact value) |
| Renderer | Original was HTML → Chromium → Skia/PDF. A headless‑Chromium HTML pipeline is a proven route to this exact output. `[OURS]` |
| Absent from original | No PDF outline/TOC, no form fields, no annotations except photo hyperlinks |

### 1.2 The template set

Build **page templates, not a free‑flowing document**. Original has three; we ship nine.

| # | Template | Origin |
|---|---|---|
| A | Cover | magicplan has one — ours is rebuilt |
| B | Floor overview | as magicplan |
| C | Room detail (plan + attributes) | as magicplan, payload expanded |
| D | Photo grid | as magicplan |
| E | Affected‑area / moisture map page | `[OURS]` |
| F | Drying log (psychrometrics + material MC) | `[OURS]` |
| G | Equipment log | `[OURS]` |
| H | Takeoff / scope table | `[OURS]` |
| I | Estimate summary | `[OURS]` |
| J | Certification & signature | `[OURS]` |

### 1.3 Running header — every page except the cover `[MEASURED]`

Four elements plus a closing rule; identical on pp. 2–20 in the original.

```
x 56.7,  y 28.4–44.8   Project name           Roboto-Bold 14 pt
x 56.7,  y 50.6–60.0   Address one-liner      Roboto-Regular 8 pt
x 56.7,  y 59.6–69.0   Totals strip           8 pt, BOLD ALL-CAPS LABEL + ":" + regular value,
                                              items joined by " • "
x 538.3–569.5, y 37.8–69.0   Company logo bitmap 31.2 × 31.2 pt
x 57 → 569.5, y ≈ 74.4       Dashed grey rule #707070
Content starts at y 85.9. Header band ≈ 46 pt tall.
```

Original strip: `TOTAL AREA: 78.68 m² • LIVING AREA: 78.68 m² • FLOORS: 1 • ROOMS: 9`

**Our strip** `[OURS]` — the header is prime real estate on every page and should carry the claim identity, not the living area:

```
CLAIM: 2026-4471822 • INSURED: Tremblay • DATE OF LOSS: 2026-07-09 • CAT: 2 • CLASS: 3
```

Keep the address one‑liner. Keep the area totals but move them to the floor overview page and room pages where they're relevant. Rationale: an adjuster reviewing a 30‑page PDF flips pages out of order; every page must self‑identify to the claim.

### 1.4 Running footer — every page except the cover `[MEASURED]`

```
x 56.7 → 569.2, y ≈ 734.4   Dashed grey rule
x 56.7, y 740.3 and 747.3   Two-line disclaimer, Roboto-Regular 6.5 pt
right side (plan pages only) Scale bar + ratio — see 1.9
right-aligned to x ≈ 570.5, y 759.0–769.5   "Page N/T", Roboto-Regular 9 pt
```

The original disclaimer names **SENSOPIA** (magicplan's corporate entity) on all 19 non‑cover pages. That is vendor boilerplate and must be replaced wholesale. Ours `[OURS]`:

- EN: warranty language naming our own entity, plus "Measurements are field‑captured and subject to verification."
- FR: bilingual or French‑only variant, selected by report locale. Given Quebec's invoice/receipt French rule, **French is the default locale** and English is the option.

### 1.5 Template A — Cover page

**magicplan's cover, exactly as measured** `[MEASURED]`:

| Element | Geometry | Type |
|---|---|---|
| Logo bitmap | x 538.3–569.5, y 28.3–59.5, 31.2×31.2 pt | — |
| Project title | x 56.7, y 84.5–107.9 | Roboto‑Bold 20 pt |
| `CREATED ON` / value | x 56.7, y 136–159, value on line below label | Bold 10 / Regular 10 |
| Hairline rule | x 56.7 → 286.0, y 166.9 | — |
| `LOCATION` / 4 lines | x 56.7, y 175–231 (street / postal+city / province / country, one line each) | Bold 10 / Regular 10 |
| Static Google map | x 314.4–569.5, y 136.4–306.5 (255.1 × 170.1 pt), red pin centred, "Google" wordmark bottom‑left, "Map data ©2026 Google" bottom‑right | — |
| Stats table | see below | — |
| Footer | contractor block, see below | — |
| y ≈ 371 → 743 | **blank white** | — |

**Cover stats table — the only real table in 20 pages** `[MEASURED]`:

```
Top rule    y 337.6, x 56.7 → 569.5
Bottom rule y 371.0, x 56.7 → 569.5
Vertical dividers at x 184.9, 313.1, 441.3 (full 337.6→371.0 height)
→ four equal 128.2 pt cells
Cell text x-origins: 56.7 / 193.4 / 321.6 / 449.8  (8.5 pt inset from each divider)
Header  Roboto-Bold 10 pt, baseline band y 343.0–354.8, sentence case
Value   Roboto-Regular 10 pt, baseline band y 354.0–365.8
Contents: "Total area" 78.68 m² | "Floors" 1 | "Rooms" 9 | "Bathroom" 0
```

Note the bug: the project contains a room *named* "Bathroom" but the counter reads **0**, because it keys off a room **type** enum that was never set. Do not reproduce this.

**Cover footer — the only contractor branding block** `[MEASURED]`:

```
Solid (not dashed) grey rule at y 743.4
LEFT   x 56.7   "Renovision AnA" Bold 8 pt (y 748.9) / email Regular 8 pt (y 757.9)
CENTER centred    street address 8 pt (y 748.9) / website 8 pt (y 757.9)
RIGHT  6×6 pt telephone glyph at x 514.5 y 751.3, phone number 8 pt at x 525.6 y 749.4
       "Page 1/20" 9 pt at y 759.0
```

**Our cover** `[OURS]` — the single biggest gap in magicplan's output. Keep the geometry (title band, two‑column upper block, map tile right, 4‑cell rule‑bounded table, three‑column contractor footer) and refill it:

```
y 84.5   Title: "RAPPORT DE SINISTRE — DÉGÂT D'EAU"  Roboto-Bold 20 pt
y 112    Subtitle: property address, Roboto-Regular 12 pt

LEFT COLUMN (x 56.7, width ~229, label Bold 10 / value Regular 10, hairline rules between groups)
  ASSURÉ / INSURED            name
  ADRESSE DU SINISTRE         4 lines, as magicplan
  N° DE SINISTRE / CLAIM No.  string
  N° DE POLICE / POLICY No.   string
  ASSUREUR / INSURER          carrier name
  EXPERT EN SINISTRE          adjuster name + AMF certificate no. where known
  DATE DU SINISTRE            date of loss
  DATE DE L'INTERVENTION      first response datetime
  CAUSE DU SINISTRE           free text, short

RIGHT COLUMN (x 314.4–569.5)
  Static map tile, same 255.1 × 170.1 pt box, same position.
  [OURS] — replace the Google Static Maps tile with a provider whose licence permits
  redistribution inside a commercial claim document. Google's static tile carries an
  attribution + terms obligation. [UNVERIFIED] whether magicplan's usage is licensed;
  do not assume ours is by copying theirs.

STATS TABLE — same rules at y 337.6 / 371.0, same three dividers, four cells:
  "Surface affectée"  xx.xx m²   |  "Catégorie"  2  |  "Classe"  3  |  "Chambres de séchage"  2
  (Total floor area, room count etc. move to page 2 — the cover should state the LOSS,
   not the building.)

SECOND TABLE [OURS] — y 400 → 470, same rule-and-divider idiom, 3 cells:
  "Jours de séchage"  6  |  "Équipement · jours"  34  |  "Estimé total"  $x,xxx.xx

SIGNATURE BLOCK [OURS] — y 560 → 700, two columns:
  Left:  "Préparé par" — technician name, IICRC/WRT cert no. [UNVERIFIED whether the
         business holds one — make the field optional], RBQ licence no., date, signature image
  Right: "Reçu par / Accepté par" — insured or adjuster name, date, signature capture
```

The cover must also fix magicplan's arithmetic habit: **sum unrounded values, then round for display.** magicplan's cover reads 78.68 m² while the printed room areas sum to 78.71. An adjuster who adds the column and gets a different number reads the whole document as unreliable.

### 1.6 Template B — Floor overview page

`[MEASURED]` layout:

```
y 85.9–100    Section heading row
   x 56.7–65.9   "▼" glyph, 12 pt
   x 71.6        Floor name, Roboto-Bold 12 pt
   right-aligned to x 571.0, y 90.1–99.5:
      "TOTAL AREA: 78.68 m² • LIVING AREA: 78.68 m² • ROOMS: 9"
      (floor strip drops FLOORS, keeps the other three)
y 100–730     One large 2D floor plan, auto-fitted to the slot, x ≈ 120–570
footer        Scale bar "0 1 2 3m", ratio "1:70"
```

**In‑plan room captions** `[MEASURED]` — Roboto‑Regular 9 pt black, centred in the room polygon, 10 pt leading, three variants:

- (A) normal room, 2 lines: `3rd bedroom` / `13.25 m² (3.191 × 4.158)`
- (B) tight room, 3 lines: `Bog closet` / `1.64 m²` / `1.680 × 0.980`
- (C) no space, 1 line: name only

Caption format is `AREA m² (LENGTH × WIDTH)` while the room‑page metrics strip prints `WIDTH … LENGTH …` — **the two are reversed in the same document.** Pick one order and enforce it globally. `[OURS]` recommendation: always `(largeur × longueur)` = (width × length), matching the header strip, and label it.

magicplan lets captions overrun their polygon and collide with dimension text (visible on "Laundry room" and "Bathroom"). Implement caption collision avoidance: try centroid → try largest inscribed rectangle → fall back to a leader line to a margin callout. `[OURS]`

**Our additions to this page** `[OURS]`:

- **Affected‑area overlay** — each affected polygon filled at ~35% opacity in its assigned colour, over the grey room fill.
- **Legend block**, bottom‑left, ~150 × 80 pt: affected‑area colour swatches by damage type, equipment symbols, monitoring‑point marker. magicplan has **no legend anywhere** — this is a cheap credibility win.
- **North arrow**, top‑right of the plan area. magicplan has none anywhere in 20 pages.
- **Chamber boundaries** drawn as a dashed coloured outline enclosing the rooms in each drying chamber, with the chamber label.

### 1.7 Template C — Room detail page

`[MEASURED]` — the page is a **two‑slot page**: top slot heading baseline at **y 85.9**, bottom slot heading baseline at **y 413.0**. Each slot holds one *block*; a block is either a room‑plan block or an attributes block, and blocks pack into slots in order.

**Room‑plan block:**

```
x 56.7    "▼" glyph
x 71.6    line 1: room name, Roboto-Bold 12 pt        (y 85.9–100.0)
x 71.6    line 2: floor name, Roboto-Regular 12 pt    (y 99.9–114.0)
right-aligned to x ≈ 570.4, TWO lines, 8 pt, bold ALL-CAPS labels + regular values, " • " joined:
   line 1 (y  90.6–100.0): WIDTH: 5.205 m • LENGTH: 3.300 m • CEILING HEIGHT: 2.449 m
   line 2 (y  99.6–109.0): AREA: 17.15 m² • PERIMETER: 17.00 m
   (unlike the plan captions, these values DO carry unit suffixes)
x ≈ 59–173, y ≈ 148–215   KEY PLAN thumbnail: whole floor outline in pale grey line-only,
                          current room picked out in black outline + light grey fill.
                          No label, no scale, no title.
x ≈ 200–570               Main enlarged room plan, auto-fitted and centred in the slot,
                          fully dimensioned.
```

**Attributes block** `[MEASURED]` — heading at y 413.0, `▼` then room name **Bold** immediately followed by `/` + floor name Regular, *no spaces around the slash*: `1st bedroom/2nd Floor`. Body indented to **x 62.4**: label `Photos` in Roboto‑**Bold 9 pt grey** at y 442.5, value in Roboto‑Regular 9 pt black at y 453.9 reading `6 Photos (see photos page)`.

**That is the entire per‑room payload of a magicplan report.** One field.

**Our attributes block** `[OURS]` — same idiom (bold grey label / regular black value, x 62.4, 9 pt, ~11.4 pt line pitch), but a real field list in two columns so it fits one slot:

```
Left column (x 62.4)                      Right column (x 320)
  Type de pièce                             Catégorie d'eau (à cette date)
  Matériau de plancher                      Classe de sinistre
  Matériau de mur / plafond                 Chambre de séchage
  Hauteur sous plafond                      Surface affectée — plancher   xx.xx m²
  Périmètre                                 Surface affectée — murs       xx.xx m²
  Ouvertures  (portes / fenêtres)           Surface affectée — plafond    xx.xx m²
  Photos      N (voir page photos)          Points de relevé              N
  Notes       free text, wraps
```

**Block‑overflow rule** `[MEASURED]` and how to fix it: in the original, p8 holds *two different rooms'* plan blocks, which pushed the 3rd bedroom's attributes block to p9 — where it sits alone as two lines of text on a **95% blank page**. Do not reproduce this. `[OURS]`:

1. A room's plan block and its attributes block are a **keep‑together group** — they must land on the same page or both move.
2. A room‑plan block may share a page with another room only if both rooms' attributes fit too; otherwise one room per page.
3. Never emit a page whose ink coverage is below a threshold; merge upward instead.

### 1.8 Template D — Photo grid page

`[MEASURED]` — three‑column **column‑major** masonry.

```
Heading y 85.9:  "▼" + "Photos" Roboto-Bold 12 pt + "/" + room name Roboto-Regular 12 pt
                 NOTE: order is inverted vs the attributes heading (there: Room/Floor).
                 Fix this — use "Room / Photos" consistently. [OURS]

Column left edges  x = 56.7, 232.3, 408.0
Tile width         161.5 pt
Horizontal gutter  14.1 pt
First row top      y 108.5
Vertical gutter    14.2 pt
Column budget      to y ≈ 700 (~591 pt) [UNVERIFIED — inferred from packing, tallest
                   observed column bottom is y 697.0]
Still tile         161.5 × 215.3 pt  (3:4 portrait)
Video tile         161.3 × 287.1 pt  (9:16 portrait)

Fill order: fill column 1 top-down until the next tile exceeds the budget, then column 2,
then column 3. Overflow spills to a fresh photos page keeping the identical heading.
Observed packings: [P1,P2 | P3,P4 | V1,V2]; [P7,P8 | P9,V1 | V2]; [P1 | P2] (2 tiles only).
```

**Tile chrome** `[MEASURED]`:

- Two amber/yellow rounded‑rect pills at the tile's top‑left, inset ≈ 6.3 pt right and ≈ 2.9 pt down, text Roboto‑**Bold 7 pt** dark. Pill 1 = room name. Pill 2 = media label.
- Photos and videos are numbered in **separate sequences** (`Photo 1…9`, `Video 1…2`).
- Capture timestamp **burned into the bitmap** bottom‑right, white text with drop shadow, format `Jul 12, 2026 • 10:26 AM`. It is *not* PDF text. Keep this — pixel‑burned timestamps are the evidence property a carrier cares about, and they survive screenshotting and re‑export.
- Video tiles show a poster frame plus a centred white pill‑shaped play control with a black ▶.
- Every tile is a link annotation to `https://cloud.magicplan.app/public-report/file/<uuid>/<token>`.

**Our changes** `[OURS]`:

1. **Embed full‑resolution media in the PDF** (or offer an embedded/linked pair of exports). magicplan's PDF is a thin client over their cloud; full‑res media lives behind a signed token, so the file degrades to thumbnails offline and dies with the account. A claim record must be standalone — it may be read three years later in litigation.
2. But respect the delivery ceiling: **XactAnalysis caps upload size** (value unstated in their docs, `[UNVERIFIED]`) and its **mobile client accepts `.pdf` only**. So ship two variants: `full` (embedded originals) for the claim archive, and `carrier` (downsampled tiles ~150 dpi, target < 20 MB) for upload. This is exactly why Encircle uses low‑res thumbnails plus links.
3. Add a third pill for **damage/scope tag** where the photo is bound to an affected area or a scope line — e.g. `Démolition · gypse`.
4. Photo capture **must default to bound**: to a room, and optionally to an affected area, a monitoring point, or a line item. A flat project gallery is a materially worse product for claim defence.

### 1.9 Plan drawing conventions (applies to templates B, C, E)

`[MEASURED]` from the original, and worth copying verbatim because they read as professional:

- Pure 2D orthographic top‑down. **No 3D, no isometric, no perspective, no colour** in the base drawing.
- Walls: solid black filled polygons at true thickness.
- Room floor: flat light grey fill ≈ #EAEAEA.
- Doors: wall gap plus a thin quarter‑circle swing arc showing hand and direction.
- Windows: gap in the black wall filled with thin double/triple parallel lines.
- Fixtures/furniture: white‑filled, black‑outlined symbols at true position and size.
- No hatching, no material poché, no room‑number bubbles, no door/window tags, no section marks.

**Dimension chains** `[MEASURED]`:

- Grey ≈ #7F7F7F. Dotted grey extension lines; solid grey dimension lines with small **filled triangular arrowheads** at both ends.
- Values are **unit‑less decimal metres to 3 dp** on the plan (`4.153`, `0.756`). No `m` suffix on the plan; suffixes appear only in the header/metrics strips.
- Text Roboto‑Regular: **8.1 pt** on the crowded floor overview, **10.5 pt** on roomier single‑room pages.
- Vertical dimensions rotated 90°, reading bottom‑to‑top.
- Chains are **nested**: an inner chain of individual wall segments and opening widths, an outer chain carrying the overall run (`0.990 | 1.637` inner, `3.300` outer beneath).
- Both **interior clear** and **exterior overall** are shown for the same wall (`3.291` interior left vs `3.300` overall right).

**Scale bar** `[MEASURED]`, plan pages only, never on photo pages:

```
Bar: 121.6 pt long × 3.4 pt tall, at x ≈ 427.5–549.1, y 748.8–752.2,
     alternating black/white segments with a black outline (4 segments observed).
Tick values ABOVE the bar, Roboto-Regular 9 pt, y 738.5–749.0, unit appended to the LAST tick only.
Ratio label BELOW the bar, Roboto-Regular 9 pt, right-aligned x ≈ 553.8–571.1, y 748.5–759.0,
     directly above "Page N/T".
Observed: 1:70, 1:54, 1:64, 1:49, 1:41, 1:86, 1:45, 1:20 — arbitrary fitted ratios,
     never a standard architectural scale. Scale is chosen PER PAGE, not per drawing;
     when two rooms share a page they share one ratio.
```

`[OURS]` — **snap to standard scales** (1:20, 1:25, 1:50, 1:75, 1:100) and pick the largest that fits. `1:41` and `1:86` on a document going to an insurer look like a machine picked them, because one did.

**Metric / imperial and language** `[OURS]`: both axes change dimension text width, which changes plan fitting, which changes scale selection. Build unit formatting into the layout engine's measurement pass from day one, not as a display filter. Metric is the Quebec default; imperial support matters if the estimate lands in Xactimate with an imperial price list (`[UNVERIFIED]` which unit system Quebec carriers' price lists use — ask the contractor's two or three actual carriers).

### 1.10 Template E — Affected area / moisture map page `[OURS]`

One page per drying chamber (or per floor if there is only one chamber). Reuses the plan renderer.

```
y 85.9    "▼" + chamber name Bold 12 / floor name Regular 12
          right strip: SURFACE AFFECTÉE: xx.xx m² • CATÉGORIE: 2 • CLASSE: 3 • PIÈCES: 4
y 115–560 Plan of the chamber's rooms, with:
            - affected polygons filled at ~35% opacity in the damage-type colour
            - each affected polygon labelled with its own area, following magicplan's
              in-plan caption idiom (Regular 9 pt, name / "x.xx m²")
            - monitoring points as numbered circular markers (M1, M2 …) at true position
            - equipment symbols at placed position, with the equipment's short ID
            - containment barrier lines as a heavy dashed stroke across the opening
y 575–700 Legend + affected-area table (see 1.12 table style):
            Zone | Type de dommage | Surface | Surface (murs) | Découpe (h) | Matériau
footer    scale bar + ratio
```

Affected areas must attach to **both** a room floor polygon **and** an individual wall (elevation polygon). magicplan's own flow branches this way, and it matters: water losses are dominated by **flood cuts** — a partial wall band at 12 in / 24 in / 48 in — not by whole surfaces. A floor‑only affected‑area model cannot produce a defensible wall quantity.

Where an affected area is attached to a wall, offer a **wall elevation strip** below the plan: the wall drawn flat, height on Y, with the affected band shaded and dimensioned. `[OURS]` — this is what justifies "remove drywall to 24 in" to a reviewer in one glance.

### 1.11 Template F — Drying log page `[OURS]`

The single most valuable page we have that magicplan does not. One block per chamber; a chamber's log may run several pages.

```
y 85.9   "▼" + "Journal de séchage" Bold 12 + "/" + chamber name Regular 12
         right strip: OBJECTIF: xx% MC • JOURS: 6 • DÉBUT: 2026-07-09 • FIN: 2026-07-15

Block 1 — Psychrometrics table, one row per reading location per day.
Block 2 — Material moisture table, one row per monitoring point per day.
Block 3 — Chart: material MC vs day, one line per monitoring point, with the dry-standard
          line drawn as a dashed horizontal reference. [OURS]
Block 4 — Exceptions list: days not monitored, with the required reason text.
```

### 1.12 Table style — the missing idiom `[OURS]`

The original has **one** table and no house style for tables beyond it. Ours, derived from the cover table so it looks native:

```
Full content width x 56.7 → 569.5
Top rule and bottom rule, #707070, 0.5 pt, spanning full width
Header row:  Roboto-Bold 8 pt, sentence case, 12 pt row height, bottom-ruled
Body rows:   Roboto-Regular 8 pt, 11.4 pt row height
Zebra:       #F7F7F7 on alternating body rows (subtle; the original has no zebra) 
Column dividers: 0.5 pt #707070 verticals, full table height, as on the cover table
Cell inset:  8.5 pt from the left divider (matches the cover table exactly)
Numeric columns right-aligned; units in the header, not repeated per cell
Row overflow: repeat the header row on the continuation page, append " (suite)" to the caption
```

Reference tables and their columns:

**Psychrometrics** (one row per location per reading)

| Date/heure | Emplacement | T (°C) | HR (%) | GPP | Point de rosée (°C) | Pression vap. | Appareil | Photo |

Locations enumerate: `Extérieur`, `Zone non affectée (référence)`, `Chambre — ambiant`, `Sortie déshumidificateur`.

**Material moisture content** (one row per monitoring point per reading)

| Point | Pièce | Matériau | Type de relevé | Valeur | Unité | Standard sec | Écart | Appareil | Photo |

**Equipment log**

| Unité | Type | Modèle | Chambre | Placé le | Retiré le | Jours | Motif du changement |

**Affected areas**

| Zone | Pièce | Surface | Type de dommage | Plancher m² | Murs m² | Plafond m² | Hauteur de découpe |

**Takeoff / scope**

| # | Pièce / Zone | Description | Qté | Unité | Base de calcul | Code externe |

**Estimate**

| # | Description | Qté | Unité | P.U. | Montant | Taxes |

### 1.13 Templates G–J in brief `[OURS]`

- **G — Equipment log page.** Equipment table plus a small chamber plan showing day‑one placement. Carrier programs score "placement of equipment on the first day" as a distinct item; a photo of the plan with symbols on it is the artefact.
- **H — Takeoff page.** Quantities grouped by room then by surface, each with its **derivation shown** ("Murs: périmètre 17.00 m × h 2.449 m − ouvertures 4.62 m² = 37.02 m²"). Showing the arithmetic is the whole point; an asserted number is a reducible number.
- **I — Estimate summary page.** Line items grouped by section (Urgence / Assèchement / Démolition / Reconstruction), subtotals, markup, GST/QST, total. Note magicplan explicitly **cannot** put the sketch in its estimate export — we can and should print the key plan beside the estimate section for the room it prices.
- **J — Certification page.** Category/class determination history (each with datetime, author, justification, supporting photo IDs), demolition justification records, RBQ licence number, asbestos pre‑check result, technician signature, insured/adjuster acknowledgement.

### 1.14 Section ordering and pagination `[OURS]`

```
1   Cover (template A)
2   Sommaire du sinistre — 1 page: category/class history, chambers, timeline,
    scope summary, totals. This is the page a busy adjuster actually reads.
3   Per floor: floor overview (B)
4   Per room, in USER-CONTROLLED or SCAN order: room detail (C) + photo pages (D)
5   Per chamber: affected-area / moisture map (E)
6   Per chamber: drying log (F)
7   Equipment log (G)
8   Takeoff (H)
9   Estimate (I)
10  Certification & signatures (J)
11  Annexe: overflow photos, meter photos, documents
```

**Room ordering** `[MEASURED]` bug to avoid: magicplan sorts rooms **lexicographically by name**, which is why `2nd room closet` falls between `2nd bedroom` and `3rd bedroom`. Use explicit user order, defaulting to scan order.

**Add a table of contents.** The original has no outline and no TOC across 20 pages. Emit both a printed TOC page and a real PDF outline — a 40‑page claim report without navigation is hostile.

**Report profiles** `[OURS]` — one data model, several documents:

| Profile | Sections |
|---|---|
| Rapport d'inspection initiale | 1, 2, 3, 4, 5, 10 |
| Rapport de séchage complet | all |
| Rapport pour l'assureur (condensé) | 1, 2, 5, 6, 7, 8, 9, 10 — downsampled photos, size‑capped |
| Plan seul (sketch PDF) | 3, 4 plans only, no photos, no payload — for trades |

---

## 2. Data we already have vs data we still must capture

### 2.1 What the app stores today

| Have | Serves |
|---|---|
| Projects | Cover, header, all pages |
| Clients | Cover (partially — see gaps) |
| Room scans: floor area, wall length, ceiling height, door/window/stair counts, **full geometry** | Templates B, C, E; all area/perimeter takeoff |
| Affected areas: polygon, damage type, area | Template E; affected‑surface quantities |
| Project custom fields incl. an IICRC claim template | Cover fields, certification page — but as untyped strings |

That is genuinely most of the *geometry* half. Full geometry is the important one: it means we can compute net polygon area, inside perimeter, wall area, and opening deductions correctly rather than from bounding boxes. **Never derive area from width × length** — the sample's L‑shaped kitchen is `WIDTH 9.116 × LENGTH 5.524 = 50.4 m²` against a true area of `24.69 m²`.

### 2.2 What the report needs and we do not store

**Claim identity — blocks the cover, the header, and every carrier hand‑off**

| Missing | Notes |
|---|---|
| Carrier / insurer | Structured, not a custom field |
| Claim number, policy number | Both appear in the header strip on every page |
| Adjuster: name, email, phone, **AMF certificate number** | Quebec adjusters are AMF‑certified professionals; the file is addressed to a named accountable person |
| Date of loss, first response datetime | Drives the 72‑hour window clock |
| Cause of loss | Free text |
| Deductible, coverage notes | Estimate page |
| Package‑delivered‑to‑insurer timestamp | Starts the 60‑day statutory indemnity clock `[UNVERIFIED — CCQ article number not confirmed; the 60‑day substance was consistent across sources]` |

**Loss classification — currently absent entirely**

| Missing | Notes |
|---|---|
| Water **category** as a *versioned, timestamped determination* with author + justification + supporting photos | Not a job column. Cat 1 → Cat 3 is the single biggest scope escalation in a file and must be dated |
| **Class** (2021 5th ed. definitions: <5% / 5–40% / >40% porous affected, or Class 4 low‑evaporation assemblies) | We can *compute* the affected‑porous percentage from geometry + affected areas and store it as the justification — exactly the objective basis the 2021 edition was written to create `[UNVERIFIED — verbatim class text is from a trade publication; buy the standard before hard‑coding]` |

**Building attributes**

| Missing | Notes |
|---|---|
| **Construction year** — required field | This is the Quebec asbestos compliance switch, not optional metadata |
| Room **type** enum (required at scan time) | magicplan's cover reads "Bathroom: 0" on a project containing a bathroom because type was never set |
| Floor material, wall material, ceiling material per room | Drives demolition and reconstruction line items |
| Occupancy / occupied‑during‑drying flag | Affects equipment strategy and ALE |

**Chambers, readings, equipment — section 3, all of it missing**

**Photos**

| Missing | Notes |
|---|---|
| Binding to room / affected area / monitoring point / line item | Flat galleries are not defensible |
| Caption as a first‑class field | Survives to Xactimate as line‑item descriptions on the magicplan path |
| Preserved capture timestamp + EXIF, and a burned‑in timestamp on export | The evidence property |
| Photo **stage** tag: pré‑démolition, post‑démolition, équipement en place, relevé d'humidimètre, dommage | Carrier programs require pre‑demo photos and equipment‑in‑use photos specifically |

**Scope and money**

| Missing | Notes |
|---|---|
| Line items, quantities, units, derivation | Section 4 |
| Price book | Section 4 |
| Demolition justification records | Ground (contamination category vs documented unrestorability), material, quantity, supporting readings, before/after photos |

**Compliance and documents**

| Missing | Notes |
|---|---|
| RBQ licence number + subcategories, and the moment the job crosses from assèchement into démolition | Quebec: drying/cleaning needs no licence; **demolition or reconstruction requires one** |
| Asbestos pre‑check record keyed to construction year (flocage presumed pre‑1990‑02‑15, calorifuge pre‑1999‑05‑20), rebuttal evidence, sampling locations, register retention | CNESST zero‑tolerance; register must be readable by workers on site → needs a **mobile read view** `[UNVERIFIED — RSST article numbers unresolved; have a Quebec OHS professional confirm]` |
| Signed work authorization captured **before** work begins, with scope text as it existed at signing | |
| Contract record with the Quebec‑mandated content: description of works, start date, end date, total cost | Contractor cannot charge more than the contracted amount without a signed change order |
| Document **locale** with **French default** | Adhesion contracts must be provided in French *before* agreement; invoices and receipts must be in French `[UNVERIFIED — whether a residential restoration contract is legally a contrat d'adhésion is a lawyer question]` |

**Report‑system metadata** `[OURS]`

Report definition (profile, locale, unit system, sections enabled, photo size, disclaimer text, logo), plus an immutable **report version record** — every generated PDF stored with its generation timestamp, the data snapshot hash, and who sent it to whom. A claim file where you cannot say which version the adjuster received is a claim file you cannot defend.

### 2.3 The custom‑fields problem

The existing IICRC claim template stored as project custom fields is the right instinct and the wrong storage. Custom fields are untyped, unvalidatable, unqueryable, and cannot be versioned. Every item in 2.2 that has a computation, a validation, a timestamp, or a report‑layout consequence must become a **typed column or table**. Keep custom fields for genuinely per‑contractor extras.

---

## 3. Moisture readings, equipment logs, daily monitoring

This is the section where our product beats magicplan's, because magicplan's per‑room payload is one field and this is what the money argument rests on. The reduction triggers are known: gaps in drying logs, unread monitoring points, equipment without out‑dates, no dry standard, no final verification readings, demolition without justification.

### 3.1 Schema

**`drying_chamber`** — first‑class, sits between job and reading. Equipment sizing and psychrometric targets are per‑chamber, not per‑job and not per‑room.

```
id, project_id
name                     e.g. "Chambre 1 — sous-sol"
rooms                    many-to-many to room; a room belongs to at most one chamber
containment_type         none | poly_barrier | negative_pressure | other
water_category_at_open   FK to determination
class_at_open            FK to determination
target_gpp               nullable
opened_at, closed_at
notes
```

**`loss_determination`** — versioned, never overwritten.

```
id, project_id, chamber_id (nullable = whole job)
kind                     category | class
value                    1|2|3  /  1|2|3|4
determined_at            datetime
determined_by            user_id
basis                    text (required)
computed_affected_pct    numeric, nullable — auto-filled for class from geometry
photo_ids                array
supersedes_id            nullable
```

**`monitoring_point`** — persistent, uniquely identified, pinned to the plan. The same point is re‑read every visit.

```
id, project_id, chamber_id, room_id
label                    "M1", "M2" — stable for the life of the job
position                 {x, y} in room-local plan coordinates
surface                  floor | wall | ceiling | cavity | chase_wall | subfloor | other
material                 gypse | bois | béton | contreplaqué | isolant | tapis | …
is_reference             bool — TRUE = unaffected reference material
reference_for_point_ids  array, when is_reference
dry_standard_value       numeric, nullable — the target, derived from the reference reading
dry_standard_set_at
established_at, retired_at
```

Ceiling and cavity/chase‑wall points must be first‑class, not an afterthought. "Skipping units, ceilings, or chase walls creates blind spots and invites scope disputes."

**`monitoring_visit`** — the daily record.

```
id, project_id, chamber_id
visited_at               datetime
technician_id
status                   completed | partial | not_monitored
not_monitored_reason     text — REQUIRED when status = not_monitored
notes
```

A day not monitored is an **explicit record with a mandatory reason**, never a silent gap. Carrier programs require daily monitoring to substantiate invoiced equipment days and require any skipped day to be documented; a gap is a deduction.

**`psychrometric_reading`**

```
id, visit_id, chamber_id
location                 exterior | unaffected_reference | chamber_ambient | dehu_outlet | other
location_note
read_at
temperature_c            numeric
relative_humidity_pct    numeric
gpp                      numeric   -- store, don't recompute at render time
dew_point_c              numeric
vapor_pressure           numeric
instrument_id            FK
photo_id                 nullable — meter face
```

Store GPP, dew point and vapour pressure as **persisted derived values** with the formula version that produced them. Recomputing at render time means an old report silently changes when the formula changes.

Minimum per visit per chamber: exterior, unaffected reference, and chamber ambient. Dehumidifier outlet where a dehu is present.

**`material_moisture_reading`**

```
id, visit_id, point_id
read_at
value                    numeric
unit                     pct_mc | rel_scale | wme     -- pin-type %MC vs non-invasive relative
                                                      -- scales are NOT interchangeable
instrument_id            FK
photo_id                 nullable — meter face, timestamped
is_final_verification    bool
```

The unit distinction is load‑bearing: a non‑invasive relative reading and a pin %MC reading cannot be plotted on one axis or compared to one dry standard. Enforce it in the model or the drying chart will lie.

**`instrument`**

```
id, org_id, kind (thermo_hygrometer | pin_meter | non_invasive_meter | thermal_camera),
make, model, serial, calibrated_at, calibration_due
```

Store the meter make/model with every reading. Guidance is consistent that the instrument must be identified for a reading to mean anything, and it is also the difference between a reading an adjuster accepts and one they query.

**`equipment_unit` and `equipment_placement`**

```
equipment_unit:  id, org_id, kind (air_mover | dehumidifier | air_scrubber | heater |
                 injectidry | hydroxyl | other), make, model, asset_tag,
                 rated_capacity, capacity_unit

equipment_placement:
  id, project_id, chamber_id, unit_id
  position          {x, y} on the chamber plan, nullable
  placed_at         datetime
  removed_at        datetime nullable
  placed_by, removed_by
  change_reason     text — required on removal or relocation
  photo_ids
```

Billable equipment‑days are **derived**, never typed:

```
days = ceil((removed_at − placed_at) / 24h)     # rounding rule configurable per org
```

This is the direct answer to "no basis for confirming the drying took the number of days billed or involved the equipment claimed." Also: mid‑job equipment reduction is defensible practice — airflow strategy changes between the constant‑rate and falling‑rate phases — so the file must show **why** equipment came out, not merely that it did. Hence `change_reason`.

**`equipment_justification`** — persist the inputs, not just the count.

```
id, chamber_id, calculated_at
wet_floor_area_m2
wet_wall_ceiling_area_above_2ft_m2
air_mover_ratio_floor          -- configurable constant
air_mover_ratio_wall_ceiling   -- configurable constant
air_movers_required
estimated_evaporation_load
dehumidifier_capacity_required
ruleset_version
```

`[UNVERIFIED]` — the commonly cited ratios (one air mover per 50–70 sq ft wet floor; one per 100–150 sq ft wet wall/ceiling above 2 ft) come from a single trade article, and I could not confirm whether they sit in the mandatory or the advisory portion of S500. **Treat them as configurable org defaults, ship no formula as "the S500 calculation", and license the standard before implementing any calculator.** Storing the inputs and the ruleset version means the number is reproducible when challenged even if the constants later change.

**`demolition_record`**

```
id, project_id, room_id, affected_area_id nullable
ground              contamination_category | documented_unrestorable | other
material, quantity, unit
supporting_reading_ids, supporting_determination_id
performed_at, performed_by
photo_before_ids, photo_after_ids
justification_text  -- required
```

Cannot be left blank when material removal is billed. These are the two grounds that hold up in a claim file: contamination category, and documented failure to respond to drying.

### 3.2 Derived state the report and the UI both need

- **Dry standard per point** — set from the unaffected reference reading at job start. Force capture of at least one reference reading per material type per chamber before the first affected reading. Without it, the completion argument literally cannot be made: completion is defined as materials returning to levels consistent with unaffected reference materials. `[UNVERIFIED]` — the widely repeated "within 2–4 percentage points" tolerance appeared only in low‑quality sources. Do **not** ship it as a default. The verified formulation is qualitative.
- **Per‑visit completeness view** — which established points were *not* read today. This is the single highest‑leverage screen in the app.
- **Drying trend per point** — MC vs day against the dry standard line.
- **Chamber day count** and variance against expectation. At least one Quebec carrier publishes a default expectation of roughly four days for drying. Any job billed longer needs the log to carry the argument — surface the variance and require a documented reason tied to readings (falling‑rate phase, Class 4 bound water, material unresponsiveness).
- **72‑hour emergency‑response clock** from date of loss.

### 3.3 The pre‑submission completeness check `[OURS]`

Run before any carrier export; this is where the app's revenue value actually lives, because incomplete files produce line‑item **reductions**, not denials.

| Check | Severity |
|---|---|
| Any monitoring day with no visit record and no `not_monitored_reason` | blocker |
| Any established point unread on a completed visit | warning per point |
| Any equipment placement with no `removed_at` on a closed job | blocker |
| Any chamber with no reference reading / no dry standard | blocker |
| Any chamber closed without final verification readings at every point | blocker |
| Any demolition line billed with no `demolition_record` | blocker |
| Any reading with no meter photo | warning |
| Any reading whose meter‑photo EXIF timestamp diverges materially from `read_at` | warning |
| Photo with no room binding | warning |
| Missing claim number / policy number / adjuster | blocker |
| Missing construction year, or asbestos pre‑check incomplete on a job with demolition | blocker |
| Demolition scope present with no RBQ licence recorded | blocker |
| Estimate total exceeding contracted amount with no signed change order | blocker |

---

## 4. The estimate

### 4.1 The strategic point first

magicplan's own pricing page scopes its estimator to **"Personalized price lists for out‑of‑pocket work."** It supplies quantity math against *your* price list. It does **not** supply carrier pricing — on an insurance job the dollars are settled in Xactimate (or Cotality) against a Verisk/Cotality‑licensed regional price list, which we will not have.

So: **do not build a dollar‑value estimator as the insurance deliverable.** Build

1. **quantities and scope** that export cleanly and are reconcilable to the adjuster's estimate — this is the product; and
2. a straightforward **own‑price estimator** for out‑of‑pocket work, deductibles, betterment, and non‑covered scope — a real but secondary track.

### 4.2 Quantity derivation — measured geometry → takeoff

Every quantity is computed and stores its derivation. Nothing is typed.

**Room‑level primitives (from full geometry, never from bounding box)**

```
floor_area           = polygon area of the room's interior
perimeter            = inside wall perimeter
wall_gross_area      = perimeter × ceiling_height
opening_area         = Σ (door w×h) + Σ (window w×h)
wall_net_area        = wall_gross_area − opening_area
ceiling_area         = floor_area                       # flat ceilings; sloped needs its own model
baseboard_lf         = perimeter − Σ door widths
casing_lf            = Σ per opening trim run           # if openings carry dimensions
```

**Affected quantities (the ones that matter)**

```
affected_floor_area     = Σ area of affected polygons attached to the room floor
affected_ceiling_area   = Σ area of affected polygons attached to the ceiling
affected_wall_area      = Σ area of affected polygons attached to walls
flood_cut_area          = Σ (affected wall run length × cut height)
flood_cut_lf            = Σ affected wall run length          # drives cut-and-detach LF items
affected_porous_pct     = affected porous area ÷ total porous area   → feeds the Class selector
```

Flood cut height is a per‑affected‑area property with the common presets available (12 in / 24 in / 48 in / full height), stored in the report's unit system but computed in metres.

**Mitigation quantities**

```
equipment_days per unit         = ceil((removed_at − placed_at)/24h)
air_mover_days, dehu_days       = Σ by kind
monitoring_visits               = count of completed visits
containment_sf                  = barrier opening area, from the plan
negative_air_days               = scrubber placement days
antimicrobial_sf                = affected floor + wall + ceiling area, by category rule
```

**`takeoff_line`** — the bridge record between geometry and money.

```
id, project_id, room_id, affected_area_id nullable, chamber_id nullable
description
quantity, unit                  SF|M2|LF|M|EA|DA|HR|CY|M3
derivation_kind                 enum naming the formula above
derivation_inputs               json — the actual numbers used
derivation_text                 human-readable string printed on the takeoff page
external_code                   nullable — see 4.4
source                          computed | manual_override
override_reason                 required when source = manual_override
```

Printing `derivation_text` on template H is not decoration. An asserted quantity is reducible; a quantity with its arithmetic beside it has to be argued with.

### 4.3 What a price book for this trade needs `[OURS]`

```
price_book:      id, org_id, name, currency, region, effective_from, effective_to,
                 unit_system, locale, source (own | carrier_published | imported)

price_item:      id, price_book_id
                 code                internal code, stable
                 description_fr, description_en      -- both, always
                 unit                SF|M2|LF|M|EA|DA|HR|CY|M3
                 category            urgence | assèchement | démolition | nettoyage |
                                     décontamination | reconstruction | main-d'œuvre |
                                     équipement | matériaux | frais généraux
                 material_rate, labour_rate, equipment_rate     -- split, not a blended rate
                 minimum_charge
                 waste_factor_pct
                 tax_class           taxable | exempt | zero-rated
                 external_codes      json map { xactimate: "...", cotality: "..." }
                 notes

estimate:        id, project_id, price_book_id, locale, status, version,
                 markup_pct, overhead_pct, profit_pct, discount, created_at, sent_at

estimate_line:   id, estimate_id, takeoff_line_id nullable, price_item_id nullable
                 seq, section, description, quantity, unit,
                 unit_price, material_amount, labour_amount, equipment_amount,
                 line_total, tax_class, note, photo_ids
```

Trade‑specific requirements a generic estimator gets wrong:

- **Split material / labour / equipment rates.** Carriers scrutinise the split, and equipment is billed by the day while labour is billed by the hour on the same job.
- **Day and hour units are first‑class.** `DA` (equipment‑day) and `HR` are as common as `SF` in mitigation. Equipment‑day quantities must flow automatically from `equipment_placement`.
- **Bilingual descriptions on every item.** Not a translation pass — two columns, populated at authoring time. Invoices and receipts must be in French.
- **GST 5% + QST 9.975% as a two‑tier tax model,** computed per line by `tax_class`, with QST calculated on the GST‑exclusive base. Store the rates as dated records; they change.
- **Waste factor per item,** applied to material quantity only, and shown separately in the line so it can be defended.
- **Minimum charges,** which are common on small mitigation items and quietly wrong if the estimator just multiplies.
- **Versioned estimates** with a status lifecycle. Align to the states magicplan uses (Sent / Accepted / Approved / Rejected) or map cleanly onto them, plus a Draft state.
- **Change orders as first‑class records** linked to an estimate version, because the contractor cannot exceed the contracted amount without one.

### 4.4 The external code field

Every `price_item` and every `takeoff_line` carries an `external_codes` map from day one. Retrofitting a code system onto a free‑text scope later is expensive, and code alignment is what makes an exported scope usable by the estimator or adjuster working in the carrier's platform.

`[UNVERIFIED]` — we do **not** have, and must not ship, any Verisk or Cotality code list or price data. The field is a place for the *contractor or their estimator* to record the mapping they already know. Populating it from a licensed source is a commercial question, not an engineering one. Do not scrape it.

---

## 5. File formats and integrations

### 5.1 CONFIRMED REAL — build against these

| What | Status | Evidence |
|---|---|---|
| **PDF** | The deliverable that actually reaches the carrier. XactAnalysis renders even Xactimate sketches as PDFs for the adjuster to view. | Verisk help documents the assignment tabs and upload types |
| **XactAnalysis accepted upload types** | `.pdf .jpg .jpeg .png .zip .doc .docx .xls .xlsx .txt` — and the **mobile client accepts `.pdf` only**. There is a size cap; the value is not published `[UNVERIFIED]` | XactAnalysis help |
| **FML (Floorplan Markup Language)** | **The only sketch‑exchange format in this industry with a public, permissively licensed spec.** JSON, maintained by Floorplanner, spec at `fml.floorplanner.dev`. Cotality/Symbility documents importing FML — their import prompt reads "Import a diagram XML or FML file" (label sourced second‑hand via magicplan's how‑to `[UNVERIFIED]`, but the FML acceptance itself is confirmed on Symbility's own support site: "We added the ability to import their FML files starting in version 6.13") | Floorplanner spec + Symbility support |
| **Raster underlay into Xactimate** | Verisk documents importing a reference image into Sketch and setting scale by picking two points of a known dimension, then tracing. Works today, needs no partnership, no format, no agreement. Encircle's own product tells users to do exactly this with the JPEG it produces. | Xactware help |
| **Encircle's model as precedent** | Encircle — Kitchener, Ontario, the closest Canadian analogue — delivers floor plans **as JPEG images** into the claim file and its reports as PDFs. A raster‑plus‑PDF pipeline is a shipping, funded, carrier‑accepted product. So is Albi's (LiDAR floor plan → JPEG). | Vendor docs |

**What this means for our build:** our machine‑readable path is **FML** and our universal path is **PDF + high‑contrast dimensioned raster underlay**. Both are real, both are buildable now, neither needs anyone's permission.

Design the raster underlay deliberately, not as a screenshot: high contrast, clean line weights, at least one clearly labelled known dimension prominently placed so the estimator can set scale in seconds, exported at a resolution that survives tracing.

### 5.2 NOT VERIFIED — never present these as available

| Claim | Reality |
|---|---|
| **ESX writing** | ESX is a real Xactimate exchange file (a full project file, reportedly ZIP+XML per third‑party format references — **not** per Verisk). **There is no public Verisk‑published schema.** Every vendor that emits ESX (magicplan, DocuSketch, Polycam) does so as a contracted Verisk third‑party integrator. I did not inspect a real ESX. **Assume nothing about element names, units, or geometry conventions. Do not ship, promise, or code an ESX writer on this basis.** |
| **Whether an in‑house contractor tool can become a Verisk TPI** — terms, eligibility, cost | Unknown. Polycam's marketing names an "official Verisk TPI API"; I found no Verisk page documenting it. **This is the single biggest open question in the build, and it is commercial/legal, not technical.** Get written answers from Verisk before any ESX engineering. |
| **SKX** | Real, apparently sketch‑only (Matterport TruePlan delivers `.SKX`), but sourced from secondary write‑ups only — Matterport's own KB returned 401. Internal structure undocumented publicly. |
| **"ESX‑lite"** | **Found nowhere.** Not in Verisk docs, vendor docs, or format references. Do not reference it in code, docs, or sales material. |
| **".sk"** | **Found nowhere** as a restoration/estimating exchange format. Possibly a confusion with SketchUp `.skp` or with SKX. |
| **DXF as sketch *geometry* into Xactimate** | Not documented anywhere. Underlay import is described for **images/documents used for tracing**. Do not assume a vector CAD geometry path exists. |
| **Cotality FML specifics** | Which FML version/subset is accepted, whether both Claim Workspace (web) and Claims Estimate (mobile) accept it, whether the March 2025 Cotality rebrand changed menu labels, and what happens to unmappable elements — all unknown. The alternative "diagram XML" format has no public spec I could find. |
| **Any moisture/drying data import on the Cotality side** | I found **no** Cotality documentation of a drying‑log import at all. |
| **Which Quebec carriers sit on Xactimate vs Cotality** | Not verified. Intact, Desjardins, Beneva, Promutuel, belairdirect, Aviva, Wawanesa, TD, Co‑operators, CAA all operate in Quebec; which platform each uses must be answered per‑carrier by the contractor's own program contacts. **This is a phone call, not more research, and it should happen before any integration work is scheduled.** |
| **Whether any Canadian carrier mandates a specific mitigation platform** | The USAA program document that mandates Moisture Mapper and a minimum "Moisture Score" is **US‑only, 2022, retrieved from a plaintiff‑side law firm's site.** It is excellent evidence of *how carriers think* — and of no Canadian obligation whatsoever. |
| **magicplan Canadian/Quebec pricing** | The `$25 / $30 / $40` per‑project tiers ($250–400/month at the 10‑project minimum, $40/project overage on every plan) are the **US‑dollar storefront**. Regional pricing appears to exist. Do not use these as the local competitive anchor without checking what the contractor actually pays. |
| **Whether magicplan's Scope of Work line items actually flow through ESX** | Two magicplan sources conflict. Their "complete ESX" blog lists only reference blocks/areas, fixtures and photo captions; their scoping blog claims "All line items." SoW is labelled "Early access." Unresolved. |
| **French support in magicplan** | Zero evidence either way. Potentially a real differentiator in Quebec, but unproven. |

### 5.3 The integration verification protocol `[OURS]`

Before any format claim ships to a real claim:

1. Produce a file from our pipeline.
2. Import it into the actual target — Xactimate trial, Cotality Claims Estimate — with a real claim number.
3. Screenshot the result.
4. Store the screenshot and the file as a **regression fixture**.

Nothing in the research substitutes for a successful round trip. And note the standing risk: Xactimate mobile now ships LiDAR capture of its own, and Xactimate already has a native water‑mitigation module with containment barriers, zones, auto‑added equipment line items and a per‑day mitigation log. **We do not win by out‑Xactimating Xactimate.** We win on the parts they don't own: the contractor's own job flow, French output, one clean field capture that feeds both carrier ecosystems, and a report that is complete before it is sent.

### 5.4 Media hyperlink policy `[OURS]`

magicplan's every photo tile is a link to a signed cloud URL. The PDF is a thin client: useless offline at full resolution, and the links die with the account. For direct insurance work that is disqualifying. **Embed full‑resolution media in the archival export.** Offer the linked/downsampled variant only as the size‑constrained carrier upload.

---

## 6. Build order

Each increment ships on its own and is useful the day it lands. Nothing here depends on an unverified integration.

---

**Increment 1 — Typed claim record (1 sprint)**

Promote claim identity out of custom fields into typed columns: carrier, claim number, policy number, adjuster (name/email/phone/AMF cert), date of loss, first response, cause of loss, deductible. Add required `construction_year` and required room `type` enum at scan time. Add report locale with **French as default**.

*Ships:* a cover page that identifies the claim. *Value:* every downstream document stops being anonymous. *Why first:* everything else references these fields, and retrofitting them into existing projects gets harder every week.

---

**Increment 2 — The report engine skeleton + Cover, Floor, Room, Photos (2 sprints)**

Header/footer components, the two‑slot page model with **keep‑together** groups and the no‑near‑blank‑page rule, the token set (Roboto at 20/14/12/10.5/10/9/8.1/8/7/6.5 pt; #707070 rules; #7F7F7F dimensions; #EAEAEA fill; 56.7 pt margins), templates A/B/C/D at the measured geometry, plan renderer with nested dimension chains, caption collision avoidance, key‑plan thumbnail, snapped scale bar, north arrow, legend, 3‑column column‑major photo masonry with pills and burned‑in timestamps, embedded full‑res media, PDF outline + TOC.

*Ships:* a report that stands beside magicplan's and reads better. *Value:* immediate — this is what the contractor hands over today. *Note:* room ordering is user/scan order, not alphabetical.

---

**Increment 3 — Affected areas on walls + the takeoff page (1–2 sprints)**

Extend affected areas to attach to individual walls with a flood‑cut height, add the wall elevation strip, add template E (affected‑area/moisture map, minus the moisture) and template H (takeoff table with printed derivations). Implement the quantity formulas in 4.2.

*Ships:* measured, derived, defensible quantities on paper. *Value:* this is the first thing that saves the contractor real money on a real claim, and it is the core of what magicplan sells.

---

**Increment 4 — Chambers, monitoring, drying log (2–3 sprints)**

`drying_chamber`, `monitoring_point` (incl. reference points and dry standards), `monitoring_visit` with the mandatory not‑monitored reason, `psychrometric_reading`, `material_moisture_reading`, `instrument`. Mobile capture flow optimised for one‑handed use in a wet basement, fully offline. Meter‑face photo attached to readings. Per‑visit completeness view. Template F (drying log tables + MC‑vs‑day chart against the dry standard).

*Ships:* the document magicplan has no equivalent of. *Value:* highest of any increment — this is what an adjuster actually reduces invoices over. *Constraint:* offline‑first is mandatory here, not optional.

---

**Increment 5 — Equipment log and derived equipment‑days (1 sprint)**

`equipment_unit`, `equipment_placement` with in/out timestamps and change reasons, placement symbols on the chamber plan, `equipment_justification` with stored inputs and ruleset version, template G.

*Ships:* equipment‑day quantities that fall out of the record instead of being typed. *Value:* directly answers the most common line‑item reduction, and feeds increment 7's estimate automatically.

---

**Increment 6 — Loss classification, demolition justification, compliance gates (1–2 sprints)**

Versioned `loss_determination` for category and class with auto‑computed affected‑porous percentage. `demolition_record` required before demolition is billed. RBQ licence record and the assèchement→démolition crossing point as a workflow state. Asbestos pre‑check keyed to construction year with the two Quebec date thresholds and rebuttal evidence, plus a **mobile read view** of the register for field techs. Template J.

*Ships:* the certification page and the compliance spine. *Value:* risk elimination. *Caveat:* have a Quebec OHS professional and a Quebec lawyer review before the app asserts any obligation to a field tech.

---

**Increment 7 — Price book and estimate (2 sprints)**

`price_book` / `price_item` with split material‑labour‑equipment rates, bilingual descriptions, waste factors, minimum charges, external code map. `estimate` / `estimate_line` generated from `takeoff_line` and `equipment_placement`. GST/QST two‑tier tax. Versioning, status lifecycle, change orders. Templates I and the estimate PDF/XLS export — **with the key plan printed beside each section**, which magicplan explicitly cannot do.

*Ships:* priced scope for out‑of‑pocket work and a quantity‑complete scope for insurance work. *Deliberately not shipping:* carrier price data.

---

**Increment 8 — Pre‑submission completeness check + report profiles (1 sprint)**

The blocker/warning list from 3.3, run before export, presented as a fix‑it checklist. The four report profiles from 1.14. Size‑capped, downsampled carrier variant respecting the XactAnalysis upload types. Report versioning with generation timestamp, data hash, and delivery record (who received which version, when) — which also starts the 60‑day indemnity clock.

*Ships:* the feature that most reduces the contractor's write‑offs. *Value:* this is arguably where the product's ROI is, and it is cheap because every underlying record already exists by this point.

---

**Increment 9 — Machine‑readable export: FML (1–2 sprints)**

Serialize the sketch model to FML against the published spec. Validate by importing into Cotality Claims Estimate on a real claim; screenshot; store as a fixture.

*Ships:* a legitimate machine‑readable path to Symbility/Cotality‑side carriers with no partner agreement. *Precondition:* confirm with the contractor's actual carriers that any of them are on that side. If none are, defer this and invest the time in increment 8's polish instead.

---

**Increment 10 — Verisk conversation (not an engineering task)**

In parallel, from increment 3 onward: get written answers from Verisk on TPI eligibility, terms, and cost for an in‑house contractor tool. **No ESX or SKX engineering is scheduled until those answers exist.** Until then the Xactimate story is, honestly and sufficiently: PDF report + high‑contrast dimensioned raster underlay for Options → Import Underlay Image → Set Scale. That is what Encircle tells its own users to do, and it works today.

---

## Appendix — Standing cautions

- **Buy ANSI/IICRC S500‑2021 before hard‑coding anything from it.** Every S500 detail in this blueprint is secondary‑sourced. The class percentage thresholds, the equipment ratios, the drying‑completion wording — all need clause‑level verification, and the mandatory/advisory distinction matters enormously if a number is ever used to defend an invoice. The business needs a licensed copy regardless.
- **Confirm the Civil Code article numbers** before citing the 60‑day indemnity deadline anywhere client‑ or carrier‑facing. The substance was consistent; the numbering was not verifiable.
- **Confirm the RSST asbestos article numbers.** Sources conflicted; the two date thresholds are well corroborated, the article numbers are not, and CNESST enforcement includes director personal liability.
- **Do not put unverified definition text in UI helper copy** — particularly the Category 1 and Category 2 defining sentences, which I could not source verbatim.
- **The field and entity names above are ours.** They are not S500, carrier, or Verisk nomenclature and must never be presented to an adjuster as standard terms.
- **Ask the contractor's two or three actual carriers** for their vendor/program documentation requirements. That one conversation will beat any further web research on what the report must contain.