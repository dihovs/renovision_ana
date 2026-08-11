/**
 * Wording for the customer-facing quote, in both languages.
 *
 * French is the source text, and not only as a style choice. Under the
 * Consumer Protection Act s. 26, where a French and a non-French version of a
 * consumer contract diverge, "l'interprétation la plus favorable au
 * consommateur prévaut" — the reading most favourable to the consumer wins. So
 * a sloppy English string is not merely untidy; it is the version a court may
 * read against us. Keeping both here, side by side, is what stops them drifting.
 */

export type QuoteLocale = "fr" | "en";

export const QUOTE_COPY = {
  fr: {
    quote: "Soumission",
    date: "Date",
    validUntil: "Valide jusqu'au",
    preparedFor: "Préparée pour",
    workAddress: "Adresse des travaux",
    description: "Description",
    quantity: "Qté",
    unitPrice: "Prix unitaire",
    lineTotal: "Montant",
    subtotal: "Sous-total",
    discount: "Rabais",
    total: "Total",
    deposit: "Dépôt demandé",
    balance: "Solde à la fin des travaux",
    optional: "En option",
    optionalHelp: "Cochez les options que vous souhaitez ajouter. Le total se met à jour.",
    chooseOption: "Choisissez votre option",
    tierGood: "Économique",
    tierBetter: "Recommandé",
    tierBest: "Premium",
    terms: "Conditions",
    approve: "Approuver cette soumission",
    approveHeading: "Prêt à commencer ?",
    yourName: "Votre nom",
    signature: "Signature (tapez votre nom)",
    approveButton: "J'approuve cette soumission",
    requestChanges: "Demander une modification",
    requestChangesPlaceholder: "Dites-nous ce que vous aimeriez changer.",
    sendRequest: "Envoyer",
    approvedHeading: "Merci — soumission approuvée",
    approvedBody: "Nous vous contacterons sous peu pour planifier les travaux.",
    changesSentHeading: "Message envoyé",
    changesSentBody: "Nous reviendrons vers vous avec une soumission révisée.",
    expired: "Cette soumission est échue. Contactez-nous pour un prix à jour.",
    declined: "Cette soumission a été refusée.",
    cancel: "Annuler",
    nameRequiredError: "Veuillez inscrire votre nom pour approuver.",
    messageRequiredError: "Dites-nous ce que vous aimeriez changer.",
    noLongerOpenApproval: "Cette soumission n'est plus ouverte à l'approbation.",
    noLongerOpenChanges: "Cette soumission n'est plus ouverte.",
    approvalFailedGeneric: "Impossible d'enregistrer votre approbation.",
    changesFailedGeneric: "Impossible d'envoyer votre message.",
    rbq: "Licence RBQ",
    gst: "TPS",
    qst: "TVQ",
    notATaxInvoice:
      "Cette soumission n'est pas une facture. Les prix sont valides jusqu'à la date indiquée et peuvent varier si l'étendue des travaux change.",
    cancellationTitle: "Droit de résolution",
    // CPA s. 58(h): the ten-day cancellation faculty must appear in the
    // contract itself, in the consumer's own document — not in a policy page
    // they are told to go and find.
    cancellationBody:
      "Vous pouvez annuler ce contrat, à votre seule discrétion, dans les dix (10) jours suivant la réception de votre exemplaire. Aucun paiement ne peut être exigé et aucun travail ne peut débuter avant l'expiration de ce délai.",
  },
  en: {
    quote: "Quote",
    date: "Date",
    validUntil: "Valid until",
    preparedFor: "Prepared for",
    workAddress: "Work address",
    description: "Description",
    quantity: "Qty",
    unitPrice: "Unit price",
    lineTotal: "Amount",
    subtotal: "Subtotal",
    discount: "Discount",
    total: "Total",
    deposit: "Deposit requested",
    balance: "Balance on completion",
    optional: "Optional",
    optionalHelp: "Tick any options you'd like to add. The total updates as you go.",
    chooseOption: "Choose your option",
    tierGood: "Essential",
    tierBetter: "Recommended",
    tierBest: "Premium",
    terms: "Terms",
    approve: "Approve this quote",
    approveHeading: "Ready to go ahead?",
    yourName: "Your name",
    signature: "Signature (type your name)",
    approveButton: "I approve this quote",
    requestChanges: "Request a change",
    requestChangesPlaceholder: "Tell us what you'd like changed.",
    sendRequest: "Send",
    approvedHeading: "Thank you — quote approved",
    approvedBody: "We'll be in touch shortly to schedule the work.",
    changesSentHeading: "Message sent",
    changesSentBody: "We'll come back to you with a revised quote.",
    expired: "This quote has expired. Please contact us for an updated price.",
    declined: "This quote was declined.",
    cancel: "Cancel",
    nameRequiredError: "Please type your name to approve.",
    messageRequiredError: "Tell us what you'd like changed.",
    noLongerOpenApproval: "This quote is no longer open for approval.",
    noLongerOpenChanges: "This quote is no longer open.",
    approvalFailedGeneric: "Could not record your approval.",
    changesFailedGeneric: "Could not send your message.",
    rbq: "RBQ licence",
    gst: "GST",
    qst: "QST",
    notATaxInvoice:
      "This quote is not an invoice. Prices hold until the date shown and may change if the scope of work changes.",
    cancellationTitle: "Right of cancellation",
    cancellationBody:
      "You may cancel this contract, at your sole discretion, within ten (10) days of receiving your copy. No payment may be required and no work may begin before that period ends.",
  },
} as const;

export function copyFor(locale: QuoteLocale) {
  return QUOTE_COPY[locale];
}
