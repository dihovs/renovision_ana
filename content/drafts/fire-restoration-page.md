# Fire Restoration Service Page — Full Content

**Route:** `/services/fire-damage` (FR) / `/en/services/fire-damage` (EN)
**Files needed:** 
  - `src/components/pages/FireDamageContent.tsx`
  - `src/app/[lang]/services/fire-damage/page.tsx`
  - Update `src/lib/serviceFaq.ts` to add FIRE_DAMAGE_FAQ
  - Update `src/app/sitemap.ts` to add the route
  - Add a card to `src/components/pages/ServicesContent.tsx` 
  - Add to Header nav if desired
  - Add to `src/lib/serviceAreas.ts` constants for related services

---

## FireDamageContent.tsx — FR/EN copy

Follows the exact pattern of `SewerBackupContent.tsx` (uses `ServiceDetailContent` component, passes `faq` via spread like WaterDamageContent does).

```typescript
// COPY — FR
eyebrow: "Restauration après incendie"
title: "Après le feu, la fumée fait autant de dégâts que les flammes"
intro: "Un incendie laisse derrière lui de l'eau, de la suie et des odeurs tenaces. Notre équipe intervient pour sécuriser, nettoyer et reconstruire — du premier appel à la dernière couche de peinture. Ligne répondue 24/7."

// CHECKLIST — to be added as new section between intro and process steps
// For the developer: add a `checklist` field of type { title: string; steps: string[] }[] 
// to ServiceDetailCopy and render it between the hero section and the process section.

checklistTitle: "Quoi faire après un incendie"
checklistItems: [
  "N'entrez dans le bâtiment que lorsque les autorités confirment qu'il est sécuritaire",
  "Contactez votre assureur dès que possible — la police couvre souvent l'hébergement d'urgence",
  "Conservez tous les reçus (hébergement, repas, vêtements, médicaments)",
  "Ne jetez rien avant que l'expert en sinistre l'ait vu — des biens qui semblent irrécupérables se sauvent",
  "Appelez-nous au 579-999-5979 dès que vous avez l'autorisation d'accéder aux lieux"
]

// PROCESS
processTitle: "Comment ça fonctionne"
processIntro: "Cinq étapes, de la sécurisation à la remise en état complète"

processSteps: [
  {
    title: "Sécurisation et évaluation",
    desc: "Nous sécurisons le bâtiment (barricadage, couverture de toit temporaire si nécessaire) et évaluons les dommages structurels, l'étendue de la suie et l'eau laissée par l'extinction."
  },
  {
    title: "Extraction d'eau et démolition sélective",
    desc: "L'eau utilisée par les pompiers est pompée, puis les matériaux irrécupérables (gypse imbibé, isolant, moquette) sont retirés. On ne démolit que ce qui doit l'être."
  },
  {
    title: "Nettoyage de suie et désodorisation",
    desc: "Toutes les surfaces sont nettoyées avec des produits spécialisés pour éliminer la suie et les résidus de fumée. Des techniques de désodorisation (ozone, thermonébulisation) traitent les odeurs incrustées dans les matériaux."
  },
  {
    title: "Restauration du contenu",
    desc: "Les meubles, vêtements et objets qui peuvent être sauvés sont nettoyés, désodorisés et entreposés pendant les travaux. Nous pouvons même restaurer des documents endommagés."
  },
  {
    title: "Reconstruction et finition",
    desc: "Gypse, plancher, peinture, moulures et armoires — la même équipe coordonne tous les corps de métier pour un résultat cohérent."
  }
]

// INCLUDES
includesTitle: "Ce qui est inclus"
includesIntro: "Tout géré sous un même toit, avec documentation complète pour votre assureur"

includes: [
  {
    title: "Sécurisation d'urgence du bâtiment",
    desc: "Barricadage, bâchage temporaire du toit et mise hors service des équipements endommagés."
  },
  {
    title: "Extraction d'eau et démolition contrôlée",
    desc: "Pompage de l'eau d'extinction, retrait des matériaux brûlés et imbibés, préservation de ce qui peut être sauvé."
  },
  {
    title: "Nettoyage de suie et désodorisation",
    desc: "Nettoyage spécialisé de toutes les surfaces, traitement des odeurs de fumée par ozone ou thermonébulisation."
  },
  {
    title: "Documentation pour réclamation",
    desc: "Photos datées de chaque pièce, rapport des dommages, portée écrite des travaux — tout ce que votre expert en sinistre attend."
  },
  {
    title: "Reconstruction complète",
    desc: "De la charpente aux finitions, exécutée par la même équipe qui a fait le nettoyage — pas de transfert à une autre entreprise."
  }
]

// LOCAL CONTEXT
localContext: {
  heading: "Les incendies dans le parc immobilier lavallois"
  paragraphs: [
    "Ce qui rend un incendie différent des autres sinistres, c'est qu'il combine plusieurs types de dégâts en un seul événement. Les flammes brûlent, l'eau des extincteurs imbibe, la suie tache et les odeurs de fumée s'incrustent. Chacun de ces problèmes demande une méthode différente, et les traiter dans le mauvais ordre est la façon la plus courante de voir une odeur de fumée réapparaître six mois après la fin des travaux.",
    "Dans le parc immobilier lavallois, les bungalows des années 1950-60 présentent un défi particulier : leurs toits en pente créent des cavités où la fumée et la suie circulent bien au-delà de la pièce d'origine. Une cuisine qui brûle dans un bungalow de Vimont laisse souvent de la suie dans les chambres à l'étage, transportée par le vide technique du toit. C'est pourquoi notre inspection couvre l'ensemble du bâtiment, pas seulement la pièce sinistrée.",
    "Pour les immeubles à logements de l'ouest de Laval et de Montréal, l'enjeu est la coordination entre unités. Un incendie dans un logement peut rendre le voisin du dessus inhabitable à cause de l'eau et de la fumée, et les relations entre locataires et assureurs deviennent complexes. Notre expérience des chantiers en immeubles occupés (confinement, heures bruyantes communiquées, nettoyage quotidien) fait que le voisin peut rester chez lui pendant les travaux dans la plupart des cas."
  ]
  readMore: {
    label: "Lire l'article sur les dégâts d'eau cachés après un incendie",
    href: "/blog/hidden-water-damage-and-mold-timeline"
  }
}

// FAQ — see FIRE_DAMAGE_FAQ in serviceFaq.ts below
```

For the EN version, translate directly. Key additions:
- checklist EN steps: "1. Only re-enter when authorities confirm it's safe / 2. Contact your insurer — they often cover emergency accommodations / 3. Keep every receipt (housing, meals, clothes, meds) / 4. Don't throw anything away before the adjuster sees it / 5. Call us at 579-999-5979 once you have access clearance"
- process EN and includes EN follow same structure
- localContext EN paragraphs reference Laval's 1950s-60s bungalow stock, the hidden smoke travel through roof cavities, and multi-unit coordination

---

## serviceFaq.ts — FIRE_DAMAGE_FAQ

Add to `src/lib/serviceFaq.ts` after the existing WATER_DAMAGE_FAQ export:

```typescript
export const FIRE_DAMAGE_FAQ: Record<Locale, FaqItem[]> = {
  en: [
    {
      question: "Can anything be saved after a fire?",
      answer:
        "More than you might expect. Soot can be cleaned from most hard surfaces, smoke odour can be removed from textiles and wood with specialized treatment (ozone, thermal fogging), and water-damaged documents can often be restored through freeze-drying. The key is not throwing anything away before the adjuster and our team have assessed it — what looks unsalvageable in the first hour is frequently recoverable.",
    },
    {
      question: "How long does it take to restore a home after a fire?",
      answer:
        "It depends on the extent of the fire, smoke, and water damage. A small kitchen fire confined to one room might be three to four weeks. A whole-house fire is typically several months. The drying phase after firefighting water sets the schedule — we don't start rebuilding until moisture readings confirm the structure is dry, because rebuilding over damp material traps problems.",
    },
    {
      question: "Does insurance cover fire damage restoration?",
      answer:
        "Most Quebec home insurance policies cover fire damage, including the cost of cleanup, repair, and rebuilding. Your policy also typically covers emergency accommodations if the home is uninhabitable. What is covered exactly depends on your specific policy — call your insurer to confirm, and keep every receipt for immediate expenses.",
    },
    {
      question: "Will my home smell like smoke after the repairs?",
      answer:
        "No — if the smoke odour is properly treated rather than painted over. Our process includes ozone treatment, thermal fogging, and surface cleaning that removes smoke residue rather than sealing it. If the odour is gone before the new paint goes on, it stays gone. A smoke smell that returns after repairs is nearly always the result of skipping the odour treatment step.",
    },
  ],
  fr: [
    {
      question: "Peut-on sauver quelque chose après un incendie ?",
      answer:
        "Plus qu'on ne le croit. La suie se nettoie sur la plupart des surfaces dures, les odeurs de fumée se neutralisent dans les tissus et le bois (ozone, thermonébulisation), et les documents endommagés par l'eau se restaurent souvent par lyophilisation. L'important est de ne rien jeter avant que l'expert et notre équipe l'aient évalué : ce qui semble irrécupérable dans la première heure est souvent récupérable.",
    },
    {
      question: "Combien de temps prend la restauration après un incendie ?",
      answer:
        "Cela dépend de l'étendue du feu, de la fumée et des dégâts d'eau. Un petit feu de cuisine confiné à une pièce peut prendre de trois à quatre semaines. Un incendie qui touche toute la maison prend généralement plusieurs mois. La phase de séchage après l'eau d'extinction commande l'échéancier — nous ne commençons pas la reconstruction avant que les relevés d'humidité confirment que la structure est sèche, parce que reconstruire sur un matériau humide emprisonne les problèmes.",
    },
    {
      question: "L'assurance couvre-t-elle la restauration après incendie ?",
      answer:
        "La plupart des polices d'assurance habitation au Québec couvrent les dommages causés par le feu, y compris le nettoyage, la réparation et la reconstruction. Votre police couvre aussi généralement l'hébergement d'urgence si la maison est inhabitable. Ce qui est exactement couvert dépend de votre police — appelez votre assureur pour confirmer, et conservez tous les reçus pour les dépenses immédiates.",
    },
    {
      question: "Est-ce que ma maison sentira la fumée après les réparations ?",
      answer:
        "Non — si l'odeur de fumée est correctement traitée plutôt que peinte par-dessus. Notre processus inclut le traitement à l'ozone, la thermonébulisation et le nettoyage des surfaces, qui éliminent les résidus de fumée plutôt que de les sceller. Si l'odeur disparaît avant la nouvelle peinture, elle ne revient pas. Une odeur de fumée qui réapparaît après les réparations est presque toujours le signe que l'étape de désodorisation a été sautée.",
    },
  ],
};
```

---

## Fire Damage page.tsx server component

Follow the pattern of `src/app/[lang]/services/mould-remediation/page.tsx`:

```typescript
import FireDamageContent from "@/components/pages/FireDamageContent";
import { localizedMetadata, serviceJsonLd } from "@/lib/seo";
import { toLocale } from "@/i18n/routing";
import { FIRE_DAMAGE_FAQ } from "@/lib/serviceFaq";

export const generateMetadata = localizedMetadata({
  path: "/services/fire-damage",
  fr: {
    title: "Restauration après incendie à Laval et Montréal",
    description:
      "Restauration complète après incendie à Laval et Montréal : nettoyage de suie, désodorisation, extraction d'eau des pompiers et reconstruction. Ligne répondue 24/7.",
  },
  en: {
    title: "Fire Damage Restoration in Laval and Montreal",
    description:
      "Full fire damage restoration in Laval and Montreal: soot cleaning, smoke odour removal, firefighting water extraction, and complete rebuild. Emergency line answered 24/7.",
  },
});

const schema = {
  path: "/services/fire-damage",
  fr: {
    name: "Restauration après incendie",
    serviceType: "Restauration après incendie",
    description:
      "Sécurisation du bâtiment, extraction d'eau, nettoyage de suie, désodorisation, restauration du contenu et reconstruction complète après un incendie.",
  },
  en: {
    name: "Fire Damage Restoration",
    serviceType: "Fire Damage Restoration",
    description:
      "Building securing, water extraction, soot cleaning, odour removal, content restoration, and full reconstruction after a fire.",
  },
};

export default async function FireDamagePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const locale = toLocale((await params).lang);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            serviceJsonLd(locale, { ...schema, faq: FIRE_DAMAGE_FAQ[locale] }),
          ),
        }}
      />
      <FireDamageContent />
    </>
  );
}
```

---

## Add to sitemap.ts

In `src/app/sitemap.ts`, add `"/services/fire-damage"` to the routes array.

---

## Add to ServicesContent.tsx card grid

Add a new card in `src/components/pages/ServicesContent.tsx` between the mould card and the flooring card (order: disaster services first, construction services second):

```typescript
// EN card
{
  href: "/services/fire-damage",
  icon: "shield", // or a new IconFire icon
  title: "Fire Damage Restoration",
  desc: "Soot cleaning, smoke odour removal, water extraction from firefighting, and full reconstruction — one crew from start to finish.",
},

// FR card
{
  href: "/services/fire-damage",
  icon: "shield",
  title: "Restauration après incendie",
  desc: "Nettoyage de suie, désodorisation, extraction d'eau des pompiers et reconstruction complète — une seule équipe du début à la fin.",
},
```

(Add alongside the 10 existing cards — currently 10, will become 11.)

---

## Header nav consideration

If the page is important enough for top nav, add a nav entry. Otherwise the /services page grid is sufficient for discovery and internal links from related services will pass authority.

---

## ASSUREURS and GESTIONNAIRES cross-linking

Add to serviceAreas.ts const: `FIRE_DAMAGE` constant with href `/services/fire-damage`, and add `FIRE_DAMAGE` to every area's relatedServices array that also lists water-damage (fire is a universal risk).