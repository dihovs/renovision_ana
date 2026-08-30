/**
 * "I got an estimate on your website — where does it stand?"
 *
 * The customer reads their reference to Ana, and this decides what she says
 * back. Two rules shape all of it.
 *
 * WHAT IS DISCLOSED IS DELIBERATELY THIN. Whoever holds the number gets told
 * that a request exists, roughly when it arrived, and that somebody will call.
 * Never the name, the address, the phone number, the scope, and above all
 * never the estimate figures. That restraint — not the six digits — is what
 * makes it safe to answer a voice on the phone: a wrong number reaching a
 * stranger tells them nothing they could use, and the owner's rule that Ana
 * never says a price does not stop being true because the price is already in
 * the database.
 *
 * NOTHING NEGATIVE IS EVER SAID. The pipeline has states the customer must not
 * hear — a lead sitting unopened, or marked lost — and reading the internal
 * word out is worse than useless: "nobody has looked at your request yet" is a
 * true sentence that costs the job. Every state maps to a line that is honest
 * about what happens next without narrating the queue. `lost` is the sharpest
 * case: it usually means the customer went elsewhere, and the right answer is
 * to offer a callback, not to tell them they are marked lost.
 */

export type LeadStatusRow = {
  status: string;
  opened_at: string | null;
  created_at: string;
};

/** How Ana says the date — day and month, no year, the way people speak. */
function spokenDate(iso: string, locale: "fr" | "en"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    day: "numeric",
    month: "long",
    timeZone: "America/Toronto",
  }).format(date);
}

/**
 * The reference matched nothing.
 *
 * Phrased as a mis-hearing rather than an accusation, because by far the most
 * likely cause is the transcription rather than the customer: a digit lost on a
 * bad line is ordinary, and a caller inventing a reference is not.
 */
export function referenceNotFoundLine(locale: "fr" | "en"): string {
  return locale === "fr"
    ? "Je ne trouve pas ce numéro — je l'ai peut-être mal entendu. Pouvez-vous me le répéter chiffre par chiffre?"
    : "I'm not finding that number — I may have misheard it. Could you read it to me one digit at a time?";
}

/** Asked twice and still nothing: stop guessing and take it the human way. */
export function referenceGiveUpLine(locale: "fr" | "en"): string {
  return locale === "fr"
    ? "Je n'arrive pas à retrouver ce numéro. Ce n'est pas grave — laissez-moi votre nom et votre numéro de téléphone, et quelqu'un vous rappelle pour faire le suivi."
    : "I still can't find that one. No problem at all — give me your name and phone number and someone will call you back to follow it up.";
}

/**
 * What Ana says when the reference matches.
 *
 * The date is included because it is the one detail that lets the customer
 * confirm we are both talking about the same request, and it discloses nothing
 * on its own.
 */
export function estimateStatusLine(row: LeadStatusRow, locale: "fr" | "en"): string {
  const when = spokenDate(row.created_at, locale);
  const on = when ? (locale === "fr" ? ` du ${when}` : ` from ${when}`) : "";

  switch (row.status) {
    // Someone has already spoken to them, or a quote has gone out. Say so —
    // this is the one case where the customer may know more than the CRM does,
    // and pretending otherwise makes Ana sound like she is reading a script.
    case "contacted":
      return locale === "fr"
        ? `Oui, je l'ai. Votre demande${on} a déjà été prise en charge — quelqu'un de chez nous vous a contacté. Si vous n'avez pas eu de nouvelles, je fais un rappel tout de suite.`
        : `Yes, I have it. Your request${on} has already been picked up — someone from our side has been in touch. If you haven't heard back, I'll flag it for a follow-up right now.`;

    case "quoted":
      return locale === "fr"
        ? `Je l'ai. Une soumission a déjà été préparée pour votre demande${on}. Elle vous a été envoyée par courriel — si vous ne la trouvez pas, je peux demander qu'on vous la renvoie.`
        : `I have it. A quote has already gone out for your request${on} — it was sent by email. If you can't find it, I can have it sent again.`;

    case "won":
      return locale === "fr"
        ? `Oui — votre projet${on} est confirmé chez nous. Si vous avez une question sur les dates ou les travaux, je prends la note et quelqu'un vous rappelle.`
        : `Yes — your project${on} is confirmed with us. If you have a question about dates or the work itself, I'll take a note and someone will call you.`;

    // Marked lost internally. The customer hears none of that: they hear an
    // open door, which is also the commercially correct answer.
    case "lost":
      return locale === "fr"
        ? `Je vois votre demande${on}. Voulez-vous qu'on la reprenne? Je peux demander à quelqu'un de vous rappeler pour en discuter.`
        : `I can see your request${on}. Would you like us to pick it back up? I can have someone call you to talk it through.`;

    // 'new' — the common case, and the one the owner asked for by name. The
    // opened flag is the only thing that changes the wording, and neither
    // version admits to a queue.
    default:
      return row.opened_at
        ? locale === "fr"
          ? `Oui, je l'ai — votre demande${on} est bien reçue et elle a été vue par notre équipe. Quelqu'un vous appelle sous peu pour organiser la visite gratuite.`
          : `Yes, I have it — your request${on} came through and our team has seen it. Someone will be calling you shortly to arrange the free visit.`
        : locale === "fr"
          ? `Oui, je l'ai — votre demande${on} est bien reçue et elle est dans la liste de l'équipe. Quelqu'un vous appelle sous peu pour organiser la visite gratuite.`
          : `Yes, I have it — your request${on} came through and it's with the team. Someone will be calling you shortly to arrange the free visit.`;
  }
}
