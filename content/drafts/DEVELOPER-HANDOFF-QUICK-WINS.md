# Developer Handoff — Quick Win Content (Sep 2026)

Three deliverables. Content is written. Here is what needs code changes.

---

## 1. Emergency Checklist on Water Damage Page

**Files to modify:**
  - `src/components/pages/ServiceDetailContent.tsx` — add a new `checklist` section
  - `src/components/pages/WaterDamageContent.tsx` — add checklist content to the copy object
  - `src/components/pages/ServiceDetailContent.tsx` type `ServiceDetailCopy` — add checklist field

**Content:** `content/drafts/emergency-checklist-water-damage.md`
**Schema:** No new schema needed — the checklist is visible-only content (not a separate schema type)

**Implementation:**
1. Add to `ServiceDetailCopy` type:
```typescript
checklist?: {
  title: string;
  intro: string;
  steps: { number: number; title: string; desc: string }[];
}
```
2. Render in `ServiceDetailContent` between the hero section (ends line 167) and the process section (begins line 170):
   - A light-grey background section with a "Quoi faire en cas de dégât d'eau" H2 title
   - Numbered steps in a vertical list (1-5), each with a bolded step title + description paragraph
   - Phone CTA inline at the bottom of the checklist: "Notre ligne est répondue 24/7 au 579-999-5979" / "Our line is answered 24/7 at 579-999-5979"

3. Add the FR content to `WaterDamageContent.tsx` copy.fr, EN to copy.en:
   - `checklistTitle`, `checklistIntro`, `checklistSteps` array matching the type above

---

## 2. Fire Damage Restoration — New Service Page

**New files to create:**
  - `src/components/pages/FireDamageContent.tsx`
  - `src/app/[lang]/services/fire-damage/page.tsx`

**Files to modify:**
  - `src/lib/serviceFaq.ts` — FIRE_DAMAGE_FAQ already added
  - `src/components/pages/ServicesContent.tsx` — add fire card (between mould and flooring, position 4)
  - `src/app/sitemap.ts` — add route
  - `src/lib/serviceAreas.ts` — add FIRE_DAMAGE constant + add to all 12 area pages' relatedServices

**Content:** `content/drafts/fire-restoration-page.md` (full copy, process, includes, local context, FAQ)
**FAQ:** `FIRE_DAMAGE_FAQ` already added to `src/lib/serviceFaq.ts`

**Implementation:**
1. Create `FireDamageContent.tsx` following the exact pattern of `SewerBackupContent.tsx`:
   - Import `ServiceDetailContent` and `ServiceDetailCopy` from `./ServiceDetailContent`
   - Use `IconShield` (or create a new `IconFire`) — check with designer
   - Spread `faq: FIRE_DAMAGE_FAQ[locale]` into the copy object (like WaterDamageContent does)
   - The copy includes: eyebrow, title, intro, checklist (new field), processSteps, includes, localContext, faq

2. Create `page.tsx` following the exact pattern of `MouldRemediationPage`:
   - Import `FireDamageContent`, FIRE_DAMAGE_FAQ
   - GenerateMetadata with FR and EN title/description
   - Service schema with FR and EN
   - Inject FAQPage schema JSON-LD from FIRE_DAMAGE_FAQ

3. Add card to `ServicesContent.tsx`:
   - FR title: "Restauration après incendie"
   - FR desc: "Nettoyage de suie, désodorisation, extraction d'eau des pompiers et reconstruction complète — une seule équipe du début à la fin."
   - EN title: "Fire Damage Restoration"
   - EN desc: "Soot cleaning, smoke odour removal, water extraction from firefighting, and full reconstruction — one crew from start to finish."
   - Icon: `icon: "shield"` (use existing IconShield, or create IconFire if designer prefers)

4. Add to sitemap routes array: `"/services/fire-damage"`

---

## 3. FAQ on Main Services Page

**Files to modify:**
  - `src/components/pages/ServicesContent.tsx` — add Q&A section below card grid
  - `src/app/[lang]/services/page.tsx` — add FAQPage JSON-LD schema

**Content:** `content/drafts/services-page-faq.md` (5 FR + 5 EN Q&As)

**Implementation:**
1. In `ServicesContent.tsx`, add a section below the card grid (after line 197):
   - Same Q&A rendering pattern from `ServiceDetailContent` lines 277-296
   - Grey background, "Questions fréquentes" / "Frequently asked questions" H2
   - 5 Q&As as dl/dt/dd in white cards

2. In `services/page.tsx`, add a second `<script type="application/ld+json">` block alongside the existing breadcrumb schema:
   - `@type: "FAQPage"`
   - `mainEntity` array matching the 5 visible Q&As
   - The same strings must appear in both the visible copy and the schema

---

## Implementation order (recommended)

1. Fire damage page (highest impact — new search surface)
2. Water damage checklist (quickest win — just adds to existing page)
3. Services page FAQ (lowest effort — only two files to touch)

**Content files in this repo:**
  - `content/drafts/emergency-checklist-water-damage.md`
  - `content/drafts/emergency-checklist-fire-damage.md`
  - `content/drafts/fire-restoration-page.md`
  - `content/drafts/services-page-faq.md`

**FAQ data already live in:**
  - `src/lib/serviceFaq.ts` — FIRE_DAMAGE_FAQ export added