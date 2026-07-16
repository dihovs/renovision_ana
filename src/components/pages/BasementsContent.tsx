"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import ServiceDetailContent, { type ServiceDetailCopy } from "./ServiceDetailContent";
import { IconStairs } from "@/components/ui/icons";

const copy: Record<"en" | "fr", ServiceDetailCopy> = {
  en: {
    eyebrow: "Basement Transformations",
    title: "From Unfinished Storage Space to a Room You Actually Use",
    intro:
      "An unfinished basement is wasted square footage. Here's how we turn bare concrete and exposed framing into a livable, dry room.",
    processTitle: "How It Works",
    processIntro: "Moisture gets addressed first — every time, no exceptions.",
    processSteps: [
      {
        title: "Inspection & Moisture Check",
        desc: "We check for moisture issues before anything else. A basement build-out over an unresolved moisture problem doesn't hold up.",
      },
      {
        title: "Design & Planning",
        desc: "We plan the layout — media room, extra bedroom, play area — and handle any permits the build requires.",
      },
      {
        title: "Framing, Insulation & Build-Out",
        desc: "Framing, insulation, drywall, and rough electrical go in, followed by whatever finishes the layout calls for.",
      },
      {
        title: "Finishing & Walkthrough",
        desc: "Flooring, lighting, and trim complete the space, then we walk it with you before calling it done.",
      },
    ],
    includesTitle: "What's Included",
    includesIntro: "A full build-out, not just paint over a problem.",
    includes: [
      {
        title: "Moisture Correction",
        desc: "Any moisture issue gets corrected at the source before framing starts — the foundation of a basement that stays dry.",
      },
      {
        title: "Framing, Insulation & Drywall",
        desc: "A proper interior build-out, insulated and finished to match the rest of the home.",
      },
      {
        title: "Flooring & Lighting",
        desc: "Flooring suited to a below-grade space, plus lighting that makes the room feel like part of the house.",
      },
      {
        title: "Media Walls & Built-Ins",
        desc: "Optional built-in media walls, wet bars, or storage — added when the layout calls for it.",
      },
    ],
  },
  fr: {
    eyebrow: "Transformations de sous-sol",
    title: "D'un espace d'entreposage non aménagé à une pièce que vous utilisez vraiment",
    intro:
      "Un sous-sol non aménagé, c'est de la superficie gaspillée. Voici comment nous transformons du béton nu et une ossature exposée en une pièce habitable et sèche.",
    processTitle: "Comment ça fonctionne",
    processIntro: "L'humidité est toujours traitée en premier — sans exception.",
    processSteps: [
      {
        title: "Inspection et vérification de l'humidité",
        desc: "Nous vérifions les problèmes d'humidité avant tout le reste. Un aménagement de sous-sol par-dessus un problème d'humidité non résolu ne tient pas la route.",
      },
      {
        title: "Conception et planification",
        desc: "Nous planifions l'aménagement — salle média, chambre supplémentaire, aire de jeu — et gérons les permis requis pour les travaux.",
      },
      {
        title: "Ossature, isolation et aménagement",
        desc: "Ossature, isolation, gypse et préparation électrique sont installés, suivis des finitions requises par l'aménagement.",
      },
      {
        title: "Finition et visite",
        desc: "Plancher, éclairage et moulures complètent l'espace, puis nous le parcourons avec vous avant de déclarer le projet terminé.",
      },
    ],
    includesTitle: "Ce qui est inclus",
    includesIntro: "Un aménagement complet, pas seulement de la peinture par-dessus un problème.",
    includes: [
      {
        title: "Correction de l'humidité",
        desc: "Tout problème d'humidité est corrigé à la source avant le début de l'ossature — la base d'un sous-sol qui reste sec.",
      },
      {
        title: "Ossature, isolation et gypse",
        desc: "Un aménagement intérieur adéquat, isolé et fini pour s'harmoniser avec le reste de la maison.",
      },
      {
        title: "Plancher et éclairage",
        desc: "Un plancher adapté à un espace en sous-sol, ainsi qu'un éclairage qui donne à la pièce une impression de faire partie de la maison.",
      },
      {
        title: "Murs média et unités intégrées",
        desc: "Murs média intégrés, bars ou espaces de rangement en option, ajoutés selon les besoins de l'aménagement.",
      },
    ],
  },
};

export default function BasementsContent() {
  const { locale } = useLanguage();
  return <ServiceDetailContent icon={IconStairs} copy={copy[locale]} />;
}
