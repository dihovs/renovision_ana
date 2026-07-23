import Anthropic from "@anthropic-ai/sdk";
import {
  estimateRange,
  type FloorMaterial,
  type ProjectSize,
  type ProjectType,
  type QualityTier,
  type WallMaterial,
} from "@/components/chat/chatLogic";
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
            max_tokens: 1024,
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

            if (block.name === "estimate_price") {
              const input = block.input as {
                projectType: ProjectType;
                size: ProjectSize;
                tier: QualityTier;
                floorMaterial?: FloorMaterial;
                wallMaterial?: WallMaterial;
              };
              const { low, high } = estimateRange(input.projectType, input.size, input.tier);
              emit({ type: "estimate", ...input, low, high });
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: `Estimated range: ${low} - ${high}. Briefly confirm the estimate is ready without restating the dollar figures yourself.`,
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
