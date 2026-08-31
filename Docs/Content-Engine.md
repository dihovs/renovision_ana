# Content Engine — renovisionana.ca

The operating manual for putting new pages and posts on the site. It exists
because the research is already done (`SEO-Keyword-Research.md`,
`SEO-Deep-Audit-2026-08.md`, `Website-Competitive-Research.md`) and the
bottleneck is now production, not analysis.

**Two rules define this engine:**

1. **The queue decides what gets written**, not whatever seems interesting that
   day. The queue is `Docs/Content-Backlog.md`. It is ordered, and every item
   carries the evidence that justifies it.
2. **Nothing reaches `src/` without the owner reading it first.** Drafts live in
   `content/drafts/`, outside the build. There is no auto-publish step, and no
   script in this repo writes to `src/lib/blogPosts.ts` or `serviceAreas.ts`.

---

## The pipeline

    backlog → brief → draft (FR) → draft (EN) → validate → OWNER GATE → land → deploy

### Stage 1 — Brief

Pick the top unblocked item from `Docs/Content-Backlog.md`. Write
`content/briefs/<slug>.md` from `content/briefs/_TEMPLATE.md`. A brief is not
an outline of what you want to say; it is a record of what the SERP currently
rewards and where our angle differs. If the brief can't name what the top three
results are missing, the item goes back to the queue.

### Stage 2 — Draft, French first

French is canonical (the unprefixed path); English lives under `/en`. Write the
French first and translate to English — not the reverse. A French draft written
by translating English reads translated, and this market notices.

Blog posts are drafted as `content/drafts/<slug>.json`, matching the `BlogPost`
type in `src/lib/blogPosts.ts` exactly. Area and service pages are drafted as
markdown in the same folder, because their shapes live in different files.

### Stage 3 — Validate

    npm run content:check

Mechanical rules only — lengths, structural FR/EN parity, dead internal links,
banned vocabulary, slug collisions. It catches the errors that are embarrassing
rather than the ones that are wrong. Passing it does not mean the draft is good.

### Stage 4 — Owner gate

Artush reads the **French** draft. Not the English, not a summary. Anything he
can't say out loud to a customer gets cut. This is the only gate that matters,
and it is never skipped because the validator passed.

### Stage 5 — Land

    npm run content:check -- --emit <slug>

prints the TypeScript literal. Paste it into `src/lib/blogPosts.ts` (newest
first). Then, in the same commit:

- **Hero image** into `public/images/blog/` — or leave `heroImage` off and let
  the `heroStat` graphic carry it. Never ship a stock photo of a bathroom that
  isn't ours.
- **Sitemap.** A new blog post needs nothing (it reads `publishedAt`). A new
  *route* must be added to the `routes` array in `src/app/sitemap.ts`, and edits
  to existing marketing copy or area content mean bumping
  `MARKETING_LAST_UPDATED` / `AREAS_LAST_UPDATED` by hand. Those constants are
  deliberately not `new Date()` — see the comment in that file.
- **One inbound link.** A post nobody links to is orphaned. Add a
  `linkParagraph` from a related page or post, chosen because a reader would
  actually follow it.
- **Commit alone.** Content commits don't ride along with app work.

### Stage 6 — Deploy (separate decision, owner's call)

Vercel deploys production from **`master`**, not `mobile-app`. Move content
commits over by cherry-picking into a temp `git worktree` — never fast-forward
`mobile-app` into `master`, and never `vercel --prod` from a dirty tree.
See the deploy mechanics section of the SEO memory / `Docs/HANDOFF.md`.

---

## House rules

These are not style preferences. Each one exists because breaking it cost us
something or would.

**Money and measurement**
- Always `$/pi²` and total CAD. Never `m²`, never `€`. The France-scraped
  content currently ranking answers in m² — that gap is our opening.
- Cost ranges come from the estimator price book, not from the internet.

**Quebec, not France**
- Banned as France-only signals: Veolia, SAUR, MAAF, loi Warsmann, garantie
  décennale, permis de construire, TVA, prix au m².
- Quebec signal instead: the city, the insurer (Desjardins, Beneva, Intact,
  Promutuel, La Personnelle), or the legal term (TAL, vice caché, loi 16/141).

**The 24/7 line**
- « Réponse 24/7 » / "Answered 24/7" — the phone is answered at any hour.
- Never imply overnight crew dispatch. Confirmed with the owner 2026-08-30;
  the schema, the header strip and every page must agree on this distinction.

**Facts**
- Every factual claim about a place, a law, or a number carries a citable
  source. Area pages record theirs in a `sources` array; posts cite in-line by
  naming the body (Royal LePage, APCIQ, RBQ, Ville de Laval).
- Professional judgment is written as general expertise about a housing type or
  era — never as a claim about a specific building or address.

**Structure**
- Internal links mirror the real service hierarchy, curated per page. Not
  everything links to everything; that is the pattern Google penalised in
  Aug 2025.
- No template-swapping a page and changing the city name. If a competitor in
  Ontario could publish the same text with a find-and-replace, it isn't done.
- Section types available to posts: `paragraph`, `heading`, `list`, `stats`,
  `linkParagraph`, `timeline`. FR and EN must use the same sequence of types.

**Lengths** (calibrated against what's already shipped, not invented)
- `metaTitle` 38–52 chars — the layout appends " | Renovision AnA".
- `metaDescription` 130–160 chars.
- `excerpt` one or two sentences, distinct from the meta description.

---

## Definition of done

- [ ] Brief names what the current top-3 results fail to answer
- [ ] French written first, English is a real translation
- [ ] `npm run content:check` passes
- [ ] Every fact traceable to a named source
- [ ] Costs in $/pi² and CAD
- [ ] At least one inbound internal link from an existing page
- [ ] Sitemap route added / lastmod constant bumped if applicable
- [ ] Owner has read the French version
- [ ] Backlog row moved to `done` with the publish date
