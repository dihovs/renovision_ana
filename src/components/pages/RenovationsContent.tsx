"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import ServiceDetailContent, { type ServiceDetailCopy } from "./ServiceDetailContent";
import { IconHammer } from "@/components/ui/icons";

const copy: Record<"en" | "fr", ServiceDetailCopy> = {
  en: {
    eyebrow: "Interior Renovations",
    title: "Renovations for Any Room, Residential or Commercial",
    intro:
      "Bedrooms, living rooms, offices — if it's an interior space, we can take it from outdated to done right. Here's how the process works.",
    processTitle: "How It Works",
    processIntro: "The same clear process regardless of which room or how big the job is.",
    processSteps: [
      {
        title: "Walkthrough & Scope",
        desc: "We look at the space in person or by photo and talk through what you want changed and why.",
      },
      {
        title: "Design & Estimate",
        desc: "You get an itemized estimate covering materials and labor, so there are no surprises once work starts.",
      },
      {
        title: "Construction",
        desc: "Our crew handles the work on the agreed timeline, keeping the space as clean and livable as the job allows.",
      },
      {
        title: "Final Walkthrough",
        desc: "We walk the finished space with you and address anything before calling the job complete.",
      },
    ],
    includesTitle: "What's Included",
    includesIntro: "Renovation work scoped to fit the room, not a one-size-fits-all package.",
    includes: [
      {
        title: "Layout Changes & Wall Removal",
        desc: "Opening up a room or reconfiguring a layout, handled with the right permits and structural know-how.",
      },
      {
        title: "Flooring, Paint & Trim",
        desc: "The finishing work that actually changes how a room feels, done as part of the same project.",
      },
      {
        title: "Lighting & Electrical Updates",
        desc: "Fixtures, outlets, and wiring updated to match the new layout and use of the space.",
      },
      {
        title: "Any Room, Residential or Commercial",
        desc: "Bedrooms, living rooms, home offices, or light commercial interiors — same standard of work across all of them.",
      },
    ],
    localContext: {
      heading: "Renovating Laval's post-war housing",
      paragraphs: [
        "A lot of this work is opening up layouts that made sense in 1958 and don't now. The 1950s-60s bungalow stock — Vimont is almost entirely that era — was built with small, closed rooms, so the common request is removing a wall between kitchen and living space. That's a structural question before it's a design one, and we establish whether a wall is load-bearing before anyone starts picking finishes.",
        "Homes of that age also tend to have dated finishes sitting on systems that have reached the end of their service life. It's worth knowing which of the two you're dealing with, because replacing finishes over tired systems means opening the same walls again in a few years.",
        "In condo and multiplex work, the paperwork matters as much as the trade. Quebec's Bill 16 now requires every syndicate to obtain a contingency fund study by August 2028, and once a building has a repair timeline, common-area work tends to get planned rather than deferred.",
      ],
      readMore: {
        label: "Read what Bill 16 means for condo syndicates",
        href: "/blog/quebec-bill-16-condo-contingency-fund-study",
      },
    },
  },
  fr: {
    eyebrow: "Rénovations intérieures",
    title: "Rénovations pour toute pièce, résidentielle ou commerciale",
    intro:
      "Chambres, salons, bureaux — si c'est un espace intérieur, nous pouvons le faire passer de désuet à bien fait. Voici comment fonctionne le processus.",
    processTitle: "Comment ça fonctionne",
    processIntro: "Le même processus clair, peu importe la pièce ou l'ampleur du projet.",
    processSteps: [
      {
        title: "Visite et portée du projet",
        desc: "Nous examinons l'espace en personne ou par photos et discutons de ce que vous voulez changer et pourquoi.",
      },
      {
        title: "Conception et estimation",
        desc: "Vous recevez une estimation détaillée couvrant les matériaux et la main-d'œuvre, sans surprise une fois les travaux commencés.",
      },
      {
        title: "Construction",
        desc: "Notre équipe effectue les travaux selon l'échéancier convenu, en gardant l'espace aussi propre et habitable que possible.",
      },
      {
        title: "Visite finale",
        desc: "Nous parcourons l'espace terminé avec vous et corrigeons tout avant de déclarer le projet complété.",
      },
    ],
    includesTitle: "Ce qui est inclus",
    includesIntro: "Des travaux de rénovation adaptés à la pièce, pas une formule universelle.",
    includes: [
      {
        title: "Modification d'aménagement et retrait de murs",
        desc: "Ouvrir une pièce ou reconfigurer un aménagement, réalisé avec les permis appropriés et le savoir-faire structurel nécessaire.",
      },
      {
        title: "Plancher, peinture et moulures",
        desc: "Les travaux de finition qui changent réellement l'ambiance d'une pièce, réalisés dans le cadre du même projet.",
      },
      {
        title: "Mise à jour de l'éclairage et de l'électricité",
        desc: "Luminaires, prises et câblage mis à jour pour s'adapter au nouvel aménagement et à l'usage de l'espace.",
      },
      {
        title: "Toute pièce, résidentielle ou commerciale",
        desc: "Chambres, salons, bureaux à domicile ou espaces commerciaux légers — la même norme de travail pour tous.",
      },
    ],
    localContext: {
      heading: "Rénover le parc immobilier d'après-guerre de Laval",
      paragraphs: [
        "Une bonne partie de ce travail consiste à ouvrir des aménagements qui avaient du sens en 1958 et qui n'en ont plus. Le parc de bungalows des années 1950-60 — Vimont en est presque entièrement constitué — a été bâti avec de petites pièces fermées; la demande courante est donc d'abattre un mur entre la cuisine et l'aire de vie. C'est une question structurale avant d'être une question de design, et nous déterminons si un mur est porteur avant que quiconque choisisse des finis.",
        "Les maisons de cet âge présentent aussi souvent des finis désuets posés sur des systèmes arrivés en fin de vie utile. Il vaut la peine de savoir auquel des deux on a affaire, car remplacer les finis par-dessus des systèmes fatigués signifie rouvrir les mêmes murs dans quelques années.",
        "En copropriété et en multiplex, la paperasse compte autant que le métier. La loi 16 du Québec exige désormais que chaque syndicat obtienne une étude du fonds de prévoyance d'ici le 14 août 2028, et une fois qu'un immeuble dispose d'un calendrier de travaux, les rénovations des parties communes tendent à être planifiées plutôt que reportées.",
      ],
      readMore: {
        label: "Lire ce que la loi 16 implique pour les syndicats de copropriété",
        href: "/blog/quebec-bill-16-condo-contingency-fund-study",
      },
    },
  },
};

export default function RenovationsContent() {
  const { locale } = useLanguage();
  return <ServiceDetailContent icon={IconHammer} copy={copy[locale]} />;
}
