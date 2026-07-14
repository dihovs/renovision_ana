"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { IconHammer, IconCheckCircle, IconHome, IconShield } from "@/components/ui/icons";
import { SITE_EMAIL } from "@/lib/constants";

const copy = {
  en: {
    eyebrow: "Careers",
    title: "Build Something That Lasts — Including Your Career",
    intro:
      "We're a growing renovation team that treats its people the way it treats its work: with care and respect. If you take pride in your craft, we'd like to meet you.",
    whyTitle: "Why work with us",
    reasons: [
      {
        icon: "hammer",
        title: "Steady, Varied Work",
        desc: "Kitchens, bathrooms, basements, water damage response — no two weeks look the same.",
      },
      {
        icon: "check",
        title: "Quality Over Shortcuts",
        desc: "We schedule jobs so you have time to do them right. Your name goes on work you can be proud of.",
      },
      {
        icon: "shield",
        title: "Safety First, Always",
        desc: "Proper equipment, real training, and job sites run by people who care that you get home safe.",
      },
      {
        icon: "home",
        title: "Room to Grow",
        desc: "Learn new trades on the job and take on more responsibility as you're ready for it.",
      },
    ],
    rolesTitle: "Who we're looking for",
    rolesDesc:
      "We're always interested in hearing from experienced renovation carpenters, flooring installers, painters, drywall finishers, and reliable general labourers — as well as apprentices eager to learn.",
    applyTitle: "How to apply",
    applyDesc:
      "Send us a short email with your experience, the kind of work you like doing, and when you can start. A resume helps but isn't required — we care more about your work.",
    applyCta: "Email Us About a Job",
  },
  fr: {
    eyebrow: "Carrières",
    title: "Construisez quelque chose de durable — y compris votre carrière",
    intro:
      "Nous sommes une équipe de rénovation en pleine croissance qui traite ses gens comme elle traite son travail : avec soin et respect. Si vous êtes fier de votre métier, nous aimerions vous rencontrer.",
    whyTitle: "Pourquoi travailler avec nous",
    reasons: [
      {
        icon: "hammer",
        title: "Du travail stable et varié",
        desc: "Cuisines, salles de bain, sous-sols, interventions après dégât d'eau — aucune semaine ne se ressemble.",
      },
      {
        icon: "check",
        title: "La qualité avant les raccourcis",
        desc: "Nous planifions les chantiers pour que vous ayez le temps de bien faire les choses. Votre nom est associé à un travail dont vous pouvez être fier.",
      },
      {
        icon: "shield",
        title: "La sécurité d'abord, toujours",
        desc: "De l'équipement adéquat, une vraie formation et des chantiers gérés par des gens qui tiennent à ce que vous rentriez chez vous en sécurité.",
      },
      {
        icon: "home",
        title: "De la place pour grandir",
        desc: "Apprenez de nouveaux métiers sur le chantier et prenez plus de responsabilités à votre rythme.",
      },
    ],
    rolesTitle: "Qui nous cherchons",
    rolesDesc:
      "Nous sommes toujours intéressés à rencontrer des menuisiers de rénovation expérimentés, des installateurs de planchers, des peintres, des finisseurs de gypse et des manœuvres fiables — ainsi que des apprentis désireux d'apprendre.",
    applyTitle: "Comment postuler",
    applyDesc:
      "Envoyez-nous un court courriel décrivant votre expérience, le type de travail que vous aimez et votre disponibilité. Un CV aide, mais n'est pas obligatoire — c'est votre travail qui compte.",
    applyCta: "Écrivez-nous pour un emploi",
  },
};

const icons = {
  hammer: IconHammer,
  check: IconCheckCircle,
  shield: IconShield,
  home: IconHome,
} as const;

export default function CareersContent() {
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
      </section>

      <section className="bg-brand-blue-light/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
            {c.whyTitle}
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {c.reasons.map(({ icon, title, desc }) => {
              const Icon = icons[icon as keyof typeof icons];
              return (
                <div key={title} className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-black/5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-green-light text-brand-green">
                    <Icon />
                  </div>
                  <h3 className="mt-5 font-heading text-lg font-bold text-brand-blue">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-charcoal/75">{desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h2 className="font-heading text-3xl font-bold text-brand-blue">{c.rolesTitle}</h2>
        <p className="mt-4 leading-relaxed text-charcoal/75">{c.rolesDesc}</p>
        <div className="mt-12 rounded-2xl bg-navy p-8">
          <h3 className="font-heading text-2xl font-bold text-white">{c.applyTitle}</h3>
          <p className="mt-3 text-white/75">{c.applyDesc}</p>
          <a
            href={`mailto:${SITE_EMAIL}?subject=Job%20Application`}
            className="mt-6 inline-block rounded-full bg-brand-green px-7 py-3 font-heading font-bold text-white transition-colors hover:bg-brand-green-dark"
          >
            {c.applyCta}
          </a>
        </div>
      </section>
    </>
  );
}
