"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import ServiceDetailContent, { type ServiceDetailCopy } from "./ServiceDetailContent";
import { IconTiles } from "@/components/ui/icons";

const copy: Record<"en" | "fr", ServiceDetailCopy> = {
  en: {
    eyebrow: "Flooring",
    title: "Tile, Hardwood & Vinyl Flooring, Installed Right",
    intro:
      "New flooring changes how a room feels more than almost anything else. Here's how we take you from a worn-out floor to a finished one.",
    processTitle: "How It Works",
    processIntro: "From first measurement to the final trim piece.",
    processSteps: [
      {
        title: "In-Home Consultation",
        desc: "We measure the space, look at subfloor condition, and talk through the materials that fit your budget and use case.",
      },
      {
        title: "Material Selection",
        desc: "Tile, hardwood, or luxury vinyl plank — we help you pick something that matches the room and holds up to how you'll use it.",
      },
      {
        title: "Removal & Subfloor Prep",
        desc: "Old flooring comes out, the subfloor gets leveled or repaired, and the space is ready for a clean install.",
      },
      {
        title: "Installation & Finishing",
        desc: "New flooring goes in, followed by trim, transitions, and a final walkthrough so nothing's left half-done.",
      },
    ],
    includesTitle: "What's Included",
    includesIntro: "Every step from old floor to new, handled by one crew.",
    includes: [
      {
        title: "Tile, Hardwood & Vinyl Plank",
        desc: "We work with the flooring types most common in homes and light commercial spaces — you're not limited to one material.",
      },
      {
        title: "Old Flooring Removal & Disposal",
        desc: "Existing flooring removed and hauled away — one less thing for you to arrange separately.",
      },
      {
        title: "Subfloor Leveling & Repair",
        desc: "Uneven or damaged subfloor addressed before installation so the new floor sits flat and lasts.",
      },
      {
        title: "Trim & Transition Finishing",
        desc: "Baseboards, thresholds, and transitions between rooms finished cleanly, not left as an afterthought.",
      },
    ],
  },
  fr: {
    eyebrow: "Planchers",
    title: "Céramique, bois franc et vinyle, installés correctement",
    intro:
      "Un nouveau plancher change l'ambiance d'une pièce plus que presque tout le reste. Voici comment nous vous accompagnons d'un plancher usé à un plancher terminé.",
    processTitle: "Comment ça fonctionne",
    processIntro: "De la première mesure à la dernière moulure.",
    processSteps: [
      {
        title: "Consultation à domicile",
        desc: "Nous mesurons l'espace, examinons l'état du sous-plancher et discutons des matériaux qui conviennent à votre budget et à votre usage.",
      },
      {
        title: "Choix des matériaux",
        desc: "Céramique, bois franc ou vinyle de luxe — nous vous aidons à choisir un revêtement qui convient à la pièce et qui résiste à l'usage prévu.",
      },
      {
        title: "Retrait et préparation du sous-plancher",
        desc: "L'ancien plancher est retiré, le sous-plancher est nivelé ou réparé, et l'espace est prêt pour une installation propre.",
      },
      {
        title: "Installation et finition",
        desc: "Le nouveau plancher est posé, suivi des moulures, des seuils de transition et d'une visite finale pour que rien ne reste inachevé.",
      },
    ],
    includesTitle: "Ce qui est inclus",
    includesIntro: "Chaque étape, de l'ancien plancher au nouveau, gérée par une seule équipe.",
    includes: [
      {
        title: "Céramique, bois franc et vinyle de luxe",
        desc: "Nous travaillons avec les types de plancher les plus courants dans les maisons et les espaces commerciaux légers — vous n'êtes pas limité à un seul matériau.",
      },
      {
        title: "Retrait et disposition de l'ancien plancher",
        desc: "Le plancher existant est retiré et évacué — une chose de moins à organiser vous-même.",
      },
      {
        title: "Nivellement et réparation du sous-plancher",
        desc: "Un sous-plancher inégal ou endommagé est corrigé avant l'installation pour que le nouveau plancher soit plat et durable.",
      },
      {
        title: "Finition des moulures et transitions",
        desc: "Plinthes, seuils et transitions entre les pièces finis proprement, pas laissés en plan.",
      },
    ],
  },
};

export default function FlooringContent() {
  const { locale } = useLanguage();
  return <ServiceDetailContent icon={IconTiles} copy={copy[locale]} />;
}
