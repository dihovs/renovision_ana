"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import FeatureCard from "@/components/ui/FeatureCard";
import {
  IconBuilding,
  IconClipboard,
  IconCheckCircle,
  IconCalendar,
  IconShield,
  IconHome,
} from "@/components/ui/icons";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

const copy = {
  en: {
    eyebrow: "For Property Management Companies",
    title: "A Renovation Partner That Keeps Your Portfolio Moving",
    intro:
      "Vacant units cost money every day they sit empty. We help property managers turn units fast, respond to emergencies, and keep tenants happy — with one point of contact and paperwork your office can actually use.",
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
        title: "Fully Licensed & Insured",
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
      { value: "24/7", label: "Emergency response" },
      { value: "48h", label: "Typical estimate turnaround" },
      { value: "1", label: "Point of contact per portfolio" },
    ],
  },
  fr: {
    eyebrow: "Pour les compagnies de gestion immobilière",
    title: "Un partenaire de rénovation qui fait avancer votre portefeuille",
    intro:
      "Un logement vacant coûte de l'argent chaque jour. Nous aidons les gestionnaires immobiliers à retourner les unités rapidement, à répondre aux urgences et à garder les locataires satisfaits — avec un seul point de contact et une documentation que votre bureau peut vraiment utiliser.",
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
        title: "Licencié et assuré",
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
      { value: "24/7", label: "Réponse d'urgence" },
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
    </>
  );
}
