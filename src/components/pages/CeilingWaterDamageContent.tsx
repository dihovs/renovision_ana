"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import ServiceDetailContent, { type ServiceDetailCopy } from "./ServiceDetailContent";
import { IconDroplet } from "@/components/ui/icons";
import { CEILING_FAQ } from "@/lib/serviceFaq";

/**
 * Ceiling water damage — a sub-page of /services/water-damage rather than a
 * ninth top-level service, because that is what it is: the same job, narrowed
 * to the surface people actually search for.
 *
 * Why it exists at all: the top two organic results for « dégât d'eau plafond
 * réparation Montréal » are Macif and Habitatpresto — both French, from France,
 * walking a Montrealer through a French claim procedure priced in € and m².
 * The Quebec results below them are each one slice: the plumber stops at the
 * leak, the cleaner stops at drying, and none of them answer who pays. See
 * content/briefs/degat-eau-plafond.md.
 *
 * The costs in `includes` come from the estimator price book (DEM-CEILING,
 * DW-INST-12, DW-MR, DW-TAPE-L4, DW-SKIM, PNT-STAINBLOCK, PNT-PRIME-NEW,
 * PNT-CEIL-2), summed
 * into ranges and labelled as rates rather than quotes. They are the one thing
 * the two pages currently outranking us cannot state without being wrong, so
 * they are worth keeping accurate — update them when the price book moves.
 *
 * Two different primers, and the distinction is the whole surface-repair price.
 * A water STAIN on sound board needs PNT-STAINBLOCK (stain-blocking primer,
 * 1.55) — which is what this page's copy actually promises, in both languages.
 * PNT-PRIME-NEW (1.15) is for priming NEW board and is correct in the two
 * replacement figures below, where the board is new. This shipped on 2026-08-31
 * quoting the cheaper item against copy describing the dearer one, which
 * under-quoted the surface repair by $0.40/sq ft. Caught because a parallel
 * session working on ceiling rules listed PNT-STAINBLOCK among the codes it
 * touches and this page did not use it.
 */
const copy: Record<"en" | "fr", ServiceDetailCopy> = {
  en: {
    eyebrow: "Ceiling Water Damage",
    title: "What to Do, Who Pays, and How We Put the Ceiling Back",
    intro:
      "A brown stain that wasn't there yesterday. Maybe a bulge, maybe a drip. The question isn't whether it's serious — it's where the water is coming from, and whose problem that is. Our line is answered 24/7.",
    processTitle: "The First Six Hours",
    processIntro: "What you do before anyone arrives decides a good part of the bill.",
    processSteps: [
      {
        title: "Cut the power at the panel",
        desc: "Not the wall switch — a light fixture under an active leak is a wet circuit. Kill the room's breaker rather than reaching for anything in the room.",
      },
      {
        title: "Contain, then photograph",
        desc: "A basin under the drip, move what can be moved, then photograph before anything else shifts. That record is what your insurer works from, and it only exists once.",
      },
      {
        title: "Leave a bulging ceiling alone",
        desc: "A bulge is holding water and piercing it releases all of it at once. If you must, do it at the centre of the bulge, with a container underneath and nobody standing under it. Otherwise wait for us.",
      },
      {
        title: "Find the source, or find who owns it",
        desc: "A pipe in the void, the roof, or the unit above — the ceiling looks identical in all three, but the responsible party and the insurer are not. While the source is running, everything else is theoretical.",
      },
    ],
    includesTitle: "Patch or Replace, and What It Costs",
    includesIntro:
      "The moisture reading decides, not the look. Rates below are our labour and materials in $/sq ft — not quotes, since the affected area and the access decide the rest.",
    includes: [
      {
        title: "Surface repair — about $9.05/sq ft",
        desc: "Sound, dry board with a stain only: sealed with a blocking primer, skimmed if the texture moved, then two coats.",
      },
      {
        title: "Full replacement — about $16.95/sq ft",
        desc: "Removal, ½-inch board, level 4 taping, primer and paint. A board that absorbed water doesn't come back straight as it dries — it deforms, joints open, and the paint tells on it six months later.",
      },
      {
        title: "Moisture-resistant board — about $18.15/sq ft",
        desc: "Where the ceiling is under a bathroom or kitchen and the same failure could recur.",
      },
      {
        title: "Small areas priced per repair",
        desc: "A 1–4 sq ft spot repair is $245 and 4–16 sq ft is $495, rather than by the square foot. A fully redone 10 × 12 ft bedroom ceiling lands around $2,000–$2,200 in ceiling work — before drying, and before anything wet beyond the ceiling itself.",
      },
    ],
    localContext: {
      heading: "Ceilings dry from one face, and that changes the job",
      paragraphs: [
        "A wall dries from both sides. A ceiling doesn't — what sits above it holds the water: insulation, the service void, and in a plex or a condo, your neighbour's floor assembly. The EPA's 24-to-48-hour benchmark for mould on wet material applies here like anywhere, but the clock runs on material you can't see from below, which is why we open up enough to read moisture above the ceiling rather than only under it. Soaked insulation left over a new ceiling is the most reliable way to do the same job twice.",
        "Who pays is the question most people actually arrive with, and in a Quebec co-ownership two policies generally come into play: the syndicate's, covering the building and common portions, and yours, covering your improvements and belongings. The practical question is usually the deductible and how it gets split. That split is not the same from one building to the next — it depends on your declaration of co-ownership and the policies in force, and the rules changed with laws 16 and 141. For a tenant it's the lease, and in a dispute the TAL.",
        "Read your declaration and call your insurer before agreeing anything with the neighbour. What we do is narrower and more useful: document what got wet, with moisture readings and photographs from the first visit to the last, in a form an adjuster can process without a follow-up call. We don't decide what's covered.",
      ],
      readMore: {
        label: "Read the hidden water damage and mould timeline",
        href: "/blog/hidden-water-damage-and-mold-timeline",
      },
      alsoSee: {
        label: "Who actually pays for a condo water loss in Quebec",
        href: "/blog/condo-water-damage-who-pays",
      },
    },
    faq: CEILING_FAQ.en,
  },
  fr: {
    eyebrow: "Dégât d'eau au plafond",
    title: "Quoi faire, qui paie, et comment on refait le plafond",
    intro:
      "Une tache brune qui n'y était pas hier. Peut-être un renflement, peut-être une goutte. La question n'est pas de savoir si c'est grave — c'est de savoir d'où vient l'eau, et qui s'en occupe. Notre ligne est répondue 24/7.",
    processTitle: "Les six premières heures",
    processIntro: "Ce que vous faites avant l'arrivée de quiconque détermine une bonne partie de la facture.",
    processSteps: [
      {
        title: "Coupez le courant au panneau",
        desc: "Pas l'interrupteur du mur — un plafonnier sous une infiltration active est un circuit mouillé. Coupez le disjoncteur de la pièce plutôt que de toucher à quoi que ce soit à l'intérieur.",
      },
      {
        title: "Confinez, puis photographiez",
        desc: "Un bac sous la goutte, déplacez ce qui peut l'être, puis photographiez avant que quoi que ce soit d'autre ne bouge. C'est ce dossier que votre assureur regardera, et il n'existe qu'une fois.",
      },
      {
        title: "Ne touchez pas à un plafond gonflé",
        desc: "Un renflement contient de l'eau, et le percer libère tout d'un coup. Si vous devez le faire, faites-le au centre du renflement, avec un contenant dessous et personne en dessous. Sinon, attendez-nous.",
      },
      {
        title: "Trouvez la source, ou trouvez qui en est propriétaire",
        desc: "Une conduite dans le vide, la toiture, ou le logement au-dessus — le plafond a la même apparence dans les trois cas, mais le responsable et l'assureur ne sont pas les mêmes. Tant que la source coule, le reste est théorique.",
      },
    ],
    includesTitle: "Réparer ou remplacer, et ce que ça coûte",
    includesIntro:
      "Le relevé d'humidité décide, pas l'apparence. Les taux ci-dessous sont notre main-d'œuvre et nos matériaux en $/pi² — ce ne sont pas des soumissions : la superficie touchée et l'accès font le reste.",
    includes: [
      {
        title: "Réparation de surface — environ 9,05 $/pi²",
        desc: "Panneau sain et sec, tache seulement : scellée avec un apprêt bloquant, ratissée si la texture a bougé, puis deux couches.",
      },
      {
        title: "Remplacement complet — environ 16,95 $/pi²",
        desc: "Retrait, gypse ½ po, tirage de joints niveau 4, apprêt et peinture. Un panneau qui a absorbé de l'eau ne redevient pas droit en séchant — il se déforme, les joints ouvrent, et la peinture le révèle six mois plus tard.",
      },
      {
        title: "Gypse hydrofuge — environ 18,15 $/pi²",
        desc: "Quand le plafond se trouve sous une salle de bain ou une cuisine et que la même défaillance pourrait se répéter.",
      },
      {
        title: "Petites zones facturées à la réparation",
        desc: "Une réparation ponctuelle de 1 à 4 pi² se facture 245 $ et de 4 à 16 pi², 495 $, plutôt qu'au pied carré. Un plafond de chambre de 10 × 12 pi entièrement refait place les travaux de plafond autour de 2 000 $ à 2 200 $ — avant l'assèchement, et avant tout ce qui aurait été mouillé au-delà du plafond lui-même.",
      },
    ],
    localContext: {
      heading: "Un plafond sèche par une seule face, et ça change le travail",
      paragraphs: [
        "Un mur sèche des deux côtés. Un plafond, non — ce qui se trouve au-dessus retient l'eau : l'isolant, le vide technique et, dans un plex ou une copropriété, l'assemblage de plancher du voisin. Le seuil de 24 à 48 heures de l'EPA pour la moisissure sur un matériau mouillé s'applique ici comme ailleurs, mais le compte à rebours court sur un matériau invisible d'en bas. C'est pourquoi nous ouvrons assez pour lire l'humidité au-dessus du plafond et non seulement en dessous. Un isolant imbibé laissé au-dessus d'un plafond neuf est la façon la plus fiable de refaire le même travail deux fois.",
        "Qui paie est la question avec laquelle la plupart des gens arrivent. En copropriété au Québec, deux polices entrent généralement en jeu : celle du syndicat, qui couvre l'immeuble et les parties communes, et la vôtre, qui couvre vos améliorations et vos biens. La question pratique est habituellement celle de la franchise et de sa répartition. Cette répartition n'est pas la même d'un immeuble à l'autre — elle dépend de votre déclaration de copropriété et des polices en vigueur, et les règles ont changé avec les lois 16 et 141. Pour un locataire, c'est le bail, et en cas de litige, le TAL.",
        "Lisez votre déclaration et appelez votre assureur avant de convenir de quoi que ce soit avec le voisin. Ce que nous faisons est plus étroit et plus utile : documenter ce qui a été mouillé, avec relevés d'humidité et photos de la première visite à la dernière, sous une forme qu'un expert en sinistre peut traiter sans rappel. Nous ne décidons pas de ce qui est couvert.",
      ],
      readMore: {
        label: "Lire la chronologie des dégâts d'eau cachés et de la moisissure",
        href: "/blog/hidden-water-damage-and-mold-timeline",
      },
      alsoSee: {
        label: "Qui paie vraiment un dégât d'eau en copropriété au Québec",
        href: "/blog/condo-water-damage-who-pays",
      },
    },
    faq: CEILING_FAQ.fr,
  },
};

export default function CeilingWaterDamageContent() {
  const { locale } = useLanguage();
  return <ServiceDetailContent icon={IconDroplet} copy={copy[locale]} />;
}
