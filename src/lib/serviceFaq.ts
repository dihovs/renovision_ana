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
/**
 * Mould remediation. Four questions harvested from the SERP, and the first one
 * is the reason this block needed care: "is it dangerous" is a medical question
 * on a contractor's page. The answer names a doctor or the CLSC rather than
 * reassuring or alarming, because we are not qualified to do either and a
 * reader with an asthmatic child deserves better than marketing copy.
 *
 * Deliberately absent, all owner decisions of 2026-08-30: any certification
 * claim (there is no credential to name, and vague wording would read as one),
 * any mention of air testing, any mention of asbestos.
 */
export const MOULD_FAQ: Record<Locale, FaqItem[]> = {
  en: [
    {
      question: "Is it dangerous?",
      answer:
        "That depends on the person as much as on the mould, and we are not the right people to judge it. A doctor or your CLSC can answer for your situation. What we can say: the larger the area and the longer the material stayed wet, the less reasonable it is to live beside it while you decide.",
    },
    {
      question: "Can I clean it myself?",
      answer:
        "A small patch on a hard, non-porous surface — tile, sealed concrete — cleans up. Affected drywall, insulation or pressed wood does not: the material is porous, and scrubbing the surface moves spores around without removing what is inside it. The question isn't how big the patch is, but what is behind it.",
    },
    {
      question: "Will it come back?",
      answer:
        "If the source isn't fixed, yes, and usually in the same place. That is why the first step here is finding the water rather than starting with removal.",
    },
    {
      question: "How long does it take?",
      answer:
        "Removal is often the shortest part. Drying sets the schedule, and it ends at a moisture reading rather than a date. The rebuild follows, and how long it takes depends on what came out.",
    },
  ],
  fr: [
    {
      question: "Est-ce dangereux ?",
      answer:
        "Cela dépend de la personne autant que de la moisissure, et nous ne sommes pas les bonnes personnes pour trancher. Un médecin ou votre CLSC peut répondre pour votre situation. Ce que nous pouvons dire : plus la surface est grande et plus longtemps le matériau est resté mouillé, moins il est raisonnable de vivre à côté en attendant.",
    },
    {
      question: "Puis-je la nettoyer moi-même ?",
      answer:
        "Une petite tache sur une surface dure et non poreuse — céramique, béton scellé — se nettoie. Du gypse, de l'isolant ou du bois pressé atteints ne se nettoient pas : le matériau est poreux, et frotter la surface déplace les spores sans retirer ce qui est dans l'épaisseur. La question à se poser n'est pas la taille de la tache, mais ce qu'il y a derrière.",
    },
    {
      question: "Est-ce que ça va revenir ?",
      answer:
        "Si la source n'est pas réglée, oui, et généralement au même endroit. C'est pourquoi la première étape ici est de trouver l'eau plutôt que de commencer par le retrait.",
    },
    {
      question: "Combien de temps ça prend ?",
      answer:
        "Le retrait est souvent l'étape la plus courte. C'est le séchage qui commande l'échéancier, et il se termine à un relevé d'humidité, pas à une date. La remise en état suit, et sa durée dépend de ce qui est sorti.",
    },
  ],
};

/**
 * Ceiling water damage. These four are the SERP's own "People also ask" for
 * « dégât d'eau plafond réparation Montréal », kept close to the wording people
 * actually type — that is the whole point of harvesting them rather than
 * inventing questions that flatter the service.
 *
 * The "who pays" answer is deliberately the general Quebec framework and
 * nothing more: two policies, the deductible question, and go read your own
 * declaration. Owner's decision, 2026-08-30. Do not turn it into a worked
 * example — the page ranks for the query either way, and only one version is
 * safe to publish.
 */
export const CEILING_FAQ: Record<Locale, FaqItem[]> = {
  en: [
    {
      question: "What if the ceiling is damaged but it's stopped dripping?",
      answer:
        "Don't assume it's over. The water has stopped coming through, which says nothing about what is still wet above it — insulation and the service void hold moisture long after the visible drip stops. Photograph it, and have the moisture read before repainting. Painting over still-damp drywall is the most frequently redone repair we see.",
    },
    {
      question: "How do you repair a water stain on a ceiling?",
      answer:
        "If the board is sound and dry: seal the stain with a blocking primer, skim it if the texture has moved, then two coats. A stain that comes back through fresh paint means it wasn't sealed, not that it needs a third coat.",
    },
    {
      question: "How long does a ceiling take to dry?",
      answer:
        "Typically three to five days of equipment — longer than a wall, because a ceiling dries from one face only while the insulation above it stays wet. The number that ends drying is the moisture reading, not the calendar.",
    },
    {
      question: "Who pays when the damage comes from the condo above?",
      answer:
        "In a Quebec co-ownership, two policies generally come into play: the syndicate's, which covers the building and common portions, and yours, which covers your improvements and belongings. The practical question is usually the deductible and how it is split. That split depends on your declaration of co-ownership and the policies in force — read it and call your insurer before settling anything with your neighbour. We document what got wet; we don't decide what's covered.",
    },
  ],
  fr: [
    {
      question: "Que faire si le plafond est endommagé mais qu'il ne coule plus ?",
      answer:
        "Ne présumez pas que c'est terminé. L'eau a cessé de traverser, ce qui ne dit rien de ce qui reste humide au-dessus : l'isolant et le vide technique retiennent l'humidité bien après l'arrêt de la goutte visible. Photographiez, et faites lire l'humidité avant de repeindre. Repeindre par-dessus un gypse encore humide est la réparation la plus souvent refaite que nous voyons.",
    },
    {
      question: "Comment réparer une tache d'eau au plafond ?",
      answer:
        "Si le panneau est sain et sec : on scelle la tache avec un apprêt bloquant, on ratisse si la texture a bougé, puis deux couches. Une tache qui revient à travers une peinture neuve signifie qu'elle n'a pas été scellée, et non qu'il faut une troisième couche.",
    },
    {
      question: "Combien de temps pour faire sécher un plafond ?",
      answer:
        "Généralement de trois à cinq jours d'appareils — plus longtemps qu'un mur, parce qu'un plafond ne sèche que par une seule face pendant que l'isolant au-dessus reste mouillé. Le chiffre qui met fin au séchage est le relevé d'humidité, pas le calendrier.",
    },
    {
      question: "Qui doit payer quand le dégât vient du condo au-dessus ?",
      answer:
        "En copropriété au Québec, deux polices entrent généralement en jeu : celle du syndicat, qui couvre l'immeuble et les parties communes, et la vôtre, qui couvre vos améliorations et vos biens. La question pratique est habituellement celle de la franchise et de sa répartition. Cette répartition dépend de votre déclaration de copropriété et des polices en vigueur — lisez-la et appelez votre assureur avant de vous entendre avec le voisin. Nous documentons ce qui a été mouillé; nous ne décidons pas de ce qui est couvert.",
    },
  ],
};

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

/**
 * Main services listing page. These five Q&As answer the broad discovery
 * queries that don't belong to a single service page — response time,
 * insurance, warranty, service area, scope of work.
 */
export const SERVICES_PAGE_FAQ: Record<Locale, FaqItem[]> = {
  en: [
    {
      question: "How fast can you respond to a water damage emergency?",
      answer:
        "Our line is answered 24/7. For a water damage emergency in Laval or Montreal, we dispatch a crew the same day. Response time depends on distance, but emergency calls are always prioritized.",
    },
    {
      question: "Do you work with my insurance company?",
      answer:
        "Yes. We document damage with photos and moisture readings from the first visit and provide a written scope your adjuster can process without a follow-up call. We don't decide what your policy covers, but we make sure your file has everything it needs.",
    },
    {
      question: "Do you offer a warranty on your work?",
      answer:
        "Yes. Every project comes with a one-year written workmanship warranty. General liability insurance is in place on every job, with certificates available on request.",
    },
    {
      question: "Do you serve all of Laval and Montreal?",
      answer:
        "Yes. We cover all of Laval (Chomedey, Sainte-Rose, Vimont, Fabreville, Duvernay, Laval-des-Rapides, Pont-Viau) and several Montreal sectors (Ahuntsic-Cartierville, Saint-Laurent, Montréal-Nord, LaSalle) as well as Terrebonne and the North Shore. Each sector has its own housing characteristics — we adapt our methods to the construction type.",
    },
    {
      question: "Do you also do renovations that aren't linked to a disaster?",
      answer:
        "Yes. We do full interior renovations: kitchens, bathrooms, basements, flooring, drywall, painting. Everything inside the walls.",
    },
  ],
  fr: [
    {
      question: "Quels sont vos délais d'intervention pour un dégât d'eau ?",
      answer:
        "Notre ligne est répondue 24/7. Pour une urgence dégât d'eau à Laval ou Montréal, on envoie une équipe le jour même. Le délai dépend de la distance, mais on priorise toujours les appels d'urgence.",
    },
    {
      question: "Travaillez-vous avec mon assureur ?",
      answer:
        "Oui. Nous documentons les dégâts avec photos et relevés d'humidité dès la première visite, et fournissons une portée écrite que votre expert en sinistre peut traiter sans appel de suivi. Nous ne décidons pas ce que votre police couvre, mais nous faisons en sorte que votre dossier contienne tout ce qu'il faut.",
    },
    {
      question: "Offrez-vous une garantie sur vos travaux ?",
      answer:
        "Oui. Chaque projet est accompagné d'une garantie écrite d'un an sur la main-d'œuvre. L'assurance responsabilité civile est en vigueur sur chaque chantier, avec attestations disponibles sur demande.",
    },
    {
      question: "Desservez-vous tout Laval et Montréal ?",
      answer:
        "Oui. Nous couvrons l'ensemble de Laval (Chomedey, Sainte-Rose, Vimont, Fabreville, Duvernay, Laval-des-Rapides, Pont-Viau) et plusieurs secteurs de Montréal (Ahuntsic-Cartierville, Saint-Laurent, Montréal-Nord, LaSalle) ainsi que Terrebonne et la Rive-Nord. Chaque secteur a ses particularités — nous adaptons nos méthodes à son type de construction.",
    },
    {
      question: "Faites-vous aussi la rénovation sans lien avec un sinistre ?",
      answer:
        "Oui. Nous faisons des rénovations intérieures complètes : cuisines, salles de bain, sous-sols, planchers, gypse, peinture. Tout ce qui se trouve à l'intérieur des murs.",
    },
  ],
};
export const FIRE_DAMAGE_FAQ: Record<Locale, FaqItem[]> = {
  en: [
    {
      question: "Can anything be saved after a fire?",
      answer:
        "More than you might expect. Soot can be cleaned from most hard surfaces, smoke odour can be removed from textiles and wood with specialized treatment (ozone, thermal fogging), and water-damaged documents can often be restored through freeze-drying. The key is not throwing anything away before the adjuster and our team have assessed it — what looks unsalvageable in the first hour is frequently recoverable.",
    },
    {
      question: "How long does it take to restore a home after a fire?",
      answer:
        "It depends on the extent of the fire, smoke, and water damage. A small kitchen fire confined to one room might be three to four weeks. A whole-house fire is typically several months. The drying phase after firefighting water sets the schedule — we don't start rebuilding until moisture readings confirm the structure is dry, because rebuilding over damp material traps problems.",
    },
    {
      question: "Does insurance cover fire damage restoration?",
      answer:
        "Most Quebec home insurance policies cover fire damage, including the cost of cleanup, repair, and rebuilding. Your policy also typically covers emergency accommodations if the home is uninhabitable. What is covered exactly depends on your specific policy — call your insurer to confirm, and keep every receipt for immediate expenses.",
    },
    {
      question: "Will my home smell like smoke after the repairs?",
      answer:
        "No — if the smoke odour is properly treated rather than painted over. Our process includes ozone treatment, thermal fogging, and surface cleaning that removes smoke residue rather than sealing it. If the odour is gone before the new paint goes on, it stays gone. A smoke smell that returns after repairs is nearly always the result of skipping the odour treatment step.",
    },
  ],
  fr: [
    {
      question: "Peut-on sauver quelque chose après un incendie ?",
      answer:
        "Plus qu'on ne le croit. La suie se nettoie sur la plupart des surfaces dures, les odeurs de fumée se neutralisent dans les tissus et le bois (ozone, thermonébulisation), et les documents endommagés par l'eau se restaurent souvent par lyophilisation. L'important est de ne rien jeter avant que l'expert et notre équipe l'aient évalué : ce qui semble irrécupérable dans la première heure est souvent récupérable.",
    },
    {
      question: "Combien de temps prend la restauration après un incendie ?",
      answer:
        "Cela dépend de l'étendue du feu, de la fumée et des dégâts d'eau. Un petit feu de cuisine confiné à une pièce peut prendre de trois à quatre semaines. Un incendie qui touche toute la maison prend généralement plusieurs mois. La phase de séchage après l'eau d'extinction commande l'échéancier — nous ne commençons pas la reconstruction avant que les relevés d'humidité confirment que la structure est sèche, parce que reconstruire sur un matériau humide emprisonne les problèmes.",
    },
    {
      question: "L'assurance couvre-t-elle la restauration après incendie ?",
      answer:
        "La plupart des polices d'assurance habitation au Québec couvrent les dommages causés par le feu, y compris le nettoyage, la réparation et la reconstruction. Votre police couvre aussi généralement l'hébergement d'urgence si la maison est inhabitable. Ce qui est exactement couvert dépend de votre police — appelez votre assureur pour confirmer, et conservez tous les reçus pour les dépenses immédiates.",
    },
    {
      question: "Est-ce que ma maison sentira la fumée après les réparations ?",
      answer:
        "Non — si l'odeur de fumée est correctement traitée plutôt que peinte par-dessus. Notre processus inclut le traitement à l'ozone, la thermonébulisation et le nettoyage des surfaces, qui éliminent les résidus de fumée plutôt que de les sceller. Si l'odeur disparaît avant la nouvelle peinture, elle ne revient pas. Une odeur de fumée qui réapparaît après les réparations est presque toujours le signe que l'étape de désodorisation a été sautée.",
    },
  ],
};
