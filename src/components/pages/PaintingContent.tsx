"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import ServiceDetailContent, { type ServiceDetailCopy } from "./ServiceDetailContent";
import { IconBrush } from "@/components/ui/icons";

// Grounded in the estimator's "Painting" category (see
// src/lib/estimator/data/lineItems.ts): priming new drywall, two-coat walls
// and ceilings, baseboards and trim, doors both sides, closet interiors, plus
// the real surcharges for extra colour changes and dark/high-hide colours.
const copy: Record<"en" | "fr", ServiceDetailCopy> = {
  en: {
    eyebrow: "Interior Painting",
    title: "Paint That Covers Properly the First Time",
    intro:
      "Most painting complaints come down to two things: coverage and cut lines. Thin coats that let the old colour ghost through, and edges that wander where the wall meets the ceiling. We prime what needs priming, paint in full coats, and cut the lines straight — walls, ceilings, trim, and doors across Laval and Montreal.",
    media: [
      {
        src: "/images/painting-concept-before.jpg",
        alt: "Interior wall being rolled with off-white paint over primer, painter's tape along the baseboard and drop cloths covering the floor",
        caption: "Masked, cut in, and rolling the first full coat",
      },
      {
        src: "/images/painting-concept-after.jpg",
        alt: "The finished room with even off-white walls, crisp cut lines at the ceiling, and painted white trim and door",
        caption: "Two coats on, crisp lines at ceiling and trim",
      },
    ],
    mediaNote: "Illustrations of the process, not photos of a specific project.",
    processTitle: "How It Works",
    processIntro: "Preparation is most of the job. The painting is the quick part.",
    processSteps: [
      {
        title: "Prep & Protect",
        desc: "Furniture moved or covered, floors protected, and surfaces cleaned so the paint bonds to the wall rather than to dust.",
      },
      {
        title: "Prime Where It Matters",
        desc: "New drywall gets a primer coat, because bare board and joint compound absorb paint at completely different rates.",
      },
      {
        title: "Two Full Coats",
        desc: "Walls and ceilings get two proper coats. Dark and high-hide colours are flagged upfront, since they genuinely take more product.",
      },
      {
        title: "Trim, Doors & Cleanup",
        desc: "Baseboards, trim, and doors painted last, then the space is put back the way we found it.",
      },
    ],
    includesTitle: "What's Included",
    includesIntro: "Priced honestly, including the parts that actually cost more.",
    includes: [
      {
        title: "Walls & Ceilings",
        desc: "Two coats on walls and ceilings, with priming included on new drywall.",
      },
      {
        title: "Trim, Baseboards & Doors",
        desc: "Baseboards and trim painted, and interior doors finished on both sides.",
      },
      {
        title: "Closets & Detail Areas",
        desc: "Closet interiors and the tight detail work that often gets skipped or charged as an extra elsewhere.",
      },
      {
        title: "Colour Changes Quoted Upfront",
        desc: "Extra colour changes and dark or high-hide colours are quoted as line items, so the price you're given is the price that holds.",
      },
    ],
    localContext: {
      heading: "Painting around a Quebec calendar",
      paragraphs: [
        "Interior painting is the one trade that doesn't slow down in winter, which is exactly why it fills the months when exterior work can't happen. The constraint that time of year isn't temperature, it's ventilation — a sealed-up house in February holds solvent smell far longer than an open one in June, so low-VOC products and staging the work by room matter more than they do in summer.",
        "A steady share of this work is turnover repainting in the multiplex and apartment stock around Chomedey, where roughly a third of the housing dates from 1960 to 1980. Those are scheduled against a lease date rather than a preference, so the job gets planned backwards from when the next tenant moves in.",
        "Where new drywall is involved, priming isn't optional. Bare board and joint compound absorb paint at completely different rates, and skipping the primer coat is what produces a wall where every taped seam reads through the finish once the light hits it.",
      ],
      readMore: {
        label: "See our drywall installation and finishing",
        href: "/services/drywall",
      },
    },
  },
  fr: {
    eyebrow: "Peinture intérieure",
    title: "Une peinture qui couvre vraiment du premier coup",
    intro:
      "La plupart des plaintes en peinture se ramènent à deux choses : la couverture et les lignes de coupe. Des couches trop minces qui laissent transparaître l'ancienne couleur, et des arêtes qui serpentent à la jonction du mur et du plafond. Nous apprêtons ce qui doit l'être, appliquons des couches complètes et coupons les lignes droites — murs, plafonds, moulures et portes à Laval et à Montréal.",
    media: [
      {
        src: "/images/painting-concept-before.jpg",
        alt: "Mur intérieur peint au rouleau en blanc cassé par-dessus l'apprêt, ruban à masquer le long de la plinthe et toiles de protection au sol",
        caption: "Masquage, coupe et première couche complète",
      },
      {
        src: "/images/painting-concept-after.jpg",
        alt: "La pièce terminée avec des murs blanc cassé uniformes, des lignes de coupe nettes au plafond et des moulures et une porte peintes en blanc",
        caption: "Deux couches, lignes nettes au plafond et aux moulures",
      },
    ],
    mediaNote: "Illustrations du processus, et non des photos d'un projet précis.",
    processTitle: "Comment ça fonctionne",
    processIntro: "La préparation, c'est l'essentiel du travail. La peinture est la partie rapide.",
    processSteps: [
      {
        title: "Préparer et protéger",
        desc: "Meubles déplacés ou recouverts, planchers protégés et surfaces nettoyées pour que la peinture adhère au mur et non à la poussière.",
      },
      {
        title: "Apprêter là où ça compte",
        desc: "Le gypse neuf reçoit une couche d'apprêt, car le panneau nu et le composé à joints absorbent la peinture à des rythmes complètement différents.",
      },
      {
        title: "Deux couches complètes",
        desc: "Les murs et les plafonds reçoivent deux vraies couches. Les couleurs foncées et très couvrantes sont signalées d'avance, car elles demandent réellement plus de produit.",
      },
      {
        title: "Moulures, portes et nettoyage",
        desc: "Plinthes, moulures et portes peintes en dernier, puis les lieux sont remis dans l'état où nous les avons trouvés.",
      },
    ],
    includesTitle: "Ce qui est inclus",
    includesIntro: "Un prix honnête, y compris pour les éléments qui coûtent réellement plus cher.",
    includes: [
      {
        title: "Murs et plafonds",
        desc: "Deux couches sur les murs et les plafonds, apprêt inclus sur le gypse neuf.",
      },
      {
        title: "Moulures, plinthes et portes",
        desc: "Plinthes et moulures peintes, et portes intérieures finies des deux côtés.",
      },
      {
        title: "Garde-robes et détails",
        desc: "Intérieurs de garde-robes et travail de détail serré, souvent omis ou facturé en supplément ailleurs.",
      },
      {
        title: "Changements de couleur chiffrés d'avance",
        desc: "Les changements de couleur supplémentaires et les couleurs foncées ou très couvrantes sont chiffrés en postes distincts, pour que le prix annoncé soit le prix final.",
      },
    ],
    localContext: {
      heading: "Peindre au rythme du calendrier québécois",
      paragraphs: [
        "La peinture intérieure est le seul métier qui ne ralentit pas en hiver — c'est justement pourquoi elle occupe les mois où les travaux extérieurs sont impossibles. À cette période, la contrainte n'est pas la température mais la ventilation : une maison fermée en février retient l'odeur des solvants bien plus longtemps qu'une maison ouverte en juin, alors les produits à faible COV et l'organisation des travaux pièce par pièce comptent plus qu'en été.",
        "Une part constante de ce travail est la remise en peinture entre deux locataires dans le parc de multiplex et d'immeubles à logements autour de Chomedey, où environ le tiers des logements datent de 1960 à 1980. Ces chantiers sont planifiés en fonction d'une date de bail et non d'une préférence : on remonte le calendrier à partir de l'arrivée du prochain locataire.",
        "Quand il y a du gypse neuf, l'apprêt n'est pas facultatif. Le panneau nu et le composé à joints absorbent la peinture à des rythmes complètement différents, et sauter la couche d'apprêt produit un mur où chaque joint tiré transparaît sous le fini dès que la lumière l'atteint.",
      ],
      readMore: {
        label: "Voir notre installation et finition de gypse",
        href: "/services/drywall",
      },
    },
  },
};

export default function PaintingContent() {
  const { locale } = useLanguage();
  return <ServiceDetailContent icon={IconBrush} copy={copy[locale]} />;
}
