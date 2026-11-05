"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import FeatureCard from "@/components/ui/FeatureCard";
import CtaBand from "@/components/home/CtaBand";
import TrustBar from "@/components/home/TrustBar";
import {
  IconClipboard,
  IconCheckCircle,
  IconBuilding,
  IconCalendar,
} from "@/components/ui/icons";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

const icons = {
  clipboard: IconClipboard,
  check: IconCheckCircle,
  building: IconBuilding,
  calendar: IconCalendar,
} as const;

type IconKey = keyof typeof icons;
type Benefit = { icon: IconKey; title: string; desc: string };

const copy: Record<
  "en" | "fr",
  {
    eyebrow: string;
    title: string;
    intro: string;
    benefitsTitle: string;
    benefitsIntro: string;
    benefits: Benefit[];
    ctaTitle: string;
    ctaDesc: string;
  }
> = {
  en: {
    eyebrow: "For Property Managers",
    title: "A Single Point of Contact for Your Units",
    intro:
      "When a unit gets called back, every day it sits empty is rent you do not collect. You need a crew that arrives when they say they will, finishes on schedule, and documents everything so the insurer pays without asking you to explain. That is exactly what we do — one number to call, one project manager per file, and a written scope with photo documentation that keeps the adjuster out of your inbox.",
    benefitsTitle: "What a property manager actually needs",
    benefitsIntro: "The things that keep your units turning over.",
    benefits: [
      {
        icon: "clipboard",
        title: "Single point of contact per job",
        desc: "One project manager owns the file from inspection to final invoice. You never get transferred or have to explain the same loss to a different person.",
      },
      {
        icon: "calendar",
        title: "Predictable timelines",
        desc: "A written schedule at the first visit, with milestones for containment, drying, reconstruction, and finishing. You know when the unit comes back online.",
      },
      {
        icon: "check",
        title: "Insurance-compliant documentation",
        desc: "Dated photos, written scope, drying log. The adjuster gets what they need without a call to your office. The file moves on its own.",
      },
      {
        icon: "building",
        title: "Direct billing to the insurer",
        desc: "Itemised invoicing per line of scope, formatted for adjuster review. No rework cycles, no surprises on the final bill.",
      },
    ],
    ctaTitle: "A unit back online, on a clear timeline",
    ctaDesc:
      "One call gets a project manager on site same day. You get a written scope, a schedule, and a single point of contact until the keys go back to the tenant.",
  },
  fr: {
    eyebrow: "Pour les gestionnaires immobiliers",
    title: "Un interlocuteur unique pour vos unités",
    intro:
      "Quand une unité est rappelée, chaque jour d'inoccupation est un loyer que vous ne percevez pas. Vous avez besoin d'une équipe qui arrive à l'heure convenue, finit selon l'échéancier, et documente tout pour que l'assureur paie sans vous demander d'expliquer. C'est exactement ce que nous faisons — un numéro à appeler, un chargé de projet par dossier, et une portée écrite avec documentation photo qui garde l'expert en sinistre hors de votre boîte de réception.",
    benefitsTitle: "Ce dont un gestionnaire a besoin",
    benefitsIntro: "Les choses qui permettent à vos unités de se remettre en location rapidement.",
    benefits: [
      {
        icon: "clipboard",
        title: "Interlocuteur unique par dossier",
        desc: "Un seul chargé de projet suit le dossier de l'inspection à la facture finale. Vous n'êtes jamais transféré ni obligé d'expliquer le même sinistre à une autre personne.",
      },
      {
        icon: "calendar",
        title: "Échéanciers prévisibles",
        desc: "Un calendrier écrit dès la première visite, avec les étapes pour le confinement, le séchage, la reconstruction et les finitions. Vous savez quand l'unité sera prête.",
      },
      {
        icon: "check",
        title: "Documentation conforme aux assureurs",
        desc: "Photos datées, portée écrite, journal de séchage. L'expert obtient ce dont il a besoin sans appeler votre bureau.",
      },
      {
        icon: "building",
        title: "Facturation directe à l'assureur",
        desc: "Facturation détaillée poste par poste selon la portée, formatée pour la révision par l'expert. Pas de reprises ni de surprises.",
      },
    ],
    ctaTitle: "Une unité remise en état, avec un échéancier clair",
    ctaDesc:
      "Un appel suffit pour qu'un chargé de projet se rende sur place le jour même. Vous recevez une portée écrite, un calendrier et un interlocuteur unique jusqu'à ce que les clés retournent au locataire.",
  },
};

export default function GestionnairesContent() {
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
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {c.benefits.map((b) => {
              const Icon = icons[b.icon];
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