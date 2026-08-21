import Anthropic from "@anthropic-ai/sdk";
import { guarded } from "../../guard";

/**
 * Tidy a site note into something that can go in front of an adjuster.
 *
 * **His ask, 20 Aug 2026:** *"when I'm taking the notes, I'm just saying
 * whatever I can with my language, and it doesn't sound professional. Do you
 * think we can add some kind of an AI editor there?"*
 *
 * He dictates these one-handed in a wet basement, often in his second
 * language, and they go verbatim into a document an insurer reads. Every
 * word of that is a good reason to have this — and the same words are why it
 * has to be built narrowly.
 *
 * **THE ONE RULE: it may not add anything.** A note on a claim is evidence.
 * A model asked to make text "more professional" will helpfully supply the
 * detail the sentence seems to be missing — a cause, a measurement, a
 * material, a recommendation — and every one of those is a fact nobody
 * observed, in a document somebody may be paid or refused on. So the prompt
 * forbids it in as many words, the temperature is zero, and the output is
 * capped near the length of the input: a rewrite that grows is a rewrite
 * that invented something.
 *
 * **And it never replaces silently.** The caller shows both and the operator
 * chooses. What he wrote is what he saw; this is only a suggestion about how
 * to say it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { note?: unknown } | null;
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  return guarded(async () => {
    if (note.length < 3) throw new Error("There is nothing to tidy up yet.");
    // A site note is a sentence or two. Anything longer is a paste, and
    // rewriting a wall of text is a different job with different risks.
    if (note.length > 1200) throw new Error("That note is too long to tidy up.");
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("The writing assistant is not configured.");

    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      // Zero, deliberately. This is a transcription task wearing a writing
      // task's clothes, and every degree of creativity here is a degree of
      // invention in a document that must not contain any.
      temperature: 0,
      system: SYSTEM,
      messages: [{ role: "user", content: note }],
    });

    const polished = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!polished) throw new Error("The writing assistant returned nothing.");

    // A rewrite far longer than the original has added something, whatever
    // the prompt said. Refusing is better than handing back a note the
    // operator may accept without reading closely.
    if (polished.length > Math.max(240, note.length * 2)) {
      throw new Error("That came back longer than it went in — keeping your own wording.");
    }

    return { polished, original: note };
  });
}
