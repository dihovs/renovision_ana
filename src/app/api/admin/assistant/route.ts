import { isSignedIn } from "@/lib/adminAuth";
import type Anthropic from "@anthropic-ai/sdk";
import {
  buildContext,
  MAX_IMAGES_PER_TURN,
  sanitiseImages,
  streamAnswer,
  type AssistantMessage,
  type AssistantSubject,
} from "@/lib/crm/assistant";
import { ADMIN_OWNER_SESSION } from "@/lib/voice/owner";
import { ownerToolsFor, runOwnerTool } from "@/lib/voice/ownerTools";

/**
 * Ask Claude about a lead, job or client.
 *
 * Behind the admin session, and the context is assembled server-side from the
 * record id alone. Nothing the browser sends becomes part of the prompt except
 * the questions themselves — a context supplied by the client is a prompt any
 * caller can rewrite.
 *
 * SINCE ANA-20 IT HAS ANA'S TOOLS. This is the second authenticated owner
 * surface and the only place ADMIN_OWNER_SESSION may be used — see the comment
 * on that constant for why a signed-in admin holding Ana's draft-only tools is
 * not an escalation (the admin panel around this box can already send the
 * invoice with one click and no model involved).
 *
 * The record becomes optional here for the same reason: with tools, a box
 * opened on the dashboard rather than on somebody's file is a useful thing
 * rather than an empty one.
 */

export const runtime = "nodejs";
// The record is fetched fresh on every question; a cached answer about a lead
// whose status has since changed is worse than no answer.
export const dynamic = "force-dynamic";

const MAX_TURNS = 20;
/**
 * How many times the model may call tools before answering.
 *
 * Six covers the deepest real chain — resolve a name, read the record, check
 * what is slipping, price something, draft it — with room to spare, and bounds
 * a loop that would otherwise be paid for one round trip at a time.
 */
const MAX_TOOL_ROUNDS = 6;
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

  // A subject is optional now, but a MALFORMED one is still refused: absent
  // means "opened on the dashboard", while a broken id means the caller is
  // confused and a database round trip would not help them.
  const subject = body.subject ?? null;
  if (
    subject &&
    (!["lead", "job", "client"].includes(subject.kind) ||
      typeof subject.id !== "string" ||
      // Every id in this system is a uuid. Anything else is not worth a
      // database round trip.
      !/^[0-9a-f-]{36}$/i.test(subject.id))
  ) {
    return Response.json({ error: "Unknown record" }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter(
      (m): m is AssistantMessage =>
        Boolean(m) &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        // A photo with no words is still a question ("what is this?"), so an
        // empty string is allowed when something is attached to it.
        (m.content.trim().length > 0 || Boolean(m.images?.length)),
    )
    .slice(-MAX_TURNS)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_QUESTION_CHARS),
      images: sanitiseImages(m.images),
    }));

  if (messages.length === 0) {
    return Response.json({ error: "Ask a question" }, { status: 400 });
  }

  // A photo that was sent but silently dropped would have him believing Ana
  // looked at something she never saw, so a rejected attachment is an error
  // rather than a quieter answer.
  for (const [index, original] of (body.messages ?? []).entries()) {
    const kept = messages[index]?.images?.length ?? 0;
    const sent = original?.images?.length ?? 0;
    if (sent > kept && sent > 0) {
      return Response.json(
        {
          error:
            sent > MAX_IMAGES_PER_TURN
              ? `Three photos at a time, please — that was ${sent}.`
              : "That photo could not be read. JPEG, PNG, GIF or WebP, under about 3 MB.",
        },
        { status: 400 },
      );
    }
  }

  const context = subject ? await buildContext(subject) : null;
  if (subject && !context) {
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
        const tools = ownerToolsFor(ADMIN_OWNER_SESSION);
        let turn: AssistantMessage[] | Anthropic.MessageParam[] = messages;

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const answer = streamAnswer(context, turn as AssistantMessage[], {
            escalate: body.escalate,
            tools,
          });
          answer.on("text", (delta) => emit({ type: "text", text: delta }));
          const final = await answer.finalMessage();

          if (final.stop_reason !== "tool_use") break;

          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const block of final.content) {
            if (block.type !== "tool_use") continue;
            // Named to the reader as it runs: a box that sits silent while it
            // reads six tables looks broken, and "Checking the price book" is
            // also the only place he can see WHICH tools answered him.
            emit({ type: "tool", name: block.name });
            // runOwnerTool never throws — a broken tool must produce a sentence
            // rather than an exception that ends the conversation.
            const output = await runOwnerTool(ADMIN_OWNER_SESSION, block.name, block.input, {
              // English, unlike the phone, which defaults to French: this admin
              // panel is written in English and he reads it in English. The
              // model still answers him in French if he writes in French —
              // that is SYSTEM_PROMPT's job, and it is about his words, not
              // about how a tool labelled a column.
              locale: "en",
              surface: "screen",
            });
            results.push({ type: "tool_result", tool_use_id: block.id, content: output });
          }

          turn = [
            ...(turn as Anthropic.MessageParam[]),
            { role: "assistant", content: final.content },
            { role: "user", content: results },
          ];
        }

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
