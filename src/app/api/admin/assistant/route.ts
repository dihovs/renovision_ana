import { isSignedIn } from "@/lib/adminAuth";
import { buildContext, streamAnswer, type AssistantMessage, type AssistantSubject } from "@/lib/crm/assistant";

/**
 * Ask Claude about a lead, job or client.
 *
 * Behind the admin session, and the context is assembled server-side from the
 * record id alone. Nothing the browser sends becomes part of the prompt except
 * the questions themselves — a context supplied by the client is a prompt any
 * caller can rewrite.
 */

export const runtime = "nodejs";
// The record is fetched fresh on every question; a cached answer about a lead
// whose status has since changed is worse than no answer.
export const dynamic = "force-dynamic";

const MAX_TURNS = 20;
const MAX_QUESTION_CHARS = 2000;

export async function POST(request: Request) {
  if (!(await isSignedIn())) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }

  let body: {
    subject?: AssistantSubject;
    messages?: AssistantMessage[];
    escalate?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const subject = body.subject;
  if (
    !subject ||
    !["lead", "job", "client"].includes(subject.kind) ||
    typeof subject.id !== "string" ||
    // Every id in this system is a uuid. Anything else is not worth a database
    // round trip.
    !/^[0-9a-f-]{36}$/i.test(subject.id)
  ) {
    return Response.json({ error: "Unknown record" }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter(
      (m): m is AssistantMessage =>
        Boolean(m) &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_QUESTION_CHARS) }));

  if (messages.length === 0) {
    return Response.json({ error: "Ask a question" }, { status: 400 });
  }

  const context = await buildContext(subject);
  if (!context) {
    return Response.json({ error: "That record no longer exists." }, { status: 404 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "The assistant is not configured — ANTHROPIC_API_KEY is missing." },
      { status: 503 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        const answer = streamAnswer(context, messages, { escalate: body.escalate });
        answer.on("text", (delta) => emit({ type: "text", text: delta }));
        await answer.finalMessage();
        emit({ type: "done" });
      } catch (err) {
        console.error("[assistant] failed:", err);
        // The record itself may contain a customer's name and address, so the
        // error text never leaves the server.
        emit({ type: "error", message: "Something went wrong." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
