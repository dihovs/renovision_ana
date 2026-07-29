"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import ServiceDetailContent, { type ServiceDetailCopy } from "./ServiceDetailContent";
import { IconWrench } from "@/components/ui/icons";

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
    localContext: {
      heading: "Why small repairs are their own trade here",
      paragraphs: [
        "A lot of this work comes from Chomedey and the surrounding multiplex stock, where roughly a third of the housing was built between 1960 and 1980. Tenant turnover in those buildings generates a steady stream of small, awkward jobs — a patched wall, a cracked tile, a water-stained section of trim — that most contractors won't schedule because they're too small to be worth mobilizing for.",
        "The hard part is almost never the repair itself, it's the match. Paint that has been on a wall for fifteen years is no longer the colour it started as, and tile from a discontinued line has to be sourced or approximated. Matching against the aged finish rather than the original spec is what decides whether a patch disappears or announces itself.",
        "In occupied units that also means working around people. Containment, dust control and access get planned in advance, and the job gets finished in one visit wherever it can be, because a tenant living around an unfinished repair is its own kind of cost.",
      ],
      readMore: {
        label: "See how we work with property managers",
        href: "/commercial",
      },
    },
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
    localContext: {
      heading: "Pourquoi les petites réparations sont un métier en soi",
      paragraphs: [
        "Une bonne part de ce travail vient de Chomedey et du parc de multiplex environnant, où environ le tiers des logements ont été bâtis entre 1960 et 1980. Le roulement des locataires dans ces immeubles génère un flux constant de petits travaux ingrats — un mur à reboucher, une céramique fissurée, une section de moulure tachée par l'eau — que la plupart des entrepreneurs refusent de planifier parce qu'ils sont trop petits pour justifier un déplacement.",
        "Le plus difficile n'est presque jamais la réparation elle-même, c'est l'agencement. Une peinture appliquée il y a quinze ans n'a plus la couleur de départ, et une céramique d'une gamme discontinuée doit être trouvée ou approchée. C'est le fait de s'agencer au fini vieilli plutôt qu'à la spécification d'origine qui détermine si un raccord disparaît ou se remarque.",
        "Dans les logements occupés, cela signifie aussi travailler autour des gens. Confinement, contrôle de la poussière et accès sont planifiés d'avance, et le travail se termine en une seule visite chaque fois que c'est possible, parce qu'un locataire qui vit autour d'une réparation inachevée représente un coût en soi.",
      ],
      readMore: {
        label: "Voir comment nous travaillons avec les gestionnaires immobiliers",
        href: "/commercial",
      },
    },
  },
};

export default function RepairsContent() {
  const { locale } = useLanguage();
  return <ServiceDetailContent icon={IconWrench} copy={copy[locale]} />;
}
