import type { Metadata } from "next";
import Link from "next/link";
import { IconHammer, IconDroplet, IconKitchen } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Renovision AnA offers general renovations, water damage repair and restoration, and kitchen & bathroom remodeling.",
};

const SERVICES = [
  {
    href: "/services/renovations",
    icon: IconHammer,
    title: "Renovations",
    desc: "Full and partial renovations for residential and commercial properties.",
  },
  {
    href: "/services/water-damage",
    icon: IconDroplet,
    title: "Water Damage Restoration",
    desc: "Rapid response water extraction, drying, and repair.",
  },
  {
    href: "/services/kitchen-bath",
    icon: IconKitchen,
    title: "Kitchen & Bath Remodeling",
    desc: "Modern, functional kitchen and bathroom remodels.",
  },
];

export default function ServicesPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
      <h1 className="text-center font-heading text-4xl font-extrabold text-brand-blue">
        Our Services
      </h1>
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {SERVICES.map(({ href, icon: Icon, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-black/5 transition-all hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-green-light text-brand-green">
              <Icon />
            </div>
            <h2 className="mt-5 font-heading text-lg font-bold text-brand-blue">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-charcoal/75">{desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
