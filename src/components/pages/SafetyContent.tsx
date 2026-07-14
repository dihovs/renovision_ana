"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import FeatureCard from "@/components/ui/FeatureCard";
import { IconShield, IconCheckCircle, IconClipboard, IconBuilding } from "@/components/ui/icons";

const copy = {
  en: {
    eyebrow: "Safety & Certifications",
    title: "Licensed, Insured, and Serious About Safety",
    intro:
      "Insurance companies and property managers need more than good work — they need proof. Here are the credentials, coverage, and practices behind every Renovision AnA job site.",
    certsTitle: "Credentials & coverage",
    certs: [
      {
        icon: "shield",
        title: "Licensed & Insured",
        desc: "Fully licensed for residential and commercial renovation work, with comprehensive liability insurance. Certificates available on request for vendor onboarding.",
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
    ],
    practicesTitle: "On every job site",
    practices: [
      "Site containment and dust control in occupied buildings",
      "Personal protective equipment required for all crew",
      "Daily cleanup and secure tool storage",
      "Clear signage and protected walkways for tenants",
      "Moisture readings logged during water damage drying",
      "Final walkthrough and sign-off on completion",
    ],
    note: "Need our certificates or insurance documents for your vendor file? Contact us and we'll send them the same day.",
    contactCta: "Request Documents",
  },
  fr: {
    eyebrow: "Sécurité et certifications",
    title: "Licenciés, assurés et sérieux en matière de sécurité",
    intro:
      "Les assureurs et les gestionnaires immobiliers ont besoin de plus que du bon travail — ils ont besoin de preuves. Voici les attestations, les couvertures et les pratiques derrière chaque chantier Renovision AnA.",
    certsTitle: "Attestations et couvertures",
    certs: [
      {
        icon: "shield",
        title: "Licencié et assuré",
        desc: "Pleinement licencié pour les travaux de rénovation résidentiels et commerciaux, avec une assurance responsabilité complète. Certificats disponibles sur demande.",
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
    ],
    practicesTitle: "Sur chaque chantier",
    practices: [
      "Confinement du chantier et contrôle de la poussière dans les immeubles occupés",
      "Équipement de protection individuelle obligatoire pour toute l'équipe",
      "Nettoyage quotidien et rangement sécurisé des outils",
      "Signalisation claire et passages protégés pour les locataires",
      "Relevés d'humidité consignés pendant le séchage après dégât d'eau",
      "Visite finale et approbation à la fin des travaux",
    ],
    note: "Besoin de nos certificats ou documents d'assurance pour votre dossier fournisseur? Contactez-nous et nous les enverrons le jour même.",
    contactCta: "Demander les documents",
  },
};

const icons = {
  shield: IconShield,
  check: IconCheckCircle,
  clipboard: IconClipboard,
  building: IconBuilding,
} as const;

export default function SafetyContent() {
  const { locale } = useLanguage();
  const c = copy[locale];

  return (
    <>
      {/* Dark charcoal hero — the reference site's safety page treatment */}
      <section className="bg-charcoal-dark py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-green-soft">
            {c.eyebrow}
          </p>
          <h1 className="mt-3 font-heading text-4xl font-extrabold text-white sm:text-5xl">
            {c.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-white/70">{c.intro}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="text-center font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
          {c.certsTitle}
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {c.certs.map(({ icon, title, desc }) => (
            <FeatureCard
              key={title}
              icon={icons[icon as keyof typeof icons]}
              title={title}
              desc={desc}
            />
          ))}
        </div>
      </section>

      <section className="bg-brand-blue-light/40 py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
            {c.practicesTitle}
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {c.practices.map((p) => (
              <li key={p} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <IconCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" />
                <span className="text-sm leading-relaxed text-charcoal/85">{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-12 rounded-2xl bg-charcoal-dark p-8 text-center">
            <p className="text-white/85">{c.note}</p>
            <a
              href="/contact"
              className="mt-5 inline-block rounded-full bg-brand-green px-7 py-3 font-heading font-bold text-white transition-colors hover:bg-brand-green-dark"
            >
              {c.contactCta}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
