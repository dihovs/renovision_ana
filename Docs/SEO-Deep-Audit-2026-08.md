# SEO Deep Audit — renovisionana.ca

**Researched 2026-08-02.** Code audit of the repo at `master` (6f6f11c) + live
fetch of the production HTML, robots.txt and sitemap.xml + ~15 live competitor
pages fetched and read.

## What this supersedes

| Prior doc | Status |
|---|---|
| `Docs/Renovision-Ana-SEO-Roadmap.md` | **Largely done or superseded.** Phase 2 (hyper-local pages) shipped — 9 real, sourced area pages exist. Phase 5 (technical pass) is what this document replaces: robots/sitemap/schema/`llms.txt` all now exist, so the checklist is stale. Phases 0, 0.5, 1, 6 are still open and still **owner-blocked** (GBP + Search Console access). |
| `Docs/Website-Competitive-Research.md` | **Still valid as conversion/trust research.** Two of its "verified gaps" are now fixed and should not be re-reported: the case-studies "placeholders shown for now" sentence is gone, and `seo.ts` no longer hardcodes `locale: "en_US"` (it is `fr_CA`). The i18n gap it names is confirmed and quantified below. Do not act on its RBQ recommendations — see honesty note. |
| `Docs/SEO-Keyword-Research.md` | **Still the keyword source of truth.** Not superseded. This document does not redo keyword research; it adds the technical audit, real competitor site architecture, and the ordered backlog those keywords need. |

## Honesty constraints carried into every recommendation

Renovision AnA has **no RBQ licence and no IICRC certification**. It is fully
insured and offers a 1-year workmanship warranty. Every competitor studied
below leads with RBQ + IICRC. **The strategy in this document does not close
that gap by faking it** — it routes around it by winning on surfaces where
credentials are not the differentiator (question-intent content, published
prices, real local specificity, bilingual reach). Two live honesty defects are
flagged in the backlog (B7, B8): the nav label "Sécurité et **certifications**"
and the schema/copy contradiction between "7 jours sur 7" and Mon–Fri 08:00–18:00.

---

# 1. Current implementation audit

## 1.1 Metadata — good foundation, systemic truncation

Every marketing page routes through `src/lib/seo.ts` → `buildMetadata()`, which
emits title, description, canonical, OpenGraph (`fr_CA`, explicit og:image) and
Twitter card. Verified live on the homepage: canonical, `og:locale=fr_CA`,
`og:image` all render correctly. This is genuinely well built and needs no
structural change.

Titles and descriptions are unique per page, French, and geo-qualified. Real
defects:

**Title truncation is systemic.** The root layout applies a
`"%s | Renovision AnA"` template (`src/app/layout.tsx:33`). Most page titles
already carry "à Laval et Montréal", so the rendered `<title>` runs 70–90
characters and Google truncates around 60:

| Page | Rendered title | Chars |
|---|---|---|
| `/estimation` | Combien coûte votre rénovation à Laval? Estimation en ligne gratuite \| Renovision AnA | 86 |
| `/services/kitchen-bath` | Rénovation de cuisine et salle de bain à Laval et Montréal \| Renovision AnA | 76 |
| `/services/water-damage` | Restauration après dégât d'eau à Laval et Montréal \| Renovision AnA | 68 |

The brand suffix is what gets cut, so nothing load-bearing is lost — but the
back half of several titles is also lost. Shortening the geo to "Laval" on
pages whose H1 and body already say Montréal buys ~13 characters each.

**High-intent modifiers are missing from the money page.**
`/services/water-damage` titles as "Restauration après dégât d'eau" but the
keyword research names `urgence dégât d'eau`, `dégât d'eau qui appeler`, and
`rénovation après sinistre Laval` as the commercial cluster. "Urgence" and
"après sinistre" appear nowhere in that page's title or description.

**Missing metadata surfaces:** no `src/app/not-found.tsx` (Next's unstyled
default 404 is served on every mistyped URL, with no nav back into the site),
no `manifest.ts`, no `alternates.languages` anywhere.

## 1.2 Schema — well-architected, five concrete defects

`src/components/seo/LocalBusinessSchema.tsx` renders one canonical
`HomeAndConstructionBusiness` node with a stable `@id`
(`https://www.renovisionana.ca/#business`) in the root layout, and every
`Service`/`FAQPage` node across the site references that `@id` as `provider`.
That is the correct pattern and is better than every Quebec competitor studied.
Verified live: the node renders with address, geo, hours, `areaServed`,
`priceRange`, and a live-pulled `aggregateRating` of **5.0 / 15 reviews** with
5 review bodies.

Coverage by page:

| Page | Schema present |
|---|---|
| `/` | LocalBusiness only (from layout) |
| `/services` | BreadcrumbList |
| `/services/*` (8 pages) | Service + BreadcrumbList |
| `/service-areas/[area]` (9) | Service + FAQPage + BreadcrumbList |
| `/blog/[slug]` (4) | BlogPosting + BreadcrumbList |
| `/estimation` | FAQPage + BreadcrumbList |
| `/service-areas`, `/about`, `/contact`, `/gallery`, `/case-studies`, `/commercial`, `/safety`, `/careers`, `/blog`, `/privacy` | **none** |

**Defect 1 — the hours contradict the copy (and the truth).** Schema declares
Monday–Friday 08:00–18:00 only. The header ships "Urgence dégât d'eau? / 7 jours
sur 7" (`src/i18n/translations.ts:440-441`) and `/services/water-damage`'s meta
description promises "Intervention rapide 7 jours sur 7". Per the owner facts on
file, after-hours calls go to voicemail. Three sources, three different claims.
Google reads the schema; a customer reads the header; neither matches reality.

**Defect 2 — `areaServed` is a flat string array with wrong forms.** It mixes
Laval boroughs, Montreal boroughs and separate municipalities as bare strings,
several anglicized or unaccented: `"Montreal-North"` (should be Montréal-Nord),
`"Ile-Perrot"` (Île-Perrot), `"Montreal"` never appears at all. Bare strings
give Google no entity to resolve — and "Laval" alone is genuinely ambiguous with
Laval, Mayenne, France. (A live search for `"Renovision AnA" Laval avis Google`
returned nine French-from-France renovation companies and zero Quebec results.)
`areaServed` should be typed `City`/`AdministrativeArea` objects with
`containedInPlace` pointing at Québec, or a `GeoCircle` around the real address.

**Defect 3 — no `Organization`/`WebSite` node.** There is no `WebSite` node
declaring `inLanguage`, no `knowsLanguage: ["fr-CA", "en-CA"]` on the business
(which is how you tell Google you serve both markets), and no
`hasOfferCatalog`/`makesOffer` connecting the eight `Service` nodes to the
business as a catalogue. Each service is an island referencing the business;
the business does not reference its services.

**Defect 4 — self-serving review markup.** The `review` array republishes
Google reviews on the business's own site under its own `AggregateRating`.
Google's structured-data policy treats reviews the business collects about
itself as ineligible for review rich results and can flag the page. The reviews
are real and the display is honest, so this is low risk — but the rich result
will not fire, and the effort spent maintaining it is buying nothing. The
`review` bodies are also English on a French-served page with no `inLanguage`
declared per review.

**Defect 5 — thin `Service` nodes.** The eight service nodes declare
`areaServed` as Laval + Montréal only, while the business node claims sixteen
areas including Terrebonne and Longueuil. No `Service` node carries `offers`,
`serviceOutput`, or `hoursAvailable`. `/commercial` — the property-manager page,
a named B2B audience — has no `Service` node at all.

## 1.3 Heading hierarchy — clean, but the H1s waste the strongest signal

Every marketing page has exactly one `<h1>`. No skipped levels found. That is
already better than most of the market.

The problem is what the H1s *say*.

**The homepage H1 has no geography.** Live it reads "Rénovation et restauration
de dégâts d'eau *en qui vous pouvez avoir confiance.*"
(`src/components/home/HeroBanner.tsx:99-105`, from
`translations.ts:445-446`). The `<title>` has "à Laval et Montréal"; the H1 does
not — and the half of it that isn't the service name is brand voice. On a
local-intent site this is the single cheapest relevance signal on the page and
it is being left on the table.

**Homepage H2s are all brand voice, zero keyword.** Live: "Voyez la différence",
"Ce que disent nos clients", "La confiance des sociétés de gestion immobilière",
"Conçu pour chaque client", "Nos services", "Comment ça fonctionne", "Ils nous
font confiance", "Prêt à commencer votre projet?". Eight H2s and not one
contains a service term plus a place name.

**`/services` has an H1 and zero H2s** (`ServicesContent.tsx` — 8 service cards
render below the H1 with no sectioning). It is a link grid, not a page.

## 1.4 Internal linking — the area pages are effectively orphaned

This is the most under-appreciated defect in the codebase.

The nine `/service-areas/[area]` pages are the highest-value local assets on
the site: real sourced municipal history, Statistics Canada figures, per-area
FAQ, and correct per-slug Montréal-vs-Laval schema. They carry sitemap priority
0.8, the highest after the homepage.

**`/service-areas` appears in the header nav zero times and the footer nav zero
times.** Header nav (`Header.tsx:115-127`) is services, estimation, commercial,
gallery, blog, contact, about, case-studies, safety, careers. Footer
(`Footer.tsx:30-42`) is the same ten plus privacy. Neither includes service
areas.

A grep for literal internal `href="/…"` across every marketing component returns
`/service-areas` **exactly once** — from `AboutContent.tsx:278`, a badge row
buried on the About page. The index page is one link deep from a page that is
itself two clicks from the homepage. Individual area pages are reachable from
that index, from `ServiceDetailContent.tsx:263`, and from nowhere else.

Related findings:
- **No sibling cross-linking between areas.** `ServiceAreaContent.tsx:171` has a
  single "back to all areas" link. Chomedey does not link to Sainte-Rose. Nine
  pages that should form a mesh form a star with a nearly invisible hub.
- **Service ↔ area linking is done right.** Areas link to genuinely relevant
  services via `relatedServices` in `serviceAreas.ts`, with an explicit comment
  explaining why drywall and painting appear everywhere. Services link back to
  areas. Keep this.
- **Blog → service linking works** (`blogPosts.ts` links to
  `/services/water-damage`, `/services/basements`, `/commercial`, `/contact`).
- **The homepage links to almost nothing.** No link to `/service-areas`,
  `/safety`, `/case-studies`, or any individual area.

## 1.5 i18n and hreflang — confirmed: half the site is unindexable

Verified against the live production HTML:

```
<html lang="fr" …>
<link rel="canonical" href="https://www.renovisionana.ca"/>
<meta property="og:locale" content="fr_CA"/>
```

**No `hreflang` link tags. None. Anywhere on the site.**

The mechanism: `src/i18n/LanguageProvider.tsx` holds locale in React state
seeded to `"fr"`, reads `localStorage` after mount, and mutates
`document.documentElement.lang` client-side. One URL serves both languages.

Consequences, precisely:

1. Googlebot's crawl of every URL returns French. The English half of
   `src/i18n/translations.ts` (~365 lines) plus the English half of every
   `serviceAreas.ts` and `blogPosts.ts` entry is **completely unindexable**.
   There is no URL for Google to attach it to.
2. `water damage restoration Laval`, `basement finishing Laval`,
   `general contractor Laval Quebec` and the whole English cluster are
   **structurally unrankable**, not merely unranked.
3. The client-side `lang` mutation means an English-preferring returning visitor
   sees `lang="en"` in the DOM over content that was served as French — an
   accessibility and screen-reader defect independent of SEO.
4. `og:locale` is hardcoded `fr_CA` with no `og:locale:alternate`.

**How this fork must implement it.** Next **16.2.10**. Verified against the
bundled docs at `node_modules/next/dist/docs/`:

- There is **no `i18n` config key** for the App Router. Localized routing is
  `app/[lang]/` + a root-level interceptor
  (`01-app/02-guides/internationalization.md`).
- The interceptor file is **`proxy.ts`, not `middleware.ts`** —
  `01-app/03-api-reference/03-file-conventions/proxy.md` opens with: *"the
  `middleware` file convention is deprecated and has been renamed to `proxy`."*
  Anything written from memory will name the wrong file.
- `alternates.languages` in metadata emits `<link rel="alternate" hreflang>`
  (`04-functions/generate-metadata.md:823-846`).
- `MetadataRoute.Sitemap` entries accept `alternates.languages`, emitting
  `xhtml:link` per URL
  (`03-file-conventions/01-metadata/sitemap.md:216-295`).

**Recommended URL shape: French at the root, English under `/en/`.** Not
`/fr/` + `/en/`. Rationale:

- Every currently indexed URL keeps working. No mass 301, no equity reset on
  the nine area pages and four blog posts.
- Bill 96 (below) requires French be available on terms at least as favourable
  as any other language. French living at the unprefixed canonical path, with
  English one directory deeper, is the most defensible configuration available.
- hreflang triple per page: `fr-CA` → root path, `en-CA` → `/en/…`,
  `x-default` → root path (French). Use `fr-CA`/`en-CA`, not bare `fr`/`en` —
  bare `en` invites Google to serve the page to UK searchers.

## 1.6 Images — all alt text present, all of it English

Every `<Image>`/`<img>` in the marketing tree has an `alt`. Decorative images
correctly use `alt=""`. No missing-alt defects.

But the hardcoded alt strings are English on French-served pages:

- `HeroBanner.tsx:61` — "A finished basement family room with plank flooring…"
- `ScrollBeforeAfter.tsx:129,143` — "Gutted basement mid-demolition with exposed
  ceiling joists…"
- `CommercialContent.tsx:190` — "Modern property management office with city
  skyline view…"

Gallery, case-studies and service-detail images pull alt from locale copy and
are correct. Only these four are hardcoded. Alt text is an indexed signal;
on a French page it should be French.

**Owner-verify, not a code fix:** three files in `public/images/` are named
`kitchen-concept.jpg`, `drywall-concept-after.jpg`, `painting-concept-after.jpg`
and `kitchen-concept.jpg` is used as the "after" image in the gallery
(`GalleryContent.tsx:25`). If these are renders rather than completed work,
a gallery presenting them as projects is the same class of problem as the
"Licensed & insured" claim that was already removed.

## 1.7 robots.txt, sitemap, llms.txt

**robots.txt (live, correct):** allows all, disallows `/api/` and `/admin`,
declares the sitemap. `/q/`, `/i/` and `/hub/` token pages carry
`robots: { index: false, follow: false }` in their page metadata — verified in
source. Adding them to the `Disallow` list would also save crawl budget on
leaked token URLs, but this is not a defect.

**sitemap.xml (live, 34 URLs).** One real defect:
`lastModified: new Date()` is used for all 21 static routes **and all 9 area
pages** (`sitemap.ts:33, 52`). Every deploy tells Google that thirty pages
changed. The blog entries were correctly fixed to use real publish dates
(`sitemap.ts:44`) — the same fix never reached the other two arrays. This
teaches Google to distrust the site's `lastmod` entirely, which is the opposite
of what a site publishing new content wants. Also missing:
`alternates.languages` (needed for the hreflang work) and any image sitemap.

`changefreq`/`priority` are present but Google ignores both. Harmless.

**`/llms.txt`** (`src/app/llms.txt/route.ts`) is a good idea executed
incompletely. It is **entirely English** on a French-first site, and its page
list omits `/estimation` (the flagship differentiator), `/blog`,
`/service-areas`, and all nine area pages. For answer-engine citation — the
exact use case it exists for — the highest-value local pages are invisible.

## 1.8 Performance / config

`next.config.ts` is empty (`/* config options here */`). No `images.formats`
for AVIF, no explicit cache headers. Next 16 defaults are reasonable, so this
is low priority — but a real PageSpeed baseline has never been captured
(Roadmap Phase 0, still open).

---

# 2. Competitive landscape — what is actually out there

Fifteen live pages fetched and read on 2026-08-02. Companies and URLs are real.

## 2.1 Solution Gestion Sinistre — the one to actually worry about

`https://solutiongestionsinistre.com` · RBQ 5810-8705-01 · IICRC S500/S520 ·
founded 2021

This is not a brochure. It is a full programmatic content operation and it is
the single most important competitive finding in this document — because it is
executing, in the Montreal market, precisely the strategy the keyword research
recommends.

**A 32-page question-intent hub at `/reponses/`,** organized into 11 categories
(Assèchement, Assurance, Barricadage, Coût, Équipement, Incendie, Moisissure,
Réglementation, Rénovation, Tarification, Urgence, Zone). Each page is one real
searcher question as the H1, ~1,200–1,400 words, with H2/H3 process structure
and cross-links to siblings. A sample of the URLs:

- `/reponses/qui-appeler-premier-sinistre` — "Qui appeler en premier après un sinistre à Montréal ?"
- `/reponses/que-faire-degat-eau-nuit` — "Que faire en cas de dégât d'eau la nuit à Montréal ?"
- `/reponses/degat-eau-locataire-responsabilite` — "Qui paie un dégât d'eau : locataire ou propriétaire ?"
- `/reponses/moisissure-apres-degat-eau-quand` — "En combien de temps apparaît la moisissure après un dégât d'eau ?"
- `/reponses/combien-temps-secher-mur-degat-eau` — "Combien de temps pour assécher un mur après un dégât d'eau ?"
- `/reponses/cout-assechement-sous-sol-laval` — "Combien coûte un assèchement de sous-sol à Laval ?"
- `/reponses/combien-coute-degat-eau-montreal` — "Combien coûte un dégât d'eau à Montréal en 2026 ?"
- `/reponses/rbq-licence-sinistre-quebec` — "Faut-il une licence RBQ pour un entrepreneur en sinistre au Québec ?"

Cross-reference this against the PAA questions harvested in
`SEO-Keyword-Research.md` (§"PAA questions harvested live"). They overlap
almost one-for-one. **Someone else has already started building the content
asset that research recommended.** They are also publishing cost content
("Combien coûte un dégât d'eau à Montréal en 2026") — the differentiator the
competitive research doc identified as unclaimed in Quebec.

Beyond `/reponses/`: 30+ zone pages (municipalities *and* Montreal
neighbourhoods — Plateau, Villeray, Rosemont, NDG), nine service pages,
`/guides`, `/faq`, `/blog`, `/cas-clients`, `/partenaires`, `/technologie`, an
AI photo-upload pre-assessment tool. Trust block: "Intervention 2h engagement",
"4.9/5 Satisfaction client", "Fournisseur de 18 compagnies d'après-sinistre",
"Aucun système de boîte vocale n'est utilisé".

**Their one weakness: French only.** No English version detected. That is the
opening.

## 2.2 The rest of the field

| Company | URL | RBQ | Cert | Response promise | Structure | Weakness |
|---|---|---|---|---|---|---|
| **Groupe RPL** | grouperpl.com | 8301-7483-12 | IICRC, CAA-Québec, APCHQ, GCR | 24/7 line above the logo | 6 service pages, insurer logos (Intact, Beneva, Promutuel, Desjardins, TD) | **No blog, no FAQ, no city pages, no reviews shown, French only** |
| **JG Lessard** | jglessard.com | 1368-9997-20 | IICRC techs | none published | **Audience nav: property managers / condo syndicates / commercial / architects.** FR+EN. City pages: Mirabel, Longueuil, Blainville, Laval, Montréal. Form takes address, service type, **file upload**, consent | No hreflang; no review counts; no question content |
| **NetCorp** | netcorp.ca | 5853-1740-01 | IICRC | 24/7 (×8 on page) | Single deep service page, photo-upload form | No city pages, no blog, no reviews, FR only |
| **Canada's Restoration Services** | canadarestorationservices.com | — | IICRC, BBB A+, HomeStars Best of Best 2025, CleanTrust | **"On site within 45 min or less in Laval" + ETA update every 15 min** | **50+ city pages across 4 provinces**, URL pattern `/[city]/[service]`, 5-question FAQ, 11 testimonials sourced from HomeStars | National template; thin local specificity |
| **Steamatic Laval** | steamatic.ca/franchises/steamatic-laval/ | — | none shown | 24/7 only | Franchise template, FR+EN on separate paths, **no hreflang** | Minimal H2s, zero local content, no reviews, no certifications listed |
| **Rénovations MG Pro** | renovationsmgpro.com | 5720-7359-01 | — | — | 9 service pages, blog, **city pages: Chomedey, Laval-sur-le-Lac, Ville St-Laurent, Pointe-Claire, Blainville**, financing offer ("3 mois sans intérêt") | No reviews, no APCHQ |
| **On Side** | onside.ca/en/branch/laval | — | national | — | National franchise, branch pages | Template |

## 2.3 The directory wall

Every renovation SERP is 2–5 results deep in directories before an actual
contractor appears. `soumissionrenovation.ca/fr/repertoire/qc/laval/sous-sol`
lists **16 contractors on page 1 of 3**, each with logo, address, star rating
(4.5–5.0), **review count (2–41)**, service-category count (15–55), a 50–300
word description, membership date, and a quote button. It cross-links to
Sainte-Rose, Vimont and Laval-des-Rapides variants and to adjacent trades.

Two things follow. First, organic #1 is not available on broad renovation terms
— #3–5 is the realistic ceiling, exactly as the prior research concluded.
Second, **the review counts on those directory profiles are 2–41.** Renovision
AnA's real 5.0/15 is already mid-field. Claiming and completing those profiles
is free ranking surface with no engineering cost.

Also present in the field: `411habitation.com`, `constructionrenovation.com`,
`soumissionslaval.ca`, `trustedpros.ca`, `openhouseqc.com`.

## 2.4 What the field tells us

1. **RBQ + IICRC is table stakes and we do not have it.** Six of seven named
   competitors publish an RBQ number above the fold. Do not fake it, and do not
   compete on the credential axis at all.
2. **Nobody except SGS publishes prices.** Renovision AnA has a working
   estimator over a 1,678-line price book (`src/lib/estimator/data/lineItems.ts`).
   That is still the strongest unclaimed differentiator in the market — but the
   window is closing, and it closes when SGS publishes its second cost page.
3. **Nobody except SGS answers questions.** RPL, NetCorp, Steamatic and On Side
   have no blog and no FAQ. This is the largest open lane, and Renovision AnA
   already has the infrastructure (FAQPage schema wired on nine area pages and
   the estimator page) to occupy it cheaply.
4. **Nobody is bilingual properly.** JG Lessard and Steamatic have FR and EN on
   separate paths with **no hreflang**. SGS, RPL and NetCorp are French only.
   A correct `fr-CA`/`en-CA`/`x-default` implementation would make Renovision
   AnA the only properly bilingual restoration site in the market.
5. **Audience segmentation wins B2B terms.** JG Lessard ranks on gestionnaire /
   syndicat / commercial queries because it has a page for each. Confirmed again
   this pass.

---

# 3. Gap analysis, prioritized

Three distinct kinds of gap. Do not confuse them.

## 3.1 Technical SEO defects (code fixes, no owner input)

| Gap | Impact | Effort |
|---|---|---|
| No hreflang; one URL per page; English content unindexable | **Highest.** Halves the addressable market by construction | L |
| Area pages orphaned — `/service-areas` not in header or footer | **High.** 9 best local pages get almost no internal PageRank | S |
| `lastModified: new Date()` on 30 sitemap URLs every deploy | Medium. Destroys `lastmod` trustworthiness | XS |
| Homepage H1 carries no geography | Medium. Cheapest local signal on the site | XS |
| Schema hours contradict "7 jours sur 7" copy | Medium + honesty | S |
| `areaServed` bare strings, anglicized/unaccented | Medium. Laval/France ambiguity is real | S |
| No `WebSite`/`Organization` node, no `knowsLanguage`, no `hasOfferCatalog` | Low–medium | S |
| Alt text English on French pages (4 files) | Low | XS |
| No breadcrumbs on 10 pages incl. `/service-areas`, `/commercial` | Low | S |
| `llms.txt` English-only, omits `/estimation` + area pages | Low | XS |
| No `not-found.tsx` | Low | XS |
| Titles truncating at 60 chars | Low | S |

## 3.2 Missing pages and content (code + copy)

Where competitors have a page and we have nothing:

| Gap | Who has it | Impact |
|---|---|---|
| **Question-intent hub** (`/reponses/` equivalent) | SGS: 32 pages | **Highest.** Matches PAA data one-for-one |
| **Published cost guides in CAD/pi²** | SGS (2 pages); nobody else in Quebec | **High.** We have the price book; nobody else does |
| **Audience pages** — `/syndicats`, `/assureurs`, `/gestionnaires` | JG Lessard (all four) | High. B2B terms are wide open |
| **Ceiling water damage** (`dégât d'eau plafond`) | Nobody ranks organically | High, low effort |
| **Rive-Nord coverage** — Terrebonne, Blainville, Repentigny | SGS 30+ zones; MG Pro 5 cities | Medium. Demand is there, we have 0 pages |
| **Insurer relationships stated** | RPL (5 insurer logos), JG Lessard (4 named) | Medium — **owner-blocked** |
| **Named response-time commitment** | CRS "45 min", SGS "2h" | Medium — **owner-blocked** |

## 3.3 Trust and conversion gaps

| Gap | State | Blocked on |
|---|---|---|
| RBQ number | Not held | Owner — do not fabricate |
| IICRC / APCHQ / GCR | Not held | Owner — do not fabricate |
| Review count (15) vs directory field (2–41) and map pack (18–85) | Mid-field, real, growing | Owner — post-job review requests |
| GBP categories ↔ site services alignment | Never verified | **Owner — GBP access** |
| Search Console | Never connected | **Owner — DNS verification** |
| Directory profiles unclaimed | ~8 platforms | Owner — free, no engineering |
| Response-time promise | None published | Owner |
| `kitchen-concept.jpg` etc. shown as gallery "after" | Unverified | Owner — confirm these are real projects |

---

# 4. Quebec-specific local SEO

## 4.1 Bill 96 / Charter of the French Language (Loi 14)

Quebec treats a commercial website targeting Quebec consumers as commercial
publishing, which must be available in French. Under the Regulation respecting
the language of commerce and business, the French version must be available on
terms **at least as favourable** as any other language — in practice, French
content that is as complete and as reachable as the English. First-offence fines
run CAD 3,000–30,000 per offence, doubled on a second and tripled after, with
each day capable of counting separately. The OQLF is now prosecuting web content,
not just signage (URBN Canada and Waterco both landed around CAD 3,000).

**Current posture: compliant and comfortable.** French is the served default on
every URL; English requires an explicit user action. This is more than the law
requires.

**Implication for the hreflang work — this is the constraint that decides the
URL shape.** French must stay at the unprefixed root. `/services/water-damage`
stays French; English moves to `/en/services/water-damage`. Do **not** implement
`Accept-Language`-based auto-redirect from `/` to `/en/` — that would make
English the default for an English-preferring browser in Quebec, which is
exactly the "less favourable terms" the regulation targets. `x-default` should
point at the French URL, not a language selector.

(The 25-employee francisation registration threshold that took effect 2025-06-01
governs formal francisation registration, not the website rule. It does not
apply here.)

## 4.2 French-language SEO nuances

- **URL slugs: strip accents, keep hyphens, lowercase.** Accented characters
  percent-encode into unreadable URLs. The current slugs are English
  (`/services/water-damage`, `/services/kitchen-bath`) serving French content —
  a genuine mismatch, since URL words are a (weak) relevance signal and a
  (strong) SERP-display signal. **But do not rename them now.** They are indexed,
  and the value of `degat-eau` over `water-damage` is far smaller than the risk
  of a 301 chain across the whole service tree. Take French slugs on *new* pages
  only (`/reponses/…`, `/couts/…`), and revisit existing slugs only if the
  `[lang]` refactor forces a URL change anyway.
- **France-vs-Quebec contamination.** Per the prior keyword research, ~40% of
  French autocomplete is France. Reinforced this pass: a brand search for
  "Renovision AnA Laval avis" returned nine French-from-France companies. Every
  page should carry a Quebec anchor — a Quebec insurer name (Desjardins, Beneva,
  Intact, Promutuel), a Quebec legal term (TAL, vice caché, loi 16), a Quebec
  municipality, or `$/pi²` pricing. **Never m².**
- **"Laval" is ambiguous.** Laval, Mayenne (France) is a real city of ~50,000.
  Write "Laval, Québec" or "Laval (Rive-Nord)" in body copy at least once per
  page, and fix `areaServed` to typed `City` nodes with `containedInPlace`.

## 4.3 Google Business Profile

GBP signals are the largest single block of local ranking weight (~32%),
followed by on-page (~19%) and reviews (~16%). Primary category is the top
single factor in the local pack. For a service-area business, distance acts as
an eligibility filter rather than a ranking factor: if the searcher is inside
the declared service area, relevance and prominence decide the position.

Actions — **all owner-blocked, none fixable in code:**

1. Audit categories. Primary category should reflect the money cluster, not the
   broadest label. Cross-check every GBP service against a real page on the
   site (Roadmap Phase 1, still open).
2. Write the GBP description in **French** (Quebec French, not European French
   — Google's own FR-CA/FR-FR localization is inconsistent), and name both
   languages served.
3. Publish separate French and English Google Posts. The field is too short to
   fit both in one.
4. Confirm the service-area polygon actually includes the Rive-Nord
   municipalities named in the schema.
5. Review velocity is the only lever that moves review signals. Ask after every
   completed job; respond to all of them.

## 4.4 Citations that matter in Quebec

NAP must match exactly across all of them (`68 Boulevard Cartier Ouest, Laval,
QC H7N 2A3` / `+1 579-990-3077`). A focused, perfectly consistent set of 10–20
beats a sprawling inconsistent one.

**Tier 1 (Quebec/Canada-specific):** PagesJaunes.ca (highest authority for
French-speaking audiences), 411.ca / Canada411, Bing Places, Apple Business
Connect, Yelp Canada.

**Tier 2 (trade directories that already rank on our terms — free ranking
surface):** soumissionrenovation.ca, constructionrenovation.com,
411habitation.com, soumissionslaval.ca, trustedpros.ca, renoquotes,
HomeStars, Houzz.

**Not applicable:** RBQ's licence-holder registry, APCHQ and ACQ member
directories all require credentials the business does not hold.

---

# 5. Implementation backlog

Ordered by (impact × 1/effort). Each item names the files. **Owner-blocked**
items cannot be closed by code and are separated at the end.

Effort key: **XS** <1h · **S** 1–3h · **M** half day to 2 days · **L** 3+ days.

---

### B1 — Put `/service-areas` in the header and footer nav
**Files:** `src/components/layout/Header.tsx` (~line 115-127),
`src/components/layout/Footer.tsx` (~line 30-42), `src/i18n/translations.ts`
(add `nav.serviceAreas` to both locales).
**Why:** Nine sourced local pages at sitemap priority 0.8 receive exactly one
internal link from the whole site, out of a badge row on `/about`. This is the
highest impact-to-effort item in the document.
**Impact:** High. **Effort:** XS.

### B2 — Add geography to the homepage H1
**Files:** `src/components/home/HeroBanner.tsx:99-105` (the H1 renders
`t.hero.headlineStart` + `t.hero.headlineAccent`),
`src/i18n/translations.ts:143-144` (EN) and `:445-446` (FR).
**Why:** The live H1 reads "Rénovation et restauration de dégâts d'eau / en qui
vous pouvez avoir confiance." — no place name anywhere, on a business whose
entire search value is local. The trailing accent clause is pure brand voice
occupying the most valuable heading on the site. Fold the geo in, e.g.
headlineAccent → "à Laval et Montréal."
**Impact:** Medium-high. **Effort:** XS.

### B3 — Stop lying to Google about `lastmod`
**Files:** `src/app/sitemap.ts` lines 33 and 52.
**Why:** `lastModified: new Date()` on 21 static routes + 9 area pages means
every deploy claims 30 pages changed. The blog array already does this correctly
(line 44) — apply the same discipline. Use a module-level build constant, or
per-area/per-page dates if you want real ones.
**Impact:** Medium. **Effort:** XS.

### B4 — Reconcile the 7-days-a-week claim across copy and schema
**Files:** `src/components/seo/LocalBusinessSchema.tsx` lines 57-64,
`src/i18n/translations.ts` lines 139 and 441,
`src/app/services/water-damage/page.tsx` (meta description).
**Why:** Schema says Mon–Fri 08:00–18:00. Header says "7 jours sur 7". Meta
description says "Intervention rapide 7 jours sur 7". Owner facts say
after-hours goes to voicemail. Pick the true statement and make all three
match. If weekend calls really are returned, model it honestly: keep the
weekday `openingHoursSpecification` and add a separate `specialOpeningHours`
or `contactPoint` with `contactType: "emergency"` rather than declaring
24/7 hours the business does not staff.
**Impact:** Medium + honesty. **Effort:** S. **Partially owner-blocked** — needs
the owner to state the real after-hours behaviour.

### B5 — Fix `areaServed` typing and French place names
**Files:** `src/components/seo/LocalBusinessSchema.tsx` lines 68-85.
**Why:** Bare strings give Google no entity to resolve; `"Montreal-North"` and
`"Ile-Perrot"` are wrong in both languages; "Laval" alone collides with Laval,
France. Convert to `{"@type": "City", name: "…", containedInPlace: {"@type":
"AdministrativeArea", name: "Québec"}}` with correct accented French names, and
add `"Montréal"` itself (currently absent).
**Impact:** Medium. **Effort:** S.

### B6 — Localize the four hardcoded English alt strings
**Files:** `src/components/home/HeroBanner.tsx:61`,
`src/components/home/ScrollBeforeAfter.tsx:129,143`,
`src/components/pages/CommercialContent.tsx:190`. Route through
`src/i18n/translations.ts` like the gallery and service-detail images already do.
**Impact:** Low. **Effort:** XS.

### B7 — Rename the "Sécurité et certifications" nav label
**Files:** `src/i18n/translations.ts:130` and `:432`,
`src/components/pages/SafetyContent.tsx:9` and `:49` (eyebrow).
**Why:** The page body is honest — insurance and a written 1-year workmanship
warranty. The *label* promises certifications the business does not hold. Same
class of defect as the "Licensed & insured" copy already removed. Suggested:
"Sécurité et garantie" / "Safety & Warranty".
**Impact:** Low SEO, real honesty. **Effort:** XS.

### B8 — Enrich the business schema node
**Files:** `src/components/seo/LocalBusinessSchema.tsx`.
**Why:** Add `knowsLanguage: ["fr-CA", "en-CA"]` (tells Google you serve both
markets — a precondition for the bilingual play), a `WebSite` node in the graph
with `inLanguage`, and `hasOfferCatalog` listing the eight services so the
business points at its services rather than only the reverse. Also consider
dropping the `review` array: self-collected reviews are ineligible for review
rich results under Google's policy, so it is maintenance with no return. Keep
`aggregateRating` (live-pulled, real).
**Impact:** Medium. **Effort:** S.

### B9 — Add high-intent modifiers to the water-damage page metadata
**Files:** `src/app/services/water-damage/page.tsx` (title/description),
`src/components/pages/WaterDamageContent.tsx` (H2s).
**Why:** "urgence" and "après sinistre" — the two highest-commercial-intent
terms in the keyword research — appear nowhere in the title, description, or
any H2 of the page that sells that service. Also shorten the title so the
brand template does not push it past 60 characters.
**Impact:** Medium. **Effort:** S.

### B10 — Breadcrumb + page-type schema on the ten bare pages
**Files:** `src/app/service-areas/page.tsx`, `about`, `contact`, `gallery`,
`case-studies`, `commercial`, `safety`, `careers`, `blog`, `privacy` —
using `breadcrumbJsonLd()` from `src/lib/seo.ts`. Add a `Service` node to
`/commercial` (named B2B audience, currently unmarked) and `ContactPage` /
`AboutPage` types where they fit.
**Impact:** Low-medium. **Effort:** S.

### B11 — Fix `llms.txt`
**Files:** `src/app/llms.txt/route.ts`.
**Why:** Written entirely in English for a French-first site; omits
`/estimation` (the flagship differentiator), `/blog`, `/service-areas`, and all
nine area pages. Answer engines citing this business currently cannot see its
best local content. Emit French primary with the English titles alongside, and
add the missing routes — generate the area list from `serviceAreas.ts` so it
cannot drift.
**Impact:** Low-medium, rising. **Effort:** XS.

### B12 — Add a branded `not-found.tsx`
**Files:** new `src/app/not-found.tsx`.
**Why:** Mistyped URLs currently serve Next's unstyled default with no way back
into the site. A French 404 with links to services, areas and contact recovers
the traffic and the crawl path.
**Impact:** Low. **Effort:** XS.

---

### B13 — Ceiling water-damage page
**Files:** new `src/app/services/water-damage/plafond/page.tsx` +
`src/components/pages/…`, add to `src/app/sitemap.ts`, link from
`WaterDamageContent` and the relevant area pages.
**Why:** The prior research verified no restoration brand holds the organic top
3 for "dégât d'eau plafond réparation Montréal" — plasterers and plumbers do.
The PAA data hands over the outline, including the single best question in the
dataset: *"Qui doit payer pour réparer et peindre un plafond suite à un dégât
d'eau provenant du condo au-dessus?"* — emergency + condo + insurance + our
exact trades. FAQPage schema wiring already exists to copy from
`service-areas/[area]/page.tsx`.
**Impact:** High. **Effort:** M.

### B14 — Question-intent hub (`/reponses/`)
**Files:** new `src/lib/answers.ts` (content, FR + EN fields, mirroring
`serviceAreas.ts`), new `src/app/reponses/page.tsx` and
`src/app/reponses/[slug]/page.tsx`, `src/app/sitemap.ts`, links from
`/services/water-damage` and the area pages.
**Why:** This is the competitive centre of gravity. Solution Gestion Sinistre
has 32 such pages live and they map almost one-for-one onto the PAA questions
in `SEO-Keyword-Research.md`. Every page is a `FAQPage`/`QAPage` node, French
slugs without accents, ~1,000+ words, cross-linked into a mesh. Start with the
eight questions the research already harvested (first-24h, qui appeler, sous-sol
inondé, plafond/condo, refoulement, moisissure timeline). **Do not** copy SGS's
regulatory pages — `rbq-licence-sinistre-quebec` is a question this business
cannot answer advantageously.
**Impact:** Highest content-side. **Effort:** L (M for the first five pages).

### B15 — Cost guides in CAD and $/pi², generated from the price book
**Files:** new `src/app/couts/[slug]/page.tsx` reading from
`src/lib/estimator/data/lineItems.ts` — **single source, never a second copy of
the numbers**. Link from `/estimation` and each service page.
**Why:** The strongest unclaimed differentiator in the market, and the window is
closing — SGS has already published two cost pages. Renovision AnA has a
1,678-line price book and a working estimator; nobody else in Quebec has either.
Answer in `$/pi²` and total CAD, never m² (the France-scraped content currently
ranking answers in m² — that is the wedge).
**Impact:** High. **Effort:** M.

### B16 — Audience pages: `/syndicats`, `/gestionnaires`, `/assureurs`
**Files:** new routes + content components, add to nav, sitemap, `llms.txt`,
and de-orphan the existing Bill 16 condo blog post by linking it from
`/syndicats`.
**Why:** JG Lessard ranks #1/#2 on every audience term in the market for exactly
one reason: it has a page per audience (property manager, syndicate, commercial,
architect). Confirmed again this pass. `/syndicats` and `/gestionnaires` are
buildable now. **`/assureurs` is owner-blocked** — it needs real answers on
Xactimate, carrier panels and direct billing, and writing it without them
produces exactly the generic contractor copy the roadmap warns against.
**Impact:** High for B2B. **Effort:** M each.

### B17 — Rive-Nord expansion: Terrebonne + a Rive-Nord hub
**Files:** `src/lib/serviceAreas.ts` (new entries, same sourced-fact discipline
as the existing nine — real citable municipal/StatCan facts, no template swap),
sitemap picks them up automatically.
**Why:** Rive-Nord cities autocomplete for water damage where Laval boroughs
mostly do not. SGS covers 30+ zones; MG Pro covers 5 cities; we cover 0 outside
Laval and four Montreal boroughs, while the business schema already claims
Terrebonne and Longueuil.
**Impact:** Medium-high. **Effort:** M.

### B18 — Sibling cross-links between area pages
**Files:** `src/components/pages/ServiceAreaContent.tsx` (~line 171),
`src/lib/serviceAreas.ts` (add a `nearby` field).
**Why:** Nine pages currently form a star around a hub nobody links to (see B1).
Adding 2–3 genuinely adjacent areas per page ("aussi à proximité") turns it into
a mesh. Adjacency must be geographic and real — not every-page-links-to-every-page,
which is the pattern the roadmap correctly warns against.
**Impact:** Medium. **Effort:** S.

### B19 — Add H2 structure to `/services`
**Files:** `src/components/pages/ServicesContent.tsx`,
`src/i18n/translations.ts`.
**Why:** An H1 and eight cards with zero H2s. Group into "Après sinistre",
"Rénovation intérieure", "Finition et réparations" with real intro copy per
group, so the page has something to rank on beyond being a link grid.
**Impact:** Low-medium. **Effort:** S.

---

### B20 — Bilingual routing + hreflang *(the big one)*
**Files:** `src/app/[lang]/` restructure of the entire marketing tree, new root
`proxy.ts`, `src/lib/seo.ts` (add `alternates.languages`), `src/app/sitemap.ts`
(add per-entry `alternates.languages`), `src/i18n/LanguageProvider.tsx`
(localStorage → route-driven), `src/components/layout/Header.tsx` (language
toggle becomes a link, not a state setter), every `page.tsx`.

**Before writing a line of this, read:**
`node_modules/next/dist/docs/01-app/02-guides/internationalization.md` and
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
This is Next **16.2.10** — `middleware.ts` is **deprecated and renamed to
`proxy.ts`**, and there is no `i18n` config key for the App Router. Code written
from memory will target the wrong file convention.

**Shape:** French stays at the unprefixed root (`/services/water-damage`),
English goes to `/en/services/water-damage`. No `Accept-Language` auto-redirect
— see §4.1; making English the default for an English-preferring browser is
precisely what Bill 96's "at least as favourable" clause targets. hreflang per
page: `fr-CA` → root, `en-CA` → `/en/…`, `x-default` → root. Add
`og:locale:alternate`. Every currently indexed URL keeps working, so no 301s
and no equity reset.

**Why:** Roughly half the content in `translations.ts`, `serviceAreas.ts` and
`blogPosts.ts` — already written, already paid for — is structurally
unindexable. The entire English keyword cluster is unrankable, not merely
unranked. And no competitor in the market has correct hreflang: JG Lessard and
Steamatic both run FR and EN on separate paths with none.

**Impact:** Highest on the list. **Effort:** L. Sequence it *after* B1–B12
(so the cheap wins are not blocked behind a refactor) and *before* B14–B17
(so new content is created bilingual rather than retrofitted).

---

## Owner-blocked — cannot be closed by code

| # | Needed from the owner | Unblocks |
|---|---|---|
| O1 | **Google Search Console** — add property, verify via DNS TXT | All measurement. Roadmap Phase 0.5, still open |
| O2 | **GBP dashboard access** — audit primary + secondary categories, cross-check every GBP service against a real page, confirm the service-area polygon covers the Rive-Nord municipalities the schema claims | ~32% of local ranking weight. Roadmap Phase 1 |
| O3 | **Real after-hours behaviour** — are weekend/night calls returned, and within what window? | B4. Currently three contradictory claims on the live site |
| O4 | **PageSpeed baseline** (mobile + desktop) before any perf work | Roadmap Phase 0 |
| O5 | **Claim the 8 directory profiles** — soumissionrenovation, constructionrenovation, 411habitation, soumissionslaval, trustedpros, renoquotes, HomeStars, Houzz | Free ranking surface. Field review counts are 2–41; ours is 15 |
| O6 | **Tier-1 citations** — PagesJaunes.ca, 411.ca, Bing Places, Apple Business Connect, Yelp Canada, NAP-exact | Citation signals |
| O7 | **Review velocity** — ask after every completed job, respond to all | ~16% of local weight; the only lever that moves it |
| O8 | **Xactimate? carrier panels? direct billing?** | B16 `/assureurs` — unwriteable without these |
| O9 | **Response-time commitment he will stand behind** | The one competitive claim available to us that does not require a credential. CRS publishes 45 min, SGS publishes 2 h |
| O10 | **Confirm `kitchen-concept.jpg`, `drywall-concept-*`, `painting-concept-*` are real completed projects** | Gallery honesty. If they are renders, they cannot sit in a projects gallery |
| O11 | **Real closed-job price ranges** to sanity-check B15 against the price book | B15 |

---

## Sources

Competitors and market: [Solution Gestion Sinistre](https://solutiongestionsinistre.com/) ·
[SGS /reponses hub](https://solutiongestionsinistre.com/reponses/) ·
[Groupe RPL](https://www.grouperpl.com/) ·
[JG Lessard](https://www.jglessard.com/en/post-disaster/) ·
[NetCorp](https://www.netcorp.ca/nettoyage-apr%C3%A8s-sinsitre) ·
[Canada's Restoration Services — Laval](https://www.canadarestorationservices.com/page/water-damage-restoration-laval-montreal) ·
[Steamatic Laval](https://steamatic.ca/franchises/steamatic-laval/) ·
[Rénovations MG Pro](https://www.renovationsmgpro.com/) ·
[On Side Laval](https://www.onside.ca/en/branch/laval) ·
[Soumission Rénovation — Laval sous-sol](https://soumissionrenovation.ca/fr/repertoire/qc/laval/sous-sol)

Regulatory and technical: [Bill 96 website requirements](https://www.weglot.com/blog/bill-96-explained) ·
[CFIB — Quebec Law 14](https://www.cfib-fcei.ca/en/site/qc-law-14-bill-96) ·
[Bill 96 compliance checklist](https://2727coworking.com/articles/quebec-bill-96-business-compliance) ·
[hreflang Canada implementation](https://koanthic.com/en/hreflang-canada-implementation-complete-guide-2026/) ·
[x-default Canadian best practice](https://www.seologist.com/knowledge-sharing/what-is-x-default-in-hreflang/) ·
[Local ranking factors 2026](https://www.clickrank.ai/local-seo-ranking-factors/) ·
[BrightLocal — Google's local algorithm](https://www.brightlocal.com/learn/google-local-algorithm-and-ranking-factors/) ·
[GBP optimization for Quebec](https://projekia.com/en/blog/google-business-profile-optimization-quebec-en) ·
[Canadian business directories](https://townmedialabs.ca/blog/local-seo-guide-canadian-businesses) ·
[French URL slug practice](https://heroicimpulsion.com/slug-seo)

Next.js behaviour verified against the bundled docs in
`node_modules/next/dist/docs/` (v16.2.10), not from memory.
