"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import ServiceDetailContent, { type ServiceDetailCopy } from "./ServiceDetailContent";
import { IconDroplet } from "@/components/ui/icons";
import { WATER_DAMAGE_FAQ } from "@/lib/serviceFaq";

const copy: Record<"en" | "fr", ServiceDetailCopy> = {
  en: {
    eyebrow: "Water Damage Restoration",
    title: "Fast Response When Water Damage Can't Wait",
    intro:
      "A leak or burst pipe gets worse every hour it sits, and it rarely waits for business hours. Our line is answered 24/7. Here's exactly what happens once you call us — from the first assessment to the final repair.",
    processTitle: "How It Works",
    processIntro: "The same four steps whether it's a small leak or a multi-unit emergency.",
    checklist: {
      title: "What to do in case of water damage",
      intro: "The first minutes count. Here's what you can do while you wait for our crew.",
      steps: [
        {
          number: 1,
          title: "Stop the water at the source",
          desc: "If you can safely reach the shut-off valve on the leaking pipe, close it. If you don't know which one it is, close the main water supply. Knowing where that valve is before a pipe fails is the cheapest maintenance step there is.",
        },
        {
          number: 2,
          title: "Kill power to the affected area",
          desc: "Go to the electrical panel and switch off the breaker for the wet rooms. Do NOT touch any switch or outlet while standing in water. If the panel is in a wet area, call Hydro-Quebec (514 385-7257 in Montreal, 450 646-6500 in Laval) or 911 instead.",
        },
        {
          number: 3,
          title: "Document everything before you move it",
          desc: "Take photos and video of every affected room — the standing water, wet walls, dripping ceilings. This is the record your insurer works from, and you only get one shot. Don't throw anything out before the condition is recorded.",
        },
        {
          number: 4,
          title: "Move what you can lift out of the water",
          desc: "Move small furniture, boxes, rugs, and valuables to a dry area. Leave heavy items (sofas, appliances) where they are — dragging them across wet flooring causes more damage.",
        },
        {
          number: 5,
          title: "Call your insurer, then call us",
          desc: "Your policy requires prompt notification. Then call us at 579-999-5979 — the line is answered at any hour. We arrive with pumps, dehumidifiers, and everything needed to limit the damage.",
        },
      ],
    },
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
      alsoSee: {
        label: "Damage to a ceiling? What to do, and who pays",
        href: "/services/water-damage/ceiling",
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
    checklist: {
      title: "Quoi faire en cas de dégât d'eau",
      intro: "Les premières minutes comptent. Voici ce qu'on peut faire en attendant notre arrivée.",
      steps: [
        {
          number: 1,
          title: "Fermez l'eau à la source",
          desc: "Si vous pouvez atteindre le robinet d'arrêt ou la valve de la conduite qui fuit sans danger, fermez-la. Si vous ne savez pas où elle se trouve, fermez l'entrée d'eau principale. Savoir où se trouve cette valve avant qu'un tuyau ne cède est le geste d'entretien qui coûte le moins cher.",
        },
        {
          number: 2,
          title: "Coupez l'électricité dans la zone touchée",
          desc: "Rendez-vous au panneau électrique et coupez le disjoncteur des pièces inondées. Ne touchez à AUCUN interrupteur ou prise électrique si vous êtes debout dans l'eau. Si le panneau est dans une zone mouillée, appelez Hydro-Québec (514 385-7257 à Montréal, 450 646-6500 à Laval) ou le 911 plutôt que d'y toucher.",
        },
        {
          number: 3,
          title: "Photographiez tout avant de déplacer quoi que ce soit",
          desc: "Prenez des photos et vidéos de chaque pièce touchée, de l'eau au sol, des murs mouillés, des plafonds qui gouttent. C'est ce dossier que votre assureur regardera, et il n'existe qu'une fois. Ne jetez rien avant d'avoir documenté l'état des lieux.",
        },
        {
          number: 4,
          title: "Sortez de l'eau ce que vous pouvez soulever",
          desc: "Déplacez les petits meubles, les cartons, les tapis et les objets de valeur vers une zone sèche. Laissez les meubles lourds (divans, électroménagers) là où ils sont — les traîner sur un plancher mouillé l'endommagerait davantage.",
        },
        {
          number: 5,
          title: "Appelez votre assureur, puis appelez-nous",
          desc: "Votre police exige que vous déclariez le sinistre rapidement. Ensuite, appelez-nous au 579-999-5979 — la ligne est répondue à toute heure. On arrive avec les pompes, les déshumidificateurs et tout ce qu'il faut pour limiter les dégâts.",
        },
      ],
    },
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
      alsoSee: {
        label: "Un dégât au plafond? Quoi faire, et qui paie",
        href: "/services/water-damage/ceiling",
      },
    },
  },
};

export default function WaterDamageContent() {
  const { locale } = useLanguage();
  // FAQ merged in here rather than written into `copy` above, so the strings
  // stay in the one module the page's FAQPage schema also reads from.
  return (
    <ServiceDetailContent
      icon={IconDroplet}
      copy={{ ...copy[locale], faq: WATER_DAMAGE_FAQ[locale] }}
    />
  );
}
