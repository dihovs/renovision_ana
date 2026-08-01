# Design upgrade ideas — what the world's best-designed sites do, and what we take

**Studied:** 2026-08-01 · ~45 reference sites across four clusters, plus a measured
teardown of our own live site at desktop and mobile widths.

- **Canonical product design** — Stripe, Linear, Vercel, Apple, Figma, Notion, Resend, Clerk
- **Premium physical craft** — Dinesen, Farrow & Ball, Ferrari, Bang & Olufsen, Molteni&C, Salvatori, Buster + Punch, Vola, Aman, Belmond, The Ned, Ett Hem
- **Architecture & editorial studios** — Norm, Snøhetta, David Chipperfield, BIG, Vincent Van Duysen, Ström, Zaha Hadid, Studio KO, John Pawson, Heatherwick, **Fenton Whelan**, Thurstan
- **Award winners & agencies** — Awwwards SOTY/SOTM 2025–26, CSS Design Awards WOTY 2025, Lusion, Locomotive, BASIC/DEPT, Hello Monday, Active Theory, Immersive Garden, Unseen, Terminal Industries

**Method note.** Nearly every number below was mined from the reference sites'
shipped production CSS and JS, not from screenshots or "design system extractor"
sites. Where those two disagreed, production CSS wins. Two things this corrected:
**stripe.com was fully redesigned in April 2026**, so commonly-cited Stripe token
sets describe the old site; and Stripe's container is **1264px**, not the ~1080px
widely repeated.

**Scope.** Pure **design** lens — typography, spacing, colour, motion, art
direction, micro-interaction, page craft. It deliberately does not repeat the
industry/positioning findings in `Docs/Website-Competitive-Research.md`.

**Brand is locked.** Navy `#2B5C9E`, green `#4E9E2E`, charcoal `#23272C`, Poppins
display + Plus Jakarta body. Nothing below is a rebrand. Every item is elevation
inside those constraints.

**The binding constraint, and the good news.** `public/images/` holds ~8 usable
photographs, several of which are AI concepts (`*-concept-*.jpg`), and
`/case-studies` still ships *"Photos de projets réels à venir; images temporaires
pour l'instant."* to every visitor. That constraint turns out to be the *normal*
condition for the most expensive sites in this study. **Fenton Whelan** — a
super-prime London property developer, the closest structural analogue to this
business anywhere in the research — carries its entire homepage on numbers,
tracked-out labels, hairline rules and a numbered values list. §2 is a dedicated
playbook for exactly this.

---

## 0. What our design language measurably is today

Measured on the live site (`renovisionana.ca`), 1100 px and 401 px viewports:

| Dimension | Current state |
|---|---|
| Display type | H1 `68px / 75.6px` (LH 1.11), **`letter-spacing: normal`** |
| Section heads | **Every H2 on the homepage is `36px / 40px / 700`, brand blue** — seven sections, one size |
| Body sizes in use | 18, 16, 15, 14, 13, 12, 11 px — no scale, no ratio |
| Section padding | `py-20` (80 px) on 5 of 7 sections, **identical on mobile and desktop** |
| Container widths | Three on one page: `max-w-7xl` (1280), `max-w-5xl` (1024), `max-w-3xl` (768) |
| Band colours | White + `brand-blue-light` at 0.25 / 0.30 / 0.40 / 0.60 alpha — four near-identical pale blues |
| Page ground | Pure `#FFFFFF` |
| Alignment | 7 of 10 home components use `text-center` |
| Motion | 19 explicit `duration-*` classes in the whole app; everything else is Tailwind's stock `150ms cubic-bezier(0.4,0,0.2,1)`. **Zero custom `cubic-bezier` anywhere in `src/`** |
| Entrance motion | `Reveal` (20 px travel, 700 ms) is used on `/about`, `/commercial`, `/estimation`, admin login — **never on the homepage** |
| Card hover | `hover:-translate-y-1 hover:shadow-xl` on `FeatureCard` and `AudienceSections` |
| Hero imagery | Four corrective layers (blue `mix-blend-color`, green `soft-light`, a `/92` scrim, a bottom fade) stacked over one stock photo |
| Radii | 16 px cards, `rounded-full` pills, 24 px chat panel |
| `design-system/…/MASTER.md` | Says body font = Inter (code ships Plus Jakarta), buttons 8 px (code ships pills), cards 12 px (code ships 16 px). Drifted; no type scale, no motion tokens |

That table *is* the diagnosis. The site is competently built and completely
un-tuned: one heading size, one padding value, one easing curve, four
indistinguishable background tints. Nothing below asks for new colours or new
fonts — it asks for **ratios**.

---

## 1. The patterns worth stealing

### P1 — Pick one tracking school and hold it
The most consistent expensive-signal in the study — but there are **three coherent
schools, and mixing them is what reads as amateur.**

| School | Display tracking | Label tracking | Who |
|---|---|---|---|
| **A. Classical inversion** | −0.012 → −0.06em | **+0.10 → +0.25em** | Vercel, Stripe, Linear, Chipperfield, Ström, Zaha, Farrow & Ball, B&O, Salvatori |
| **B. Wide-tracked light caps** (no large type at all) | **+0.35 → +0.62em** | +0.35em | **Norm, Fenton Whelan, Thurstan** |
| **C. Zero tracking** | 0 | 0 → 0.025em | Snøhetta, Dinesen, BIG, Ett Hem |

School A, with real numbers:

| | 72px | 56px | 48px | 32px | 24px | ≤16px |
|---|---|---|---|---|---|---|
| **Vercel** (cleanest curve) | — | −0.06em | −0.06em | −0.04em | −0.04em | **0** |
| Stripe *(post-redesign)* | — | −0.025em | −0.02em | −0.02em | −0.01em (26px) | **0** |
| Linear | −0.022em | −0.022em | −0.022em | −0.022em | −0.012em | 0 @12px |
| Clerk | — | — | −0.025em | −0.015em (36px) | — | 0 |

School B is remarkable: **Norm's H1 is 30px Caslon caps at +15px (+0.50em)** and its
section H2 is 13px at +8px (**+0.615em**). There is no large type anywhere on the
site — monumentality comes entirely from tracking. Fenton Whelan's nav links are
28px caps at **+0.40em**; its section labels 14px at **+0.35em**.

**Fit: School A, decisively — but steal School B's label values.** We want a real
display H1, so classical inversion is our rule. But note what School B proves: a
site can feel monumental with **no large type and no photography**, which is
precisely our situation. §2 exploits that.

Also note **Aman** — the most expensive brand studied — tracks its 72px display at
**0.014em** (essentially nothing) and its 10px eyebrow at **0.198em**. Restraint at
the top, generosity at the bottom.

### P2 — Tracking keyed to size **and weight**
**Who:** Notion (the best single idea found) — heavier weights need *less* negative
tracking at the same size:
`--font-letter-spacing-sans-1000-regular: −4.00px` vs `-1000-bold: −2.50px`.
**Molteni&C** solves the serif/sans version: at every matched size the **sans gets
+1% and the serif −1%**, pulling the serif's wide sidebearings in and opening the
sans's tight ones out so the two read at matched colour.
**Fit: yes.** Our H1 mixes weight 500 and weight 800 *in the same sentence* at the
same 68 px. Those runs need different tracking or the bold half looks cramped — which
is exactly how it reads on screen.

### P3 — Arithmetic leading
**Who:** Apple — display `line-height = font-size + 4px`; reading contexts
`= font-size + 8px`. Apple's odd published ratios (1.08349, 1.14286) are just
`(size+4)/size`. **Dinesen** does the absolute-unit version: line-heights set in
rem (`1.625rem`), locking a fixed **26 px rhythm** regardless of size.
Convergence across the whole study: **display 1.0–1.25** (Aman 1.111, Belmond 1.1,
BIG 1.14, Chipperfield 1.14, Dinesen 1.15, Salvatori 1.18, Snøhetta 1.0), **body
1.4–1.8** (Fenton Whelan 1.407, Chipperfield 1.37, Snøhetta 1.45, Ström 1.48, Norm
1.556, Dinesen 1.63, The Ned 180% set globally on `html`).
**Fit: yes.** One rule that holds at every step, trivially expressible as tokens.

### P4 — One modular scale for type **and** space
**Who:** David Chipperfield — the cleanest system found. A single **1.25
(major-third)** scale governs both. Type: `.8 / 1 / 1.25 / 1.563 / 1.953 / 2.4rem`.
Space: `--size-300 .8 · 400 1 · 500 1.25 · 600 1.563 · 700 1.953 · 800 2.4 · 900 3.9
· 1000 5.6 · 1100 8 · 1200 12 · 1300 18rem` — **sizes 300–800 are literally the same
numbers as the font sizes.** Semantic aliases on top: `--module-sm/md/lg` 31→90px,
`--section-sm/md/lg` **90 → 288px**.
**Fit: yes.** It removes every "what padding goes here" decision permanently.

### P5 — Three weights, strict roles
**Who:** Vercel (400 read / 500 interact / **600 max — no 700 anywhere**), Linear
(400 / 510 / 590), Apple (**only 400 and 600**), and at the extreme **one family,
one weight, whole site**: BIG (Everett, one woff2), Snøhetta (Dovre Social 300),
Dinesen (Atlas Grotesk 300), John Pawson (Univers Next Pro Light), Ström, Salvatori.
**Fit: yes.** We load Poppins 500/600/700/800 *plus italic* plus Jakarta 400/500/600
— seven weights used ad hoc. Collapse to three; delete the italic 800.

### P6 — Authority through lightness
**Who:** Stripe sets 56 px display at **weight 300**. Dinesen, Snøhetta, Norm,
Pawson, Studio KO all run their entire sites at 300. Nobody in the craft cluster
bolds anything.
**Fit: yes, and it is our loudest current mistake.** Our hero is 68 px **ExtraBold
Italic green** — the loudest possible setting, and the single biggest gap between
our page and every reference in this study. Poppins ships 100–900; we currently
load only 500–800.

### P7 — Nobody uses `#FFFFFF` as a ground or `#000` as ink
**Warm grounds:** `#f9f4ed` Fenton Whelan · `#F5F1E5` Norm · `#f3eee7` Aman ·
`#f7f7f5` Dinesen · `#faf8f4` Farrow & Ball · `#fcfaee` B&O · `#e9e7e3` Thurstan ·
`#fffffa` Van Duysen.
**Warm inks:** `#391812` Van Duysen · `#4c3e34` Fenton Whelan · `#383839` Norm ·
`#191817` B&O · `#191919` Dinesen · `#313131` Aman · `#45484b` F&B · `#4a4a4a` The
Ned. Product benchmarks agree: Vercel `#171717`, Linear `#08090a`, Clerk `#131316`,
Notion `#191918` on a **warm** neutral ramp.
**Hairlines are never `#ddd`:** `#dad9d7` Aman · `#d0cdc8` Dinesen · `#dbd9d9`
Belmond · `#dfdfdf` Snøhetta · `rgba(0,0,0,0.1)` Norm.
**Fit: yes.** Our charcoal `#23272C` is already correct. Our *white* is not: pure
`#FFFFFF` against a blue-heavy palette reads cold and clinical. One warm off-white
is the cheapest premium signal available to us. Warm neutrals read *craft*; cool
greys read *hardware*.

### P8 — Alpha ramps beat gray ramps
**Who:** Notion (`--color-alpha-black-100…900`), Figma (every border is
`color-mix(in oklch, #000, transparent 84%)`), Linear (`#ffffff0d` = 5 %), Vercel
(`gray-alpha` as a first-class scale). **The Ned** sets its entire label tier as the
body colour at 60 % alpha rather than as a lighter grey — so it composites correctly
on any ground.
**Fit: yes.** We mix `ring-black/5` and `text-charcoal/70` with opaque tints.
Formalise it.

### P9 — One accent, reserved for **state**
**Who:** Dinesen's amber `#ffaf4b` appears *only* as link hover border, active tab
underline, active pager dots and button hover — **never as a fill, never as a brand
block.** Snøhetta's neon `#42FF00` appears only as an SVG `fill`. Vola `#ff6f03`.
Aman has *no* single accent at all — per-property themed pairs instead. Vercel has
no accent: `#171717` carries every CTA.
**Fit: this is a real diagnosis for us.** Brand green is currently a large filled
field — two big pills, four stat icons, a marquee tag, hero accent type. Demoting
green to *state* (hover, active, focus, the count-up number) and letting navy and
charcoal carry structure would instantly raise the register.

### P10 — Shadow-as-border, and the hairline ring
**Who:** Vercel — `box-shadow: 0 0 0 1px rgba(0,0,0,0.08)` replaces `border`
throughout, stacking `ring + 0 2px 2px #0000000a + 0 16px 24px -8px #0000000f`.
**Clerk** goes finer with **`0 0 0 0.5px`** rings plus an
`inset 0 1px 0 0 rgba(255,255,255,0.07)` top bevel — 0.5 px renders as a true
hairline on 2× displays where 1 px looks heavy.
**Why:** zero-blur rings sit outside the box model, so nothing shifts when a border
appears, and they clip correctly to the radius.
**Fit: yes.** We use `ring-1 ring-black/5` then add generic `shadow-sm`/`shadow-lg`.

### P11 — Tinted, multi-layer shadow
**Who:** Stripe — `0 16px 32px rgba(50,50,93,.12)`. The shadow is **blue**, so it
belongs to the palette rather than sitting on top of it.
**Fit: yes — we already half-do it.** `ScrollBeforeAfter` uses
`0 30px 60px -20px rgba(43,92,158,0.35)`. Good, and it exists in exactly one file.

### P12 — Nobody lifts cards or buttons on hover
**Who:** all eight product benchmarks *and* the entire craft cluster. Apple's button
hover is a background swap — no transform, no shadow. Vercel's nav button changes
colour only. Stripe's hovers are almost entirely **border-colour**. Chipperfield
presses at `scale(.98)` — *shrink*. Aman's only transforms shrink (`scale(0.8)` logo).
Image hover zoom, the real numbers: **`1.006`** (Ström) · `1.03` (Belmond) · `1.05`
(Snøhetta, over 800 ms) · `1.1` (The Ned) · **none at all** (Aman, Norm).
**Norm's card hover, worth copying verbatim:** a `rgba(245,241,229,.2)` veil (the
ground colour at 20 %) fades in while a caption word rises **10 px** and fades in at
18 px caps / +5 px tracking. **No scale.**
**Fit: yes, and we are the counter-example.** `FeatureCard` and `AudienceSections`
both do `hover:-translate-y-1 hover:shadow-xl` on `transition-all 150ms`.

### P13 — Reveal distances are far smaller than instinct suggests
**Who:** Linear **4 px** (`staggerIn .4s ease-out-quart backwards`). Resend runs a
two-tier system: **16 px** for page-load hero, **4 px** for menus. Chipperfield
**16 px** (`1rem`). Dinesen's hero settles over **25 px**. BIG **20 px**. Nobody in
the study uses 40 px.
**Chipperfield's reveal keyframe is the complete spec, and note the `0% / 1%` trick**
— it pins the element invisible until the animation actually starts, avoiding flash:
```css
@keyframes reveal{
  0%{opacity:0}
  1%{transform:translate3d(0, var(--animate-trans-y,1rem), 0); opacity:0}
  to{transform:translateZ(0); opacity:1}}
.reveal{animation:reveal .5s cubic-bezier(0,.23,.07,1) 1 backwards}   /* hero: 1s */
```
**Fit: yes.** Our `Reveal` uses 20 px over 700 ms — double the distance and double
the duration of Linear's.

### P14 — The two-tier motion budget, and duration by site *type*
UI transitions land at **100–250 ms** (Linear 0.16 s, Figma **0.18 s ×68**, Vercel a
hard ≤300 ms cap, Apple 0.32 s ×62); ambient loops run **3–180 s**. **Almost nothing
lives in between.** By-Kin splits harder: 45–75 ms hover feedback vs 0.6–1.2 s
composition.
**But duration is also a genre signal.** Ateliers run slow: Van Duysen **800 /
1200 / 1500 ms**, Dinesen 1.5 s hero, Norm 1 s menu, Terminal Industries 1.2 s.
Commerce runs fast: Vola `--speed: 0.12s`, Buster + Punch 0.2 s, BIG 0.15 s.
**Fit: yes — and we should sit closer to the commerce end.** A water-damage visitor
is in a hurry. Our current 150/300/500/700 ms cluster sits in exactly the dead zone
the benchmarks avoid.

### P15 — A named house easing curve
Two of the most expensive sites in the study arrived at effectively the same curve
independently: **Vincent Van Duysen `cubic-bezier(0.51, 0.01, 0, 1)`** (36 uses) and
**Chipperfield `cubic-bezier(0.55, 0.08, 0, 1)`**. Call it ≈ **`cubic-bezier(0.52,
0.05, 0, 1)`** — a long, flat deceleration tail. Other production curves worth
knowing: `cubic-bezier(0.165,0.84,0.44,1)` (B&O, **75 uses, whole site**; also
Snøhetta's easeOutQuart), `cubic-bezier(0.23,1,0.32,1)` (**Aman's only curve**),
`cubic-bezier(0.175,0.885,0.32,1.1)` (Vercel *and* Clerk — the `1.1` end control
point is a 10 % overshoot that reads as snap, not bounce).
Studios formalise this: BASIC ships `--ease-garret`, Unseen registers `joe.out`,
Terminal registers `custom.fastInOut`, Linear ships the **entire Penner library** as
19 tokens, Chipperfield ships four named curves plus `--trans-time-sm/md/lg/xl`.
**Fit: yes.** A named curve is the clearest marker separating motion identity from
motion decoration. We have zero.

### P16 — Split timing per property
**Who:** Snøhetta — `transition-duration: .6s, .8s` with `easeOutSine, easeOutQuart`
on opacity/transform. Aman — colour/border at `.4s` but `box-shadow` at `.1s`, so the
focus ring snaps while the fill drifts. The Ned — `transform .3s ease .1s, opacity
.3s ease`, a 100 ms stagger *inside one button*.
**Fit: yes.** The single clearest "someone tuned this" tell, and it costs one comma.

### P17 — Chiaroscuro band rhythm, and three surfaces maximum
**Who:** Ferrari alternates "black cinematic sections and white editorial panels."
Figma is the extreme: body all white, **footer `#000000`** — one hard flip, no third
surface. Apple alternates `#000` and `#1d1d1f`. Norm's *entire* sectioning device is
`#E1DBD0` on `#F5F1E5`. Aman ships a five-step sand ladder
(`#f3eee7 #ebe8e5 #e6e2db #dad9d7 #d5d1c8`). Dinesen alternates `#fff ⇄ #f7f7f5`
with a `#191919` footer band.
**Fit: strongly yes — our biggest structural miss.** Four pale-blue tints at
0.25/0.30/0.40/0.60 alpha are visually indistinguishable; on a phone the boundary
between "Conçu pour chaque client" and "Nos services" is invisible.

### P18 — Generous, consistent section padding
Desktop section padding, sorted: Buster + Punch 32–48 px · Belmond 80–100 px ·
Van Duysen 120 px · Chipperfield `--section-md/lg` **128–288 px** · Ström **144 /
256 px** · Aman 154 px · **Dinesen 160 + 160 px, 192 px between image modules** ·
Norm up to 247 px · Snøhetta `pt-256`. Product benchmarks: Apple **144 px** (216 px
before a major transition), Linear **128 px** with a **224 px** pre-footer gap,
Resend 96 px uniformly.
**160–256 px between major sections is the band.** Dinesen's ladder —
**16 / 40 / 50 / 80 / 160 / 192 px** — is the cleanest to ship as-is.
**Fit: yes.** Ours is 80 px flat, identical on a 390 px phone.

### P19 — Nobody centres the text column
Snøhetta sets prose at `col-start-5 / col-span-8` of 12 — measured 884 px starting
502 px into a 1426 px wrapper. Norm's prose starts 27 % in at 46 % width. **BIG hangs
the caption `left:-44px; text-align:right` — outside the image, right-ragged against
it.** Dinesen never uses a plain 6/6 (`medium-5 offset-2`, `medium-8 offset-1`, and a
custom 2.5/12 column). Aman uses `1fr 2fr` / `2fr 1fr` with a 64 px gap. Fenton
Whelan uses `405px 1fr 390px` — fixed text rails flanking a flexible middle.
**Measure caps in `ch`, not px** (Snøhetta: 35 / 50 / 55 / 60ch).
**Fit: yes.** Seven of ten of our home components are `text-center`.

### P20 — Captions are not shrunk
**Who:** Snøhetta sets figcaptions at **full body size (22 px)** — deliberately.
Chipperfield captions plans directly beneath them ("Ground floor plan, new elements
marked in red"). Farrow & Ball's label tier is 16 px.
**Fit: yes.** Our smallest text is 11 px at 40 % charcoal ("SOUVENT") — measured on a
phone, effectively illegible.

### P21 — Hairline rules at three calibrated widths
**Who:** Dinesen's `:before` device — a **40 px** 1 px `#d0cdc8` rule above spec
notes, **100 px × 2 px** above hero credits, **160 px** above case metadata, each
with ~80 px clear above. Fenton Whelan uses **1 px vertical** rules
(`grid-template-columns: 1px 1fr`) to structure a services list, and between stat
columns a 1 px vertical rule that is a **gradient fading out at both ends**:
```css
.stats__divider{width:1px;align-self:stretch;margin:0 2rem;
  background:linear-gradient(180deg, hsla(30,15%,69%,.4) 5%,
             rgba(123,109,95,.4) 55%, hsla(30,15%,69%,.4))}
```
Snøhetta rules every list row (`border-bottom:1px; padding: 9px 0 7px 24px` —
asymmetric on purpose).
**Fit: yes.** Cheap, photo-free, and genuinely sophisticated.

### P22 — The eyebrow / label recipe
Three near-identical independent implementations:
```css
/* The Ned, 62 uses */  uppercase; 11.2px; .15em;  weight 400; rgba(74,74,74,.6)
/* Aman */              uppercase; 10.1px; .198em; #313131
/* Farrow & Ball */     uppercase; 16px;   .25em;  weight 300
```
Plus **Vercel and Figma set the eyebrow in a monospace** (Geist Mono 11–12 px at
+0.071em; figmaMono 12 px at +0.042em), and Terminal Industries runs `01 FAST START`
in mono caps.
**Fit: yes.** Ours are four different, inconsistent voices —
`11px/0.18em/bold/40% charcoal`, `12px/0.22em/semibold/green`,
`10px/0.35em/bold/white55`, `14px/0.35px/bold`.

### P23 — One image ratio, enforced at the asset
**Who:** **Norm crops every image on the entire site to 1091×1500 (0.727 ≈ 8:11
portrait).** One ratio, whole site. BIG uses `3200/1800` with the width bound to
`64vh` so a row always fits the screen. **Salvatori — a stone brand — crops near-
square and gently portrait (1:1, 9:8, 7:6, 9:7), never cinematic**, because a wide
crop begs for a big room shot.
**Fit: yes, and it directly disciplines our photo problem.** A wide crop advertises
the room we can't show; a portrait or square crop advertises the detail we can.

### P24 — Never put text over a photograph
**Who:** **Aman uses zero rgba scrims anywhere in 231 KB.** Photography is left
ungraded and text sits *beside* it on the off-white ground. Belmond, when it must,
uses **per-property tinted** gradients (navy `rgb(20,25,47)`, brown `rgb(59,38,25)`
— never black), an 83 px header tint at only `rgba(0,0,0,.15)`, and
`rgba(255,255,255,0) → #faf9f7 80%` to *dissolve* a hero into the page ground.
**Fit: yes — this indicts our hero directly.** We stack four corrective layers
(`mix-blend-color` blue, `soft-light` green, a `from-charcoal-dark/92` scrim, a
bottom fade) over one stock photo. The result on mobile is that the photo is
invisible; on desktop it survives only in the right third. We are paying a
full-bleed image's weight for a texture.

### P25 — Attribute-toggled, hysteretic sticky header
**Who:** **Linear** — JS sets `data-scrolled` on `<html>`; CSS does everything else,
plus `backdrop-filter: blur(20px)` and a `::before` gradient so content dissolves
rather than clips at the nav edge. **Aman** adds hysteresis at **100 px / 50 px** so
the header can't flicker, hides on scroll-down and *returns on scroll-up* at `.3s`,
arms the peek only past 800 px, and **tints `#f3eee7 → #e6e2db` rather than going
transparent→solid**. **Snøhetta** replaces the entire light/dark state machine with
one rule: `mix-blend-mode: exclusion`. **Notion** removes the JS entirely — a 1 px
scroll sentinel drives the nav off a native scroll timeline:
```css
.scrollSentinel{block-size:1px; margin-block-end:-1px; view-timeline:--nav-stuck 0px}
.globalNavigation{animation:navShadowScrolled linear both;
  animation-duration:auto; animation-timeline:--nav-stuck; animation-range:exit 100%}
```
**Fit: yes.** Our `Header.tsx` runs a rAF-throttled listener driving two React state
booleans, re-rendering on every threshold cross — and then hides the bar permanently
after 8 px of scroll, leaving ~8 400 px of page with no navigation at all.

### P26 — Gate every hover behind `@media (any-hover: hover)`
**Who:** Linear (all hovers), Vercel (link underlines).
**Fit: yes.** A tap on our service cards currently leaves them translated up 4 px
until you tap elsewhere.

### P27 — Underlines, done properly
Four production techniques: Ström `transform: scaleX(0)→scaleX(1)` with
`transform-origin: bottom left` in / `bottom right` out · The Ned animates `width`
(16 rules) so underlines grow from a point · **Chipperfield uses real
`text-decoration` with `text-underline-offset: .35ex`** and a custom thickness ·
Snøhetta's `border-bottom` **weight scales with type size** (1 px body, 2 px in
large text). Linear: `text-decoration-thickness: 1px` with
`--underline-offset: clamp(2px, 0.225em, 6px)`.
**Fit: yes.** Ours are default browser underlines or none.

### P28 — Numbered index systems
**Who:** Chipperfield — projects numbered 1–20, grid/list toggle, metadata reduced
to name + open-ended year range ("2022–"). **Norm** — a contact-sheet index on a
`#E1DBD0` band: `repeat(auto-fill, minmax(8%,1fr))`, landscape shots `span 2`,
portraits `span 1`, literal "01".."12" at 10 px/600 underneath. **Fenton Whelan** —
`01–04` at `opacity:.3`, 22 px, above each tracked-out value title. **Snøhetta** — a
floating chapter TOC with an **18 px tabular-numeral gutter**, 1 px dividers, and a
1 px scroll-progress bar at 70 % opacity. Terminal Industries — `01 FAST START`.
**Fit: yes, and it solves the photo problem.** An index reads as a body of work.

### P29 — Specification tables as content
**Who:** Chipperfield's **"Data and credits"** table, ~16 labelled fields
(Competition / Project start / Construction start / Completion / Gross floor area /
Client / Architect / Project team / Executive architect / Structural engineer /
Services engineer / Building physics / Selected Awards). Snøhetta's
`sp:grid-cols-2 lp:grid-cols-4` technical grid. BIG's `grid-cols-[100px_auto]`
key/value footer lists. Heatherwick treats each project as an exhibition catalogue —
"process work, sketches, models and photography, to show the thinking, not just the
outcome."
**Fit: yes.** Spec data is visually rich and needs no photograph. For us: Scope /
Duration in days / Claim type / Trades / Moisture readings logged / Materials /
Borough / Insurer.

### P30 — One signature artifact, built from real domain knowledge
**Who:** Awwwards Site of the Year 2025 — the **Lando Norris** site by OFF+BRAND,
whose most-remembered element is not the WebGL hero but the *Helmets Hall of Fame*.
**Terminal Industries** applies award-grade craft to a **Yard Efficiency
Calculator** — a conversion widget. **Farrow & Ball's** entire product system is a
signature artifact (see §2.4).
**Fit: yes — we already own the raw material.** Our AI estimator is genuinely rare
in this market; it is currently a green pill in the corner.

### P31 — The restrained path wins awards too
**Dropbox Brand** (Daybreak Studio) took **CSS Design Awards Website of the Year
2025** *and* Best UX. Built in Webflow with **no Lenis, no GSAP, no Three.js**. Its
entire motion system is one easing token (`cubic-bezier(.4,0,.2,1)`, four uses) and
three durations. It won on typography, system rigour and IA. Its hero type is worth
memorising: `clamp(0px, 6.25vw - 15px, 120px)` — the **negative offset** makes type
start scaling *later* on small screens instead of collapsing to nothing.
Corroborated across the craft cluster: **only 2 of 12 top craft sites use a
smooth-scroll library at all**; Aman, Snøhetta, BIG, Dinesen, F&B, The Ned,
Chipperfield and Norm all use native scrolling. And **Aman — the most expensive
brand in the study — ships exactly one `cubic-bezier` in 231 KB, no parallax, no
image hover zoom, and 30 `prefers-reduced-motion: no-preference` blocks**, i.e.
motion is opt-in.
**Fit: this is our entire strategy.** The counter-path has a published price: Lando
Norris scored **7.0 on accessibility** while winning Site of the Year, and WebGL
costs 800 KB–2 MB of runtime JS.

---

## 2. The photo-poor playbook

Our binding constraint, solved by the sites that do it best. Ranked by leverage.
**Fenton Whelan** (fentonwhelan.com) is the reference build throughout — a
super-prime property developer whose homepage is carried entirely by numbers, tracked
labels and hairline rules.

### 2.1 Vertical space is the cheapest luxury signal
160–256 px between sections costs nothing, needs no assets, and is the single
biggest separator from a templated site (P18). Ship Dinesen's ladder
**16 / 40 / 50 / 80 / 160 / 192 px**, or Chipperfield's unified 1.25 scale (P4).

### 2.2 Big numbers as a section — the complete Fenton Whelan spec
```css
.stats__inner  {display:flex; align-items:stretch}
.stats__col    {display:flex; flex:1; flex-direction:column; gap:30px}
.stats__number {font-size:80px; font-weight:600; letter-spacing:-1px; line-height:1}
               /* 80 → 70 → 60 → 50px responsive */
.stats__number-row   {display:inline-flex; align-items:baseline; flex-wrap:wrap;
                      gap:.12em; line-height:1}
.stats__number-symbol{font-size:33.743px; font-weight:600}   /* 80 : 33.743 = 2.37:1 */
.stats__label  {font-size:14px; letter-spacing:4.9px /* .35em */;
                line-height:1.727; max-width:300px; text-transform:uppercase}
.stats__divider{width:1px; align-self:stretch; margin:0 2rem;
  background:linear-gradient(180deg, hsla(30,15%,69%,.4) 5%,
             rgba(123,109,95,.4) 55%, hsla(30,15%,69%,.4))}
```
Note the inversion **inside one component**: the number is tracked **−1 px** while
the label beside it is tracked **+4.9 px**. Live content on their site: *"£2.5BN+
Assets Originated and Completed"* · *"50+ Projects Completed since 2005"* · *"35+
Years of Combined Founders' Experience"*. **The Ned** goes further and ships a
dedicated numeral webfont, base64-inlined, purely for figures.
**Ours:** years, projects completed, average hours to first visit, % of jobs within
estimate, m² delivered, trades managed. All numerals, `tabular-nums`, counting up on
first intersection.

### 2.3 The numbered-values module
```css
.philosophy__content    {display:grid; grid-template-columns:405px 1fr 390px; gap:0 40px}
.philosophy__value-num  {font-size:22px; opacity:.3}          /* 01 02 03 04 */
.philosophy__value-title{font-size:22px; font-weight:600; letter-spacing:7.7px /* .35em */;
                         text-transform:uppercase; color:rgba(76,62,52,.7)}
.philosophy__value-body {display:grid; grid-template-rows:0fr; opacity:0;
  transition:grid-template-rows .4s ease, opacity .3s ease, margin .4s ease}
.philosophy__value-body.open{grid-template-rows:1fr; margin-top:12px; opacity:1}
```
`grid-template-rows: 0fr → 1fr` is the modern height-auto accordion — no JS
measurement. Fenton Whelan's four values are *London Quality / Integrity /
Transparency / Craftsmanship*. Ours writes itself.

### 2.4 The swatch is a **photograph**, not a hex fill
Farrow & Ball's product tile is `{colour}_no._{code}_-_swirl_1.jpg` at **327×327,
1:1** — a brushed swirl of real paint, so the chalky finish and brush movement
survive. For us: **1:1 macro crops of oak, brass, terrazzo, limewash, grout, tile
glaze, plaster, stone.** Twenty square material macros are cheap to shoot, need no
finished room, and are far more distinctive than stock interiors. Corroborated by
Salvatori (P23): material brands crop near-square, never cinematic.

**Their colour-scheme card composes a room's palette abstractly, in real proportion:**
```css
.schema-colour-card-top{height:208px}
.base  {flex:1 1 66%}   .accent{flex:1 1 34%}   .trim{height:70px}
```
with two 50 % metadata columns beneath, each carrying a 24 px chip, a role label
("accent Colour"), the name and the number ("No.27"). Translate to
**wall / floor / joinery / metal**.

**Count-driven palette rows** for "materials used on this project": default 52 px
swatches / 20 px gap / 350 px cap; `.count-3` → 80 px / 40 px gap; `.count-4` and
`.count-6` → 68 px / 25 px.

**Colour-coded navigation:** 10×10 px dots, `border-radius:4px; border:1px solid
#939393`, one hex per family, `repeat(2,1fr)` with 40 px gap. Becomes oak / brass /
stone / plaster.

### 2.5 The CTA is a rule, not a box
```css
.btn-learn-more{border-bottom:1px solid currentColor; padding-bottom:10px;
  font-size:14px; font-weight:600; text-transform:uppercase; transition:opacity .3s}
.btn-learn-more:hover{opacity:.7}
```
Fenton Whelan's *entire* CTA language. Note how much less this shouts than two
filled green pills.

### 2.6 Two-tone same-size type
**Snøhetta** sets a grey `<h1>` running inline into a black intro sentence as
continuous text, and project titles as black name + grey subtitle at the same 96 px.
**Fenton Whelan** splits one sentence across `#948372` and `#b9ad9e`. Emphasis
without bold, without a second typeface, without an image.

### 2.7 Line drawings instead of imagery
**BIG's** logo draws itself via `stroke-dasharray` with staggered delays; every
project carries a 38–50 px solid black square containing a white line-drawing
pictogram; the hamburger is a **staircase of 12/8/6/4 px bars**, not three equal
lines. **Chipperfield interleaves plans with photographs**, captioned beneath.
For a renovator, floor plans, elevations and wall sections are drawings we can
produce — and they carry a page.

### 2.8 A tinted band as the only sectioning device
Norm: `#E1DBD0` on `#F5F1E5`. Aman: a five-step sand ladder. Dinesen: `#fff ⇄
#f7f7f5` with a `#191919` footer.

### 2.9 Two-column body text
BIG's entire `/about` hero is 100 px uppercase over `max-w-[965px] lg:columns-2
gap-[85px]` prose with an **authored `break-before-column`** forcing the split
point. One photo on the page.

### 2.10 Asymmetry makes a single photo look art-directed
Dinesen: `.image-2x__offset { width:45vw; position:absolute; left|right:0 }` — a
45 vw image overlapping a full-width one. BIG hangs the caption outside the image.
**If you only have four good photographs, off-centre placement does more for them
than a grid ever will.**

---

## 3. Prioritised upgrades for our site

### Tier A — polish passes, one day each

**A1 · A real type scale with optical tracking**
*Files:* `src/app/globals.css` (`@theme inline`), then a sweep of
`src/components/home/*`, `src/components/pages/*`.
*Change:* adopt **School A** (P1) with Apple's arithmetic leading (P3). Proposed,
tuned for Poppins:

| Token | Size (desktop / mobile) | Weight | Line-height | Tracking |
|---|---|---|---|---|
| `display` | 60 / 32 | **400** | size + 4px | **−0.03em** |
| `h1` | 44 / 30 | 500 | size + 4px | −0.025em |
| `h2` | 32 / 26 | 500 | size + 6px | −0.02em |
| `h3` | 22 / 20 | 600 | size + 8px | −0.01em |
| `body-lg` | 18 | 400 | size + 8px | **0** |
| `body` | 17 | 400 | size + 8px | **0** |
| `caption` | 15 | 400 | 1.5 | 0 |
| `label` | 12 | 500 | 1.4 | **+0.20em, uppercase** |

Weights collapse to three (P5) and drop: load Poppins **400 / 500 / 600**, delete
700, 800 and the italic. Set `--font-heading` to 400 at display size (P6). Minimum
type size 15 px, not 11 (P20). Add `text-wrap: balance` to every heading and
`text-pretty` to body — neither appears anywhere in `src/` and both are free.
Consider Dropbox's `clamp(0px, 6.25vw - 15px, 120px)` negative-offset pattern for
the hero (P31) instead of three breakpoint jumps.
*Why it reads premium:* four heading levels instead of one 36 px slab give the eye a
hierarchy; negative tracking at display size is the difference between "set" and
"typed"; and dropping from ExtraBold Italic to 400 moves us from the loudest
setting in the study to the register every reference site occupies.

**A2 · A spacing, band and ground system**
*Files:* `globals.css`, all `src/components/home/*`.
*Change:* (a) section padding `py-16 sm:py-24 lg:py-40` — 160 px desktop, per P18;
(b) **one** container width (`max-w-6xl` ≈ 1152 px) so the left edge never jumps;
(c) collapse the four pale-blue tints to **three surfaces** — a warm off-white
ground (~`#F7F4EE`), one tinted band (~`#EDE8E0`), and `#23272C` (P7, P17);
(d) derive every border from alpha (P8), hairlines at ~`#D8D1C8` not `#ddd`.
*Why it reads premium:* rhythm. Every section is currently the same distance apart
and roughly the same colour, so the page has no cadence — and pure white against a
blue palette reads clinical.

**A3 · Motion tokens, one house curve, split timing**
*Files:* `globals.css`, `Reveal.tsx`, `FeatureCard.tsx`, `AudienceSections.tsx`,
`Header.tsx`, `ChatWidget.tsx`, `testimonials-columns-1.tsx`.
*Change:* stop using bare `transition-all` — it animates layout properties at
Tailwind's stock 150 ms. Define and use:
```css
--ease-house:  cubic-bezier(.52,.05,0,1);      /* Van Duysen / Chipperfield */
--ease-out:    cubic-bezier(.165,.84,.44,1);   /* B&O / Snøhetta easeOutQuart */
--ease-snap:   cubic-bezier(.175,.885,.32,1.1);/* Vercel + Clerk, 10% overshoot */
--dur-sm: .18s;  --dur-md: .5s;  --dur-lg: .8s;
```
Name the properties transitioned, use split timing where two things move (P16), gate
hovers behind `@media (any-hover: hover)` (P26), and rewrite `Reveal` to
Chipperfield's keyframe — **16 px travel, 500 ms, `backwards` fill, with the
`0%/1%` anti-flash pair** (P13) — then actually use it on the homepage with an
80 ms stagger.
*Why it reads premium:* every reference site has a named curve. 150 ms
almost-linear is the default nobody chose.

**A4 · Hover states that don't lift**
*Files:* `FeatureCard.tsx`, `AudienceSections.tsx`, `PartnerLogos.tsx`,
`testimonials-columns-1.tsx`.
*Change:* replace `hover:-translate-y-1 hover:shadow-xl` with Norm's move (P12) — a
ground-colour veil at 20 % fades in, a caption rises 10 px, no scale — or simply a
border-colour warm on the P10 ring. Image hover zoom, if any, `scale(1.03)` max.
Add `active:scale-[0.99]` (Chipperfield presses *inward*).
*Why it reads premium:* a grid of cards that all jump and grow shadows is a named
marker of templated design; a card whose hairline warms is not.

**A5 · Count-up stats, rebuilt as four numerals**
*Files:* `src/components/home/StatsBar.tsx`, `src/i18n/translations.ts`.
*Change:* today the four cells are `5+`, `100+`, `5★` and `Laval et Montréal` — one
is a place name and one is a glyph, so the grid can't read as a stat row. Rebuild to
the §2.2 spec: 80 px numeral at weight 600 / `letter-spacing: -1px` / `line-height:
1`, a baseline-aligned symbol at ~34 px with `gap: .12em`, a 14 px label at
`+0.35em` capped at 300 px, and the **gradient 1 px divider** between columns.
Animate 0 → value over ~900 ms on first intersection, in `tabular-nums`.
*Why it reads premium:* it is the single most-copied device from the one reference
site that sells exactly what we sell — and it needs no photography.

**A6 · Footer craft**
*Files:* `src/components/layout/Footer.tsx`.
*Change:* the footer is 349 px of charcoal, 16 links, four equal 231 px columns, two
social circles — welded to an identical charcoal CTA band above it. Give it a real
top rule with 64 px either side, a **deliberately lopsided** grid (Norm's footer is
one 50 % column plus four at 8 %; BIG uses `grid-cols-[100px_auto]` key/value
lists), the `label` voice on column heads, an RBQ/licence line, service areas as
small type, hours, and the estimator link — **which appears in neither header nor
footer today**. Open the mobile accordions by default.
*Why it reads premium:* the footer is the last thing every visitor sees and the
first thing that betrays a template.

**A7 · Kill the duplicated eyebrow, unify the label voice**
*Files:* `src/i18n/translations.ts`, `HeroBanner.tsx`, and every eyebrow site-wide.
*Change:* the hero eyebrow reads *"Rénovations et restauration de dégâts d'eau"* and
the H1 immediately below reads *"Rénovation et restauration de dégâts d'eau"* — the
same six words twice at the top of the page. Replace with the locality/credential
line (`LAVAL & GRAND MONTRÉAL · RBQ 0000-0000-00`) in the single `label` token (P22).

**A8 · Button hierarchy, and demote green to state**
*Files:* `HeroBanner.tsx`, `CtaBand.tsx`, `EstimatorContent.tsx`, `Header.tsx`.
*Change:* the hero's primary CTA is **236 × 39 px at 13 px** while the floating chat
pill is **245 × 48 px at 14 px** — the ambient widget is larger than the page's
primary action, same green, same words. Set the hero CTA to ~52 px / 15 px. Then
apply P9: keep **one** filled green button per viewport and convert every secondary
CTA to the §2.5 rule-underline treatment.
*Why it reads premium:* green currently appears as a large filled field five ways on
one screen. Reserved accents read expensive; ubiquitous accents read like a coupon.

**A9 · Two live defects in the same pass** (details in §5)
The CtaBand call button overflows the viewport on a phone; the before/after labels
are inverted.

---

### Tier B — component-level redesigns

**B1 · Hero: type-led, text beside the photo — never over it**
*Files:* `src/components/home/HeroBanner.tsx`, `src/i18n/translations.ts`.
*What changes:* four corrective layers over a stock photo (P24). On mobile the photo
is invisible behind the text; on desktop it survives only in the right third.
*Proposal:* Aman's rule. Text sits on the warm ground; the photograph becomes a
single hard-edged **portrait crop at 0.727 or 3:4 in the right column** (P23), full
contrast, **no scrim, no blend layers**, because nothing sits on top of it. Headline
at the A1 `display` token — 60 px, weight 400, −0.03em — with one thin brand rule and
the credential label above. If we later get real photography, that slot is where it
goes.
*Why it reads premium:* it is what the most expensive brand in the study does, and
it removes the LCP cost of a full-bleed hero image.

**B2 · Testimonials: stop the treadmill**
*Files:* `src/components/home/Testimonials.tsx`, `src/components/ui/testimonials-columns-1.tsx`.
*What changes:* three columns marquee forever at `ease: "linear"` with no hover
pause, inside a `max-h-[640px]` mask that fades the top and bottom cards to near-zero
opacity. On a phone the first visible card is a ghost over an empty white card — it
reads as a rendering failure. You cannot finish reading a quote before it leaves.
*Proposal:* a static **editorial quote block** — one long quote at 32/40 in the
display face (Aman's pull-quote spec, `max-width: 780px`), attribution in the `label`
voice, rating as a single line of type, and a "read all N reviews" link. Optionally
Aman's `margin-bottom: -60px` so the quote overlaps the block beneath. Crossfade
every ~8 s with pause-on-hover, or drop motion entirely.
*Why it reads premium:* P31/P12. Moving testimonials say "carousel plugin"; one
large quote says "we chose this one".

**B3 · Services: numbered index instead of eight boxes**
*Files:* `src/components/home/ServicesSection.tsx`, `src/components/ui/FeatureCard.tsx`.
*What changes:* at 1100 px the eight cards render as 2 × 499 × 241 px boxes — very
wide, very short, a 48 px icon chip and three words each; 2 637 px of stacked cards
on mobile.
*Proposal:* P28 + §2.3. A numbered list — `01`…`08` at `opacity:.3`, service name
tracked out in the label voice, one line of description, a **hairline rule between
rows** (P21), icon at 20 px as a right-aligned marker, and the description in a
`grid-template-rows: 0fr → 1fr` disclosure. Snøhetta's `.fade-list` is the hover:
hovering anywhere drops **every** row to the hairline colour and restores only the one
under the cursor — pure CSS, no lift.
*Why it reads premium:* an index reads as a body of work; a grid of equal boxes reads
as a menu. And it needs no photography.

**B4 · Chat widget entry treatment**
*Files:* `src/components/chat/ChatWidget.tsx`.
*What changes:* the launcher is a 245 px green pill — **55 % of a 401 px phone
viewport** — occluding the first service card and the CTA band, in the identical
colour and words as the hero's primary button. The panel has *no* enter transition:
bare `{isOpen && …}`, it pops.
*Proposal:* (a) collapse the launcher to a **56 px circle** carrying the
`vision-ai-mark`, charcoal with a green status dot, expanding to the labelled pill on
hover (desktop) or after 6 s idle on first visit only; (b) animate the panel —
`scale(0.96) → 1` + opacity over **260 ms on `--ease-snap`**, `transform-origin:
bottom right` so it grows out of the launcher (Vercel ships exactly this as
`--ds-motion-overlay-scale: .96 / duration .3s`); (c) on mobile, slide up over
320 ms rather than appear.
*Why it reads premium:* the launcher stops competing with the page's own CTA, and a
panel that grows from its trigger is the most legible micro-interaction in the whole
pattern language.

**B5 · `/estimation` — our best page, currently returning 404**
*Files:* `src/app/estimation/page.tsx`, `src/components/pages/EstimatorContent.tsx`,
`Header.tsx`, `Footer.tsx`.
*What changes:* `https://renovisionana.ca/estimation` returns **HTTP 404** on
production and is linked from neither header nor footer. It is also our most
template-like page: centred heading, three numbered cards, a two-column split, three
FAQ boxes, a charcoal CTA.
*Proposal:* deploy it, link it, and rebuild around the artifact (P30): a **live
specimen** at the top — a real itemised estimate rendered as a document (line items,
`tabular-nums`, a travel-fee row from a postal code, a total range) visible *before*
the visitor engages. Then the honest "is this the final price?" panel. Then the FAQ
as a hairline-ruled definition list (P21, P29), not three shadowed boxes. Terminal
Industries' Yard Efficiency Calculator is the precedent: award-grade craft on a
conversion widget.
*Why it reads premium:* showing the output is a stronger claim than describing it,
and a document in tabular figures is the most credible object a pricing page can hold.

**B6 · The before/after as a full-bleed moment**
*Files:* `src/components/home/ScrollBeforeAfter.tsx`.
*What changes:* our single strongest asset sits in a `max-w-3xl` centred container
with two decorative pastel blobs behind it.
*Proposal:* Dinesen's `.big-image` treatment — `max-width: 1920px; margin: 0 auto
12rem` with the inner figure at ~1300 px: near-full-bleed but never edge-to-edge on
large screens, with **192 px** below it. Caption in the `label` voice below-left
(P19/P20). Drop the pastel grounding shapes here (keep `GroundedImage` for smaller
feature photos). Fix the inverted labels (§5).
*Why it reads premium:* one image, given the room, with a small caption, is the
oldest premium move there is.

**B7 · Case studies and gallery as catalogue**
*Files:* `src/components/pages/CaseStudiesContent.tsx`, `GalleryContent.tsx`.
*What changes:* six case studies and four gallery projects leaning on imagery we
mostly don't have, with a live disclaimer admitting the images are placeholders.
*Proposal:* P29 + §2.4. Each case study becomes a **Data-and-credits spec sheet** —
Scope / Duration / Claim type / Trades / Moisture readings / Materials / Borough —
as a two-column definition list in `tabular-nums`, with a **material-macro row**
(§2.4) and the *one* real photo at full width at the end. Norm's contact-sheet
index (P28) for the gallery. Delete the placeholder sentence and delete the
AI-concept images rather than presenting them as work.

---

### Tier C — bold structural ideas

> **An honest caveat.** Across every Awwwards and CSSDA winner whose production code
> was inspected there were **zero** uses of the View Transitions API and **zero** uses
> of CSS `animation-timeline`. The award cohort is still Lenis + GSAP + Three.js.
> We recommend the native path deliberately: we are not competing for Site of the
> Day, we are a local trade selling trust. Native gives most of the perceived benefit
> at **0 KB**, no main-thread cost, no accessibility regression, and graceful
> degradation — and the craft cluster corroborates it (only 2 of 12 top craft sites
> use any scroll library; Aman uses none).

**C1 · Page transitions via React `<ViewTransition>`**
*Files:* `next.config.ts` (`experimental.viewTransition: true`), `src/app/layout.tsx`,
`Header.tsx`, service-page links.
*What:* `transitionTypes={['nav-forward'|'nav-back']}` on `<Link>`, **60 px**
directional offsets, **150 ms ease-in exit / 210 ms ease-out enter delayed by
150 ms** — the asymmetry Locomotive ships as `--transition-speed-enter: 0.45s` vs
`--transition-speed-leave: 0.2s` — and `viewTransitionName: 'site-header'` so the
header stays anchored while content slides. Add a shared-element morph from gallery
thumbnail to case-study hero: `share="morph"`, 400 ms, with a `blur(3px)` keyframe at
30 % to hide interpolation artefacts.
*Read `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` first — this
fork's API differs from stock, and every number above came from that file.*
*Why it reads premium:* old content leaves fast so it stops competing; new content
arrives gently so you register it. Nothing else changes the feel of the whole site
for so little code.

**C2 · Header that behaves, and scroll choreography on one page**
*Files:* `Header.tsx`, `src/components/pages/ServiceDetailContent.tsx` (all nine
service pages), `globals.css`.
*What:* first, fix the header per P25 — Aman's **100 px / 50 px hysteresis**, hide on
scroll-down, **return on scroll-up**, and tint rather than swap transparent→solid;
then move the state to a `data-scrolled` attribute (Linear) or delete the JS entirely
with Notion's 1 px `view-timeline` sentinel. Second, on the water-damage process only:
`position: sticky` pins the process drawing while the four descriptions scroll past,
with `animation-timeline: view()` driving a hairline progress rule (Apple's
`.sticky-container` / `.scroll-item` model; their scrub container runs ~176 vh).
No library, compositor-only properties, unsupported browsers see four stacked steps.
*Why it reads premium:* it makes the process feel like a process — and it works
entirely with line drawings (§2.7), so it needs no photography. It also restores
navigation to ~8 400 px of page that currently has none.

**C3 · The signature moment: a live wall section**
*Files:* new component under `src/components/home/`, plus `EstimatorContent.tsx`.
*What:* P30. One interactive artifact only a restoration contractor could build: a
**cutaway wall section** — floor, subfloor, base plate, insulation, vapour barrier,
drywall — as a clean line drawing in brand navy on the warm ground. Dragging a water
level up through it reveals, layer by layer, what gets wet, what must come out, what
can be dried in place, and roughly what each layer costs to restore. It hands off to
the estimator with the affected layers pre-filled. Technique: `@property`-registered
custom properties driving `clip-path` and `color-mix` — the Resend/Notion frontier
(both ship this in production), pure CSS, no canvas, no WebGL.
*Why it reads premium:* it is the Helmets-Hall-of-Fame move — the memorable thing is
built from real domain knowledge, not from WebGL. It is a drawing, so it costs no
photography; it is genuinely informative, so it earns the scroll.

---

## 4. Don't do

- **Don't put text over a photograph.** Aman ships **zero scrims in 231 KB**; text
  sits beside imagery on the ground. Our hero stacks four corrective layers to make
  one stock photo survive underneath a headline. If a photo needs a `/92` scrim, it
  is not doing any work.
- **Don't mix the three tracking schools** (P1). Pick classical inversion and hold it
  everywhere, including the label tier.
- **Don't re-add Lenis or any smooth-scroll library.** It was already mounted here and
  removed — per the comment in `Header.tsx` it swallowed native scroll events and
  broke the header's own listener. And only 2 of 12 top craft sites use one at all.
  Hijacked scrolling fights the one thing a water-damage visitor needs: the phone
  number.
- **No WebGL hero, no floating 3D object.** 800 KB–2 MB of runtime JS. Awwwards Site
  of the Year 2025 scored **7.0 on accessibility** — that is the honest price.
- **No custom cursors (`cursor: none`), magnetic buttons, or cursor-follower blobs.**
  Agency-portfolio vocabulary. On a site serving stressed homeowners and insurance
  adjusters on work laptops, it reads as a toy.
- **No dark mode, no full-dark site.** `globals.css` already states the brand calls
  for a bright site; charcoal is an accent.
- **No glassmorphism, no neon gradient meshes, no kinetic type for its own sake.**
  Glassmorphism measures at **15–30 % FPS drops** on real devices, worst on Android.
  Kinetic typography fights screen readers and crawlers and introduces CLS.
- **Avoid the named "AI-slop" tells** — several of which we currently ship:
  purple/blue hero gradients; **card grids with uniform 16 px radius, identical
  padding and identical card heights**; **uniform fade-in on every element**; buttons
  that snap instead of easing; oversized hero plus a vague tagline. Our services grid
  and our `Reveal` are both on that list.
- **No AI-generated "project" photography presented as work.** We ship
  `*-concept-*.jpg` and a live placeholder disclaimer. The fix is *fewer* images, not
  more synthetic ones. Illustration that is obviously illustration is honest; a
  photorealistic render of a kitchen we never built is not.
- **No auto-playing carousels**, including the testimonial marquee. Motion that
  competes with reading is the most reliable cheap-template tell.
- **Don't use green as a large filled field.** Reserve the accent for state (P9).
- **Don't centre everything** (P19). Seven of ten home components are `text-center`.
- **Don't add a second floating element.** We already have the chat launcher *and* a
  floating language toggle.
- **Don't chase the 300–500 ms motion range.** The benchmarks deliberately leave it
  empty. Ours lives there.
- **Don't shrink captions below 15 px** (P20). Snøhetta sets them at full body size.

---

## 5. What I actually saw on the live site

Eight things, observed at 1100 px and 401 px viewports on `renovisionana.ca`.

**1 · The CTA band's call button is wider than a phone.** Homepage, "Prêt à commencer
votre projet?". It renders **411 px wide inside a 401 px viewport, starting at
`left: -10px`** — its rounded ends are clipped off both edges of the screen. Cause:
`whitespace-nowrap` on `{t.ctaBand.ctaCall} · {SITE_PHONE}` in `CtaBand.tsx`.
→ **A9 / A8.**

**2 · The before/after labels are inverted.** Homepage, "Voyez la différence". At rest
the *left* half shows the finished room (plank floor, painted walls, stairs) and is
labelled **AVANT**; the *right* half shows gutted joists and debris and is labelled
**APRÈS**. The masked overlay in `ScrollBeforeAfter.tsx` reveals
`hero-basement-after-v2.jpg` from the left while `left-3` carries
`t.hero.beforeLabel`. On our single most persuasive asset. → **A9 / B6.**

**3 · `/estimation` returns HTTP 404 in production**, and is linked from neither
header nav nor footer. The site's one true differentiator has a landing page nobody
can reach. → **B5.**

**4 · Seven section headings, one size.** Every H2 on the homepage is
`36px / 40px / 700` in brand blue. There is no secondary or tertiary heading level
anywhere on the page, so the eye cannot rank sections — while the H1 above them sits
at 68 px with `letter-spacing: normal` in ExtraBold Italic. → **A1.**

**5 · Four indistinguishable pale-blue bands.** `brand-blue-light` at 0.25, 0.30, 0.40
and 0.60 alpha, plus pure white. On a phone the boundary between "Conçu pour chaque
client" and "Nos services" is invisible — the page reads as one continuous pale field
for roughly 4 000 px of scroll. → **A2.**

**6 · The floating language toggle collides with content.** Because the header hides
completely after 8 px of scroll and never returns, a fixed FR/EN pill is pinned
top-right with no backdrop. It lands directly on the audience card's service chips
("Dégât d'eau / Gypse / Planchers") and on the before/after caption — semi-transparent
text over text. Separately, with the header gone for the remaining ~8 400 px, **there
is no navigation at all** until you scroll back to the top. → **C2 / A6.**

**7 · The chat launcher occludes content and duplicates the hero CTA.** 245 × 48 px =
**55 % of a 401 px viewport**, same green, same words ("Estimation instantanée") as
the hero's own button — which is *smaller* at 236 × 39 px. Captured mid-fade at
`opacity: 0.64` at the top of the homepage; further down it sits on top of the first
service card's title. → **A8 / B4.**

**8 · The testimonial wall's top card is a ghost.** The `max-h-[640px]` mask
(`transparent → black 15%`) fades the top card to near-invisible while the column
marquees upward at `linear` with no pause. On a phone the first thing under "Ce que
disent nos clients" is a faint name over an empty white card. It reads as a rendering
failure, not a design. → **B2.**

*Also worth a line, though not strictly visual:* the full desktop nav is gated at
`xl` (1280 px), so at 1100 px — and on any windowed browser or 1280 px laptop with a
scrollbar — a 68 px hero headline sits above a hamburger menu. And
`design-system/renovision-ana/MASTER.md` has drifted from the build on fonts, radii
and shadows and contains no type scale or motion tokens; A1–A4 should be written back
into it so it stops being a third source of truth.

---

## 6. If only three things get done

1. **A1 + A2** — the type scale with optical tracking, three surfaces instead of five,
   a warm ground, and Poppins at 400 instead of ExtraBold Italic. One day, no new
   assets, changes every page at once. This is the Dropbox Brand strategy (P31): win
   on typography and system rigour, not on animation.
2. **A5 + B3** — the Fenton Whelan stats band and the numbered services index. These
   are the two components that carry a page **with no photography**, and they replace
   the two weakest blocks we currently ship.
3. **A9 + B5** — fix the overflowing button and the inverted before/after labels, and
   get `/estimation` deployed and linked. Two are defects on the most persuasive
   things we own; the third is a page that currently does not exist to anyone but us.

---

## 7. A starting token spec

Synthesised from the highest-agreement values across the study, biased to our
constraints. Closest single model: **Fenton Whelan** (a builder carrying its homepage
on numbers), with **Dinesen**'s rhythm and **Chipperfield**'s scale discipline —
recoloured to our locked navy/green/charcoal.

```css
:root{
  /* ground & ink — warm, never #fff */
  --ground:      #f7f4ee;   --ground-band: #ede8e0;   --surface: #ffffff;
  --ink:         #2b2b2b;   --ink-muted:   rgba(43,43,43,.6);
  --stroke:      #d8d1c8;   --dark-band:   #23272c;
  --brand-blue:  #2b5c9e;   --accent:      #4e9e2e;   /* STATE ONLY — hover, active, focus */

  /* one 1.25 modular scale for type AND space (Chipperfield) */
  --s-300:.8rem;    --s-400:1rem;    --s-500:1.25rem;  --s-600:1.563rem;
  --s-700:1.953rem; --s-800:2.4rem;  --s-900:3.9rem;   --s-1000:5.6rem;
  --s-1100:8rem;    --s-1200:12rem;  --s-1300:18rem;   /* 128 / 192 / 288px */
  --section: var(--s-1100);            /* 128px → 160px lg; 64px ≤767 */
  --gutter: 40px;  --container: 1152px;  --grid-cols: 12;

  --dur-sm:.18s; --dur-md:.5s; --dur-lg:.8s;
  --ease-house: cubic-bezier(.52,.05,0,1);
  --ease-out:   cubic-bezier(.165,.84,.44,1);
  --ease-snap:  cubic-bezier(.175,.885,.32,1.1);

  --ring:   0 0 0 1px rgba(0,0,0,.08);
  --lift:   var(--ring), 0 2px 2px rgba(0,0,0,.04), 0 16px 24px -8px rgba(0,0,0,.06);
  --tinted: 0 30px 60px -20px rgba(43,92,158,.35);   /* already in ScrollBeforeAfter */
}
```

Plus: section padding **160 px** desktop; **one** image aspect ratio enforced at the
asset (0.727 or 3:4 for real photos, 1:1 for material macros); image hover
`scale(1.03)` or none; hairline rules at 40 / 100 / 160 px; captions never below
15 px; and green reserved strictly for hover borders, active underlines, active dots
and the count-up numeral.

---

## Sources

**Token-level teardowns from production CSS** (fetched 2026-08-01):
[Stripe](https://stripe.com) *(redesigned April 2026)* · [Linear](https://linear.app) ·
[Vercel](https://vercel.com) — publishes machine-readably at
[/geist/typography.md](https://vercel.com/geist/typography.md),
[/colors.md](https://vercel.com/geist/colors.md),
[/materials.md](https://vercel.com/geist/materials.md),
[/grid.md](https://vercel.com/geist/grid.md),
[vercel.com/design.md](https://vercel.com/design.md) ·
[Apple](https://www.apple.com/macbook-pro/) · [Figma](https://figma.com) ·
[Notion](https://notion.so) · [Resend](https://resend.com) · [Clerk](https://clerk.com).

**Premium physical craft:** [Dinesen](https://dinesen.com) ·
[Farrow & Ball](https://farrow-ball.com) · [Ferrari](https://ferrari.com) ·
[Bang & Olufsen](https://bang-olufsen.com) · [Molteni&C](https://molteni.it) ·
[Salvatori](https://salvatori.it) · [Buster + Punch](https://busterandpunch.com) ·
[Vola](https://vola.com) · [Atelier Ellis](https://atelierellis.co.uk) ·
[Aman](https://aman.com) · [Belmond](https://belmond.com) ·
[The Ned](https://thened.com) · [Ett Hem](https://etthem.se).

**Architecture, editorial & the direct analogue:**
**[Fenton Whelan](https://fentonwhelan.com)** · [Thurstan](https://thurstan.co) ·
[Norm Architects](https://normcph.com) · [Snøhetta](https://snohetta.com) ·
[David Chipperfield](https://davidchipperfield.com) · [BIG](https://big.dk) ·
[Vincent Van Duysen](https://vincentvanduysen.com) ·
[Ström Architects](https://stromarchitects.com) · [Zaha Hadid](https://zaha-hadid.com) ·
[Studio KO](https://studioko.fr) · [John Pawson](https://johnpawson.com) ·
[Heatherwick Studio](https://heatherwick.com) ·
[Aman brand identity by Construct (BP&O)](https://bpando.org/2016/02/16/branding-aman/).

**Award winners & agencies:**
[Awwwards Sites of the Year](https://www.awwwards.com/websites/sites_of_the_year/) ·
[Sites of the Month](https://www.awwwards.com/websites/sites_of_the_month/) ·
[Sites of the Day](https://www.awwwards.com/websites/sites_of_the_day/) — SOTY 2025
[Lando Norris](https://www.awwwards.com/sites/lando-norris) by
[OFF+BRAND](https://www.itsoffbrand.com/our-work/lando-norris) (jury + users' choice)
and [Messenger](https://www.awwwards.com/sites/messenger) by abeto ·
[CSS Design Awards Website of the Year 2025](https://www.cssdesignawards.com/woty2025/)
— **Dropbox Brand** by Daybreak Studio (9.03, also Best UX), runners-up *The Symphony
of Vines* (Unseen), *Charles Leclerc*, *Bruno's Portfolio* ·
[Lusion](https://lusion.co) · [Locomotive](https://locomotive.ca/en) ·
[BASIC/DEPT®](https://basicagency.com) · [Hello Monday](https://www.hellomonday.com) ·
[Active Theory](https://activetheory.net) ·
[Terminal Industries](https://terminal-industries.com) by REJOUICE®.

**Technique references:**
[CSS scroll-driven animations (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations) ·
[WebKit's guide](https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/) ·
[Josh Comeau on scroll-driven animations](https://www.joshwcomeau.com/animation/scroll-driven-animations/) ·
[Kevin Hufnagl — recreating the Stripe gradient](https://kevinhufnagl.com/how-to-stripe-website-gradient-effect/) ·
[925 Studios — the AI-slop web design guide](https://www.925studios.co/blog/ai-slop-web-design-guide) ·
[Studio Meyer — 2026 reality check](https://studiomeyer.io/en/blog/webdesign-trends-2026-reality-check) ·
[It's Nice That — 2026 graphic trends](https://www.itsnicethat.com/features/forward-thinking-graphic-trends-2026-graphic-design-120126) ·
[best architecture firm websites 2026](https://whitelam.media/insights/best-architecture-firm-websites-2026) ·
[Figma — web design trends](https://www.figma.com/resource-library/web-design-trends/).
View-transition API numbers verified against this repo's own
`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`.
