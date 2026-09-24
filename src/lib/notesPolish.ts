import Anthropic from "@anthropic-ai/sdk";

/**
 * Rewrite a site note so it reads professionally in an insurance document —
 * the one model call behind both the phone's manual "polish" button
 * (`/api/v1/notes/polish`) and the automatic pass a report/estimate export
 * now runs over every affected area's damage notes before printing them.
 * One prompt, one set of guardrails, because a note polished by hand and a
 * note polished at export time must read the same way or an operator who
 * checked the first is being shown something different at the second.
 *
 * **THE ONE RULE: it may not add anything.** A note on a claim is evidence.
 * A model asked to make text "more professional" will helpfully supply the
 * detail the sentence seems to be missing — a cause, a measurement, a
 * material, a recommendation — and every one of those is a fact nobody
 * observed, in a document somebody may be paid or refused on. So the prompt
 * forbids it in as many words, the temperature is zero, and the output is
 * capped near the length of the input: a rewrite that grows is a rewrite
 * that invented something.
 */
const SYSTEM = `You rewrite a restoration contractor's site notes so they read professionally in an insurance report.

ABSOLUTE RULES:
- Never add information. No causes, measurements, materials, dates, room names, recommendations or conclusions that are not already in the note.
- Never remove information. Every fact in the input must survive.
- Never soften or strengthen a claim. "Might be mould" stays "might be"; "floor is destroyed" does not become "floor shows damage".
- No greeting, no sign-off, no preamble, no explanation. Return the rewritten note and nothing else.
- Keep it to roughly the length of the input. If the input is one sentence, return one sentence.
- Match the input's language. A French note comes back in French.
- Plain trade English. Not legal language, not marketing language.

If the note is already clear and professional, return it unchanged.`;

export class NotesPolishError extends Error {}

/**
 * Returns the polished text, or throws `NotesPolishError` with a message
 * safe to surface to an operator — never a raw SDK or network error.
 */
export async function polishNote(note: string): Promise<string> {
  const trimmed = note.trim();
  if (trimmed.length < 3) throw new NotesPolishError("There is nothing to tidy up yet.");
  // A site note is a sentence or two. Anything longer is a paste, and
  // rewriting a wall of text is a different job with different risks.
  if (trimmed.length > 1200) throw new NotesPolishError("That note is too long to tidy up.");
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new NotesPolishError("The writing assistant is not configured.");
  }

  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 600,
    // Zero, deliberately. This is a transcription task wearing a writing
    // task's clothes, and every degree of creativity here is a degree of
    // invention in a document that must not contain any.
    temperature: 0,
    system: SYSTEM,
    messages: [{ role: "user", content: trimmed }],
  });

  const polished = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!polished) throw new NotesPolishError("The writing assistant returned nothing.");

  // A rewrite far longer than the original has added something, whatever
  // the prompt said. Refusing is better than handing back a note the
  // operator may accept without reading closely.
  if (polished.length > Math.max(240, trimmed.length * 2)) {
    throw new NotesPolishError("That came back longer than it went in — keeping your own wording.");
  }

  return polished;
}
