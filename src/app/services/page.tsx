import type { Metadata } from "next";
import FeatureCard from "@/components/ui/FeatureCard";
import {
  IconDroplet,
  IconTiles,
  IconKitchen,
  IconHammer,
  IconStairs,
  IconBrush,
} from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Water damage restoration, flooring, kitchens & bathrooms, interior renovations, basement transformations, and small repairs with color matching.",
};

const SERVICES = [
  {
    href: "/services/water-damage",
    icon: IconDroplet,
    title: "Water Damage Restoration",
    desc: "Rapid response water extraction, drying, and repair.",
  },
  {
    href: "/services/flooring",
    icon: IconTiles,
    title: "Flooring",
    desc: "Tile, hardwood, and vinyl flooring installed with precision.",
  },
  {
    href: "/services/kitchen-bath",
    icon: IconKitchen,
    title: "Kitchens & Bathrooms",
    desc: "Modern, functional kitchen and bathroom remodels.",
  },
  {
    href: "/services/renovations",
    icon: IconHammer,
    title: "Interior Renovations",
    desc: "Complete renovations for any room and any interior space.",
  },
  {
    href: "/services/basements",
    icon: IconStairs,
    title: "Basement Transformations",
    desc: "From unfinished space to beautiful, livable rooms.",
  },
  {
    href: "/services/repairs",
    icon: IconBrush,
    title: "Small Repairs & Color Matching",
    desc: "Cost-effective local repairs with seamless color matching.",
  },
];

export default function ServicesPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
      <h1 className="text-center font-heading text-4xl font-extrabold text-brand-blue">
        Our Services
      </h1>
      <p className="mx-auto mt-3 max-w-2xl text-center text-charcoal/70">
        Any interior job, big or small — from full transformations to cost-effective local repairs.
      </p>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map(({ href, icon, title, desc }) => (
          <FeatureCard key={href} icon={icon} href={href} title={title} desc={desc} headingLevel="h2" />
        ))}
      </div>
    </section>
  );
}
