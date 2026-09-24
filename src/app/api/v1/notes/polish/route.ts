import { guarded } from "../../guard";
import { polishNote } from "@/lib/notesPolish";

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
 * has to be built narrowly. The actual rewrite — the prompt, the guardrails,
 * the length check — lives in `src/lib/notesPolish.ts` now, shared with the
 * automatic pass a report/estimate export runs over every affected area's
 * damage notes: one prompt, so a note polished by hand here and a note
 * polished automatically there read the same way.
 *
 * **And it never replaces silently.** The caller shows both and the operator
 * chooses. What he wrote is what he saw; this is only a suggestion about how
 * to say it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { note?: unknown } | null;
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  return guarded(async () => {
    const polished = await polishNote(note);
    return { polished, original: note };
  });
}
