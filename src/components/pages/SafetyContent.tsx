"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import Link from "@/components/ui/LocaleLink";
import FeatureCard from "@/components/ui/FeatureCard";
import CtaBand from "@/components/home/CtaBand";
import TrustBar from "@/components/home/TrustBar";
import { IconShield, IconCheckCircle, IconClipboard, IconBuilding, IconHome } from "@/components/ui/icons";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

const copy = {
  en: {
    eyebrow: "Safety & Warranty",
    title: "Insured, Guaranteed, and Serious About Safety",
    intro:
      "Insurance companies and property managers need more than good work — they need proof. Here are the credentials, coverage, and practices behind every Renovision AnA job site.",
    benefitsTitle: "Credentials & coverage",
    benefitsIntro: "What every client and adjuster can count on.",
    benefits: [
      {
        icon: "shield",
        title: "Insured & Guaranteed",
        desc: "Comprehensive liability insurance on every job, and a one-year workmanship warranty in writing. Insurance certificates available on request for vendor onboarding.",
      },
      {
        icon: "check",
        title: "Safety-Trained Crews",
        desc: "Every crew member follows written safe-work procedures for demolition, water damage, working at heights, and hazardous material awareness.",
      },
      {
        icon: "clipboard",
        title: "Documented Compliance",
        desc: "Job hazard assessments, incident logs, and equipment inspections are recorded on every project — documentation insurers can rely on.",
      },
      {
        icon: "building",
        title: "Insurance Claims Experience",
        desc: "We work within claims processes daily: scope documentation, photo evidence, and estimates formatted for adjusters.",
      },
      {
        icon: "home",
        title: "On Every Job Site",
        desc: "Site containment, PPE, daily cleanup, clear signage, moisture readings logged during drying, and a final walkthrough on completion.",
      },
    ],
    ctaTitle: "Need our certificates for your vendor file?",
    ctaDesc:
      "Contact us and we'll send them the same day. Every certificate is available on request.",
  },
  fr: {
    eyebrow: "Sécurité et garantie",
    title: "Assurés, garantis et sérieux en matière de sécurité",
    intro:
      "Les assureurs et les gestionnaires immobiliers ont besoin de plus que du bon travail — ils ont besoin de preuves. Voici les attestations, les couvertures et les pratiques derrière chaque chantier Renovision AnA.",
    benefitsTitle: "Attestations et couvertures",
    benefitsIntro: "Ce que chaque client et expert peut attendre.",
    benefits: [
      {
        icon: "shield",
        title: "Assuré et garanti",
        desc: "Assurance responsabilité civile complète sur chaque chantier, et une garantie écrite d'un an sur la main-d'œuvre. Attestations d'assurance disponibles sur demande.",
      },
      {
        icon: "check",
        title: "Équipes formées en sécurité",
        desc: "Chaque membre d'équipe suit des procédures écrites de travail sécuritaire : démolition, dégâts d'eau, travail en hauteur et sensibilisation aux matières dangereuses.",
      },
      {
        icon: "clipboard",
        title: "Conformité documentée",
        desc: "Analyses de risques, registres d'incidents et inspections d'équipement consignés sur chaque projet — une documentation fiable pour les assureurs.",
      },
      {
        icon: "building",
        title: "Expérience en réclamations d'assurance",
        desc: "Nous travaillons quotidiennement dans les processus de réclamation : documentation de l'étendue des travaux, preuves photo et estimations formatées pour les experts.",
      },
      {
        icon: "home",
        title: "Sur chaque chantier",
        desc: "Confinement, EPI, nettoyage quotidien, signalisation claire, relevés d'humidité consignés pendant le séchage et visite de fin de chantier.",
      },
    ],
    ctaTitle: "Besoin de nos attestations pour votre dossier fournisseur?",
    ctaDesc:
      "Contactez-nous et nous les enverrons le jour même. Chaque attestation est disponible sur demande.",
  },
};

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  shield: IconShield,
  check: IconCheckCircle,
  clipboard: IconClipboard,
  building: IconBuilding,
  home: IconHome,
};

type IconKey = keyof typeof icons;
type Benefit = { icon: IconKey; title: string; desc: string };

export default function SafetyContent() {
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
              className="cursor-pointer rounded-full uppercase tracking-[0.08em] bg-brand-green px-7 py-3.5 font-heading font-bold text-white transition-colors hover:bg-brand-green-dark"
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

      <section className="border-t border-black/5 bg-brand-blue-light/20 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
              {c.benefitsTitle}
            </h2>
            <p className="mt-3 text-charcoal/70">{c.benefitsIntro}</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {c.benefits.map((b) => {
              const Icon = icons[b.icon as IconKey];
              return <FeatureCard key={b.title} icon={Icon} title={b.title} desc={b.desc} />;
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <h2 className="font-heading text-2xl font-bold text-brand-blue">{c.ctaTitle}</h2>
          <p className="mt-3 leading-relaxed text-charcoal/75">{c.ctaDesc}</p>
          <button
            onClick={openChat}
            className="mt-6 cursor-pointer rounded-full uppercase tracking-[0.08em] bg-brand-green px-7 py-3.5 font-heading font-bold text-white transition-colors hover:bg-brand-green-dark"
          >
            {t.ctaBand.ctaEstimate}
          </button>
        </div>
      </section>

      <TrustBar />
      <CtaBand />
    </>
  );
}