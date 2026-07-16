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
  },
};

export default function RenovationsContent() {
  const { locale } = useLanguage();
  return <ServiceDetailContent icon={IconHammer} copy={copy[locale]} />;
}
