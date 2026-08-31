"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import ServiceDetailContent, { type ServiceDetailCopy } from "./ServiceDetailContent";
import { IconBackflow } from "@/components/ui/icons";

/**
 * Sewer backup (refoulement d'égout) is a separate page from water damage on
 * purpose, and not for keyword reasons alone: the two jobs have genuinely
 * different rules. A clean-water leak can often be dried in place; a backup is
 * contaminated water, so soaked porous material comes out rather than getting
 * dried and hoped over. Folding it into the water-damage page would have meant
 * writing one of those two procedures wrongly.
 *
 * Sourcing for `localContext`, in keeping with the standard set in
 * serviceAreas.ts — every local claim traces to something citable:
 *
 *  - Backwater valves mandatory under Montreal municipal by-law, and required
 *    in all new buildings since 2011; Rénoplex assistance of $80 for a standard
 *    valve, up to $560 where one goes in under existing flooring, and $1,500
 *    for a retention basin with pump. Source: Ville de Montréal,
 *    montreal.ca/articles/clapet-antiretour-la-cle-pour-prevenir-refoulement
 *    -degout-et-inondation-27249 (read 2026-08-30).
 *  - Same page: valves need servicing about twice a year and must stay
 *    accessible, and it names flooring installed over the access point as a
 *    common cause of blocked access. That is the paragraph worth having here —
 *    we are the trade that puts the flooring back.
 *  - The 24-to-48-hour mould window is the EPA benchmark already cited on the
 *    water-damage page and in the linked blog post.
 *
 * Deliberately NOT claimed: anything about Laval's own by-law. A search
 * suggested Laval prohibits a backwater valve on the main building drain,
 * which would be a genuinely useful thing to tell people — but it could not be
 * confirmed against a primary Ville de Laval source, so the copy says we
 * confirm the local requirement instead of asserting what it is. Replace this
 * with the real rule once someone has read it on ville.laval.qc.ca.
 */
const copy: Record<"en" | "fr", ServiceDetailCopy> = {
  en: {
    eyebrow: "Sewer Backup Cleanup",
    title: "When the Water Comes Back Up the Drain",
    intro:
      "A sewer backup isn't a flood of clean water — it's contaminated, and the clock on it is shorter. Our line is answered 24/7. Here's how the job runs, from the first call to the floor going back down.",
    processTitle: "How It Works",
    processIntro:
      "The same four stages whether it's one basement bathroom or a backed-up stack in a multiplex.",
    processSteps: [
      {
        title: "Call & Containment",
        desc: "You call — any hour, any day. We get the affected area sealed off first so contaminated water doesn't get tracked through the rest of the house.",
      },
      {
        title: "Extraction & Sanitation",
        desc: "Standing water is pumped out, then every surface that stays gets cleaned and disinfected rather than simply dried.",
      },
      {
        title: "Controlled Removal",
        desc: "Soaked porous material — underlay, the bottom of the drywall, insulation — comes out. This is the step that separates a backup from a clean-water leak, and skipping it is what leaves smell behind months later.",
      },
      {
        title: "Drying, Then Rebuild",
        desc: "We dry to logged moisture readings, then put back flooring, drywall, and paint — with the backwater valve left accessible, which matters more than most people expect.",
      },
    ],
    includesTitle: "What's Included",
    includesIntro: "One crew from the first pump to the last coat of paint, documented throughout.",
    includes: [
      {
        title: "Contaminated Water Extraction",
        desc: "Pumped out and hauled away, with the work area contained so the rest of the property stays clean.",
      },
      {
        title: "Disinfection & Odour Treatment",
        desc: "Surfaces cleaned and disinfected, not just dried — odour is usually a sign something porous was left in place.",
      },
      {
        title: "Documentation for Your Claim",
        desc: "Moisture readings and photos logged from the first visit to the final walkthrough, in a form an adjuster can process without a follow-up call.",
      },
      {
        title: "Full Rebuild",
        desc: "Flooring, drywall, trim, and paint restored by the same crew — including keeping the valve's access point reachable for future servicing.",
      },
    ],
    localContext: {
      heading: "Sewer backups in Laval and Montreal",
      paragraphs: [
        "The difference between a backup and a burst pipe is what's in the water. A supply line lets go and you have clean water that can often be dried in place. A backup brings contaminated water, so the rule changes: soaked porous material — carpet underlay, the bottom of the drywall, insulation in a finished basement — comes out rather than getting dried and hoped over. The EPA's 24-to-48-hour benchmark for mould growth on wet material still applies on top of that, which is why the removal decision gets made on the first visit rather than after a week of monitoring.",
        "On the island, backwater valves are not optional. Ville de Montréal's municipal by-law makes them mandatory, and every building built since 2011 has to have one. The city's Rénoplex program helps with the cost for owners of one- to five-unit buildings: roughly $80 toward a standard valve, up to $560 per valve where it has to go in under an existing floor, and $1,500 toward a retention basin with a pump system.",
        "Here's the part that concerns us specifically, and it comes straight from the city's own guidance: a valve needs servicing about twice a year, and it has to stay accessible — and flooring laid over the access point is one of the most common reasons it isn't. That is a renovation mistake, not a plumbing one. When we put a basement floor back after a backup, the access hatch stays reachable, because the alternative is that the next inspection starts by pulling up a floor you just paid for.",
        "Requirements differ between municipalities, and Laval's are not Montreal's. We confirm what applies to your address before the rebuild rather than assuming the Montreal rule travels across the bridge. Worth checking separately: sewer-backup coverage is frequently a separate endorsement on a Quebec home insurance policy rather than part of the base coverage — the time to read that page of your contract is before you need it.",
      ],
      readMore: {
        label: "Read the hidden water damage and mould timeline",
        href: "/blog/hidden-water-damage-and-mold-timeline",
      },
      alsoSee: {
        label: "What actually moves an insurance claim, seen from the job site",
        href: "/blog/insurance-claim-water-damage-quebec",
      },
    },
  },
  fr: {
    eyebrow: "Nettoyage après refoulement d'égout",
    title: "Quand l'eau remonte par le drain",
    intro:
      "Un refoulement d'égout n'est pas une inondation d'eau propre : l'eau est contaminée, et le délai pour agir est plus court. Notre ligne est répondue 24/7. Voici comment se déroule le travail, du premier appel à la repose du plancher.",
    processTitle: "Comment ça fonctionne",
    processIntro:
      "Les quatre mêmes étapes, qu'il s'agisse d'une salle de bain au sous-sol ou d'une colonne refoulée dans un multiplex.",
    processSteps: [
      {
        title: "Appel et confinement",
        desc: "Vous appelez — à toute heure, tous les jours. Nous commençons par isoler la zone touchée pour que l'eau contaminée ne se propage pas dans le reste de la maison.",
      },
      {
        title: "Extraction et assainissement",
        desc: "L'eau stagnante est pompée, puis chaque surface conservée est nettoyée et désinfectée, et non simplement séchée.",
      },
      {
        title: "Retrait contrôlé",
        desc: "Les matériaux poreux imbibés — thibaude, bas du gypse, isolant — sont retirés. C'est l'étape qui distingue un refoulement d'une fuite d'eau propre, et l'ignorer est ce qui laisse une odeur des mois plus tard.",
      },
      {
        title: "Séchage, puis remise en état",
        desc: "Nous séchons jusqu'aux relevés d'humidité consignés, puis nous reposons plancher, gypse et peinture — en gardant le clapet antiretour accessible, ce qui compte plus qu'on ne le croit.",
      },
    ],
    includesTitle: "Ce qui est inclus",
    includesIntro:
      "Une seule équipe, de la première pompe à la dernière couche de peinture, avec documentation tout au long.",
    includes: [
      {
        title: "Extraction de l'eau contaminée",
        desc: "Pompée et évacuée, avec confinement de la zone de travail pour garder le reste de la propriété propre.",
      },
      {
        title: "Désinfection et traitement des odeurs",
        desc: "Surfaces nettoyées et désinfectées, pas seulement séchées — une odeur persistante signale presque toujours qu'un matériau poreux est resté en place.",
      },
      {
        title: "Documentation pour votre réclamation",
        desc: "Relevés d'humidité et photos consignés de la première visite à la visite finale, sous une forme que votre expert en sinistre peut traiter sans rappel.",
      },
      {
        title: "Remise en état complète",
        desc: "Plancher, gypse, moulures et peinture refaits par la même équipe — en gardant le point d'accès du clapet atteignable pour l'entretien futur.",
      },
    ],
    localContext: {
      heading: "Les refoulements d'égout à Laval et à Montréal",
      paragraphs: [
        "Ce qui distingue un refoulement d'un tuyau éclaté, c'est ce que contient l'eau. Une conduite d'alimentation qui cède laisse de l'eau propre, souvent séchable sur place. Un refoulement amène de l'eau contaminée, et la règle change : les matériaux poreux imbibés — thibaude, bas du gypse, isolant d'un sous-sol fini — sont retirés plutôt que séchés en espérant. Le seuil de 24 à 48 heures de l'EPA pour la moisissure sur un matériau mouillé s'ajoute à cela, d'où la décision de retrait prise dès la première visite plutôt qu'après une semaine de suivi.",
        "Sur l'île, le clapet antiretour n'est pas optionnel. Le règlement municipal de la Ville de Montréal le rend obligatoire, et tout bâtiment construit depuis 2011 doit en être muni. Le programme Rénoplex aide à en payer le coût pour les propriétaires de bâtiments de un à cinq logements : environ 80 $ pour un clapet standard, jusqu'à 560 $ par clapet lorsqu'il doit être installé sous un plancher existant, et 1 500 $ pour un bassin de rétention avec système de pompage.",
        "Voici la partie qui nous concerne directement, et elle vient des consignes mêmes de la Ville : un clapet doit être entretenu environ deux fois par année et doit rester accessible — et un plancher posé par-dessus le point d'accès est l'une des causes les plus fréquentes d'inaccessibilité. C'est une erreur de rénovation, pas de plomberie. Quand nous reposons un plancher de sous-sol après un refoulement, la trappe d'accès reste atteignable, parce que l'autre option, c'est que la prochaine inspection commence par arracher le plancher que vous venez de payer.",
        "Les exigences varient d'une municipalité à l'autre, et celles de Laval ne sont pas celles de Montréal. Nous confirmons ce qui s'applique à votre adresse avant la remise en état plutôt que de présumer que la règle montréalaise traverse le pont. À vérifier de votre côté : au Québec, la protection contre le refoulement d'égout est souvent un avenant distinct de la police d'assurance habitation plutôt qu'une garantie de base — le bon moment pour lire cette page de votre contrat, c'est avant d'en avoir besoin.",
      ],
      readMore: {
        label: "Lire la chronologie des dégâts d'eau cachés et de la moisissure",
        href: "/blog/hidden-water-damage-and-mold-timeline",
      },
      alsoSee: {
        label: "Ce qui fait vraiment avancer une réclamation, vu du chantier",
        href: "/blog/insurance-claim-water-damage-quebec",
      },
    },
  },
};

export default function SewerBackupContent() {
  const { locale } = useLanguage();
  return <ServiceDetailContent icon={IconBackflow} copy={copy[locale]} />;
}
