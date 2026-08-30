"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import FeatureCard from "@/components/ui/FeatureCard";
import {
  IconDroplet,
  IconBackflow,
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
  backflow: IconBackflow,
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
        desc: "Rapid response water extraction, drying, and repair — with moisture readings and photos documented for your insurance claim, and the same crew handling the rebuild.",
      },
      {
        href: "/services/sewer-backup",
        icon: "backflow",
        title: "Sewer Backup Cleanup",
        desc: "Contaminated water extracted, disinfected, and the soaked material removed rather than dried — then rebuilt, with the backwater valve left accessible.",
      },
      {
        href: "/services/flooring",
        icon: "tiles",
        title: "Flooring",
        desc: "Tile, hardwood, and vinyl flooring installed with precision, including subfloor repair and leveling where older Laval homes need it.",
      },
      {
        href: "/services/kitchen-bath",
        icon: "kitchen",
        title: "Kitchens & Bathrooms",
        desc: "Modern, functional kitchen and bathroom remodels — from a vanity-and-tile refresh to a full gut renovation, plumbing moves included.",
      },
      {
        href: "/services/renovations",
        icon: "hammer",
        title: "Interior Renovations",
        desc: "Complete renovations for any room and any interior space, whether that's opening up a closed layout or turning over a rental unit between tenants.",
      },
      {
        href: "/services/basements",
        icon: "stairs",
        title: "Basement Transformations",
        desc: "From unfinished space to beautiful, livable rooms — moisture and insulation handled properly before the finishes go in.",
      },
      {
        href: "/services/drywall",
        icon: "drywall",
        title: "Drywall Installation & Finishing",
        desc: "Hung, taped, and finished flat — plus patches of any size, matched so the repair disappears into the wall.",
      },
      {
        href: "/services/painting",
        icon: "brush",
        title: "Interior Painting",
        desc: "Walls, ceilings, trim, and doors in full two-coat coverage, with surfaces prepped and repaired before the first coat.",
      },
      {
        href: "/services/repairs",
        icon: "wrench",
        title: "Small Repairs & Color Matching",
        desc: "Cost-effective local repairs with seamless color matching — the small jobs other contractors won't book.",
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
        desc: "Extraction d'eau, séchage et remise en état — intervention rapide, relevés d'humidité et photos consignés pour votre réclamation d'assurance.",
      },
      {
        href: "/services/sewer-backup",
        icon: "backflow",
        title: "Nettoyage après refoulement d'égout",
        desc: "Eau contaminée extraite et désinfectée, matériaux imbibés retirés plutôt que séchés — puis remise en état, en gardant le clapet antiretour accessible.",
      },
      {
        href: "/services/flooring",
        icon: "tiles",
        title: "Planchers",
        desc: "Céramique, bois franc et vinyle posés avec précision, incluant la réparation et la mise à niveau du sous-plancher quand les maisons plus anciennes l'exigent.",
      },
      {
        href: "/services/kitchen-bath",
        icon: "kitchen",
        title: "Cuisines et salles de bain",
        desc: "Des cuisines et salles de bain modernes et fonctionnelles — du rafraîchissement de vanité et céramique à la rénovation complète, plomberie incluse.",
      },
      {
        href: "/services/renovations",
        icon: "hammer",
        title: "Rénovations intérieures",
        desc: "Rénovation complète de toute pièce et de tout espace intérieur : ouvrir une aire fermée ou remettre un logement en état entre deux locataires.",
      },
      {
        href: "/services/basements",
        icon: "stairs",
        title: "Transformations de sous-sol",
        desc: "D'un espace brut à des pièces habitables et accueillantes — humidité et isolation traitées correctement avant la pose des finitions.",
      },
      {
        href: "/services/drywall",
        icon: "drywall",
        title: "Installation et finition de gypse",
        desc: "Posé, tiré et fini bien droit — et des réparations de toutes tailles, agencées pour que la retouche disparaisse dans le mur.",
      },
      {
        href: "/services/painting",
        icon: "brush",
        title: "Peinture intérieure",
        desc: "Murs, plafonds, moulures et portes en deux couches complètes, avec surfaces préparées et réparées avant la première couche.",
      },
      {
        href: "/services/repairs",
        icon: "wrench",
        title: "Petites réparations et agencement de couleurs",
        desc: "Réparations locales économiques avec agencement de couleurs invisible — les petits travaux que d'autres entrepreneurs refusent.",
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
