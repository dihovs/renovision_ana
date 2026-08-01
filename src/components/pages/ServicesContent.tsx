"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import FeatureCard from "@/components/ui/FeatureCard";
import {
  IconDroplet,
  IconTiles,
  IconKitchen,
  IconHammer,
  IconStairs,
  IconBrush,
  IconDrywall,
  IconWrench,
} from "@/components/ui/icons";

const icons = {
  droplet: IconDroplet,
  tiles: IconTiles,
  kitchen: IconKitchen,
  hammer: IconHammer,
  stairs: IconStairs,
  drywall: IconDrywall,
  brush: IconBrush,
  wrench: IconWrench,
} as const;

type IconKey = keyof typeof icons;

type ServiceCard = { href: string; icon: IconKey; title: string; desc: string };

const copy: Record<"en" | "fr", { title: string; intro: string; services: ServiceCard[] }> = {
  en: {
    title: "Our Services",
    intro:
      "Any interior job, big or small — from full transformations to cost-effective local repairs.",
    services: [
      {
        href: "/services/water-damage",
        icon: "droplet",
        title: "Water Damage Restoration",
        desc: "Rapid response water extraction, drying, and repair.",
      },
      {
        href: "/services/flooring",
        icon: "tiles",
        title: "Flooring",
        desc: "Tile, hardwood, and vinyl flooring installed with precision.",
      },
      {
        href: "/services/kitchen-bath",
        icon: "kitchen",
        title: "Kitchens & Bathrooms",
        desc: "Modern, functional kitchen and bathroom remodels.",
      },
      {
        href: "/services/renovations",
        icon: "hammer",
        title: "Interior Renovations",
        desc: "Complete renovations for any room and any interior space.",
      },
      {
        href: "/services/basements",
        icon: "stairs",
        title: "Basement Transformations",
        desc: "From unfinished space to beautiful, livable rooms.",
      },
      {
        href: "/services/drywall",
        icon: "drywall",
        title: "Drywall Installation & Finishing",
        desc: "Hung, taped, and finished flat — plus patches of any size.",
      },
      {
        href: "/services/painting",
        icon: "brush",
        title: "Interior Painting",
        desc: "Walls, ceilings, trim, and doors in full two-coat coverage.",
      },
      {
        href: "/services/repairs",
        icon: "wrench",
        title: "Small Repairs & Color Matching",
        desc: "Cost-effective local repairs with seamless color matching.",
      },
    ],
  },
  fr: {
    title: "Nos services",
    intro:
      "Tous les travaux intérieurs, grands ou petits — de la transformation complète aux réparations locales économiques.",
    services: [
      {
        href: "/services/water-damage",
        icon: "droplet",
        title: "Restauration après dégât d'eau",
        desc: "Extraction d'eau, séchage et remise en état — intervention rapide.",
      },
      {
        href: "/services/flooring",
        icon: "tiles",
        title: "Planchers",
        desc: "Céramique, bois franc et vinyle posés avec précision.",
      },
      {
        href: "/services/kitchen-bath",
        icon: "kitchen",
        title: "Cuisines et salles de bain",
        desc: "Des cuisines et salles de bain modernes et fonctionnelles.",
      },
      {
        href: "/services/renovations",
        icon: "hammer",
        title: "Rénovations intérieures",
        desc: "Rénovation complète de toute pièce et de tout espace intérieur.",
      },
      {
        href: "/services/basements",
        icon: "stairs",
        title: "Transformations de sous-sol",
        desc: "D'un espace brut à des pièces habitables et accueillantes.",
      },
      {
        href: "/services/drywall",
        icon: "drywall",
        title: "Installation et finition de gypse",
        desc: "Posé, tiré et fini bien droit — et des réparations de toutes tailles.",
      },
      {
        href: "/services/painting",
        icon: "brush",
        title: "Peinture intérieure",
        desc: "Murs, plafonds, moulures et portes en deux couches complètes.",
      },
      {
        href: "/services/repairs",
        icon: "wrench",
        title: "Petites réparations et agencement de couleurs",
        desc: "Réparations locales économiques avec agencement de couleurs invisible.",
      },
    ],
  },
};

export default function ServicesContent() {
  const { locale } = useLanguage();
  const c = copy[locale];

  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
      <h1 className="text-center font-heading text-4xl font-extrabold text-brand-blue">
        {c.title}
      </h1>
      <p className="mx-auto mt-3 max-w-2xl text-center text-charcoal/70">{c.intro}</p>
      {/* 2 or 4 columns, never 3 — eight services leave an orphan in a
          three-column row. See ServicesSection for the same reasoning. */}
      <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {c.services.map(({ href, icon, title, desc }) => (
          <FeatureCard
            key={href}
            icon={icons[icon]}
            href={href}
            title={title}
            desc={desc}
            headingLevel="h2"
          />
        ))}
      </div>
    </section>
  );
}
