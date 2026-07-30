# Renovision AnA — Local SEO Roadmap

Based on the "How To Rank Overnight" video analysis + audit of renovisionana.ca (July 2026)

Ordered by priority. Each phase has a **test/verify** step before moving on.

---

## Phase 0 — Baseline Check (do this first, before any changes)

- [ ] Run **pagespeed.web.dev** on renovisionana.ca (mobile + desktop) — record the scores
- [ ] Log into Google Business Profile dashboard — screenshot current categories & services list
- [ ] Confirm name/address/phone match exactly across: website footer, GBP, Facebook, Instagram

**Why first:** you need a "before" snapshot to know if later changes actually helped.

---

## Phase 0.5 — Google Search Console Setup (do this early too)

This is different from Google Business Profile — GSC shows you what people actually search to find your site, what pages get clicked, and lets Claude Code pull real performance data instead of guessing.

- [ ] Go to search.google.com/search-console, add renovisionana.ca as a property
- [ ] Verify ownership via a DNS TXT record at your domain registrar (Claude Code can walk you through adding this record if you tell it which registrar you use)
- [ ] Once verified, this becomes your main source of truth for "is any of this actually working" — check back here in Phase 8

**Test:** Search Console shows "Ownership verified" and starts populating data within a few days.

---

## Phase 1 — GBP ↔ Website Alignment (Week 1) 🔴 Highest Priority

- [ ] List every category and service currently on the GBP dashboard
- [ ] Cross-check: does every GBP service have a matching page on the site? (water damage, flooring, kitchen/bath, basements, renovations, repairs — looks mostly covered)
- [ ] Does every site service page correspond to something actually selectable on GBP? (don't let Claude invent categories — GBP is a dropdown, not free text)
- [ ] Fix any mismatches on either side

**Test:** GBP categories list and site services list should be a 1:1 match.

---

## Phase 2 — Hyper-Local Pages (Weeks 1–3) 🔴 Highest Priority

This is the single biggest gap on the site right now — zero location-specific content exists.

- [ ] Pick 5–8 target areas within your service zone (e.g. specific Laval boroughs — Chomedey, Sainte-Rose, Vimont, Fabreville, Duvernay — plus key Montreal boroughs you serve)
- [ ] For each area, build **one page** including:
  - Real landmarks/neighborhoods that show up on Google Maps (not generic filler)
  - Locally relevant issues (e.g. older housing stock in a given borough → common water damage or plumbing issues)
  - A short FAQ specific to that area
- [ ] Do NOT just template-swap the city name — that's the exact spam pattern Google penalized in Aug 2025

**Test:** Search Google Maps from within each target area for your core terms (e.g. "restauration dégât d'eau [neighborhood]") — check current position before/after publishing.

---

## Phase 3 — Internal Linking Structure (Weeks 2–3, parallel to Phase 2)

- [ ] Map out your GBP hierarchy on paper: Category → Services → Locations
- [ ] Link location pages to the specific services relevant to that area (not everything to everything)
- [ ] Avoid letting Claude auto-link pages just because they "seem related" — structure must mirror GBP, not vibes

**Test:** Click through your own site as if you were Google — does the link structure match your GBP structure exactly?

---

## Phase 4 — Add Local Specificity to Existing Service Pages (Weeks 3–4)

- [ ] Water damage, flooring, kitchen/bath, basements, renovations, repairs pages currently read as generic
- [ ] Add 2–3 sentences per page referencing real local context (Quebec housing types, climate-related issues, Bill 16 condo fund angle you already used well in the blog)

**Test:** Would a competitor's generic template page in Ontario or Ohio read identically? If yes, it's not local enough yet.

---

## Phase 4.5 — Give Claude a Brand Brief (do this once, before Phase 5)

Generic SEO audits give generic results. Before the technical pass, write up (or dictate to Claude) a short brief covering:
- Who Renovision AnA serves (property managers, insurers, homeowners) and how you talk to each
- What makes you different (licensed/insured, insurer-approved network, documentation/photo evidence for claims)
- Your actual service area boundaries

Save this as `docs/brand-brief.md` in the project so Claude references it for every description, schema, and page it touches — instead of writing generic contractor copy.

**Test:** Re-read any Claude-written copy — does it sound like it could only be Renovision AnA, or could it be any contractor anywhere?

---

## Phase 5 — Technical SEO Pass (ongoing, can run as background sub-agents)

- [ ] Ask Claude Code to run a detailed (ultrathink/Opus) SEO audit — be specific about what to check, don't just say "audit my site"
- [ ] Verify: robots.txt, sitemap.xml, LocalBusiness schema markup present and correct
- [ ] Add an `llms.txt` file (signals AI crawlers like ChatGPT/Claude/Gemini are welcome to index — note the "s," this is the correct filename, not `llm.txt`)
- [ ] Add or improve an About page with a clear, structured breakdown of the business, team, credentials, and service area — this feeds both SEO and "AI answer engine" visibility (being cited by ChatGPT/Claude/Gemini when someone asks for a recommendation)
- [ ] Re-run PageSpeed Insights, compare to Phase 0 baseline
- [ ] Validate schema two ways: Google's Rich Results Test (search.google.com/test/rich-results) and validator.schema.org

**Test:** PageSpeed scores improved vs. baseline; both schema validators show no errors; About page reads as specific to Renovision AnA, not generic.

**Optional tool:** there are open-source "SEO skill" plugins for Claude Code that bundle a lot of these checks together. These are third-party, unaudited by Anthropic — if you try one, review what permissions/access it requests (especially anything touching Google Search Console) before installing.

---

## Phase 6 — Reviews & Trust Signals (ongoing, no shortcut)

- [ ] Actively request a Google review after every completed job — no AI tool replaces this
- [ ] Respond to every review (good and bad) from the GBP dashboard

**Test:** Review count and average rating trending up month over month.

---

## Phase 7 — Content Cadence (ongoing — you're already doing this well)

- [ ] Keep publishing blog posts tied to local/regulatory topics (Bill 16, ROI data, etc.) — this is genuinely ahead of most competitors
- [ ] Where possible, tie new posts back to specific service areas

---

## Phase 8 — Measure & Iterate (Month 2+)

- [ ] Instead of checking rank from one location, check from multiple points across your service area (a "rank grid," not a single search)
- [ ] Re-audit every quarter as more local competitors start using AI too — this window won't stay easy forever

---

### Quick priority summary if you only do 3 things first:
1. **Phase 1** — GBP/site alignment
2. **Phase 2** — Build the local area pages
3. **Phase 3** — Fix internal linking to match GBP structure

Do Phase 0 and 0.5 (baseline + Search Console) in parallel with these — they're setup, not competing priorities.
