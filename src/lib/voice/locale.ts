/**
 * Which language the caller is speaking.
 *
 * Transport-independent on purpose: this is a pure function of the words, with
 * no Twilio or ElevenLabs dependency, and every voice path needs it. It used
 * to live in twiml.ts, which meant the ElevenLabs route imported a TwiML
 * helper module to get at it.
 */

/** Detect the caller's language from what they said, to switch mid-call. */
export function detectLocale(text: string, current: "fr" | "en"): "fr" | "en" {
  const normalised = text.toLowerCase();
  // Function words rather than content words: "the" and "le" identify a
  // language far more reliably than any renovation vocabulary, which is full
  // of shared borrowings ("drywall", "gyproc", "condo").
  const french = (normalised.match(/\b(je|j'ai|c'est|le|la|les|une|des|dans|pour|avec|mon|ma|est|sont|qui|pas|oui|bonjour|merci)\b/g) ?? []).length;
  const english = (normalised.match(/\b(i|the|a|is|are|my|and|with|for|in|it|that|yes|hello|thanks|have|got)\b/g) ?? []).length;

  // A clear margin is required to switch. One borrowed word should not flip a
  // French conversation into English mid-sentence.
  if (french >= english + 2) return "fr";
  if (english >= french + 2) return "en";
  return current;
}
