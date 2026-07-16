"use client";

import Image from "next/image";
import { useLanguage } from "@/i18n/LanguageProvider";
import CtaBand from "@/components/home/CtaBand";

const copy = {
  en: {
    eyebrow: "Completed Projects",
    title: "A Look at Recent Work",
    intro:
      "Real before/after results from our renovation and restoration crews. Every project starts with a clear estimate and ends with a walkthrough you sign off on.",
    beforeLabel: "Before",
    afterLabel: "After",
    projects: [
      {
        before: "/images/hero-basement-before-v2.jpg",
        after: "/images/hero-basement-after-v2.jpg",
        tag: "Basement Transformation",
        title: "Unfinished Basement to Livable Family Space",
        desc: "Full gut and rebuild: framing, insulation, drywall, recessed lighting, and plank flooring throughout.",
      },
      {
        before: "/images/kitchen-before.svg",
        after: "/images/kitchen-concept.jpg",
        tag: "Kitchen Remodel",
        title: "1980s Kitchen, Full Transformation",
        desc: "New cabinetry, quartz counters, tile backsplash, and luxury vinyl plank flooring.",
      },
      {
        before: "/images/water-damage-before-real.jpg",
        after: "/images/water-damage-after-real.jpg",
        tag: "Water Damage Restoration",
        title: "Burst Pipe Emergency Response",
        desc: "Emergency extraction and drying followed by full drywall, insulation, and flooring replacement.",
      },
      {
        before: "/images/bathtub-before.jpg",
        after: "/images/bathtub-after.jpg",
        tag: "Small Repair & Color Matching",
        title: "Bathtub Surround Repair After Water Leak",
        desc: "Damaged tile removed, new waterproofing membrane installed, and replacement tile color-matched as closely as possible to the existing bathroom finish.",
      },
    ],
  },
  fr: {
    eyebrow: "Projets réalisés",
    title: "Un aperçu de nos travaux récents",
    intro:
      "De vrais résultats avant/après de nos équipes de rénovation et de restauration. Chaque projet commence par une estimation claire et se termine par une visite que vous approuvez.",
    beforeLabel: "Avant",
    afterLabel: "Après",
    projects: [
      {
        before: "/images/hero-basement-before-v2.jpg",
        after: "/images/hero-basement-after-v2.jpg",
        tag: "Transformation de sous-sol",
        title: "D'un sous-sol non aménagé à un espace familial",
        desc: "Démolition et reconstruction complètes : ossature, isolation, gypse, éclairage encastré et plancher partout.",
      },
      {
        before: "/images/kitchen-before.svg",
        after: "/images/kitchen-concept.jpg",
        tag: "Rénovation de cuisine",
        title: "Cuisine des années 1980, transformation complète",
        desc: "Nouvelles armoires, comptoirs de quartz, dosseret de céramique et plancher de vinyle de luxe.",
      },
      {
        before: "/images/water-damage-before-real.jpg",
        after: "/images/water-damage-after-real.jpg",
        tag: "Restauration de dégât d'eau",
        title: "Intervention d'urgence après tuyau éclaté",
        desc: "Extraction et séchage d'urgence, suivis du remplacement complet du gypse, de l'isolation et du plancher.",
      },
      {
        before: "/images/bathtub-before.jpg",
        after: "/images/bathtub-after.jpg",
        tag: "Petite réparation et agencement de couleurs",
        title: "Réparation du pourtour de baignoire après dégât d'eau",
        desc: "Céramique endommagée retirée, nouvelle membrane d'étanchéité installée et céramique de remplacement agencée le plus fidèlement possible à la finition existante de la salle de bain.",
      },
    ],
  },
};

export default function GalleryContent() {
  const { locale } = useLanguage();
  const c = copy[locale];

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
            {c.eyebrow}
          </p>
          <h1 className="mt-3 font-heading text-4xl font-extrabold text-brand-blue sm:text-5xl">
            {c.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-charcoal/75">{c.intro}</p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {c.projects.map(({ before, after, tag, title, desc }) => (
            <article
              key={title}
              className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5"
            >
              <div className="relative grid grid-cols-2">
                <div className="relative aspect-[4/3]">
                  <Image
                    src={before}
                    alt={`${c.beforeLabel}: ${title}`}
                    fill
                    sizes="(min-width: 1024px) 260px, 50vw"
                    className="object-cover"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-charcoal/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    {c.beforeLabel}
                  </span>
                </div>
                <div className="relative aspect-[4/3]">
                  <Image
                    src={after}
                    alt={`${c.afterLabel}: ${title}`}
                    fill
                    sizes="(min-width: 1024px) 260px, 50vw"
                    className="object-cover"
                  />
                  <span className="absolute right-2 top-2 rounded-full bg-brand-green px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    {c.afterLabel}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
                  {tag}
                </p>
                <h2 className="mt-2 font-heading text-lg font-bold text-brand-blue">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">{desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <CtaBand />
    </>
  );
}
