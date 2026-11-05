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
  IconShield,
} from "@/components/ui/icons";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

const icons = {
  clipboard: IconClipboard,
  check: IconCheckCircle,
  building: IconBuilding,
  shield: IconShield,
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
    eyebrow: "For Insurance Companies",
    title: "A Contractor Who Speaks the Adjuster's Language",
    intro:
      "Every water damage claim runs on documentation. From the initial inspection notes to the drying log to the final invoice, every piece of paper that leaves your file has to be readable by someone who wasn't on site. That is what we deliver — written scope before work starts, photo documentation with timestamps, drying records an expert can verify, and itemised invoicing that goes straight through your system.",
    benefitsTitle: "What keeps a claim moving",
    benefitsIntro: "The things our file has that keeps yours from stalling.",
    benefits: [
      {
        icon: "clipboard",
        title: "Written scope before any work",
        desc: "A scope of work drawn before equipment goes in or demo starts. The adjuster sees what is planned, not what was done. No retroactive reconstruction.",
      },
      {
        icon: "check",
        title: "Photo documentation from day one",
        desc: "Dated photos of every room before, during, and after. The condition at first contact is preserved — not reconstructed from notes taken a week later.",
      },
      {
        icon: "building",
        title: "Direct billing to the insurer",
        desc: "Itemised per line of the scope, formatted for adjuster review. No lump-sum surprises that trigger a hold-and-verify cycle.",
      },
      {
        icon: "shield",
        title: "Comprehensive liability coverage",
        desc: "General liability insurance on every job. Certificates available on request for your vendor files.",
      },
    ],
    ctaTitle: "A file your adjuster can close",
    ctaDesc:
      "Send us the loss notice. We arrive with a camera, a moisture meter, and a scope template. The file comes back the way your system expects it.",
  },
  fr: {
    eyebrow: "Pour les assureurs",
    title: "Un entrepreneur qui parle le langage de l'expert en sinistre",
    intro:
      "Chaque réclamation dégât d'eau repose sur la documentation. De l'inspection initiale au journal de séchage jusqu'à la facture finale, chaque pièce qui quitte votre dossier doit être lisible par quelqu'un qui n'était pas sur le chantier. C'est ce que nous livrons — portée écrite avant les travaux, documentation photo horodatée, relevés de séchage vérifiables et facturation détaillée qui passe directement dans votre système.",
    benefitsTitle: "Ce qui fait avancer un dossier",
    benefitsIntro: "Ce que notre dossier contient pour éviter que le vôtre ne bloque.",
    benefits: [
      {
        icon: "clipboard",
        title: "Portée écrite avant tout travail",
        desc: "Un descriptif des travaux établi avant que l'équipement entre ou que la démolition commence. L'expert voit ce qui est prévu, pas ce qui a été fait.",
      },
      {
        icon: "check",
        title: "Documentation photo dès le premier jour",
        desc: "Photos datées de chaque pièce avant, pendant et après. L'état au premier contact est préservé.",
      },
      {
        icon: "building",
        title: "Facturation directe à l'assureur",
        desc: "Détaillée poste par poste selon la portée, formatée pour la révision par l'expert. Pas de surprises globales.",
      },
      {
        icon: "shield",
        title: "Couverture responsabilité complète",
        desc: "Assurance responsabilité civile sur chaque chantier. Attestations disponibles sur demande.",
      },
    ],
    ctaTitle: "Un dossier que votre expert peut fermer",
    ctaDesc:
      "Envoyez-nous la déclaration de sinistre. Nous arrivons avec un appareil photo, un humidimètre et un modèle de portée écrite. Le dossier revient comme votre système l'attend.",
  },
};

export default function AssureursContent() {
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