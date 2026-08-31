"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import ServiceDetailContent, { type ServiceDetailCopy } from "./ServiceDetailContent";
import { IconShield } from "@/components/ui/icons";
import { MOULD_FAQ } from "@/lib/serviceFaq";

/**
 * Mould remediation.
 *
 * This is the most contested SERP in the content backlog and the page does not
 * pretend otherwise. ÉcoRénov holds three ranking pages, Soluplus three more
 * branded « Expert Certifié », Sporetek sells air testing, and there is an
 * exact-match domain for attic mould. We are not going to out-authority
 * specialists on decontamination as a discipline.
 *
 * What none of them is: the trade that caused-and-cures it end to end. Mould is
 * a consequence — of a leak, a backup, an infiltration — and a decontamination
 * specialist hands the room back stripped, which makes the rebuild a second
 * call to a second contractor. That call is ours anyway. The whole page follows
 * from the H1: fix the water or it comes back.
 *
 * THREE THINGS THIS PAGE MUST NOT SAY, all owner decisions of 2026-08-30:
 *
 *   1. Any certification claim. There is no mould-specific credential to name,
 *      and wording vague enough to imply one is worse than silence.
 *   2. Anything about air testing. Not offered, not mentioned either way.
 *   3. Anything about asbestos. Flagged that ÉcoRénov sells asbestos work
 *      alongside mould so a reader may arrive with the question; the owner's
 *      call is to leave it off. Recorded here so a later reader knows it was a
 *      decision, not an oversight.
 *
 * And one the page holds on its own: no health claims. What mould does to a
 * child or an asthmatic is a medical question, and the copy names a doctor or
 * the CLSC rather than reassuring or alarming. See content/briefs/moisissure.md.
 */
const copy: Record<"en" | "fr", ServiceDetailCopy> = {
  en: {
    eyebrow: "Mould Remediation",
    title: "Mould Comes Back If You Don't Fix the Water",
    intro:
      "You lifted a baseboard, moved a box in the basement, or you have been smelling something since the water damage was “dried” last winter. The real question isn't how to remove what you can see — it's where the water that grew it is coming from. Our line is answered 24/7.",
    processTitle: "How It Works",
    processIntro: "Four steps, and the order is the point.",
    processSteps: [
      {
        title: "Find the water",
        desc: "Before anything else. Mould is a consequence: there is a leak, an infiltration, a backup or a cold bridge somewhere, and while it runs, whatever gets removed grows back. This is the step decontamination specialists skip most often, because the source isn't their mandate.",
      },
      {
        title: "Contain",
        desc: "We isolate the area before opening anything. Disturbing contaminated material in an open room moves the problem into the rest of the house — and in an occupied unit, it gets noticed immediately.",
      },
      {
        title: "Remove what's contaminated",
        desc: "Porous material isn't cleaned, it's replaced: drywall, insulation, carpet underlay, pressed wood. Non-porous material that is sound gets cleaned and stays. That line is drawn on site, not over the phone.",
      },
      {
        title: "Dry, verify, rebuild",
        desc: "We dry to moisture readings, not to a date. Then drywall, insulation, flooring and paint go back — by the same crew, with no second contractor to coordinate.",
      },
    ],
    includesTitle: "What's Included",
    includesIntro: "One crew from the diagnosis to the last coat of paint.",
    includes: [
      {
        title: "Source Diagnosis",
        desc: "Where the water is getting in, not only what it damaged. This is the part that decides whether the work holds.",
      },
      {
        title: "Controlled Removal",
        desc: "Containment, removal of affected porous material, and cleaning of what remains.",
      },
      {
        title: "Documentation for Your Claim",
        desc: "Dated readings and photographs from the first visit to the last, in a form an insurer can process.",
      },
      {
        title: "Full Rebuild",
        desc: "Drywall, insulation, flooring, paint. A specialist hands the room back stripped; we hand it back finished.",
      },
    ],
    localContext: {
      heading: "Why it comes back, and where we find it here",
      paragraphs: [
        "The EPA's benchmark is that wet material is very likely to grow mould within 24 to 48 hours. That number explains the speed, but not the recurrence. Recurrence always comes from the same thing: what was visible got removed without treating what was feeding it. A basement decontaminated in spring and regrown by autumn wasn't cleaned badly — it was diagnosed badly.",
        "In the housing stock here it hides in two places in particular. The finished basement, where the damage is behind something — subfloor under the laminate, insulation behind the strapping — and nothing shows until you open it. And the attic, where the problem isn't a leak but warm humid air rising out of the house and condensing under the roof in winter. Those are fixed differently, and confusing the two is the most common way to pay twice.",
        "One qualification, because it matters: we are contractors, not health professionals. What mould does to someone living with it — particularly a child, an asthmatic, or someone immunosuppressed — is a medical question, and the right person to answer it is a doctor or your CLSC, not us. Our job is to remove it and stop it coming back.",
      ],
      readMore: {
        label: "Read the hidden water damage and mould timeline",
        href: "/blog/hidden-water-damage-and-mold-timeline",
      },
    },
    faq: MOULD_FAQ.en,
  },
  fr: {
    eyebrow: "Décontamination de moisissure",
    title: "La moisissure revient si on ne règle pas l'eau",
    intro:
      "Vous avez soulevé une plinthe, déplacé une boîte au sous-sol, ou vous sentez quelque chose depuis que le dégât d'eau a été « séché » l'hiver dernier. La vraie question n'est pas comment enlever ce que vous voyez — c'est d'où vient l'eau qui l'a fait pousser. Notre ligne est répondue 24/7.",
    processTitle: "Comment ça se passe",
    processIntro: "Quatre étapes, et l'ordre est ce qui compte.",
    processSteps: [
      {
        title: "Trouver l'eau",
        desc: "Avant tout le reste. Une moisissure est une conséquence : il y a une fuite, une infiltration, un refoulement ou un pont thermique quelque part, et tant qu'il coule, tout ce qu'on retire va repousser. C'est l'étape que les spécialistes de la décontamination sautent le plus souvent, parce que la source n'est pas leur mandat.",
      },
      {
        title: "Confiner",
        desc: "On isole la zone avant d'ouvrir quoi que ce soit. Remuer un matériau contaminé dans une pièce ouverte, c'est transporter le problème dans le reste de la maison — et dans un logement occupé, ça se remarque tout de suite.",
      },
      {
        title: "Retirer ce qui est contaminé",
        desc: "Les matériaux poreux ne se nettoient pas, ils se remplacent : gypse, isolant, thibaude, bois pressé. Ce qui est non poreux et sain se nettoie et reste. Cette ligne-là se trace au chantier, pas au téléphone.",
      },
      {
        title: "Sécher, vérifier, refaire",
        desc: "On sèche jusqu'aux relevés d'humidité, pas jusqu'à une date. Puis le gypse, l'isolant, le plancher et la peinture reviennent — par la même équipe, sans deuxième entrepreneur à coordonner.",
      },
    ],
    includesTitle: "Ce qui est inclus",
    includesIntro: "Une seule équipe, du diagnostic à la dernière couche de peinture.",
    includes: [
      {
        title: "Diagnostic de la source",
        desc: "D'où l'eau entre, pas seulement ce qu'elle a abîmé. C'est la partie qui détermine si le travail tient.",
      },
      {
        title: "Retrait contrôlé",
        desc: "Confinement, retrait des matériaux poreux atteints, et nettoyage de ce qui reste.",
      },
      {
        title: "Documentation pour la réclamation",
        desc: "Relevés et photos datés, de la première visite à la dernière, sous une forme qu'un assureur peut traiter.",
      },
      {
        title: "Remise en état complète",
        desc: "Gypse, isolant, plancher, peinture. Un spécialiste vous rend la pièce à nu; nous vous la rendons finie.",
      },
    ],
    localContext: {
      heading: "Pourquoi elle revient, et où on la trouve ici",
      paragraphs: [
        "Le seuil de référence de l'EPA est qu'un matériau mouillé développe très probablement de la moisissure en 24 à 48 heures. Ce chiffre explique la vitesse, mais pas la récidive. La récidive vient toujours de la même chose : on a retiré ce qui était visible sans traiter ce qui alimentait. Un sous-sol décontaminé au printemps et repoussé à l'automne n'a pas été mal nettoyé — il a été mal diagnostiqué.",
        "Dans le parc immobilier d'ici, elle se cache à deux endroits en particulier. Le sous-sol fini, où le dommage est derrière quelque chose — sous-plancher sous le flottant, isolant derrière la fourrure — et où l'on ne voit rien jusqu'à ce qu'on ouvre. Et l'entretoit, où le problème n'est pas une fuite mais de l'air chaud et humide qui monte de la maison et condense sous le toit l'hiver. Les deux se règlent différemment, et confondre les deux est la façon la plus courante de payer deux fois.",
        "Une précision, parce qu'elle compte : nous sommes des entrepreneurs, pas des professionnels de la santé. Ce que la moisissure fait à quelqu'un qui vit avec — surtout un enfant, une personne asthmatique ou immunosupprimée — est une question médicale, et la bonne personne pour y répondre est un médecin ou votre CLSC, pas nous. Notre travail est de la retirer et d'empêcher qu'elle revienne.",
      ],
      readMore: {
        label: "Lire la chronologie des dégâts d'eau cachés et de la moisissure",
        href: "/blog/hidden-water-damage-and-mold-timeline",
      },
    },
    faq: MOULD_FAQ.fr,
  },
};

export default function MouldRemediationContent() {
  const { locale } = useLanguage();
  return <ServiceDetailContent icon={IconShield} copy={copy[locale]} />;
}
