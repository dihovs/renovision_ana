"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import ServiceDetailContent, { type ServiceDetailCopy } from "./ServiceDetailContent";
import { IconDroplet } from "@/components/ui/icons";

const copy: Record<"en" | "fr", ServiceDetailCopy> = {
  en: {
    eyebrow: "Water Damage Restoration",
    title: "Fast Response When Water Damage Can't Wait",
    intro:
      "A leak or burst pipe gets worse every hour it sits. Here's exactly what happens once you call us — from the first assessment to the final repair.",
    processTitle: "How It Works",
    processIntro: "The same four steps whether it's a small leak or a multi-unit emergency.",
    processSteps: [
      {
        title: "Call & Assessment",
        desc: "You call or message us with the details. We ask a few questions to understand the scope and get a crew moving.",
      },
      {
        title: "Extraction & Containment",
        desc: "We remove standing water and contain the affected area to stop damage from spreading to unaffected rooms.",
      },
      {
        title: "Drying & Monitoring",
        desc: "Industrial drying equipment runs for as long as moisture readings require — we check and log readings until the space is dry.",
      },
      {
        title: "Repair & Restoration",
        desc: "Drywall, insulation, flooring, and paint go back in, coordinated so you're not waiting on a separate contractor for each step.",
      },
    ],
    includesTitle: "What's Included",
    includesIntro: "Everything handled under one roof, with documentation you can actually use.",
    includes: [
      {
        title: "Moisture Detection & Documentation",
        desc: "Moisture readings and photos logged from first visit to final walkthrough — ready for an insurance claim.",
      },
      {
        title: "Water Extraction",
        desc: "Pumps and extraction equipment sized to the job, deployed the same day whenever possible.",
      },
      {
        title: "Structural Drying",
        desc: "Drywall, subfloor, and insulation dried in place or removed and replaced where needed to prevent mold.",
      },
      {
        title: "Full Repair & Rebuild",
        desc: "Flooring, paint, trim, and finishing work completed by the same crew that handled the extraction.",
      },
    ],
  },
  fr: {
    eyebrow: "Restauration de dégâts d'eau",
    title: "Une intervention rapide quand un dégât d'eau ne peut pas attendre",
    intro:
      "Une fuite ou un tuyau éclaté empire chaque heure qui passe. Voici exactement ce qui se passe une fois que vous nous appelez — de la première évaluation à la réparation finale.",
    processTitle: "Comment ça fonctionne",
    processIntro: "Les quatre mêmes étapes, qu'il s'agisse d'une petite fuite ou d'une urgence sur plusieurs logements.",
    processSteps: [
      {
        title: "Appel et évaluation",
        desc: "Vous nous appelez ou nous écrivez avec les détails. Nous posons quelques questions pour comprendre l'ampleur des travaux et mobiliser une équipe.",
      },
      {
        title: "Extraction et confinement",
        desc: "Nous retirons l'eau stagnante et confinons la zone touchée pour éviter que les dégâts ne se propagent aux pièces non touchées.",
      },
      {
        title: "Séchage et suivi",
        desc: "L'équipement de séchage industriel fonctionne aussi longtemps que les relevés d'humidité l'exigent — nous vérifions et consignons les relevés jusqu'à ce que l'espace soit sec.",
      },
      {
        title: "Réparation et restauration",
        desc: "Le gypse, l'isolation, le plancher et la peinture sont remis en place, coordonnés pour que vous n'ayez pas à attendre un entrepreneur différent pour chaque étape.",
      },
    ],
    includesTitle: "Ce qui est inclus",
    includesIntro: "Tout géré sous un même toit, avec une documentation que vous pouvez vraiment utiliser.",
    includes: [
      {
        title: "Détection d'humidité et documentation",
        desc: "Relevés d'humidité et photos consignés de la première visite à la visite finale — prêts pour une réclamation d'assurance.",
      },
      {
        title: "Extraction d'eau",
        desc: "Pompes et équipement d'extraction adaptés au travail, déployés le jour même dans la mesure du possible.",
      },
      {
        title: "Séchage structurel",
        desc: "Gypse, sous-plancher et isolation séchés sur place ou retirés et remplacés au besoin pour prévenir la moisissure.",
      },
      {
        title: "Réparation et reconstruction complètes",
        desc: "Plancher, peinture, moulures et finition réalisés par la même équipe qui a effectué l'extraction.",
      },
    ],
  },
};

export default function WaterDamageContent() {
  const { locale } = useLanguage();
  return <ServiceDetailContent icon={IconDroplet} copy={copy[locale]} />;
}
