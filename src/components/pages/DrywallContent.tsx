"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import ServiceDetailContent, { type ServiceDetailCopy } from "./ServiceDetailContent";
import { IconHammer } from "@/components/ui/icons";

// Content is grounded in what the estimator actually prices (see
// src/lib/estimator/data/lineItems.ts, category "Drywall"): 1/2", 5/8" Type X
// and moisture-resistant board, tape/plaster to Level 1/2 or Level 4, skim
// coating, corner bead, and patches banded by size. Nothing here claims work
// that isn't in the catalog.
const copy: Record<"en" | "fr", ServiceDetailCopy> = {
  en: {
    eyebrow: "Drywall Installation & Finishing",
    title: "Drywall Done Flat, Straight, and Ready to Paint",
    intro:
      "Drywall is the surface everything else gets judged against. A wavy joint or a visible patch shows up the moment the light hits it — so the taping and finishing matter as much as the board itself. We hang, tape, finish, and repair drywall across Laval and Montreal, for single patches through to full rooms.",
    media: [
      {
        src: "/images/drywall-concept-before.jpg",
        alt: "Room with newly hung drywall, seams taped and covered in fresh joint compound, metal corner bead on the outside corner",
        caption: "Board hung, seams taped and compounded",
      },
      {
        src: "/images/drywall-concept-after.jpg",
        alt: "The same room after finishing, walls flat and smooth under a uniform coat of white primer with no visible seams",
        caption: "Sanded flat and primed, ready for paint",
      },
    ],
    mediaNote: "Illustrations of the process, not photos of a specific project.",
    processTitle: "How It Works",
    processIntro: "From bare studs to a surface that's genuinely ready for primer.",
    processSteps: [
      {
        title: "Measure & Specify",
        desc: "We confirm what the space needs — standard 1/2 inch board, 5/8 inch Type X where fire rating is required, or moisture-resistant board in bathrooms and basements.",
      },
      {
        title: "Hang the Board",
        desc: "Sheets are cut and fastened to minimize joints, because every joint you avoid is one you never have to hide.",
      },
      {
        title: "Tape & Finish",
        desc: "Taping and plastering to the level the job calls for — Level 1/2 where it will be concealed, Level 4 where it gets primed and painted.",
      },
      {
        title: "Sand & Inspect",
        desc: "We sand and then check the surface under raking light, which is the only reliable way to catch a joint that will telegraph through paint.",
      },
    ],
    includesTitle: "What's Included",
    includesIntro: "The full range, from a fist-sized hole to a whole room.",
    includes: [
      {
        title: "New Drywall Installation",
        desc: "Standard, fire-rated Type X, and moisture-resistant board hung on walls and ceilings.",
      },
      {
        title: "Taping & Plastering",
        desc: "Finished to Level 1/2 or Level 4 depending on whether the surface stays concealed or gets painted.",
      },
      {
        title: "Patches of Any Size",
        desc: "From small repairs under a square foot up to large sections, blended into the surrounding wall.",
      },
      {
        title: "Skim Coating & Corner Bead",
        desc: "Skim coats to even out a tired surface, plus corner bead installed and finished for clean, durable edges.",
      },
    ],
  },
  fr: {
    eyebrow: "Installation et finition de gypse",
    title: "Du gypse droit, plat et prêt à peindre",
    intro:
      "Le gypse est la surface à laquelle tout le reste est comparé. Un joint ondulé ou un raccord visible ressort dès que la lumière l'atteint — le tirage de joints compte donc autant que les panneaux eux-mêmes. Nous posons, tirons, finissons et réparons le gypse à Laval et à Montréal, d'un simple raccord jusqu'à une pièce complète.",
    media: [
      {
        src: "/images/drywall-concept-before.jpg",
        alt: "Pièce avec gypse fraîchement posé, joints tirés et recouverts de composé, coin métallique sur l'angle saillant",
        caption: "Panneaux posés, joints tirés et plâtrés",
      },
      {
        src: "/images/drywall-concept-after.jpg",
        alt: "La même pièce après finition, murs plats et lisses sous une couche uniforme d'apprêt blanc, sans joints visibles",
        caption: "Sablé, plat et apprêté, prêt à peindre",
      },
    ],
    mediaNote: "Illustrations du processus, et non des photos d'un projet précis.",
    processTitle: "Comment ça fonctionne",
    processIntro: "Des montants nus jusqu'à une surface réellement prête pour l'apprêt.",
    processSteps: [
      {
        title: "Mesurer et spécifier",
        desc: "Nous confirmons ce dont l'espace a besoin — panneau standard de 1/2 pouce, 5/8 pouce type X là où une résistance au feu est requise, ou panneau hydrofuge dans les salles de bain et les sous-sols.",
      },
      {
        title: "Poser les panneaux",
        desc: "Les feuilles sont coupées et fixées de façon à réduire les joints, car chaque joint évité est un joint qu'on n'aura jamais à camoufler.",
      },
      {
        title: "Tirer les joints et plâtrer",
        desc: "Tirage de joints et plâtrage au niveau requis — niveau 1/2 là où la surface restera dissimulée, niveau 4 là où elle sera apprêtée et peinte.",
      },
      {
        title: "Sabler et inspecter",
        desc: "Nous sablons puis vérifions la surface en lumière rasante, la seule méthode fiable pour repérer un joint qui ressortirait à travers la peinture.",
      },
    ],
    includesTitle: "Ce qui est inclus",
    includesIntro: "Toute la gamme, d'un trou de la taille d'un poing à une pièce entière.",
    includes: [
      {
        title: "Installation de gypse neuf",
        desc: "Panneaux standard, type X résistant au feu et hydrofuges, posés sur les murs et les plafonds.",
      },
      {
        title: "Tirage de joints et plâtrage",
        desc: "Fini au niveau 1/2 ou au niveau 4 selon que la surface reste dissimulée ou sera peinte.",
      },
      {
        title: "Raccords de toute taille",
        desc: "De petites réparations de moins d'un pied carré jusqu'à de grandes sections, fondues dans le mur environnant.",
      },
      {
        title: "Ratissage et coins métalliques",
        desc: "Ratissage pour égaliser une surface fatiguée, et pose et finition de coins métalliques pour des arêtes nettes et durables.",
      },
    ],
  },
};

export default function DrywallContent() {
  const { locale } = useLanguage();
  return <ServiceDetailContent icon={IconHammer} copy={copy[locale]} />;
}
