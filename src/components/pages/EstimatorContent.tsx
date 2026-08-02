"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import FeatureCard from "@/components/ui/FeatureCard";
import CtaBand from "@/components/home/CtaBand";
import Reveal from "@/components/ui/Reveal";
import {
  IconCheckCircle,
  IconKitchen,
  IconTiles,
  IconDroplet,
  IconStairs,
  IconDrywall,
  IconBrush,
  IconHammer,
  IconWrench,
} from "@/components/ui/icons";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";
import { estimatorFaqEn, estimatorFaqFr } from "@/lib/estimatorFaq";

/**
 * The estimator's own landing page. The chat widget is the site's single
 * biggest differentiator — no competitor in the Quebec market has anything
 * like it (Docs/Website-Competitive-Research.md) — but as a floating button
 * it only converts people who already decided to click it. This page exists
 * to SELL the estimator as long-form, keyword-rich content: what it does, why
 * the numbers can be trusted, what it can't do, and why it costs nothing to
 * try. It's also the landing target for "estimation rénovation", "combien
 * coûte rénovation Laval"-type searches (Docs/SEO-Keyword-Research.md).
 *
 * Copy lives inline (AboutContent pattern) rather than in translations.ts —
 * page-specific prose doesn't belong in the shared nav/footer string table.
 *
 * Both FAQ lists are imported from src/lib/estimatorFaq.ts instead of being
 * declared here, so app/[lang]/estimation/page.tsx (a server component) can
 * build FAQPage JSON-LD from the same arrays without crossing the client
 * boundary — see that file's comment for why a named export from this
 * "use client" module doesn't survive that trip intact in this fork.
 */

const copy = {
  en: {
    eyebrow: "Free Online Estimate",
    title: "Know What Your Renovation Will Cost — in Minutes, Not Days",
    intro:
      "Most contractors make you wait for a callback just to hear a rough number. Our estimate assistant prices your project line by line — materials, labour, even travel to your address — using the same price list our crews actually work from, and hands you a detailed range in a few minutes. No forms, no waiting, no obligation.",
    ctaStart: "Start my free estimate",
    ctaCall: "Or call us",
    stepsTitle: "How it works",
    stepsIntro: "Four steps, whether it's a kitchen you've been planning for years or water damage from last night.",
    steps: [
      {
        title: "Describe your project",
        desc: "Tell the assistant what needs doing — a basement to finish, a bathroom to redo, water damage to repair. Add photos if you have them.",
      },
      {
        title: "It asks the questions that matter",
        desc: "Dimensions, finishes, access, what's original vs. already renovated — the same details a contractor would ask on a site visit, without you having to know what to mention.",
      },
      {
        title: "Get your itemized range",
        desc: "Every line priced from our real catalogue: materials, labour, and a travel fee calculated from your postal code. You see exactly where each dollar comes from.",
      },
      {
        title: "Optionally, get a firm quote from Artush",
        desc: "Send your estimate in one click. Artush reviews the project and calls you back with a confirmed price — often the same day. Nothing is sent if you'd rather just look at the numbers.",
      },
    ],
    honestTitle: "A preview, not a promise",
    honestBody:
      "This is deliberate: the estimate is a data-driven preview built on our real price list, not a confirmed bid. Every property is different, and what a crew finds once a wall is open can move the numbers. That's exactly why Artush always confirms the price in person before work starts — the range gives you an honest order of magnitude before the first phone call, not a number pulled out of thin air.",
    canTitle: "What the estimate can do",
    canItems: [
      "Price your project line by line from our real catalogue of over 125 priced items",
      "Calculate a travel fee from your postal code",
      "Estimate how many days the work will take",
      "Forward the full detail to Artush for a callback, only if you choose to",
    ],
    cantTitle: "What it can't do",
    cantItems: [
      "Replace an in-person visit — hidden conditions like mould, structural issues or old plumbing only show up on site",
      "Issue a firm, contractual quote",
      "Include licensed plumbing or electrical work — those are always priced as separate allowances",
      "Guess a price for anything you didn't describe — the assistant flags it as an exclusion instead of making one up",
    ],
    sampleTitle: "Real numbers, not made up ones",
    sampleIntro:
      "A few installation rates straight from the price book the estimator (and our crews) actually use — labour only, materials shown separately unless noted:",
    sampleItems: [
      { label: "Laminate flooring installation", value: "$8.60 / sq ft" },
      { label: "Luxury vinyl plank installation", value: "$8.25 / sq ft" },
      { label: "Nail-down hardwood installation", value: "$14.95 / sq ft" },
      { label: "Water extraction (water damage)", value: "$1.75 / sq ft" },
      { label: "Standard bathtub installation", value: "$895" },
      { label: "Emergency service call-out", value: "$295" },
    ],
    sampleNote:
      "These are single line-item rates, not full-project totals — a real project combines dozens of these depending on scope. The estimator does that math for you.",
    categoriesTitle: "What the estimator covers",
    categoriesIntro: "Every category below is priced from the same catalogue — click through to see the service in detail.",
    categories: [
      {
        icon: "kitchen",
        title: "Kitchen & Bathroom",
        desc: "Cabinets, countertops, tile, fixtures and appliances — our most requested renovation, priced line by line.",
        href: "/services/kitchen-bath",
      },
      {
        icon: "tiles",
        title: "Flooring",
        desc: "Hardwood, floating floors, luxury vinyl — demolition, subfloor, installation and baseboards all factored in.",
        href: "/services/flooring",
      },
      {
        icon: "droplet",
        title: "Water Damage",
        desc: "Extraction, drying, decontamination and moisture monitoring — the most urgent category, priced from the first call.",
        href: "/services/water-damage",
      },
      {
        icon: "stairs",
        title: "Basement Finishing",
        desc: "Framing, insulation, drywall, flooring and finishing combined into a single range for the whole project.",
        href: "/services/basements",
      },
      {
        icon: "drywall",
        title: "Drywall & Finishing",
        desc: "Demolition, installation, taping and repairs — through to the final coat of paint.",
        href: "/services/drywall",
      },
      {
        icon: "brush",
        title: "Painting",
        desc: "Walls, ceilings, trim and doors — calculated from actual surface area, not just floor space.",
        href: "/services/painting",
      },
      {
        icon: "hammer",
        title: "Interior Renovations",
        desc: "Multi-room and whole-home projects, with every trade priced as its own line rather than one vague total.",
        href: "/services/renovations",
      },
      {
        icon: "wrench",
        title: "Small Repairs",
        desc: "Touch-ups, one-off fixes and colour-matched patchwork that don't fit neatly into any other category.",
        href: "/services/repairs",
      },
    ],
    faqTitle: "Common questions",
    faq: estimatorFaqEn,
  },
  fr: {
    eyebrow: "Estimation gratuite en ligne",
    title: "Sachez combien coûtera votre rénovation — en quelques minutes",
    intro:
      "La plupart des entrepreneurs vous font attendre un rappel juste pour entendre un chiffre approximatif. Notre assistant d'estimation chiffre votre projet poste par poste — matériaux, main-d'œuvre, et même le déplacement jusqu'à chez vous — à partir de la même liste de prix que nos équipes utilisent réellement, et vous remet une fourchette détaillée en quelques minutes. Pas de formulaire, pas d'attente, aucun engagement.",
    ctaStart: "Lancer mon estimation gratuite",
    ctaCall: "Ou appelez-nous",
    stepsTitle: "Comment ça fonctionne",
    stepsIntro: "Quatre étapes, qu'il s'agisse d'une cuisine planifiée depuis des années ou d'un dégât d'eau de la veille.",
    steps: [
      {
        title: "Décrivez votre projet",
        desc: "Dites à l'assistant ce qui doit être fait — un sous-sol à finir, une salle de bain à refaire, un dégât d'eau à réparer. Ajoutez des photos si vous en avez.",
      },
      {
        title: "Il pose les questions qui comptent",
        desc: "Dimensions, finitions, accès, ce qui est d'origine ou déjà rénové — les mêmes détails qu'un entrepreneur demanderait sur place, sans que vous ayez à savoir quoi mentionner.",
      },
      {
        title: "Recevez votre fourchette détaillée",
        desc: "Chaque poste chiffré à partir de notre vrai catalogue : matériaux, main-d'œuvre, et frais de déplacement calculés selon votre code postal. Vous voyez exactement d'où vient chaque dollar.",
      },
      {
        title: "En option, obtenez une soumission ferme d'Artush",
        desc: "Envoyez votre estimation en un clic. Artush examine le projet et vous rappelle avec un prix confirmé — souvent le jour même. Rien n'est envoyé si vous préférez seulement consulter les chiffres.",
      },
    ],
    honestTitle: "Un aperçu, pas une promesse",
    honestBody:
      "C'est voulu : l'estimation est un aperçu chiffré bâti sur notre vraie liste de prix, pas une soumission confirmée. Chaque propriété est différente, et ce qu'une équipe découvre une fois un mur ouvert peut faire bouger les chiffres. C'est exactement pourquoi Artush confirme toujours le prix en personne avant le début des travaux — la fourchette vous donne un ordre de grandeur honnête avant le premier appel, pas un chiffre sorti de nulle part.",
    canTitle: "Ce que l'estimation peut faire",
    canItems: [
      "Chiffrer votre projet poste par poste à partir de notre vrai catalogue de plus de 125 postes",
      "Calculer les frais de déplacement selon votre code postal",
      "Estimer le nombre de jours que prendront les travaux",
      "Transmettre le détail complet à Artush pour un rappel, seulement si vous le choisissez",
    ],
    cantTitle: "Ce qu'elle ne peut pas faire",
    cantItems: [
      "Remplacer une visite en personne — les conditions cachées comme la moisissure, un problème structural ou une plomberie vétuste ne se voient que sur place",
      "Émettre une soumission ferme et contractuelle",
      "Inclure la plomberie et l'électricité sous licence — toujours chiffrées comme des allocations séparées",
      "Deviner un prix pour ce que vous n'avez pas décrit — l'assistant le signale plutôt comme une exclusion",
    ],
    sampleTitle: "De vrais chiffres, pas des chiffres inventés",
    sampleIntro:
      "Quelques tarifs de pose tirés directement de la liste de prix que l'estimateur — et nos équipes — utilisent réellement, main-d'œuvre seulement, matériaux indiqués séparément sauf indication contraire :",
    sampleItems: [
      { label: "Pose de plancher laminé", value: "8,60 $ / pi²" },
      { label: "Pose de vinyle de luxe (LVP)", value: "8,25 $ / pi²" },
      { label: "Pose de bois franc cloué", value: "14,95 $ / pi²" },
      { label: "Extraction d'eau (dégât d'eau)", value: "1,75 $ / pi²" },
      { label: "Installation d'un bain standard", value: "895 $" },
      { label: "Appel de service d'urgence", value: "295 $" },
    ],
    sampleNote:
      "Ce sont des tarifs à la pièce, pas des totaux de projet — un vrai projet combine des dizaines de ces postes selon l'ampleur des travaux. C'est ce calcul que fait l'estimateur pour vous.",
    categoriesTitle: "Ce que couvre l'estimateur",
    categoriesIntro: "Chaque catégorie ci-dessous est chiffrée à partir du même catalogue — cliquez pour voir le service en détail.",
    categories: [
      {
        icon: "kitchen",
        title: "Cuisine & salle de bain",
        desc: "Armoires, comptoirs, céramique, robinetterie et électroménagers — la rénovation la plus demandée, chiffrée poste par poste.",
        href: "/services/kitchen-bath",
      },
      {
        icon: "tiles",
        title: "Planchers",
        desc: "Bois franc, plancher flottant, vinyle de luxe — démolition, sous-plancher, pose et plinthes, tout est inclus dans le calcul.",
        href: "/services/flooring",
      },
      {
        icon: "droplet",
        title: "Dégât d'eau",
        desc: "Extraction, séchage, décontamination et surveillance de l'humidité — la catégorie la plus urgente, chiffrée dès le premier appel.",
        href: "/services/water-damage",
      },
      {
        icon: "stairs",
        title: "Aménagement de sous-sol",
        desc: "Structure, isolation, gypse, plancher et finition, combinés en une seule fourchette pour tout le projet.",
        href: "/services/basements",
      },
      {
        icon: "drywall",
        title: "Gypse & finition",
        desc: "Démolition, installation, tirage de joints et réparations — jusqu'à la dernière couche de peinture.",
        href: "/services/drywall",
      },
      {
        icon: "brush",
        title: "Peinture",
        desc: "Murs, plafonds, boiseries et portes — calculée sur la surface réelle, pas seulement l'aire du plancher.",
        href: "/services/painting",
      },
      {
        icon: "hammer",
        title: "Rénovation intérieure",
        desc: "Projets multi-pièces ou maison complète, avec chaque corps de métier chiffré séparément plutôt qu'un seul total vague.",
        href: "/services/renovations",
      },
      {
        icon: "wrench",
        title: "Petites réparations",
        desc: "Retouches, réparations ponctuelles et raccords de couleur qui ne rentrent dans aucune autre catégorie.",
        href: "/services/repairs",
      },
    ],
    faqTitle: "Questions fréquentes",
    faq: estimatorFaqFr,
  },
};

const categoryIcons = {
  kitchen: IconKitchen,
  tiles: IconTiles,
  droplet: IconDroplet,
  stairs: IconStairs,
  drywall: IconDrywall,
  brush: IconBrush,
  hammer: IconHammer,
  wrench: IconWrench,
} as const;

export default function EstimatorContent() {
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
              className="rounded-full uppercase tracking-[0.08em] bg-brand-green px-7 py-3.5 font-heading font-bold text-white transition-colors hover:bg-brand-green-dark"
            >
              {c.ctaStart}
            </button>
            <a
              href={`tel:${SITE_PHONE_TEL}`}
              className="rounded-full uppercase tracking-[0.08em] border-2 border-brand-blue px-7 py-3.5 text-center font-heading font-bold text-brand-blue transition-colors hover:bg-brand-blue-light"
            >
              {c.ctaCall} · {SITE_PHONE}
            </a>
          </div>
        </div>
      </section>

      <section className="bg-brand-blue-light/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
              {c.stepsTitle}
            </h2>
            <p className="mt-3 text-sm text-charcoal/60">{c.stepsIntro}</p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {c.steps.map(({ title, desc }, i) => (
              <Reveal key={title} delayMs={i * 120}>
                <div className="h-full rounded-2xl border border-black/5 bg-white p-7 shadow-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-green font-heading text-lg font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-heading text-lg font-bold text-brand-blue">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-charcoal/75">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
            {c.honestTitle}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-charcoal/75">{c.honestBody}</p>
        </Reveal>

        <div className="mx-auto mt-14 grid max-w-5xl gap-8 lg:grid-cols-2">
          <Reveal className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-black/5">
            <h3 className="font-heading text-lg font-bold text-brand-blue">{c.canTitle}</h3>
            <ul className="mt-5 space-y-3">
              {c.canItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <IconCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" />
                  <span className="text-sm leading-relaxed text-charcoal/80">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delayMs={120} className="rounded-2xl bg-charcoal-dark/5 p-7 ring-1 ring-black/5">
            <h3 className="font-heading text-lg font-bold text-brand-blue">{c.cantTitle}</h3>
            <ul className="mt-5 space-y-3">
              {c.cantItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-charcoal/40" />
                  <span className="text-sm leading-relaxed text-charcoal/80">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delayMs={200} className="mx-auto mt-10 max-w-5xl rounded-2xl bg-brand-blue-light/40 p-7 ring-1 ring-black/5">
          <h3 className="font-heading text-base font-bold text-brand-blue">{c.sampleTitle}</h3>
          <p className="mt-2 text-sm leading-relaxed text-charcoal/70">{c.sampleIntro}</p>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {c.sampleItems.map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
                <dt className="text-xs leading-snug text-charcoal/60">{label}</dt>
                <dd className="mt-1 font-heading text-base font-bold text-brand-blue">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-charcoal/55">{c.sampleNote}</p>
        </Reveal>
      </section>

      <section className="bg-brand-blue-light/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
              {c.categoriesTitle}
            </h2>
            <p className="mt-3 text-sm text-charcoal/60">{c.categoriesIntro}</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {c.categories.map(({ icon, title, desc, href }) => (
              <FeatureCard
                key={title}
                icon={categoryIcons[icon as keyof typeof categoryIcons]}
                title={title}
                desc={desc}
                href={href}
                footer={`${t.services.learnMore} →`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="text-center font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
          {c.faqTitle}
        </h2>
        <div className="mt-10 space-y-6">
          {c.faq.map(({ q, a }) => (
            <Reveal key={q} className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
              <h3 className="font-heading text-base font-bold text-brand-blue">{q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal/75">{a}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <CtaBand />
    </>
  );
}
