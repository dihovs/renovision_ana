/**
 * Which language the caller is speaking.
 *
 * Transport-independent on purpose: this is a pure function of the words, with
 * no Twilio or ElevenLabs dependency, and every voice path needs it. It used
 * to live in twiml.ts, which meant the ElevenLabs route imported a TwiML
 * helper module to get at it.
 */

/**
 * Someone naming a language rather than just speaking one.
 *
 * The opening greeting asks "en français, or would you rather speak English?",
 * and the answer to that is usually a single word. The frequency heuristic
 * below scores "English" as zero French and zero English words and leaves the
 * call in French, which would make the question pointless — so a short reply
 * that names a language is read as a request for it.
 *
 * Note "anglais" maps to English and "french" to French: the language someone
 * names is the one they want, not the one they named it in.
 *
 * Only applied to short utterances. "Je parle anglais mais je préfère le
 * français" names both and means the opposite of what a naive match would
 * conclude, so anything longer falls through to word frequency, which handles
 * it correctly.
 */
const MAX_WORDS_FOR_EXPLICIT_CHOICE = 5;
const ASKS_FOR_ENGLISH = /\b(english|anglais)\b/;
const ASKS_FOR_FRENCH = /\b(french|français|francais)\b/;

function explicitChoice(normalised: string): "fr" | "en" | null {
  if (normalised.trim().split(/\s+/).length > MAX_WORDS_FOR_EXPLICIT_CHOICE) return null;

  const wantsEnglish = ASKS_FOR_ENGLISH.test(normalised);
  const wantsFrench = ASKS_FOR_FRENCH.test(normalised);
  // Both named in one breath is not a choice; let frequency decide.
  if (wantsEnglish === wantsFrench) return null;
  return wantsEnglish ? "en" : "fr";
}

/** Detect the caller's language from what they said, to switch mid-call. */
export function detectLocale(text: string, current: "fr" | "en"): "fr" | "en" {
  const normalised = text.toLowerCase();

  const chosen = explicitChoice(normalised);
  if (chosen) return chosen;

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
