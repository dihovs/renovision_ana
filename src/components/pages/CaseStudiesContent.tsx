"use client";

import Image from "next/image";
import { useLanguage } from "@/i18n/LanguageProvider";

const copy = {
  en: {
    eyebrow: "Featured Projects",
    title: "Case Studies: Problem, Solution, Result",
    intro:
      "A closer look at how we take on real projects — what we found, what we did, and what it meant for the client. Real project photos coming soon; placeholders shown for now.",
    problemLabel: "Problem",
    solutionLabel: "Solution",
    resultLabel: "Result",
    beforeAlt: "Before: ",
    afterAlt: "After: ",
    studies: [
      {
        image: "water-damage",
        tag: "Water Damage · Property Management",
        title: "Burst Pipe Across Two Occupied Floors",
        problem:
          "A winter pipe burst soaked ceilings, walls, and flooring across two occupied apartment units. The property manager needed fast drying to prevent mold and minimal disruption for tenants.",
        solution:
          "Emergency water extraction within hours, containment and drying equipment for five days with logged moisture readings, then full drywall, insulation, paint, and flooring replacement.",
        result:
          "Both units fully restored in under three weeks with tenants in place. Complete photo documentation supported the insurance claim from first visit to final walkthrough.",
      },
      {
        image: "kitchen",
        tag: "Kitchen Remodel · Homeowner",
        title: "1980s Kitchen, Full Transformation",
        problem:
          "A dated kitchen with failing cabinets, worn vinyl flooring, and a closed-off layout that the homeowners had lived with for years.",
        solution:
          "Full gut renovation: layout opened to the dining area, new cabinetry and quartz counters, tile backsplash, luxury vinyl plank flooring, and updated lighting.",
        result:
          "A bright, functional kitchen delivered on schedule and on the agreed budget — now the family's favourite room in the house.",
      },
      {
        image: "basement",
        tag: "Basement · Homeowner",
        title: "Unfinished Basement to Family Space",
        problem:
          "An unfinished basement used for storage, with bare concrete, exposed framing, and a moisture concern in one corner.",
        solution:
          "Moisture issue corrected at the source, then full build-out: insulated framing, drywall, pot lights, vinyl plank flooring, and a built-in media wall with color-matched finishes.",
        result:
          "A warm, dry family room and play area that added usable square footage — and value — to the home.",
      },
    ],
  },
  fr: {
    eyebrow: "Projets en vedette",
    title: "Études de cas : problème, solution, résultat",
    intro:
      "Un regard détaillé sur nos projets réels — ce que nous avons trouvé, ce que nous avons fait et ce que cela a signifié pour le client. Photos de projets réels à venir; images temporaires pour l'instant.",
    problemLabel: "Problème",
    solutionLabel: "Solution",
    resultLabel: "Résultat",
    beforeAlt: "Avant : ",
    afterAlt: "Après : ",
    studies: [
      {
        image: "water-damage",
        tag: "Dégât d'eau · Gestion immobilière",
        title: "Tuyau éclaté sur deux étages occupés",
        problem:
          "Un tuyau éclaté en hiver a trempé plafonds, murs et planchers dans deux logements occupés. Le gestionnaire avait besoin d'un séchage rapide pour prévenir la moisissure, avec un minimum de dérangement pour les locataires.",
        solution:
          "Extraction d'eau d'urgence en quelques heures, confinement et équipement de séchage pendant cinq jours avec relevés d'humidité consignés, puis remplacement complet du gypse, de l'isolation, de la peinture et des planchers.",
        result:
          "Deux logements entièrement restaurés en moins de trois semaines, locataires en place. Une documentation photo complète a appuyé la réclamation d'assurance du premier jour à la visite finale.",
      },
      {
        image: "kitchen",
        tag: "Rénovation de cuisine · Propriétaire",
        title: "Cuisine des années 1980, transformation complète",
        problem:
          "Une cuisine désuète avec des armoires en fin de vie, un plancher de vinyle usé et un aménagement fermé avec lequel les propriétaires vivaient depuis des années.",
        solution:
          "Rénovation complète : aménagement ouvert sur la salle à manger, nouvelles armoires et comptoirs de quartz, dosseret de céramique, plancher de vinyle de luxe et éclairage mis à jour.",
        result:
          "Une cuisine lumineuse et fonctionnelle, livrée dans les délais et le budget convenus — maintenant la pièce préférée de la famille.",
      },
      {
        image: "basement",
        tag: "Sous-sol · Propriétaire",
        title: "D'un sous-sol non aménagé à un espace familial",
        problem:
          "Un sous-sol non aménagé servant d'entrepôt : béton nu, ossature exposée et un problème d'humidité dans un coin.",
        solution:
          "Problème d'humidité corrigé à la source, puis aménagement complet : ossature isolée, gypse, luminaires encastrés, plancher de vinyle et mur média intégré avec finitions aux couleurs agencées.",
        result:
          "Une salle familiale chaleureuse et sèche qui a ajouté de la superficie habitable — et de la valeur — à la maison.",
      },
    ],
  },
};

export default function CaseStudiesContent() {
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

        <div className="mt-16 space-y-16">
          {c.studies.map(({ image, tag, title, problem, solution, result }) => (
            <article
              key={title}
              className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5"
            >
              <div className="grid gap-0 lg:grid-cols-2">
                <div className="relative grid grid-cols-2">
                  <div className="relative min-h-56">
                    <Image
                      src={`/images/${image}-before.svg`}
                      alt={c.beforeAlt + title}
                      fill
                      sizes="(min-width: 1024px) 320px, 50vw"
                      className="object-cover"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-charcoal/80 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                      {c.problemLabel}
                    </span>
                  </div>
                  <div className="relative min-h-56">
                    <Image
                      src={`/images/${image}-after.svg`}
                      alt={c.afterAlt + title}
                      fill
                      sizes="(min-width: 1024px) 320px, 50vw"
                      className="object-cover"
                    />
                    <span className="absolute right-3 top-3 rounded-full bg-brand-green px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                      {c.resultLabel}
                    </span>
                  </div>
                </div>
                <div className="p-8 lg:p-10">
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
                    {tag}
                  </p>
                  <h2 className="mt-2 font-heading text-2xl font-bold text-brand-blue">{title}</h2>
                  <dl className="mt-6 space-y-5">
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-charcoal/50">
                        {c.problemLabel}
                      </dt>
                      <dd className="mt-1 text-sm leading-relaxed text-charcoal/80">{problem}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-charcoal/50">
                        {c.solutionLabel}
                      </dt>
                      <dd className="mt-1 text-sm leading-relaxed text-charcoal/80">{solution}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-brand-green">
                        {c.resultLabel}
                      </dt>
                      <dd className="mt-1 text-sm leading-relaxed text-charcoal/80">{result}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
