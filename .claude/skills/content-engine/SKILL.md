---
name: content-engine
description: Write, validate, and land new blog posts, area pages, and service pages for renovisionana.ca. Use whenever the task is picking what content to write next, drafting a post or page, or preparing site copy for publication. Enforces the FR-first, sourced, no-auto-publish pipeline.
---

# Content engine — renovisionana.ca

**Read `Docs/Content-Engine.md` before writing anything.** It is the operating
manual; this file is the entry point.

## What to do next

The queue is `Docs/Content-Backlog.md`. Take the top item whose status is
`queued` and whose blockers are clear. Do not invent a topic that isn't in the
backlog — if you believe one belongs there, add it with its evidence and say so,
then let the owner order it.

Never skip an item because it looks harder than the one below it. The order
encodes seasonality: a frozen-pipe post published in January is a post nobody
finds.

## The stages

1. **Brief** → `content/briefs/<slug>.md` from `_TEMPLATE.md`. It must name what
   the current top three results fail to answer. "We'd cover it better" is not
   a gap; put the item back.
2. **Draft, French first.** Blog posts as `content/drafts/<slug>.json` matching
   the `BlogPost` type in `src/lib/blogPosts.ts`. English is a translation of
   the French, never the reverse.
3. **Validate** → `npm run content:check`.
4. **Owner gate.** Artush reads the French. Present it as readable prose, not
   as JSON. Nothing proceeds without his word.
5. **Land** → `npm run content:check -- --emit <slug>`, paste into
   `src/lib/blogPosts.ts`, add the inbound link, handle the sitemap, commit
   alone.

## Hard rules

- **Never write to `src/` before the owner gate.** No script here does, and
  neither do you.
- **$/pi² and CAD.** Never m², never €.
- **Quebec, not France.** No loi Warsmann, garantie décennale, permis de
  construire, TVA, Veolia/SAUR/MAAF.
- **« Réponse 24/7 » means the phone is answered**, never overnight crew
  dispatch. Keep copy, schema, and header strip in agreement.
- **Every fact carries a source.** No invented statistics, no invented local
  history, no claims about a specific building.
- **Deploy is the owner's call.** Production ships from `master`; content
  commits reach it by cherry-pick, never by merging `mobile-app`.
