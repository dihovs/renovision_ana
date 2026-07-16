"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import ServiceDetailContent, { type ServiceDetailCopy } from "./ServiceDetailContent";
import { IconKitchen } from "@/components/ui/icons";

const copy: Record<"en" | "fr", ServiceDetailCopy> = {
  en: {
    eyebrow: "Kitchens & Bathrooms",
    title: "Kitchen & Bathroom Remodels, Start to Finish",
    intro:
      "These are the two rooms that matter most for daily life and resale value. Here's what the process looks like, from first idea to final walkthrough.",
    processTitle: "How It Works",
    processIntro: "A clear sequence so you always know what's next.",
    processSteps: [
      {
        title: "Design Consultation",
        desc: "We talk through what's not working in the current layout and what you actually want the finished space to do.",
      },
      {
        title: "Estimate & Material Selection",
        desc: "You get an itemized estimate and pick cabinetry, counters, tile, and fixtures before any demolition starts.",
      },
      {
        title: "Demolition & Rough-In",
        desc: "Old fixtures and finishes come out, then plumbing and electrical are roughed in for the new layout.",
      },
      {
        title: "Installation & Final Walkthrough",
        desc: "Cabinetry, counters, tile, and fixtures go in, followed by a walkthrough where you sign off on the finished room.",
      },
    ],
    includesTitle: "What's Included",
    includesIntro: "The full scope of a kitchen or bathroom remodel, coordinated for you.",
    includes: [
      {
        title: "Cabinetry & Countertops",
        desc: "New cabinetry and counters selected and installed to fit your layout and budget.",
      },
      {
        title: "Plumbing & Electrical Coordination",
        desc: "Sinks, fixtures, and wiring moved or updated as part of the same project, not a separate call to another trade.",
      },
      {
        title: "Tile & Shower Surrounds",
        desc: "Backsplashes, shower surrounds, and floor tile installed as part of the full remodel.",
      },
      {
        title: "Fixtures & Lighting",
        desc: "Faucets, sinks, tubs, and lighting updated to match the finished look of the room.",
      },
    ],
  },
  fr: {
    eyebrow: "Cuisines et salles de bain",
    title: "Rénovation de cuisine et salle de bain, du début à la fin",
    intro:
      "Ce sont les deux pièces qui comptent le plus pour la vie quotidienne et la valeur de revente. Voici à quoi ressemble le processus, de la première idée à la visite finale.",
    processTitle: "Comment ça fonctionne",
    processIntro: "Une séquence claire pour que vous sachiez toujours ce qui suit.",
    processSteps: [
      {
        title: "Consultation design",
        desc: "Nous discutons de ce qui ne fonctionne pas dans l'aménagement actuel et de ce que vous voulez vraiment que l'espace terminé offre.",
      },
      {
        title: "Estimation et choix des matériaux",
        desc: "Vous recevez une estimation détaillée et choisissez les armoires, comptoirs, céramique et robinetterie avant le début de la démolition.",
      },
      {
        title: "Démolition et mise à niveau",
        desc: "Les anciennes finitions et accessoires sont retirés, puis la plomberie et l'électricité sont préparées pour le nouvel aménagement.",
      },
      {
        title: "Installation et visite finale",
        desc: "Armoires, comptoirs, céramique et robinetterie sont installés, suivis d'une visite où vous approuvez la pièce terminée.",
      },
    ],
    includesTitle: "Ce qui est inclus",
    includesIntro: "L'ensemble d'une rénovation de cuisine ou de salle de bain, coordonné pour vous.",
    includes: [
      {
        title: "Armoires et comptoirs",
        desc: "Nouvelles armoires et comptoirs choisis et installés selon votre aménagement et votre budget.",
      },
      {
        title: "Coordination plomberie et électricité",
        desc: "Éviers, robinetterie et câblage déplacés ou mis à jour dans le cadre du même projet, sans appel séparé à un autre corps de métier.",
      },
      {
        title: "Céramique et pourtours de douche",
        desc: "Dosserets, pourtours de douche et céramique de plancher installés dans le cadre de la rénovation complète.",
      },
      {
        title: "Robinetterie et éclairage",
        desc: "Robinets, éviers, baignoires et éclairage mis à jour pour compléter l'apparence finale de la pièce.",
      },
    ],
  },
};

export default function KitchenBathContent() {
  const { locale } = useLanguage();
  return <ServiceDetailContent icon={IconKitchen} copy={copy[locale]} />;
}
