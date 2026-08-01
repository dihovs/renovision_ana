# What the best construction & restoration websites do — and what we take from them

**Researched:** 2026-07-31 · 22 live sites studied across four tiers (enterprise
contractors, restoration/disaster-recovery brands, high-end design-build
remodelers, pricing-transparent tech-forward firms) plus the four strongest
Quebec locals. Full per-site notes at the bottom.

## The two facts that shape everything

1. **Almost nobody publishes prices.** Zero of six enterprise contractors and
   five of seven high-end remodelers publish any number. Neil Kelly, Block
   Renovation and Adorned Homes are the exceptions. Publishing real CAD ranges
   is still a *differentiator*, not table stakes.
2. **The Quebec bar is a brochure with a phone number.** Not one local
   competitor publishes a number, offers an estimator, has a chat widget, or
   qualifies a lead beyond "what service". We are already ahead of all of them
   on tooling; the gaps are trust signals and conversion routing.

## Where we already win

AI chat estimator (nobody local has one) · live Google reviews in hero +
testimonials · real before/after scroll section · EN/FR on one domain ·
audience-segmented homepage · serif display typography (matches the premium
tier: Meadowlark, Normandy, Adorned all use display serifs).

## Verified gaps in our codebase

- No RBQ / IICRC / APCHQ / ACQ / GCR / CNESST reference anywhere in
  `src/i18n/translations.ts` — only "Licensed & insured" (unverifiable next to
  Groupe RPL showing `RBQ 8301-7483-12` above their hero).
- The string "24/7" appears nowhere. Emergency is mentioned once, buried in the
  hero subheadline — on a site that sells water-damage response.
- Contact form is name/phone/email/message. JG Lessard's local form (role
  segmentation, service type, file upload) is currently better than ours.
- `CaseStudiesContent.tsx` ships "Real project photos coming soon; placeholders
  shown for now" to every visitor — live copy announcing the proof is fake.
- Locale lives in localStorage with one URL per page → Google indexes ONE
  language per URL; we can't rank for both "rénovation après sinistre Laval"
  and "water damage restoration Laval". `seo.ts` has no `languages` alternates
  and hardcodes `locale: "en_US"`.

## Prioritized recommendations

### (a) Quick wins — this week

| # | What | Effort | Owner input? |
|---|---|---|---|
| 1 | RBQ number in header strip + footer (locals put theirs above the hero) | S | **RBQ number; APCHQ/ACQ/GCR/CNESST standing** |
| 2 | Persistent 24/7 emergency band with tel: link, visually separate from the form path | S | **Confirm after-hours calls are really answered** |
| 3 | Two qualifying questions on the contact form — "Is this an emergency? Yes/No" + "I am the… owner / property manager / adjuster / syndicate / commercial" (Paul Davis pattern) + photo upload | S | No |
| 4 | Delete the "placeholders shown for now" sentence from case studies | S | No |
| 5 | Stats bar → outcome stats ("% of jobs within estimate", "hours to first visit") with count-up-on-scroll | S | **Real numbers he'll stand behind** |
| 6 | Warm neutrals: bone `#F7F4F0` instead of `#FFF`, warm charcoal instead of `#000` (Meadowlark) — cheapest premium signal | S | Taste check |
| 7 | One explaining sentence per credential badge, naming individual certs (WRT/ASD/CDS style specificity) | S | Partial |

### (b) Medium investments

| # | What | Why | Owner input? |
|---|---|---|---|
| 8 | **Named response-time programme with published numbers** (PuroClean "CPR": 60 min contact / 4 hr on site / 24 hr status). No Quebec competitor publishes any number. Highest-leverage single differentiator. | Restoration buyers buy speed | **What he can actually commit to** |
| 9 | Insurance-professional page: documentation standard, moisture logs, direct billing, Xactimate if applicable. Vocabulary IS the credential (subrogation, loss ratio, pretesting). | Homepage card currently goes nowhere | **Xactimate? carrier panels? direct billing?** |
| 10 | `/commercial` → named pre-loss programme (BELFOR RED ALERT model): pre-walk, shutoff photo inventory, contact sheet, **pre-approved NTE amounts** | Wins portfolios, not jobs | **Will he sign pre-loss agreements? NTE threshold?** |
| 11 | Publish kitchen/bath/basement price ranges: teach cost drivers first, then Refresh/Replace/Reimagine matrix, then disclaim (Neil Kelly). Generate from the same price book the estimator uses — never two sources. | Only such page in the Quebec market | **Real ranges from closed jobs** |
| 12 | Case studies → Meadowlark anatomy: Vision → Results → Goals → Challenges → Selections, before-photos block, duration + borough + insurance-claim flag | Enterprise sites ship cards with no outcomes; beat them | **Photos, durations, permissions** |
| 13 | Name the process steps ("Livable Remodeling", "The After Party") + add week counts per phase | Named steps are remembered | No |
| 14 | Publish a warranty (nobody local does). Meadowlark's scheduled 1-year walk-through framing | Obligation → relationship | **Terms** |
| 15 | "How did you hear about us?" incl. plumbers + insurance brokers as options | Attribution + referral signal | No |
| 16 | Cost-guide content as estimator on-ramp; steal Block's disarm FAQ: "estimate = data-driven preview, not a confirmed bid" | The estimator is a widget people must choose to open | No |

### (c) Structural bets

| # | What | Notes |
|---|---|---|
| 17 | **Real /fr /en routes + hreflang** (replaces localStorage locale). Highest SEO value on the list; doubles the indexable search surface. Read `node_modules/next/dist/docs/` routing+metadata guides first — this fork differs from stock. | L |
| 18 | Audience as primary nav axis (Residential / Commercial / **Insurance** / **Syndicats de copropriété** — the latter unserved locally except JG Lessard). Brasfield anatomy per page: stat pair → filtered gallery → audience testimonials → "contact our X lead" form | L |
| 19 | Contact form → 3-step wizard (PCL): emergency-or-planned → what happened + photos → who are you → contact. Contact info LAST. Never ask budget — require street address instead (qualifies by neighbourhood, Case/Normandy pattern) | M/L |
| 20 | Paid, fixed-fee, non-obligating scoping visit (Meadowlark "Conceptual Design Agreement": "determine if your wishes and budget align"). Business-model call, highest-margin idea found | Owner decision |
| 21 | Adjuster/broker/plumber education content, French first (SERVPRO runs accredited CE courses as lead-gen; nobody in Quebec produces adjuster-facing content) | L |
| 22 | Gallery filters (service × property type × city) + metadata on every card. Must server-render — Adorned's JS-only galleries return empty to crawlers | M/L |

## Everything blocked on the owner, in one table

| Needed from Artush | Unblocks |
|---|---|
| RBQ licence number; APCHQ / ACQ / GCR / CNESST standing | #1, #7 |
| Confirmation after-hours calls are truly answered | #2, #8 |
| Real project counts / outcome percentages | #5 |
| Response-time commitment he'll stand behind | #8 |
| Xactimate? Carrier/TPA panels? Direct billing? | #9 |
| Pre-loss agreement willingness + NTE threshold | #10 |
| Real price ranges from closed jobs (CAD) | #11 |
| Real photos, durations, location permissions | #4, #12 |
| Warranty terms | #14 |
| Charge for the scoping visit? | #20 |

**If only three things get done:** RBQ number + 24/7 band (#1, #2), the two
qualifying form questions (#3), and a named response-time promise with real
numbers (#8). Those alone beat every restoration competitor in greater
Montreal.

---

## Per-site takeaways (22 studied)

**Enterprise:** Turner (4-lane contact router; Restoration as a portfolio
filter; zero animation libs) · McCarthy (filter by contract delivery method) ·
Suffolk (motion benchmark — GSAP/SplitText/ScrollTrigger/Lenis; only site
publishing real safety movement, "75% TRIR decrease since 2018") · PCL
(Canadian; best conversion pattern: 3-step modal wizard; "$6M saved"
quantification) · Mortenson (best empathy copy, worst contact page) ·
Brasfield & Gorrie (per-market pages with own stats + testimonials + market
leader form).

**Restoration:** PuroClean (best overall: 4 audiences with different promises;
branded SLA "CPR Program" 60min/4hr/24hr/48hr; pre-approved NTE for PMs) ·
Paul Davis (nav = Residential/Commercial/Insurance; "Is This An Emergency?"
field; separate FNOL "Assign A Claim" intake with 45 loss types) · SERVPRO
(sells carriers on loss ratio; restore-vs-replace pretesting; 2yr/1yr
warranty; free CE courses as lead-gen) · BELFOR Canada (RED ALERT retainer
pre-loss agreement, 4hr on site, sold by a named human) · First Onsite
("Proudly Canadian-owned" vs US franchises; says "subrogation") · 1-800 Water
Damage (falsifiable comparative review claim; plumbers as named referral
partners) · BluSky (403-blocked; drops homeowners entirely; secondary bids
when adjusters dispute).

**High-end design-build:** Meadowlark (the model: Larken serif on bone
#F7F4F0, bronze accent; "The After Party" warranty step; paid Conceptual
Design Agreement; Vision→Results→Goals→Challenges→Selections case studies) ·
Neil Kelly (9-cell price matrix + phase timeline as TOP-LEVEL NAV; Refresh/
Replace/Reimagine tiers; kitchens $40k–$290k) · Normandy (Playfair serif;
"Livable Remodeling" names the anxiety; requires street address — qualifies by
neighbourhood, never asks budget) · Case ("Built around the way you live";
CTA = "Schedule a Conversation" with a real date/time picker; per-image View
Before toggles; credits carpenters by name) · Adorned ($425 paid consult
published; JS-only galleries invisible to crawlers — cautionary) · Stonewood
NZ (navigate by price band while publishing no prices; 15-step process;
12mo+6yr warranties) · Brightstone (qualifies on life stage; CASL checkbox).

**Tech-forward:** Block Renovation (benchmark for cost content: size×scope
matrix, "what $15k/$25k/$40k buys" with a Trade-offs row, photo-upload AI
visualizer with live price; contact info LAST in 6-step wizard; outcome stats
"84% zero change orders") · Sweeten (best cost editorial, but same kitchen
budget stated 3 incompatible ways on one page — single-source your numbers) ·
Power HRG (ZIP → product → "Do you own the property?" gate → time slots;
Customer Bill of Rights) · Houzz (badge vocabulary: Verified License · 52
Hires · Responds Quickly).

**Quebec locals:** Groupe RPL (strongest: red 24/7 line above the logo; every
badge explained in a sentence; "Approuvé par les assureurs… nous prenons en
charge toutes les démarches"; but French-only, no reviews) · Soresto (real
EN/FR, 6 RBQ numbers; contact dropdown has NO emergency option — live
conversion bug) · JG Lessard (best positioning: Gestionnaire immobilier /
Syndicat / Commerce / Architecte segmentation; best form incl. file upload;
but "24–48 heures ouvrables" on a disaster page) · Atmospec (RBQ + 24/7 strip
above hero — correct placement; empty blog live on homepage; EN on separate
domain).
