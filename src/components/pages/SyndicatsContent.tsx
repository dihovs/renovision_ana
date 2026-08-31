"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import Link from "@/components/ui/LocaleLink";
import FeatureCard from "@/components/ui/FeatureCard";
import CtaBand from "@/components/home/CtaBand";
import TrustBar from "@/components/home/TrustBar";
import {
  IconClipboard,
  IconCheckCircle,
  IconBuilding,
  IconShield,
  IconCalendar,
  IconHome,
} from "@/components/ui/icons";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

/**
 * Audience page for condo syndicates — the second of its kind after
 * /commercial, which serves property managers.
 *
 * Why it exists: the SERP for « syndicat de copropriété dégât d'eau
 * responsabilité » is five results deep in trade press, Radio-Canada,
 * CondoLegal, Dunton Rainville and CA Legal, and not one of them is a
 * contractor. Every one settles who is liable and stops, leaving the board
 * member with the problem they actually have. See content/briefs/syndicats.md.
 *
 * The hinge fact is CondoLegal's: after a loss it is the syndicate that must
 * intervene and have the work carried out to repair the damage and preserve the
 * building, and its insurer that takes the file first. That makes the board's
 * next task procurement, under time pressure.
 *
 * IMPORTANT — nothing here is a new capability claim. Written scope separating
 * common from private portions, photo documentation, invoicing an adjuster can
 * process, occupied-building phasing, certificates on request and the one-year
 * written warranty all already appear on /safety, /commercial or the LaSalle
 * area FAQ. This page assembles them for a reader who has never seen the site.
 * If you add anything to this page, check it is already true somewhere else
 * first. No named syndicate and no volume claim: the owner confirmed there is
 * no reference we can name (2026-08-30), so the page ships without one rather
 * than implying work we cannot show.
 */
const icons = {
  clipboard: IconClipboard,
  check: IconCheckCircle,
  building: IconBuilding,
  shield: IconShield,
  calendar: IconCalendar,
  home: IconHome,
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
    greyTitle: string;
    greyParagraphs: string[];
    linksTitle: string;
    links: { label: string; href: string }[];
    ctaTitle: string;
    ctaDesc: string;
  }
> = {
  en: {
    eyebrow: "For Condo Syndicates",
    title: "A Contractor Who Knows How a Syndicate Works",
    intro:
      "You've just learned that it's the syndicate that has to act. That's correct: after a loss it is the syndicate that must step in and have the work carried out to repair the damage and preserve the building, and it is the syndicate's insurer that takes the file first. What's left is the part nobody explains — who does the work, in an occupied building, and how it gets invoiced. Our line is answered 24/7.",
    benefitsTitle: "What a board actually needs",
    benefitsIntro: "Six things, and they're always the same.",
    benefits: [
      {
        icon: "clipboard",
        title: "A scope that separates common from private",
        desc: "That boundary is what the adjuster has to rule on. We draw it in the quote rather than leaving it to be negotiated afterwards, which avoids the round trip that stalls the file.",
      },
      {
        icon: "check",
        title: "Photo documentation, before and after",
        desc: "Dated, from the first day to the last. The board needs it for its members, the insurer for its file, and nobody can reconstruct it later.",
      },
      {
        icon: "building",
        title: "Invoicing your insurer can process",
        desc: "Itemised, separated by line, readable by someone who wasn't on site. A lump-sum quote with no detail gets refused by the adjuster and comes back to the board.",
      },
      {
        icon: "calendar",
        title: "Work in an occupied building",
        desc: "Containment, protection of common corridors, and noisy phases scheduled to agreed hours. The neighbours stay home during the work — that's a planning constraint, not a surprise.",
      },
      {
        icon: "shield",
        title: "Insurance and certificates",
        desc: "Comprehensive liability insurance on every job, with certificates available on request for your vendor files.",
      },
      {
        icon: "home",
        title: "A one-year written warranty",
        desc: "On workmanship, in writing, handed over with the final invoice.",
      },
    ],
    greyTitle: "The grey zone, and how we handle it",
    greyParagraphs: [
      "In almost every water loss in a co-ownership there is a space nobody claims: the drywall, the insulation, the flooring. The syndicate's policy answers for the building; the co-owner's, for their improvements. In between, the material stays wet while the question gets settled.",
      "Our position is simple and not at all legal: we dry first, because drying is mitigation and the EPA's 24-to-48-hour mould benchmark doesn't pause for discussions. Then we hand over a written scope with the separation already drawn, so both files can move in parallel rather than one after the other.",
      "We don't decide what's covered. We keep the question from costing a week of drying.",
    ],
    linksTitle: "Worth reading before your next meeting",
    links: [
      {
        label: "Who actually pays for a condo water loss in Quebec",
        href: "/blog/condo-water-damage-who-pays",
      },
      {
        label: "What Bill 16 requires of your syndicate, and by when",
        href: "/blog/quebec-bill-16-condo-contingency-fund-study",
      },
      {
        label: "What actually moves an insurance claim",
        href: "/blog/insurance-claim-water-damage-quebec",
      },
    ],
    ctaTitle: "A quote your board can table",
    ctaDesc:
      "Send us the loss notice and a few photos. We come back with a written scope you can put in front of the next meeting.",
  },
  fr: {
    eyebrow: "Pour les syndicats de copropriété",
    title: "Un entrepreneur qui connaît le fonctionnement d'un syndicat",
    intro:
      "Vous venez d'apprendre que c'est au syndicat d'agir. C'est exact : après un sinistre, c'est le syndicat qui doit intervenir et faire exécuter les travaux nécessaires pour réparer les dommages et conserver l'immeuble, et c'est son assureur qui prend le dossier en charge en premier. Reste la partie que personne n'explique — qui fait le travail, dans un immeuble occupé, et comment il se facture. Notre ligne est répondue 24/7.",
    benefitsTitle: "Ce dont un conseil d'administration a besoin",
    benefitsIntro: "Six choses, et ce sont toujours les mêmes.",
    benefits: [
      {
        icon: "clipboard",
        title: "Une portée qui sépare les parties communes des privatives",
        desc: "C'est la frontière sur laquelle l'expert en sinistre doit trancher. Nous la traçons dans la soumission plutôt que de la laisser se négocier après coup, ce qui évite l'aller-retour qui immobilise le dossier.",
      },
      {
        icon: "check",
        title: "Une documentation photo avant et après",
        desc: "Datée, du premier jour à la fin. Le conseil en a besoin pour ses membres, l'assureur pour son dossier, et personne ne peut la reconstituer plus tard.",
      },
      {
        icon: "building",
        title: "Une facturation que votre assureur peut traiter",
        desc: "Détaillée, séparée par poste, lisible par quelqu'un qui n'était pas sur le chantier. Une soumission globale sans détail est refusée par l'expert et revient au conseil.",
      },
      {
        icon: "calendar",
        title: "Le travail en immeuble occupé",
        desc: "Confinement, protection des corridors communs, et phases bruyantes planifiées selon des heures convenues. Les voisins restent chez eux pendant les travaux — c'est une contrainte de planification, pas une surprise.",
      },
      {
        icon: "shield",
        title: "Assurance et attestations",
        desc: "Assurance responsabilité civile complète sur chaque chantier, attestations disponibles sur demande pour vos dossiers de fournisseurs.",
      },
      {
        icon: "home",
        title: "Une garantie écrite d'un an",
        desc: "Sur la main-d'œuvre, par écrit, remise avec la facturation finale.",
      },
    ],
    greyTitle: "La zone grise, et comment on la traite",
    greyParagraphs: [
      "Dans presque tout dégât d'eau en copropriété, il y a un espace que personne ne revendique : le gypse, l'isolant, le plancher. La police du syndicat répond de l'immeuble; celle du copropriétaire, de ses améliorations. Entre les deux, le matériau reste mouillé pendant que la question se règle.",
      "Notre position est simple et elle n'a rien de juridique : nous asséchons d'abord, parce que l'assèchement est de la mitigation et que le seuil de 24 à 48 heures de l'EPA pour la moisissure ne s'arrête pas pendant les discussions. Puis nous remettons une portée écrite où la séparation est déjà tracée, pour que les deux dossiers avancent en parallèle plutôt que l'un après l'autre.",
      "Nous ne décidons pas de ce qui est couvert. Nous faisons en sorte que la question ne coûte pas une semaine de séchage.",
    ],
    linksTitle: "À lire avant votre prochaine réunion",
    links: [
      {
        label: "Qui paie vraiment un dégât d'eau en copropriété au Québec",
        href: "/blog/condo-water-damage-who-pays",
      },
      {
        label: "Ce que la loi 16 exige de votre syndicat, et d'ici quand",
        href: "/blog/quebec-bill-16-condo-contingency-fund-study",
      },
      {
        label: "Ce qui fait vraiment avancer une réclamation",
        href: "/blog/insurance-claim-water-damage-quebec",
      },
    ],
    ctaTitle: "Une soumission pour votre conseil",
    ctaDesc:
      "Envoyez-nous la déclaration de sinistre et quelques photos. Nous revenons avec une portée écrite que vous pouvez déposer à la prochaine réunion.",
  },
};

export default function SyndicatsContent() {
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
              const Icon = icons[b.icon];
              return <FeatureCard key={b.title} icon={Icon} title={b.title} desc={b.desc} />;
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
          {c.greyTitle}
        </h2>
        <div className="mt-6 space-y-5 leading-relaxed text-charcoal/75">
          {c.greyParagraphs.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
        </div>

        <h2 className="mt-14 font-heading text-xl font-bold text-brand-blue">{c.linksTitle}</h2>
        <ul className="mt-4 space-y-3">
          {c.links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="group inline-flex items-center gap-1.5 text-base text-brand-green transition-colors hover:text-brand-green-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green"
              >
                {l.label}
                <span
                  aria-hidden
                  className="text-lg leading-none transition-transform duration-200 motion-safe:group-hover:translate-x-1"
                >
                  &rsaquo;
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-14 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
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
