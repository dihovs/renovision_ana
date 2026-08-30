import type { Locale } from "@/i18n/translations";

export type FaqItem = { question: string; answer: string };

/**
 * Service-page FAQs, kept here rather than inside the "use client" content
 * components for one reason: the visible copy and the FAQPage schema have to
 * be the same strings. Google requires FAQ markup to match text a visitor can
 * actually read, and the schema is emitted from the server component while the
 * copy renders in a client one. Two hand-maintained copies of the same answer
 * drift, and the drift is invisible until a rich result quietly stops showing.
 *
 * The questions are the ones people actually ask on the phone at the point of
 * panic, not the ones that make the service sound good. Qualinet's equivalent
 * page answers "what do I do first" and "will you have to demolish" — those are
 * the questions, and dodging them is how you lose the click back to a
 * competitor who answers them.
 */
export const WATER_DAMAGE_FAQ: Record<Locale, FaqItem[]> = {
  en: [
    {
      question: "What should I do in the first hour?",
      answer:
        "Stop the water at the shut-off valve if you can reach it safely, and kill power to the affected area at the panel rather than touching switches in a wet room. Then start photographing everything before you move it — that record is what an adjuster works from later. Move what you can lift out of the water; leave soaked heavy furniture where it is rather than dragging it across wet flooring. Call us at any hour: the line is answered 24/7.",
    },
    {
      question: "Will you have to demolish part of my home?",
      answer:
        "Not necessarily, and the answer depends on what got wet and for how long. Clean water caught early can often be dried in place, including inside wall cavities. Contaminated water is a different rule — soaked porous material comes out. We open up enough to see what is actually wet rather than drying what is visible and hoping, and we tell you which of those two situations you are in before anything is removed.",
    },
    {
      question: "How long does drying take?",
      answer:
        "Typically three to five days for equipment to run, though the number that matters is the moisture reading, not the calendar. We log readings and keep drying until the material is dry rather than until a scheduled day arrives. Repairs start after that, so a full job from first call to final paint is usually a couple of weeks.",
    },
    {
      question: "Do you work with my insurance?",
      answer:
        "Yes. We document moisture readings and photographs from the first visit to the final walkthrough and provide a written scope your adjuster can process without a follow-up call. We work directly with adjusters routinely. We do not decide what your policy covers — that is between you and your insurer — but we make sure the file has what it needs.",
    },
    {
      question: "Can mould grow before you get here?",
      answer:
        "It can. The EPA's benchmark is that wet material is very likely to start growing mould within 24 to 48 hours, and a heated house in January behaves the same as one in July on this. That window is the reason the first call matters more than the first appointment, and why we would rather look at it tonight than book you for Thursday.",
    },
  ],
  fr: [
    {
      question: "Que faire dans la première heure ?",
      answer:
        "Fermez l'eau à la valve d'arrêt si vous pouvez l'atteindre sans danger, et coupez le courant de la zone touchée au panneau plutôt que de toucher aux interrupteurs dans une pièce mouillée. Photographiez ensuite tout avant de déplacer quoi que ce soit : c'est ce dossier que votre expert en sinistre utilisera. Sortez de l'eau ce que vous pouvez soulever ; laissez les meubles lourds imbibés en place plutôt que de les traîner sur un plancher mouillé. Appelez-nous à toute heure : la ligne est répondue 24/7.",
    },
    {
      question: "Devrez-vous démolir une partie de ma maison ?",
      answer:
        "Pas nécessairement, et la réponse dépend de ce qui a été mouillé et pendant combien de temps. De l'eau propre prise tôt peut souvent être séchée sur place, y compris dans les cavités murales. L'eau contaminée obéit à une autre règle : les matériaux poreux imbibés sont retirés. Nous ouvrons suffisamment pour voir ce qui est réellement mouillé plutôt que de sécher ce qui se voit en espérant, et nous vous disons dans laquelle de ces deux situations vous êtes avant de retirer quoi que ce soit.",
    },
    {
      question: "Combien de temps prend le séchage ?",
      answer:
        "Généralement de trois à cinq jours de fonctionnement des appareils, mais le chiffre qui compte est le relevé d'humidité, pas le calendrier. Nous consignons les relevés et poursuivons le séchage jusqu'à ce que le matériau soit sec, et non jusqu'à une date prévue. Les réparations commencent ensuite : du premier appel à la dernière couche de peinture, comptez généralement quelques semaines.",
    },
    {
      question: "Travaillez-vous avec mon assurance ?",
      answer:
        "Oui. Nous consignons relevés d'humidité et photos de la première visite à la visite finale, et fournissons un descriptif écrit que votre expert en sinistre peut traiter sans rappel. Nous travaillons régulièrement avec les experts. Nous ne décidons pas de ce que votre police couvre — cela se règle entre vous et votre assureur — mais nous nous assurons que le dossier contient ce qu'il faut.",
    },
    {
      question: "La moisissure peut-elle apparaître avant votre arrivée ?",
      answer:
        "Oui. Le seuil de référence de l'EPA est qu'un matériau mouillé risque fortement de développer de la moisissure en 24 à 48 heures, et une maison chauffée en janvier se comporte comme une maison en juillet à cet égard. C'est cette fenêtre qui fait que le premier appel compte plus que le premier rendez-vous, et pourquoi nous préférons venir voir ce soir plutôt que de vous fixer un rendez-vous jeudi.",
    },
  ],
};
