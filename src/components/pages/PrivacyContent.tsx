"use client";

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageProvider";
import { SITE_EMAIL, SITE_NAME, SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

/**
 * Privacy policy, written against what this site actually does — every
 * processor named below corresponds to a real dependency and a real call in
 * the codebase (Anthropic in /api/chat, Resend in /api/leads, Google Distance
 * Matrix in /api/trip-fee, Vercel for hosting and analytics). If a data flow
 * changes, this page changes with it; a policy that describes a system you no
 * longer run is worse than none.
 *
 * Deliberately avoids citing statute section numbers. The underlying research
 * could not reach the official legislation site, and a policy that cites the
 * wrong section is harder to defend than one that plainly describes the
 * practice and names the regulator.
 */

const LAST_UPDATED = "2026-08-01";

type Section = { heading: string; body: string[]; bullets?: string[] };

type PrivacyCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  lastUpdated: string;
  sections: Section[];
  officerHeading: string;
  officerBody: string;
  contactCta: string;
};

const copy: Record<"en" | "fr", PrivacyCopy> = {
  en: {
    eyebrow: "Privacy",
    title: "Privacy Policy",
    intro:
      "This policy explains what personal information Renovision AnA collects, why we collect it, who it is shared with, and the rights you have over it. It is written to be read, not to be survived.",
    lastUpdated: "Last updated",
    sections: [
      {
        heading: "What we collect",
        body: [
          "We only collect what we need in order to answer you and to quote your project. You are never required to use the online tools — you can simply call us instead.",
        ],
        bullets: [
          "Contact form: your name, phone number, email address and the message you write.",
          "Instant estimate chat: the description of your project, plus your name, phone number and email address if you choose to leave them. Providing a civic address is optional and is used to refine the estimate.",
          "Photos: only if you choose to attach them. They help us judge scope and improve the accuracy of an estimate.",
          "Postal code: if you request a handyman estimate, your postal code is used to calculate travel distance.",
          "Phone calls: when our virtual assistant answers the line, the call is transcribed — see the phone calls section below for exactly how that works.",
          "Marketing consent: whether you agreed to receive follow-up messages, along with the date, the wording you were shown and the language you were using.",
          "Site analytics: aggregate page-view statistics. These do not identify you individually.",
        ],
      },
      {
        heading: "Why we collect it",
        body: [
          "To reply to your enquiry, prepare an estimate, schedule a site visit, carry out and document work you hire us for, and — only if you agreed to it — to follow up with you afterwards.",
          "We do not sell your personal information. We do not share it for anyone else's advertising.",
        ],
      },
      {
        heading: "How the instant estimate works",
        body: [
          "The estimate tool uses an AI assistant to interpret your description of the work. It is worth being clear about how it produces a number: the assistant identifies which items from our own price list apply and in what quantity — it never invents a price. Every rate, tax and total is calculated by our system from that fixed price list.",
          "The result is an estimated range, not a quote. It carries real uncertainty, because concealed conditions, exact finishes and site access cannot be judged from a conversation. No decision that affects you is made automatically: a person reviews every request, and a firm price only follows an in-person visit.",
        ],
      },
      {
        heading: "Phone calls answered by our virtual assistant",
        body: [
          "Calls to our business line may be answered by an automated assistant. It tells you so at the very start of the call, and the call is transcribed — we keep no audio recording — so that we can call you back already knowing what you told us.",
          "Your speech is converted to text by Twilio, our telephony provider, and the assistant's replies are generated with the help of Anthropic's AI service. The transcript, your phone number and the details you choose to give are treated like any other enquiry: transcripts of enquiries that never become work are deleted within twenty-four months, and transcripts attached to work we carried out are kept as part of the job record.",
          "The assistant never quotes prices, and no decision affecting you is made automatically — a person reviews every call and calls you back. If you would rather not speak with an automated assistant, just say so or use the contact form instead, and you can ask us to delete a transcript at any time.",
        ],
      },
      {
        heading: "Who your information is shared with",
        body: [
          "We use a small number of service providers to run the site. They process information on our behalf and are not permitted to use it for their own purposes.",
        ],
        bullets: [
          "Vercel — website hosting and aggregate analytics.",
          "Anthropic — powers the estimate chat and the phone assistant's replies. What you type or say is sent to their service to generate a response.",
          "Twilio — connects calls to our business line and converts your speech to text when the virtual assistant answers.",
          "Resend — sends the confirmation email to you and the notification email to us.",
          "Google — calculates travel distance from a postal code for handyman estimates.",
        ],
      },
      {
        heading: "Information stored outside Quebec",
        body: [
          "The providers listed above store and process information on servers located outside Quebec, primarily in the United States. This means the information may be subject to the laws of those jurisdictions.",
          "We assess this before entrusting information to a provider, and we choose providers that commit contractually to protecting it. If you would prefer not to have your information handled this way, contact us by phone and we will take your details directly instead.",
        ],
      },
      {
        heading: "How long we keep it",
        body: [
          "Enquiries and estimates that do not become work are deleted within twenty-four months.",
          "Records relating to work we actually carried out — contracts, invoices, job documentation — are kept for at least six years, because tax and construction-liability rules require it.",
          "If you withdraw marketing consent, we stop sending messages immediately but keep a record of the withdrawal itself, since that is the proof that we acted on your request.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "You can ask us to do any of the following, free of charge, and we will respond within thirty days.",
        ],
        bullets: [
          "See the personal information we hold about you.",
          "Correct anything inaccurate or incomplete.",
          "Delete information we no longer have a reason to keep.",
          "Receive your information in a portable, machine-readable format.",
          "Withdraw consent to marketing messages at any time.",
        ],
      },
      {
        heading: "Security",
        body: [
          "Access to customer information is limited to the owner. Information travels to and from this site over an encrypted connection, and our service providers hold it on encrypted infrastructure.",
          "No system is perfect. If a breach ever creates a risk of serious harm to you, we will notify you and the Commission d'accès à l'information.",
        ],
      },
      {
        heading: "Cookies",
        body: [
          "This site does not use advertising or tracking cookies, and does not build a profile of you across other websites. The analytics we use report aggregate page views only.",
        ],
      },
      {
        heading: "Complaints",
        body: [
          "If you are unhappy with how we have handled your information, tell us first — we would rather fix it directly. If you are not satisfied with our response, you can file a complaint with the Commission d'accès à l'information du Québec, which oversees privacy law in Quebec.",
        ],
      },
      {
        heading: "Changes to this policy",
        body: [
          "If we change how we handle personal information, we will update this page and change the date shown above.",
        ],
      },
    ],
    officerHeading: "Who to contact",
    officerBody:
      "Questions about this policy, or requests about your personal information, go to the person responsible for the protection of personal information at Renovision AnA:",
    contactCta: "Go to the contact page",
  },
  fr: {
    eyebrow: "Confidentialité",
    title: "Politique de confidentialité",
    intro:
      "Cette politique explique quels renseignements personnels Renovision AnA recueille, pourquoi nous les recueillons, avec qui ils sont partagés et quels droits vous avez à leur égard. Elle est écrite pour être lue.",
    lastUpdated: "Dernière mise à jour",
    sections: [
      {
        heading: "Ce que nous recueillons",
        body: [
          "Nous ne recueillons que ce dont nous avons besoin pour vous répondre et estimer votre projet. Vous n'êtes jamais obligé d'utiliser les outils en ligne — vous pouvez simplement nous téléphoner.",
        ],
        bullets: [
          "Formulaire de contact : votre nom, votre numéro de téléphone, votre adresse courriel et le message que vous écrivez.",
          "Clavardage d'estimation : la description de votre projet, ainsi que vos nom, téléphone et courriel si vous choisissez de les laisser. Fournir une adresse civique est facultatif et sert à préciser l'estimation.",
          "Photos : seulement si vous choisissez d'en joindre. Elles nous aident à juger de l'ampleur des travaux et à améliorer la précision d'une estimation.",
          "Code postal : si vous demandez une estimation de bricolage, votre code postal sert à calculer la distance de déplacement.",
          "Appels téléphoniques : lorsque notre assistante virtuelle répond à la ligne, l'appel est transcrit — voir la section sur les appels téléphoniques ci-dessous pour le détail.",
          "Consentement marketing : si vous avez accepté de recevoir des suivis, avec la date, le texte qui vous a été présenté et la langue que vous utilisiez.",
          "Statistiques du site : des données de fréquentation agrégées. Elles ne vous identifient pas individuellement.",
        ],
      },
      {
        heading: "Pourquoi nous les recueillons",
        body: [
          "Pour répondre à votre demande, préparer une estimation, planifier une visite, réaliser et documenter les travaux que vous nous confiez et — uniquement si vous y avez consenti — faire un suivi par la suite.",
          "Nous ne vendons pas vos renseignements personnels. Nous ne les partageons pas à des fins publicitaires pour le compte de tiers.",
        ],
      },
      {
        heading: "Comment fonctionne l'estimation instantanée",
        body: [
          "L'outil d'estimation utilise un assistant IA pour interpréter votre description des travaux. Il vaut la peine d'être clair sur la façon dont un montant est produit : l'assistant détermine quels articles de notre propre liste de prix s'appliquent et en quelle quantité — il n'invente jamais un prix. Chaque taux, taxe et total est calculé par notre système à partir de cette liste de prix fixe.",
          "Le résultat est une fourchette estimative, pas une soumission. Elle comporte une incertitude réelle, car les conditions cachées, les finis exacts et l'accès au chantier ne peuvent pas être évalués à partir d'une conversation. Aucune décision vous concernant n'est prise automatiquement : une personne examine chaque demande, et un prix ferme ne suit qu'une visite sur place.",
        ],
      },
      {
        heading: "Appels téléphoniques répondus par notre assistante virtuelle",
        body: [
          "Les appels à notre ligne d'affaires peuvent être répondus par une assistante automatisée. Elle vous en informe dès le début de l'appel, et l'appel est transcrit — nous ne conservons aucun enregistrement audio — afin que nous puissions vous rappeler en sachant déjà ce que vous nous avez dit.",
          "Votre voix est convertie en texte par Twilio, notre fournisseur de téléphonie, et les réponses de l'assistante sont générées à l'aide du service d'IA d'Anthropic. La transcription, votre numéro de téléphone et les renseignements que vous choisissez de donner sont traités comme toute autre demande : les transcriptions des demandes qui ne deviennent pas des travaux sont supprimées dans un délai de vingt-quatre mois, et celles liées à des travaux réalisés sont conservées comme partie du dossier.",
          "L'assistante ne donne jamais de prix, et aucune décision vous concernant n'est prise automatiquement — une personne révise chaque appel et vous rappelle. Si vous préférez ne pas parler à une assistante automatisée, dites-le simplement ou utilisez le formulaire de contact, et vous pouvez demander la suppression d'une transcription en tout temps.",
        ],
      },
      {
        heading: "Avec qui vos renseignements sont partagés",
        body: [
          "Nous utilisons un petit nombre de fournisseurs pour faire fonctionner le site. Ils traitent les renseignements pour notre compte et n'ont pas le droit de les utiliser à leurs propres fins.",
        ],
        bullets: [
          "Vercel — hébergement du site web et statistiques agrégées.",
          "Anthropic — fait fonctionner le clavardage d'estimation et les réponses de l'assistante téléphonique. Ce que vous écrivez ou dites est transmis à leur service pour générer une réponse.",
          "Twilio — achemine les appels vers notre ligne d'affaires et convertit votre voix en texte lorsque l'assistante virtuelle répond.",
          "Resend — envoie le courriel de confirmation que vous recevez et l'avis que nous recevons.",
          "Google — calcule la distance de déplacement à partir d'un code postal pour les estimations de bricolage.",
        ],
      },
      {
        heading: "Renseignements conservés à l'extérieur du Québec",
        body: [
          "Les fournisseurs énumérés ci-dessus conservent et traitent les renseignements sur des serveurs situés à l'extérieur du Québec, principalement aux États-Unis. Ces renseignements peuvent donc être assujettis aux lois de ces territoires.",
          "Nous évaluons cette situation avant de confier des renseignements à un fournisseur et nous choisissons des fournisseurs qui s'engagent contractuellement à les protéger. Si vous préférez que vos renseignements ne soient pas traités ainsi, communiquez avec nous par téléphone et nous prendrons vos coordonnées directement.",
        ],
      },
      {
        heading: "Combien de temps nous les conservons",
        body: [
          "Les demandes et estimations qui ne se transforment pas en travaux sont supprimées dans un délai de vingt-quatre mois.",
          "Les dossiers liés à des travaux réellement réalisés — contrats, factures, documentation de chantier — sont conservés au moins six ans, parce que les règles fiscales et celles sur la responsabilité en construction l'exigent.",
          "Si vous retirez votre consentement marketing, nous cessons immédiatement les envois, mais conservons une trace du retrait lui-même, puisque c'est la preuve que nous avons donné suite à votre demande.",
        ],
      },
      {
        heading: "Vos droits",
        body: [
          "Vous pouvez nous demander ce qui suit, sans frais, et nous répondrons dans un délai de trente jours.",
        ],
        bullets: [
          "Consulter les renseignements personnels que nous détenons à votre sujet.",
          "Corriger tout renseignement inexact ou incomplet.",
          "Supprimer les renseignements que nous n'avons plus de raison de conserver.",
          "Recevoir vos renseignements dans un format portable et lisible par machine.",
          "Retirer en tout temps votre consentement aux communications marketing.",
        ],
      },
      {
        heading: "Sécurité",
        body: [
          "L'accès aux renseignements des clients est limité au propriétaire. Les renseignements circulent vers ce site et depuis ce site par une connexion chiffrée, et nos fournisseurs les conservent sur une infrastructure chiffrée.",
          "Aucun système n'est parfait. Si une atteinte devait présenter un risque de préjudice sérieux pour vous, nous vous en aviserions ainsi que la Commission d'accès à l'information.",
        ],
      },
      {
        heading: "Témoins (cookies)",
        body: [
          "Ce site n'utilise pas de témoins publicitaires ou de pistage et ne constitue pas de profil vous concernant sur d'autres sites web. Les statistiques que nous utilisons ne rapportent que des pages vues agrégées.",
        ],
      },
      {
        heading: "Plaintes",
        body: [
          "Si vous êtes insatisfait de la façon dont nous avons traité vos renseignements, dites-le-nous d'abord — nous préférons corriger la situation directement. Si notre réponse ne vous satisfait pas, vous pouvez porter plainte auprès de la Commission d'accès à l'information du Québec, qui surveille l'application de la loi sur la protection des renseignements personnels au Québec.",
        ],
      },
      {
        heading: "Modifications à cette politique",
        body: [
          "Si nous changeons notre façon de traiter les renseignements personnels, nous mettrons cette page à jour et modifierons la date indiquée ci-dessus.",
        ],
      },
    ],
    officerHeading: "À qui s'adresser",
    officerBody:
      "Les questions sur cette politique, ou les demandes concernant vos renseignements personnels, s'adressent à la personne responsable de la protection des renseignements personnels chez Renovision AnA :",
    contactCta: "Aller à la page contact",
  },
};

export default function PrivacyContent() {
  const { locale } = useLanguage();
  const c = copy[locale];

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="font-label text-xs font-semibold uppercase tracking-[0.25em] text-brand-green">
          {c.eyebrow}
        </p>
        <h1 className="mt-4 font-heading text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-brand-blue sm:text-5xl">
          {c.title}
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-charcoal/80">{c.intro}</p>
        <p className="mt-4 text-sm text-charcoal/50">
          {c.lastUpdated}: <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
        </p>

        <div className="mt-14 space-y-12">
          {c.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-heading text-xl font-bold text-brand-blue sm:text-2xl">
                {section.heading}
              </h2>
              {section.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="mt-4 leading-relaxed text-charcoal/75"
                >
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-5 space-y-2.5">
                  {section.bullets.map((bullet) => (
                    <li key={bullet.slice(0, 40)} className="flex gap-3 text-charcoal/75">
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-green" />
                      <span className="leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="mt-14 rounded-2xl bg-brand-blue-light/50 p-7">
          <h2 className="font-heading text-xl font-bold text-brand-blue">{c.officerHeading}</h2>
          <p className="mt-3 leading-relaxed text-charcoal/75">{c.officerBody}</p>
          <address className="mt-4 not-italic leading-relaxed text-charcoal/85">
            <strong className="font-semibold text-brand-blue">{SITE_NAME}</strong>
            <br />
            <a href={`mailto:${SITE_EMAIL}`} className="font-semibold text-brand-blue hover:underline">
              {SITE_EMAIL}
            </a>
            <br />
            <a href={`tel:${SITE_PHONE_TEL}`} className="font-semibold text-brand-blue hover:underline">
              {SITE_PHONE}
            </a>
          </address>
          <Link
            href="/contact"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand-green hover:text-brand-green-dark"
          >
            {c.contactCta}
            <span aria-hidden>&rarr;</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
