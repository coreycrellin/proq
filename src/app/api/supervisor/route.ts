import { NextRequest, NextResponse } from "next/server";
import {
  getSupervisorChatLog,
  addSupervisorMessage,
  clearSupervisorChatLog,
  getSupervisorDraft,
  setSupervisorDraft,
} from "@/lib/db";
import { runSupervisor, formatToolDetail } from "@/lib/supervisor";
import type { ToolCall } from "@/lib/types";

export async function GET() {
  const [chatLog, draft] = await Promise.all([
    getSupervisorChatLog(),
    getSupervisorDraft(),
  ]);
  return NextResponse.json({ chatLog, draft });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const draft = typeof body.draft === "string" ? body.draft : "";
  await setSupervisorDraft(draft);
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const message = body.message as string | undefined;
  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Save user message
  await addSupervisorMessage({ role: "user", message: message.trim() });

  // Get history for context
  const history = await getSupervisorChatLog();

  // Create abort controller tied to request
  const abortController = new AbortController();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      (async () => {
        const textBlocks: string[] = [];
        const toolCalls: ToolCall[] = [];
        let resultText = "";
        const emittedToolIds = new Set<string>();

        try {
          for await (const chunk of runSupervisor(
            history.slice(0, -1), // exclude the user message we just added
            message.trim(),
            abortController.signal,
          )) {
            if (chunk.type === "stream_event") {
              const event = chunk.event;
              const eventType = event.type as string;

              // Forward raw event to client
              controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

              // Accumulate for persistence
              if (eventType === "assistant" && event.message) {
                const msg = event.message as { content?: Array<Record<string, unknown>> };
                if (msg.content) {
                  for (const block of msg.content) {
                    if (block.type === "text" && block.text) {
                      textBlocks.push(block.text as string);
                    }
                    if (block.type === "tool_use" && block.name) {
                      const toolId = String(block.id || "");
                      if (!emittedToolIds.has(toolId)) {
                        emittedToolIds.add(toolId);
                        toolCalls.push({
                          action: String(block.name),
                          detail: formatToolDetail(
                            String(block.name),
                            (block.input as Record<string, unknown>) || {},
                          ),
                        });
                      }
                    }
                  }
                }
              }

              if (eventType === "result") {
                const result = event.result as string | undefined;
                if (result) resultText = result;
              }
            } else if (chunk.type === "error") {
              controller.enqueue(
                encoder.encode(JSON.stringify({ type: "error", error: chunk.error }) + "\n")
              );
            }
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "error", error: String(err) }) + "\n")
          );
        }

        // Persist the supervisor response
        const fullText = resultText || textBlocks.join("\n");
        if (fullText.trim() || toolCalls.length > 0) {
          await addSupervisorMessage({
            role: "proq",
            message: fullText.trim() || "(tool calls only)",
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          });
        }

        controller.close();
      })().catch((err) => {
        controller.error(err);
      });
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function DELETE() {
  await clearSupervisorChatLog();
  return NextResponse.json({ ok: true });
}
