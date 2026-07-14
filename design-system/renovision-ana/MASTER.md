# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Renovision AnA
**Generated:** 2026-07-13 22:42:29
**Category:** Home Services (Plumber/Electrician)

---

## Global Rules

### Color Palette

> **BRAND OVERRIDE:** The palette below replaces the generator's generic cyan
> suggestion with Renovision AnA's locked brand colors (see globals.css).

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#2B5C9E` | `--color-brand-blue` |
| Primary Dark | `#1F4677` | `--color-brand-blue-dark` |
| Primary Light bg | `#EAF1FB` | `--color-brand-blue-light` |
| On Primary | `#FFFFFF` | — |
| Accent/CTA | `#4E9E2E` | `--color-brand-green` |
| Accent Dark | `#3D7D24` | `--color-brand-green-dark` |
| Accent Light bg | `#EEF8E9` | `--color-brand-green-light` |
| Background | `#FFFFFF` | `--background` |
| Foreground | `#2B2B2B` | `--color-charcoal` |
| Dark section bg | `#23272C` | `--color-navy` (charcoal accent sections: stats bar, footer, safety) |
| Destructive | `#DC2626` | — |
| Ring | `#2B5C9E` | — |

**Color Notes:** Brand blue for headings/trust, green for CTAs/highlights, white/light-gray surfaces. Dark charcoal reserved for a minority of accent sections (stats, safety & certifications, footer) — never full-page dark.

### Typography

> **BRAND OVERRIDE:** The brief locks fonts to Poppins (headings) + Inter (body),
> loaded via `next/font` in `src/app/layout.tsx` — do not swap to the generator's
> Lexend/Source Sans 3 suggestion.

- **Heading Font:** Poppins (600–800) — `--font-heading`
- **Body Font:** Inter — `--font-body`
- **Mood:** modern, professional, approachable, trustworthy
- Fonts are self-hosted through `next/font/google`; no CSS @import needed.

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button (CTA = brand green) */
.btn-primary {
  background: #4E9E2E;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button (outline = brand blue) */
.btn-secondary {
  background: transparent;
  color: #2B5C9E;
  border: 2px solid #2B5C9E;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #FFFFFF; /* white cards on light-gray/blue-tint section backgrounds */
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #2B5C9E;
  outline: none;
  box-shadow: 0 0 0 3px #2B5C9E20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Trust & Authority

**Keywords:** Certificates/badges displayed, expert credentials, case studies with metrics, before/after comparisons, industry recognition, security badges

**Best For:** Healthcare/medical landing pages, financial services, enterprise software, premium/luxury products, legal services

**Key Effects:** Badge hover effects, metric pulse animations, certificate carousel, smooth stat reveal

### Page Pattern

**Pattern Name:** Trust & Authority + Conversion

- **Conversion Strategy:** Security badges. Case studies. Transparent pricing. Low-friction form.
- **CTA Placement:** Contact Sales / Get Quote (primary) + Nav
- **Section Order:** 1. Hero (mission/credibility), 2. Proof (logos, certs, stats), 3. Solution overview, 4. Clear CTA path

---

## Anti-Patterns (Do NOT Use)

- ❌ Hidden contact info
- ❌ No certifications

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
