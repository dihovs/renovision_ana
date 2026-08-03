import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { formatMoney } from "./money";
import type { ProjectBrief } from "@/lib/projectBrief";

/**
 * The CRM assistant — ask Claude about a lead or a job.
 *
 * Reuses the same API key as the website chat widget, as the plan intends, but
 * with a completely different system prompt. That separation is the whole
 * design: the public widget talks TO customers and is deliberately starved of
 * pricing data; this one talks ABOUT them to the owner, and is given the
 * internal numbers precisely because nobody else can see it.
 *
 * Haiku by default. These are short summarisation and question-answering tasks
 * over a page or two of context, the owner is standing on a job site waiting
 * for the answer, and a bigger model would cost more for a slower reply that
 * isn't better at this.
 */

const MODEL = "claude-haiku-4-5";
const ESCALATED_MODEL = "claude-sonnet-4-6";

export type AssistantSubject =
  | { kind: "lead"; id: string }
  | { kind: "job"; id: string }
  | { kind: "client"; id: string };

/**
 * Everything the assistant is allowed to see about one record.
 *
 * Assembled server-side from the record id — never from anything the browser
 * sends. A prompt built from client-supplied context is a prompt anyone with
 * the endpoint can rewrite.
 */
export async function buildContext(subject: AssistantSubject): Promise<string | null> {
  const client = db();
  if (!client) return null;

  if (subject.kind === "lead") {
    const { data } = await client
      .from("leads")
      .select(
        "created_at, name, email, phone, address, locale, scope_summary, estimate_low, estimate_expected, estimate_high, total, estimated_work_days, status, notes, project_brief",
      )
      .eq("id", subject.id)
      .maybeSingle();
    if (!data) return null;

    const lead = data as Record<string, unknown> & { project_brief: ProjectBrief | null };
    const brief = lead.project_brief;

    return [
      "RECORD TYPE: website lead",
      `Received: ${lead.created_at}`,
      `Name: ${lead.name}`,
      `Phone: ${lead.phone}`,
      `Email: ${lead.email}`,
      lead.address ? `Address given: ${lead.address}` : null,
      `Language they used: ${lead.locale}`,
      `Pipeline status: ${lead.status}`,
      "",
      "WHAT THE ESTIMATOR PRODUCED",
      lead.scope_summary ? `Scope: ${lead.scope_summary}` : "No scope recorded.",
      lead.estimate_low ? `Range shown to them: ${lead.estimate_low} – ${lead.estimate_high}` : null,
      lead.total ? `Total with tax: ${lead.total}` : null,
      lead.estimated_work_days != null ? `Estimated work days: ${lead.estimated_work_days}` : null,
      "",
      "THE ASSISTANT'S BRIEF FROM THE CONVERSATION",
      brief?.headline ? brief.headline : "No brief was filed.",
      ...(brief?.facts ?? []).map((f) => `- ${f.label}: ${f.value}`),
      brief?.customerWords ? `\nIn their own words: "${brief.customerWords}"` : null,
      ...(brief?.openQuestions?.length
        ? ["", "Still unconfirmed:", ...brief.openQuestions.map((q) => `- ${q}`)]
        : []),
      "",
      lead.notes ? `OWNER'S OWN NOTES\n${lead.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (subject.kind === "job") {
    const { data } = await client
      .from("jobs")
      .select(
        "job_number, title, status, instructions, internal_notes, starts_on, subtotal_cents, total_cents, client_snapshot, property_snapshot, job_line_items(name, description, quantity_milli, unit, unit_price_cents, labor_hours), visits(starts_at, title, completed_at, notes)",
      )
      .eq("id", subject.id)
      .maybeSingle();
    if (!data) return null;

    const job = data as Record<string, unknown> & {
      client_snapshot: { displayName?: string } | null;
      property_snapshot: { street1?: string; city?: string; accessNotes?: string } | null;
      job_line_items: {
        name: string;
        description: string | null;
        quantity_milli: number | null;
        unit: string | null;
        unit_price_cents: number | null;
        labor_hours: number | null;
      }[];
      visits: { starts_at: string; title: string | null; completed_at: string | null; notes: string | null }[];
    };

    return [
      "RECORD TYPE: job",
      `Job #${job.job_number}: ${job.title ?? "untitled"}`,
      `Status: ${job.status}`,
      `Client: ${job.client_snapshot?.displayName ?? "unknown"}`,
      job.property_snapshot?.street1
        ? `Address: ${[job.property_snapshot.street1, job.property_snapshot.city].filter(Boolean).join(", ")}`
        : null,
      job.property_snapshot?.accessNotes ? `Access: ${job.property_snapshot.accessNotes}` : null,
      `Value: ${formatMoney(Number(job.total_cents) || 0)}`,
      "",
      "WORK",
      ...(job.job_line_items ?? []).map(
        (l) =>
          `- ${l.name}${l.description ? ` (${l.description})` : ""}: ${(l.quantity_milli ?? 0) / 1000} ${l.unit ?? ""} at ${formatMoney(l.unit_price_cents ?? 0)}${l.labor_hours ? `, ${l.labor_hours} h/unit` : ""}`,
      ),
      "",
      "VISITS",
      ...(job.visits ?? []).map(
        (v) =>
          `- ${v.starts_at}${v.title ? ` — ${v.title}` : ""}${v.completed_at ? " [done]" : " [not done]"}${v.notes ? ` — ${v.notes}` : ""}`,
      ),
      "",
      job.instructions ? `INSTRUCTIONS TO THE CREW\n${job.instructions}` : null,
      job.internal_notes ? `\nINTERNAL NOTES\n${job.internal_notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const { data } = await client
    .from("clients")
    .select(
      "first_name, last_name, company_name, emails, phones, lead_source, tags, notes, created_at, properties(street1, city, access_notes)",
    )
    .eq("id", subject.id)
    .maybeSingle();
  if (!data) return null;

  const c = data as Record<string, unknown> & {
    properties: { street1: string | null; city: string | null; access_notes: string | null }[];
  };

  return [
    "RECORD TYPE: client",
    `Name: ${[c.first_name, c.last_name].filter(Boolean).join(" ") || c.company_name}`,
    c.company_name ? `Company: ${c.company_name}` : null,
    `Client since: ${c.created_at}`,
    c.lead_source ? `Came from: ${c.lead_source}` : null,
    Array.isArray(c.tags) && c.tags.length ? `Tags: ${(c.tags as string[]).join(", ")}` : null,
    "",
    "PROPERTIES",
    ...(c.properties ?? []).map(
      (p) =>
        `- ${[p.street1, p.city].filter(Boolean).join(", ")}${p.access_notes ? ` (${p.access_notes})` : ""}`,
    ),
    "",
    c.notes ? `NOTES\n${c.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The assistant's brief.
 *
 * Written to be useful to a tradesperson between jobs, which mostly means:
 * answer the question, admit what the record does not say, and never invent a
 * fact about a real customer. The last one is not a style preference — an
 * invented detail here becomes something the owner repeats on a phone call.
 */
const SYSTEM_PROMPT = `You are the assistant inside Renovision AnA's own CRM. You are talking to Artush, who owns the company — a renovation and water-damage restoration business in Laval, Quebec. Nobody else can see this conversation. The customer never sees it.

You are given ONE record from the CRM. Answer only from that record.

HOW TO ANSWER
- Be brief. He is usually reading this on a phone, often between jobs. Two or three sentences beats a page.
- Lead with the answer, not with a restatement of the question.
- Plain language, tradesperson to tradesperson. No headers, no bullet-point walls unless he asks for a list.

WHAT YOU MUST NOT DO
- Never invent a fact about a customer. If the record doesn't say, say "the record doesn't say" — he will act on what you tell him, and a plausible guess about a real person's home is worse than an admission.
- Never state a price, a total, or a timeline that isn't in the record. If he asks what to charge, talk about what the record shows and what is still unknown; do not produce a number of your own.
- Do not soften bad news. If a lead looks cold or a job looks underpriced, say so plainly and say why.
- Do not give legal, insurance-coverage, or tax advice. Point out that it is a question for his accountant or broker.

WHAT IS ACTUALLY USEFUL
- What the customer's real concern is, in their words.
- What is still unconfirmed and would change the price.
- What to ask on the call.
- Whether something in the record looks wrong or missing.

If he writes in French, answer in French.`;

export type AssistantMessage = { role: "user" | "assistant"; content: string };

/**
 * Stream an answer.
 *
 * `escalate` is the same idea the voice agent will use: when the first answer
 * isn't landing, try harder rather than repeating yourself in the same voice.
 * Here the owner triggers it deliberately, because he can see the answer and
 * judge it — on a phone call it will have to be detected.
 */
export function streamAnswer(
  context: string,
  messages: AssistantMessage[],
  options: { escalate?: boolean } = {},
) {
  const client = new Anthropic();

  return client.messages.stream({
    model: options.escalate ? ESCALATED_MODEL : MODEL,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // Byte-identical on every request, so it is marked cacheable — but
        // Haiku 4.5 only caches prefixes of 4096+ tokens and this one is far
        // shorter, so today this is a no-op that fails silently rather than a
        // saving. Kept for when the prompt grows past the threshold.
        cache_control: { type: "ephemeral" },
      },
      { type: "text", text: `THE RECORD\n\n${context}` },
    ],
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
}
