import Anthropic from "@anthropic-ai/sdk";
import { calculateEstimate, formatCents, formatCentsPrecise } from "@/lib/estimator/calculate";
import type { ScopeLine } from "@/lib/estimator/types";
import { CHAT_TOOLS, buildSystemPrompt } from "./chatTools";

export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_TOOL_ROUNDS = 4;

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
  imageDataUrl?: string;
};

function toAnthropicMessage(message: IncomingMessage): Anthropic.MessageParam {
  const content: Anthropic.ContentBlockParam[] = [];

  if (message.imageDataUrl) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(message.imageDataUrl);
    if (match && ALLOWED_IMAGE_TYPES.has(match[1])) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: match[2],
        },
      });
    }
  }

  content.push({ type: "text", text: message.content || "(photo attached)" });
  return { role: message.role, content };
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Chat is not configured. Set ANTHROPIC_API_KEY to enable it." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as { messages?: IncomingMessage[]; locale?: "en" | "fr" };
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const locale = body.locale === "fr" ? "fr" : "en";

  if (incoming.length === 0) {
    return Response.json({ error: "No messages provided." }, { status: 400 });
  }

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function emit(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }

      try {
        let turnMessages: Anthropic.MessageParam[] = incoming.map(toAnthropicMessage);

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const messageStream = client.messages.stream({
            model: "claude-opus-4-8",
            max_tokens: 2048,
            system: [
              {
                type: "text",
                text: buildSystemPrompt(locale),
                cache_control: { type: "ephemeral" },
              },
            ],
            tools: CHAT_TOOLS,
            messages: turnMessages,
          });

          messageStream.on("text", (delta) => emit({ type: "text", text: delta }));

          const finalMessage = await messageStream.finalMessage();
          turnMessages = [...turnMessages, { role: "assistant", content: finalMessage.content }];

          if (finalMessage.stop_reason !== "tool_use") break;

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of finalMessage.content) {
            if (block.type !== "tool_use") continue;

            if (block.name === "build_estimate") {
              const input = block.input as {
                scopeSummary?: string;
                lines?: { itemCode?: string; quantity?: number }[];
              };
              const scope: ScopeLine[] = (input.lines ?? [])
                .filter((l): l is { itemCode: string; quantity: number } =>
                  typeof l.itemCode === "string" && typeof l.quantity === "number",
                )
                .map((l) => ({ itemCode: l.itemCode, quantity: l.quantity }));

              const result = calculateEstimate(scope);

              // The customer sees only the range; the itemized breakdown and
              // tax math ride along so the widget can forward them to the lead
              // email (so the owner sees exactly what the estimator calculated).
              emit({
                type: "estimate",
                scopeSummary: input.scopeSummary ?? "",
                low: formatCents(result.lowCents),
                expected: formatCents(result.expectedCents),
                high: formatCents(result.highCents),
                lines: result.lines.map((l) => ({
                  name: l.name,
                  quantity: l.quantity,
                  unit: l.unit,
                  total: formatCentsPrecise(l.lineTotalCents),
                })),
                subtotal: formatCentsPrecise(result.subtotalCents),
                gst: formatCentsPrecise(result.gstCents),
                qst: formatCentsPrecise(result.qstCents),
                total: formatCentsPrecise(result.totalCents),
                exclusions: result.exclusions,
              });

              // Claude gets only a terse confirmation — not the dollar figures,
              // so it can't restate them (they're shown to the customer directly).
              const note =
                result.lines.length === 0
                  ? "No valid catalog items were priced. Ask the customer for a clearer scope."
                  : `Priced ${result.lines.length} line item(s). The range is now shown to the customer. Confirm the estimate is ready in one short sentence without restating any dollar figures.`;
              const unknownNote = result.unknownItemCodes.length
                ? ` Ignored unknown item codes: ${result.unknownItemCodes.join(", ")} — do not invent codes.`
                : "";
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: note + unknownNote,
              });
            } else {
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: "Unknown tool.",
                is_error: true,
              });
            }
          }
          turnMessages = [...turnMessages, { role: "user", content: toolResults }];
        }

        emit({ type: "done" });
      } catch (err) {
        console.error("[chat] request failed:", err);
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
