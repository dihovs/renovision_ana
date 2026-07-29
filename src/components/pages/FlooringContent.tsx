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
    localContext: {
      heading: "Flooring in older Laval housing",
      paragraphs: [
        "Most of the flooring we replace sits on a subfloor that predates it by decades. In the 1950s-60s bungalow stock that dominates sectors like Vimont, and in the mixed pre-1960 to 1980s stock across Chomedey, what's underneath is rarely flat and occasionally soft. That gets checked before anything is ordered, because a level finish over an unlevel subfloor is a warranty claim waiting to happen.",
        "Basements are their own case. On slabs poured before modern moisture detailing, the material choice matters more than the look — which is the difference between flooring that lasts and flooring that cups the first humid spring.",
        "Where flooring is being replaced after water damage, the sequence is not negotiable: the subfloor gets opened up and dried properly first. Laying new material over a subfloor that's still holding moisture traps it there, and the problem resurfaces months later as cupping, odour, or worse.",
      ],
      readMore: {
        label: "See how we handle water damage first",
        href: "/services/water-damage",
      },
    },
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
    localContext: {
      heading: "Les revêtements de sol dans le parc immobilier ancien",
      paragraphs: [
        "La plupart des planchers que nous remplaçons reposent sur un sous-plancher qui les précède de plusieurs décennies. Dans le parc de bungalows des années 1950-60 qui domine des secteurs comme Vimont, et dans le parc mixte d'avant 1960 aux années 1980 à Chomedey, ce qui se trouve dessous est rarement de niveau et parfois ramolli. Nous le vérifions avant toute commande, car un fini de niveau sur un sous-plancher qui ne l'est pas mène droit à une réclamation de garantie.",
        "Les sous-sols sont un cas à part. Sur des dalles coulées avant les pratiques modernes de gestion de l'humidité, le choix du matériau compte plus que l'apparence — c'est la différence entre un plancher qui dure et un plancher qui tuile au premier printemps humide.",
        "Quand un plancher est remplacé après un dégât d'eau, la séquence n'est pas négociable : le sous-plancher est d'abord ouvert et asséché correctement. Poser un matériau neuf sur un sous-plancher encore humide y emprisonne l'eau, et le problème refait surface des mois plus tard sous forme de tuilage, d'odeurs ou pire.",
      ],
      readMore: {
        label: "Voir comment nous traitons d'abord les dégâts d'eau",
        href: "/services/water-damage",
      },
    },
  },
};

export default function FlooringContent() {
  const { locale } = useLanguage();
  return <ServiceDetailContent icon={IconTiles} copy={copy[locale]} />;
}
