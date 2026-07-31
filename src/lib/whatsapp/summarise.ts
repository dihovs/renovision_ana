import Anthropic from "@anthropic-ai/sdk";
import { getSummary, listJobMessages, saveSummary } from "./store";

/**
 * Claude's overview of a job's WhatsApp thread.
 *
 * The point is that the job page shows what happened without anyone scrolling
 * two hundred messages — and then offers a click through to the full thread and
 * the photos, because a summary is a way in, not a replacement.
 *
 * Cached against the message count. The thread only changes when a message
 * arrives, so re-summarising an unchanged conversation is paying to produce the
 * same paragraph twice.
 */

const MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `You summarise WhatsApp threads between Renovision AnA and their subcontractors, for the owner, Artush.

These are working conversations from a job site: instructions going out, photos and progress coming back, problems being raised. He reads your summary before walking onto the site or picking up the phone.

Write four or five sentences of plain prose. No headings, no bullets.

Cover, in this order and only where the thread actually says so:
- What was asked for
- What has been done
- Anything that went wrong, was found unexpectedly, or is waiting on a decision
- What the thread is waiting on right now

The last one matters most. A thread that ends with an unanswered question from a sub is the whole reason to read this.

Rules:
- Only what the messages say. If nobody mentioned the subfloor, do not mention the subfloor.
- Photos arrive as "[photo]" with any caption. You cannot see them — say a photo was sent, never what it shows.
- Quantities, measurements and dates: repeat them exactly or leave them out.
- If the thread is too thin to summarise, say so in one line instead of padding.
- Match the thread's language. These are usually French.`;

/** How a message is rendered for the model. Media becomes a marker, not a claim. */
function renderMessage(m: {
  direction: string;
  kind: string;
  body: string | null;
  media_caption: string | null;
  sent_at: string;
}): string {
  const who = m.direction === "inbound" ? "Sub" : "Us";
  const date = m.sent_at.slice(0, 10);

  if (m.kind !== "text" && m.kind !== "location") {
    const caption = m.media_caption ?? m.body;
    return `[${date}] ${who}: [${m.kind}]${caption ? ` — ${caption}` : ""}`;
  }
  return `[${date}] ${who}: ${m.body ?? ""}`;
}

/**
 * Summarise, reusing the cached version when the thread hasn't moved.
 *
 * `force` exists for the refresh button — the owner may want a fresh read after
 * changing what he is looking for, even when nothing new has arrived.
 */
export async function summariseJobThread(
  jobId: string,
  options: { force?: boolean } = {},
): Promise<{ summary: string; messageCount: number; cached: boolean } | null> {
  const messages = await listJobMessages(jobId);
  if (messages.length === 0) return null;

  if (!options.force) {
    const cached = await getSummary(jobId);
    if (cached && cached.message_count === messages.length) {
      return { summary: cached.summary, messageCount: messages.length, cached: true };
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) return null;

  // The most recent 200. A thread longer than that is months of work, and the
  // tail is what anyone actually needs before walking on site.
  const transcript = messages.slice(-200).map(renderMessage).join("\n");

  const client = new Anthropic();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: `Here is the thread. Summarise it.\n\n${transcript}`,
      },
    ],
  });

  const summary = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join(" ")
    .trim();

  if (!summary) return null;

  await saveSummary(jobId, summary, messages.length);
  return { summary, messageCount: messages.length, cached: false };
}
