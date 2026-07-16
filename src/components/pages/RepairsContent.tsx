"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import ServiceDetailContent, { type ServiceDetailCopy } from "./ServiceDetailContent";
import { IconBrush } from "@/components/ui/icons";

const copy: Record<"en" | "fr", ServiceDetailCopy> = {
  en: {
    eyebrow: "Small Repairs & Color Matching",
    title: "Repairs That Blend In, Not Stand Out",
    intro:
      "Not every job needs a full renovation. Sometimes it's a scuffed wall, a cracked tile, or a water-stained section of trim — and matching the existing finish is the hard part. Here's how we approach it.",
    processTitle: "How It Works",
    processIntro: "Small jobs, handled with the same care as a full remodel.",
    processSteps: [
      {
        title: "Assessment",
        desc: "We look at the damage in person or by photo and check what the existing material, paint, or finish actually is.",
      },
      {
        title: "Color & Material Matching",
        desc: "We source or mix material as close to the original as possible — this is the step that makes or breaks a repair.",
      },
      {
        title: "Repair Work",
        desc: "The actual fix, done carefully so the edges blend rather than leaving an obvious patch.",
      },
      {
        title: "Final Inspection",
        desc: "We check the repair against the surrounding area in real light before calling it finished.",
      },
    ],
    includesTitle: "What's Included",
    includesIntro: "The small jobs other contractors don't want, done properly.",
    includes: [
      {
        title: "Drywall & Paint Touch-Ups",
        desc: "Holes, scuffs, and water stains repaired and painted to match the surrounding wall.",
      },
      {
        title: "Tile & Flooring Patch Repairs",
        desc: "Cracked or damaged tile and flooring sections replaced without redoing the whole room.",
      },
      {
        title: "Trim & Baseboard Fixes",
        desc: "Damaged trim and baseboards repaired or replaced and finished to match what's already there.",
      },
      {
        title: "Precise Color Matching",
        desc: "The detail work that makes a repair disappear into the existing finish instead of standing out.",
      },
    ],
  },
  fr: {
    eyebrow: "Petites réparations et agencement de couleurs",
    title: "Des réparations qui se fondent, pas qui ressortent",
    intro:
      "Chaque projet n'a pas besoin d'une rénovation complète. Parfois c'est un mur éraflé, une céramique fissurée ou une section de moulure tachée par l'eau — et agencer la finition existante est la partie difficile. Voici comment nous l'abordons.",
    processTitle: "Comment ça fonctionne",
    processIntro: "De petits travaux, traités avec le même soin qu'une rénovation complète.",
    processSteps: [
      {
        title: "Évaluation",
        desc: "Nous examinons les dommages en personne ou par photos et vérifions le matériau, la peinture ou la finition existants.",
      },
      {
        title: "Agencement des couleurs et matériaux",
        desc: "Nous trouvons ou mélangeons un matériau le plus près possible de l'original — c'est l'étape qui fait la différence dans une réparation.",
      },
      {
        title: "Travaux de réparation",
        desc: "La réparation elle-même, effectuée avec soin pour que les bords se fondent plutôt que de laisser un raccord visible.",
      },
      {
        title: "Inspection finale",
        desc: "Nous comparons la réparation à la zone environnante à la lumière réelle avant de la déclarer terminée.",
      },
    ],
    includesTitle: "Ce qui est inclus",
    includesIntro: "Les petits travaux que d'autres entrepreneurs ne veulent pas faire, réalisés correctement.",
    includes: [
      {
        title: "Retouches de gypse et de peinture",
        desc: "Trous, éraflures et taches d'eau réparés et peints pour s'agencer au mur environnant.",
      },
      {
        title: "Réparations ponctuelles de céramique et de plancher",
        desc: "Sections de céramique ou de plancher fissurées ou endommagées remplacées sans refaire toute la pièce.",
      },
      {
        title: "Réparation des moulures et plinthes",
        desc: "Moulures et plinthes endommagées réparées ou remplacées et finies pour s'agencer à l'existant.",
      },
      {
        title: "Agencement précis des couleurs",
        desc: "Le travail de détail qui fait disparaître une réparation dans la finition existante plutôt que de la faire ressortir.",
      },
    ],
  },
};

export default function RepairsContent() {
  const { locale } = useLanguage();
  return <ServiceDetailContent icon={IconBrush} copy={copy[locale]} />;
}
