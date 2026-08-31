"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import FeatureCard from "@/components/ui/FeatureCard";
import GroundedImage from "@/components/ui/GroundedImage";
import Reveal from "@/components/ui/Reveal";
import {
  IconBuilding,
  IconClipboard,
  IconCheckCircle,
  IconCalendar,
  IconShield,
  IconHome,
} from "@/components/ui/icons";
import TrustBar from "@/components/home/TrustBar";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

const copy = {
  en: {
    eyebrow: "For Property Management Companies",
    title: "Renovation Contractor for Property Managers in Laval and Montreal",
    intro:
      "A partner that keeps your portfolio moving: vacant units cost money every day they sit empty. We help property managers turn units fast, respond to emergencies, and keep tenants happy — with one point of contact and paperwork your office can actually use.",
    narrativeTitle: "Built to Make a Property Manager's Job Easier",
    narrativeParagraphs: [
      "You manage more buildings than there are hours in the day. Every vacant unit is lost revenue, every maintenance call is a tenant relationship on the line, and every new vendor is one more phone number to track down when something goes wrong. That's the day-to-day reality of property management in Laval and greater Montreal — and it's exactly what Renovision AnA was built around.",
      "Instead of juggling a painter, a flooring installer, and a water damage crew separately, you call one number. We handle interior renovations, flooring, kitchen and bathroom remodels, basement build-outs, water damage restoration, and small color-matched repairs — all under one roof, with one coordinator who already knows your portfolio and your timelines.",
      "When a unit floods at 11pm or a tenant reports a leak on a Sunday, you need a crew that shows up — not a voicemail. We respond quickly, document everything with dated photos and itemized reports your owners and insurers can act on immediately, and our crews work cleanly around occupied units and common areas, because your tenants' patience is part of what you're protecting.",
      "The result: shorter vacancy windows, fewer vendor headaches, and documentation that holds up when an owner or an insurance adjuster asks questions.",
    ],
    occupiedTitle: "What changes when the building is occupied",
    occupiedParagraphs: [
      "A general contractor writes their page for an owner renovating their own home. You manage a building where the neighbours upstairs work from home, the corridor is shared, and the tenant in 3 is entitled to know when the noise stops. That is a different trade, and it gets planned before the first hammer.",
      "In practice: containment and access are decided before demolition, not during it. Noisy hours are set in advance and communicated. Corridors and elevators get protected, because damage to common areas becomes your problem, not ours. And the site is closed down each evening in a state a tenant can walk past without calling you.",
      "The same logic on the administrative side. One invoice per unit, itemised by line, in a form an owner can approve without calling you back to ask what a line means. Dated before-and-after photographs, because that is what settles a dispute six months later. And one number to call, rather than a painter, a flooring installer and a water damage crew for you to coordinate yourself.",
    ],
    benefitsTitle: "Why property managers work with us",
    benefits: [
      {
        icon: "calendar",
        title: "Fast Unit Turnovers",
        desc: "Scheduled make-ready work between tenants — paint, flooring, repairs — done on predictable timelines.",
      },
      {
        icon: "clipboard",
        title: "Clear Documentation",
        desc: "Photo reports, itemized invoices, and scope sheets formatted for your files and your owners.",
      },
      {
        icon: "check",
        title: "One Point of Contact",
        desc: "A single coordinator for all your buildings. No chasing subcontractors.",
      },
      {
        icon: "shield",
        title: "Fully Insured",
        desc: "Liability coverage and credentials on file, ready for your vendor onboarding.",
      },
      {
        icon: "home",
        title: "Occupied-Unit Experience",
        desc: "Respectful crews who work cleanly around tenants and common areas.",
      },
      {
        icon: "building",
        title: "Volume-Friendly Pricing",
        desc: "Consistent rates across your portfolio, with priority scheduling for recurring clients.",
      },
    ],
    processTitle: "Built for portfolio-scale work",
    processDesc:
      "From single-unit refreshes to multi-floor water damage response, we scale crews to the job and report progress as we go.",
    stats: [
      { value: "Insured", label: "1-year workmanship warranty" },
      { value: "48h", label: "Typical estimate turnaround" },
      { value: "1", label: "Point of contact per portfolio" },
    ],
  },
  fr: {
    eyebrow: "Pour les compagnies de gestion immobilière",
    title: "Entrepreneur en rénovation pour gestionnaires immobiliers, à Laval et Montréal",
    intro:
      "Un partenaire qui fait avancer votre portefeuille : un logement vacant coûte de l'argent chaque jour. Nous aidons les gestionnaires immobiliers à retourner les unités rapidement, à répondre aux urgences et à garder les locataires satisfaits — avec un seul point de contact et une documentation que votre bureau peut vraiment utiliser.",
    narrativeTitle: "Conçu pour faciliter le travail des gestionnaires immobiliers",
    narrativeParagraphs: [
      "Vous gérez plus d'immeubles qu'il n'y a d'heures dans une journée. Chaque unité vacante représente des revenus perdus, chaque appel de maintenance met en jeu une relation avec un locataire, et chaque nouveau fournisseur est un numéro de téléphone de plus à retracer quand quelque chose tourne mal. C'est le quotidien de la gestion immobilière à Laval et dans le grand Montréal — et c'est exactement ce pour quoi Renovision AnA a été conçue.",
      "Plutôt que de jongler séparément avec un peintre, un poseur de plancher et une équipe de restauration de dégâts d'eau, vous appelez un seul numéro. Nous prenons en charge les rénovations intérieures, les planchers, les rénovations de cuisine et de salle de bain, l'aménagement de sous-sols, la restauration de dégâts d'eau et les petites réparations avec agencement de couleurs — le tout sous un même toit, avec un seul coordonnateur qui connaît déjà votre portefeuille et vos échéanciers.",
      "Quand une unité est inondée à 23h ou qu'un locataire signale une fuite un dimanche, vous avez besoin d'une équipe qui se présente — pas d'une boîte vocale. Nous répondons rapidement, documentons tout avec des photos datées et des rapports détaillés que vos propriétaires et vos assureurs peuvent utiliser immédiatement, et nos équipes travaillent proprement autour des unités occupées et des aires communes, parce que la patience de vos locataires fait aussi partie de ce que vous protégez.",
      "Le résultat : des périodes de vacance plus courtes, moins de maux de tête liés aux fournisseurs, et une documentation qui tient la route quand un propriétaire ou un expert en sinistres pose des questions.",
    ],
    occupiedTitle: "Ce qui change quand l'immeuble est occupé",
    occupiedParagraphs: [
      "Un entrepreneur général écrit sa page pour un propriétaire qui rénove chez lui. Vous, vous gérez un immeuble où les voisins du dessus travaillent de la maison, où le corridor est commun, et où le locataire du 3 a le droit de savoir quand le bruit s'arrête. C'est un métier différent, et il se planifie avant le premier coup de marteau.",
      "Concrètement : le confinement et les accès se décident avant la démolition, pas pendant. Les heures bruyantes se fixent d'avance et se communiquent. Les corridors et les ascenseurs se protègent, parce que les dommages aux parties communes deviennent votre problème, pas le nôtre. Et le chantier se referme chaque soir dans un état où un locataire peut passer devant sans vous appeler.",
      "Côté administratif, la même logique. Une seule facture par unité, détaillée par poste, dans une forme qu'un propriétaire peut approuver sans vous rappeler pour demander ce que signifie une ligne. Des photos datées avant et après, parce que c'est ce qui règle une contestation six mois plus tard. Et un seul numéro à composer, plutôt qu'un peintre, un poseur de plancher et une équipe de dégât d'eau à coordonner vous-même.",
    ],
    benefitsTitle: "Pourquoi les gestionnaires immobiliers travaillent avec nous",
    benefits: [
      {
        icon: "calendar",
        title: "Rotation rapide des unités",
        desc: "Travaux de remise en état planifiés entre locataires — peinture, planchers, réparations — dans des délais prévisibles.",
      },
      {
        icon: "clipboard",
        title: "Documentation claire",
        desc: "Rapports photo, factures détaillées et fiches de travaux adaptées à vos dossiers et à vos propriétaires.",
      },
      {
        icon: "check",
        title: "Un seul point de contact",
        desc: "Un coordonnateur unique pour tous vos immeubles. Fini la course aux sous-traitants.",
      },
      {
        icon: "shield",
        title: "Entièrement assuré",
        desc: "Couverture de responsabilité et attestations au dossier, prêtes pour votre processus d'approbation des fournisseurs.",
      },
      {
        icon: "home",
        title: "Expérience en logements occupés",
        desc: "Des équipes respectueuses qui travaillent proprement autour des locataires et des aires communes.",
      },
      {
        icon: "building",
        title: "Tarification adaptée au volume",
        desc: "Des tarifs constants sur l'ensemble de votre portefeuille, avec priorité aux clients récurrents.",
      },
    ],
    processTitle: "Conçu pour le travail à l'échelle d'un portefeuille",
    processDesc:
      "Du rafraîchissement d'une seule unité à l'intervention après dégât d'eau sur plusieurs étages, nous adaptons nos équipes au travail et rapportons l'avancement en continu.",
    stats: [
      { value: "Assurés", label: "Garantie d'un an sur la main-d'œuvre" },
      { value: "48h", label: "Délai d'estimation typique" },
      { value: "1", label: "Point de contact par portefeuille" },
    ],
  },
};

const icons = {
  calendar: IconCalendar,
  clipboard: IconClipboard,
  check: IconCheckCircle,
  shield: IconShield,
  home: IconHome,
  building: IconBuilding,
} as const;

export default function CommercialContent() {
  const { locale, t } = useLanguage();
  const { openChat } = useChat();
  const c = copy[locale];

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-green-dark">
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
              {t.ctaBand.ctaEstimate}
            </button>
            <a
              href={`tel:${SITE_PHONE_TEL}`}
              className="rounded-full uppercase tracking-[0.08em] border-2 border-brand-blue px-7 py-3.5 text-center font-heading font-bold text-brand-blue transition-colors hover:bg-brand-blue-light"
            >
              {t.ctaBand.ctaCall} · {SITE_PHONE}
            </a>
          </div>
        </div>
      </section>

      {/* Same grounding treatment as the homepage hero: a soft wash behind the
          section plus offset shapes under the photo. Without them the image
          reads as a rectangle pasted onto white rather than something sitting
          in the layout. Mirrored from the hero, since the photo is on the left
          here and on the right there. */}
      <section className="relative overflow-hidden pb-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 55% at 22% 45%, rgba(43,92,158,0.07), transparent 70%), radial-gradient(40% 45% at 15% 80%, rgba(78,158,46,0.06), transparent 70%)",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <Reveal className="order-2 lg:order-1">
            <GroundedImage
              flip
              src="/images/office-interior.jpg"
              alt="Modern property management office with city skyline view and a maintenance cart staged with tools and a hard hat"
            />
          </Reveal>
          <Reveal delayMs={150} className="order-1 lg:order-2">
            <h2 className="font-heading text-2xl font-bold text-brand-blue sm:text-3xl">
              {c.narrativeTitle}
            </h2>
            <div className="mt-5 space-y-4">
              {c.narrativeParagraphs.map((p) => (
                <p key={p.slice(0, 24)} className="text-sm leading-relaxed text-charcoal/75">
                  {p}
                </p>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* The intersection the SERP has nobody standing in: general contractors
          write for an owner renovating their own home, property-management
          firms sell management. This section is the page's reason to rank for
          « gestionnaire immobilier entrepreneur rénovation » — it is about the
          occupied building and the invoice, which is what actually decides
          whether a manager calls back. */}
      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
        <h2 className="font-heading text-2xl font-bold text-brand-blue sm:text-3xl">
          {c.occupiedTitle}
        </h2>
        <div className="mt-5 space-y-4">
          {c.occupiedParagraphs.map((p) => (
            <p key={p.slice(0, 24)} className="text-base leading-relaxed text-charcoal/75">
              {p}
            </p>
          ))}
        </div>
      </section>

      <section className="bg-brand-blue-light/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
            {c.benefitsTitle}
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {c.benefits.map(({ icon, title, desc }) => (
              <FeatureCard key={title} icon={icons[icon as keyof typeof icons]} title={title} desc={desc} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-charcoal-dark py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold text-white">{c.processTitle}</h2>
            <p className="mt-3 text-white/70">{c.processDesc}</p>
          </div>
          <div className="mt-10 grid gap-8 text-center sm:grid-cols-3">
            {c.stats.map(({ value, label }) => (
              <div key={label}>
                <div className="font-heading text-4xl font-extrabold text-brand-green-soft">
                  {value}
                </div>
                <div className="mt-1 text-sm text-white/70">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Insured, insurer-approved, one-year written warranty — the three
          things a manager checks before adding a vendor. This was the only
          landing page of its kind without it. */}
      <TrustBar />
    </>
  );
}
