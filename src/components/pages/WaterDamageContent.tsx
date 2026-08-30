"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import ServiceDetailContent, { type ServiceDetailCopy } from "./ServiceDetailContent";
import { IconDroplet } from "@/components/ui/icons";

const copy: Record<"en" | "fr", ServiceDetailCopy> = {
  en: {
    eyebrow: "Water Damage Restoration",
    title: "Fast Response When Water Damage Can't Wait",
    intro:
      "A leak or burst pipe gets worse every hour it sits, and it rarely waits for business hours. Our line is answered 24/7. Here's exactly what happens once you call us — from the first assessment to the final repair.",
    processTitle: "How It Works",
    processIntro: "The same four steps whether it's a small leak or a multi-unit emergency.",
    processSteps: [
      {
        title: "Call & Assessment",
        desc: "You call or message us with the details — any hour, any day. We ask a few questions to understand the scope and get a crew moving.",
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
    localContext: {
      heading: "Water damage in Laval housing stock",
      paragraphs: [
        "The clock matters more here than the calendar does. The EPA's benchmark is that wet material is very likely growing mould within 24 to 48 hours, and that window doesn't move for a Quebec winter — a pipe that lets go in a heated house in January behaves the same as one in July. What changes is access: burst supply lines cluster in the cold months, and the units that flood are often the ones nobody was standing in.",
        "The sector shapes the job. In Chomedey, roughly a third of the housing was built between 1960 and 1980, much of it multiplex and apartment stock where units share stacks and structure — so containment and access get planned before demolition starts, and conditions get documented in writing for syndicates and insurers. In Duvernay's El Rancho enclave the flat roofs create a different infiltration profile entirely, landing on ceilings and upper walls first rather than coming up from below.",
        "In finished basements across the 1950s-60s bungalow stock in sectors like Vimont, the damage is usually hidden behind something: subfloor under laminate, insulation behind studwork. That's why we open up enough to see what's actually wet rather than drying what's visible and hoping.",
        "Insurers and adjusters call this work post-disaster renovation (rénovation après sinistre), and the paperwork matters as much as the drying: moisture readings and photos logged from the first visit to the last, and a written scope your adjuster can process without a follow-up call. It's the same service either way — described the way your claim file describes it.",
      ],
      readMore: {
        label: "Read the hidden water damage and mould timeline",
        href: "/blog/hidden-water-damage-and-mold-timeline",
      },
    },
  },
  fr: {
    eyebrow: "Restauration de dégâts d'eau",
    title: "Une intervention rapide quand un dégât d'eau ne peut pas attendre",
    intro:
      "Une fuite ou un tuyau éclaté empire chaque heure qui passe, et attend rarement les heures d'ouverture. Notre ligne est répondue 24/7. Voici exactement ce qui se passe une fois que vous nous appelez — de la première évaluation à la réparation finale.",
    processTitle: "Comment ça fonctionne",
    processIntro: "Les quatre mêmes étapes, qu'il s'agisse d'une petite fuite ou d'une urgence sur plusieurs logements.",
    processSteps: [
      {
        title: "Appel et évaluation",
        desc: "Vous nous appelez ou nous écrivez avec les détails — à toute heure, tous les jours. Nous posons quelques questions pour comprendre l'ampleur des travaux et mobiliser une équipe.",
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
    localContext: {
      heading: "Les dégâts d'eau dans le parc immobilier lavallois",
      paragraphs: [
        "Le chronomètre compte plus que le calendrier. Selon l'EPA, un matériau encore humide développe très probablement de la moisissure en 24 à 48 heures, et cette fenêtre ne s'allonge pas parce qu'on est en hiver — un tuyau qui cède dans une maison chauffée en janvier se comporte comme en juillet. Ce qui change, c'est l'accès : les ruptures de conduites d'alimentation se concentrent en saison froide, et les logements inondés sont souvent ceux où personne ne se trouvait.",
        "Le secteur détermine le chantier. À Chomedey, environ le tiers du parc a été bâti entre 1960 et 1980, en bonne partie des multiplex et des immeubles à logements où les unités partagent colonnes et structure — le confinement et les accès sont donc planifiés avant le début de la démolition, et l'état des lieux est consigné par écrit pour les syndicats et les assureurs. Dans l'enclave El Rancho à Duvernay, les toits plats créent un profil d'infiltration tout autre, qui touche d'abord les plafonds et le haut des murs plutôt que de remonter du sous-sol.",
        "Dans les sous-sols finis du parc de bungalows des années 1950-60, à Vimont notamment, les dommages sont presque toujours cachés derrière quelque chose : le sous-plancher sous un flottant, l'isolant derrière la charpente. C'est pourquoi nous ouvrons assez pour voir ce qui est réellement mouillé, au lieu de sécher ce qui est visible en espérant que ça suffise.",
        "Les assureurs et les experts en sinistre appellent ce travail la rénovation après sinistre, et la documentation compte autant que le séchage : relevés d'humidité et photos consignés de la première visite à la dernière, et un devis écrit que votre expert peut traiter sans appel de suivi. C'est le même service dans les deux cas — décrit comme votre dossier de réclamation le décrit.",
      ],
      readMore: {
        label: "Lire l'article sur les dégâts d'eau cachés et la moisissure",
        href: "/blog/hidden-water-damage-and-mold-timeline",
      },
    },
  },
};

export default function WaterDamageContent() {
  const { locale } = useLanguage();
  return <ServiceDetailContent icon={IconDroplet} copy={copy[locale]} />;
}
