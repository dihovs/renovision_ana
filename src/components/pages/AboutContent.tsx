"use client";

import Image from "next/image";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import FeatureCard from "@/components/ui/FeatureCard";
import Reveal from "@/components/ui/Reveal";
import StatsBar from "@/components/home/StatsBar";
import CtaBand from "@/components/home/CtaBand";
import { IconHammer, IconClipboard, IconCheckCircle, IconShield } from "@/components/ui/icons";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

const copy = {
  en: {
    eyebrow: "About Renovision AnA",
    title: "Renovation and Restoration You Can Trust",
    intro:
      "Renovision AnA was built on a simple idea: property managers, insurers, and homeowners all need the same thing from a contractor — clear communication, honest pricing, and work that's done right the first time. We serve the Laval and greater Montreal area with interior renovation and water damage restoration crews who treat every property like it's their own.",
    storyTitle: "What We Do, and Why We Do It This Way",
    storyParagraphs: [
      "Renovision AnA handles interior renovations, flooring, kitchen and bathroom remodels, basement transformations, water damage restoration, and the small color-matched repairs that don't fit neatly into any of those categories. Most contractors specialize narrowly; we built our crews to cover the full range of interior work a property actually needs over its lifetime, so you're not managing three different companies for three related jobs.",
      "That range matters most when something goes wrong. A burst pipe doesn't just need water extraction — it needs drywall, insulation, flooring, and paint afterward, all coordinated by people who already know the property and the timeline. Splitting that across separate vendors is where delays and miscommunication creep in. Keeping it under one roof is how we avoid that.",
      "We work across Laval and the greater Montreal area for three kinds of clients with different needs: property managers who need fast, documented turnarounds across a portfolio; insurers and adjusters who need photo-backed reports that hold up in a claim; and homeowners who just want the job done right and explained clearly along the way. The standard doesn't change between them — only the paperwork does.",
    ],
    processTitle: "How a Project Actually Happens With Us",
    processIntro:
      "The same four steps whether it's a burst pipe at 11pm or a kitchen you've been planning for years.",
    processSteps: [
      {
        image: "/images/process-call.svg",
        title: "You Call, We Listen",
        desc: "Describe the problem or the project — a leak, a dated kitchen, a basement you want back. We ask the right questions before we ever pick up a tool.",
      },
      {
        image: "/images/process-inspection.svg",
        title: "We Inspect and Document",
        desc: "We assess the property in person or by photo, take moisture readings when relevant, and give you a clear, itemized estimate — no surprises later.",
      },
      {
        image: "/images/crew-at-work.svg",
        title: "We Do the Work",
        desc: "Our crews handle the job start to finish, working cleanly around occupied spaces and keeping you updated as work progresses.",
      },
      {
        image: "/images/process-handover.svg",
        title: "You Get a Clear Handover",
        desc: "A final walkthrough, photo documentation of the finished work, and paperwork your insurer or property owner can use immediately.",
      },
    ],
    valuesTitle: "What we stand for",
    values: [
      {
        icon: "hammer",
        title: "Real Craftsmanship",
        desc: "Flooring, tile, cabinetry, and finishing work done to a standard we'd put our name on — because we do.",
      },
      {
        icon: "clipboard",
        title: "Clear Communication",
        desc: "Itemized estimates, photo documentation, and a single point of contact from first call to final walkthrough.",
      },
      {
        icon: "check",
        title: "Reliability",
        desc: "We show up when we say we will and finish on the timeline we quote — property managers and insurers depend on it.",
      },
      {
        icon: "shield",
        title: "Respect for Your Property",
        desc: "Clean job sites, careful work around occupied units and family spaces, and full licensing and insurance on every job.",
      },
    ],
  },
  fr: {
    eyebrow: "À propos de Renovision AnA",
    title: "Rénovation et restauration en qui vous pouvez avoir confiance",
    intro:
      "Renovision AnA est né d'une idée simple : les gestionnaires immobiliers, les assureurs et les propriétaires attendent tous la même chose d'un entrepreneur — une communication claire, une tarification honnête et un travail bien fait du premier coup. Nous desservons Laval et le grand Montréal avec des équipes de rénovation intérieure et de restauration de dégâts d'eau qui traitent chaque propriété comme la leur.",
    storyTitle: "Ce que nous faisons, et pourquoi nous le faisons ainsi",
    storyParagraphs: [
      "Renovision AnA prend en charge les rénovations intérieures, les planchers, les rénovations de cuisine et de salle de bain, les transformations de sous-sol, la restauration de dégâts d'eau et les petites réparations avec agencement de couleurs qui ne rentrent dans aucune de ces catégories. La plupart des entrepreneurs se spécialisent étroitement; nous avons plutôt bâti nos équipes pour couvrir l'ensemble des travaux intérieurs dont une propriété a besoin au fil du temps, pour que vous n'ayez pas à gérer trois compagnies différentes pour trois travaux liés.",
      "Cette polyvalence compte le plus quand quelque chose tourne mal. Un tuyau éclaté n'a pas seulement besoin d'extraction d'eau — il faut ensuite du gypse, de l'isolation, du plancher et de la peinture, le tout coordonné par des gens qui connaissent déjà la propriété et l'échéancier. Répartir cela entre plusieurs fournisseurs, c'est là que les retards et les malentendus s'installent. Garder tout sous un même toit, c'est notre façon de l'éviter.",
      "Nous desservons Laval et le grand Montréal pour trois types de clients aux besoins différents : les gestionnaires immobiliers qui ont besoin de délais rapides et documentés à l'échelle d'un portefeuille; les assureurs et experts en sinistres qui ont besoin de rapports appuyés par des photos qui tiennent la route dans une réclamation; et les propriétaires qui veulent simplement un travail bien fait et expliqué clairement en cours de route. La norme ne change pas d'un client à l'autre — seule la documentation change.",
    ],
    processTitle: "Comment un projet se déroule vraiment avec nous",
    processIntro:
      "Les quatre mêmes étapes, qu'il s'agisse d'un tuyau éclaté à 23h ou d'une cuisine que vous planifiez depuis des années.",
    processSteps: [
      {
        image: "/images/process-call.svg",
        title: "Vous appelez, nous écoutons",
        desc: "Décrivez le problème ou le projet — une fuite, une cuisine désuète, un sous-sol que vous voulez récupérer. Nous posons les bonnes questions avant même de prendre un outil.",
      },
      {
        image: "/images/process-inspection.svg",
        title: "Nous inspectons et documentons",
        desc: "Nous évaluons la propriété en personne ou par photos, prenons des relevés d'humidité au besoin, et vous remettons une estimation claire et détaillée — sans surprise plus tard.",
      },
      {
        image: "/images/crew-at-work.svg",
        title: "Nous réalisons les travaux",
        desc: "Nos équipes prennent en charge le projet du début à la fin, en travaillant proprement autour des espaces occupés et en vous tenant informé de l'avancement.",
      },
      {
        image: "/images/process-handover.svg",
        title: "Vous recevez une remise claire",
        desc: "Une visite finale, une documentation photo des travaux terminés, et une documentation que votre assureur ou propriétaire peut utiliser immédiatement.",
      },
    ],
    valuesTitle: "Nos valeurs",
    values: [
      {
        icon: "hammer",
        title: "Un vrai savoir-faire",
        desc: "Planchers, céramique, armoires et finition réalisés selon une norme dont nous sommes fiers — parce que c'est notre nom qui est en jeu.",
      },
      {
        icon: "clipboard",
        title: "Communication claire",
        desc: "Estimations détaillées, documentation photo et un seul point de contact du premier appel à la visite finale.",
      },
      {
        icon: "check",
        title: "Fiabilité",
        desc: "Nous nous présentons quand nous le disons et terminons dans les délais convenus — les gestionnaires et assureurs comptent là-dessus.",
      },
      {
        icon: "shield",
        title: "Respect de votre propriété",
        desc: "Chantiers propres, travail soigné autour des logements occupés et des espaces familiaux, licence et assurance complètes sur chaque projet.",
      },
    ],
  },
};

const icons = {
  hammer: IconHammer,
  clipboard: IconClipboard,
  check: IconCheckCircle,
  shield: IconShield,
} as const;

export default function AboutContent() {
  const { locale, t } = useLanguage();
  const { openChat } = useChat();
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
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={openChat}
              className="rounded-full bg-brand-green px-7 py-3.5 font-heading font-bold text-white transition-colors hover:bg-brand-green-dark"
            >
              {t.ctaBand.ctaEstimate}
            </button>
            <a
              href={`tel:${SITE_PHONE_TEL}`}
              className="rounded-full border-2 border-brand-blue px-7 py-3.5 text-center font-heading font-bold text-brand-blue transition-colors hover:bg-brand-blue-light"
            >
              {t.ctaBand.ctaCall} · {SITE_PHONE}
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-heading text-2xl font-bold text-brand-blue sm:text-3xl">
              {c.storyTitle}
            </h2>
            <div className="mt-5 space-y-4">
              {c.storyParagraphs.map((p) => (
                <p key={p.slice(0, 24)} className="text-sm leading-relaxed text-charcoal/75">
                  {p}
                </p>
              ))}
            </div>
          </Reveal>
          <Reveal delayMs={150} className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
            <Image
              src="/images/about-overview.jpg"
              alt={
                locale === "fr"
                  ? "Illustration en coupe d'une maison montrant l'intérieur rénové, superposée à une carte de la région de Laval et Montréal que nous desservons"
                  : "Cross-section illustration of a house showing the renovated interior, overlaid on a map of the Laval and Montreal area we serve"
              }
              fill
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="object-cover"
            />
          </Reveal>
        </div>
      </section>

      <StatsBar />

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
            {c.processTitle}
          </h2>
          <p className="mt-3 text-sm text-charcoal/60">{c.processIntro}</p>
        </div>
        <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {c.processSteps.map(({ image, title, desc }, i) => (
            <div key={title}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                <Image
                  src={image}
                  alt={title}
                  fill
                  sizes="(min-width: 1024px) 22vw, 90vw"
                  className="object-cover"
                />
                <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-green text-xs font-bold text-white">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-4 font-heading text-base font-bold text-brand-blue">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-charcoal/75">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-blue-light/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
            {c.valuesTitle}
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {c.values.map(({ icon, title, desc }) => (
              <FeatureCard key={title} icon={icons[icon as keyof typeof icons]} title={title} desc={desc} />
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
