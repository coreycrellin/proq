import { NextRequest, NextResponse } from "next/server";
import {
  getProjectSupervisorChatLog,
  addProjectSupervisorMessage,
  clearProjectSupervisorChatLog,
  getProjectSupervisorDraft,
  setProjectSupervisorDraft,
  getProject,
  getAllTasks,
} from "@/lib/db";
import { runSupervisor, type SupervisorChunk, type ProjectContext } from "@/lib/supervisor";
import type { ToolCall } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [chatLog, draft] = await Promise.all([
    getProjectSupervisorChatLog(id),
    getProjectSupervisorDraft(id),
  ]);
  return NextResponse.json({ chatLog, draft });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const draft = typeof body.draft === "string" ? body.draft : "";
  await setProjectSupervisorDraft(id, draft);
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const message = body.message as string | undefined;
  const attachments = body.attachments as Array<{ name: string; type: string; dataUrl?: string }> | undefined;
  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Build full message with attachment info
  let fullMessage = message.trim();
  if (attachments && attachments.length > 0) {
    const attNames = attachments.map((a) => a.name).join(", ");
    fullMessage += `\n[Attached: ${attNames}]`;
  }

  // Save user message
  await addProjectSupervisorMessage(id, { role: "user", message: fullMessage });

  // Get history for context
  const history = await getProjectSupervisorChatLog(id);

  // Build project context with current task state
  const tasks = await getAllTasks(id);
  const taskLines: string[] = [];
  for (const [status, items] of Object.entries(tasks)) {
    if (items.length > 0) {
      taskLines.push(
        `${status}: ${items.map((t) => t.title || t.description.slice(0, 50)).join(", ")}`
      );
    }
  }

  const projectContext: ProjectContext = {
    id: project.id,
    name: project.name,
    path: project.path,
    taskSummary: taskLines.length > 0 ? taskLines.join("\n") : undefined,
  };

  // Create abort controller tied to request
  const abortController = new AbortController();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      (async () => {
        let fullText = "";
        const toolCalls: ToolCall[] = [];

        // Collect image data URLs for passing to supervisor
        const imageDataUrls = (attachments || [])
          .filter((a) => a.type?.startsWith("image/") && a.dataUrl)
          .map((a) => a.dataUrl as string);

        try {
          for await (const chunk of runSupervisor(
            history.slice(0, -1), // exclude the user message we just added
            fullMessage,
            abortController.signal,
            projectContext,
            imageDataUrls.length > 0 ? imageDataUrls : undefined,
          )) {
            // Accumulate for persistence
            if (chunk.type === "text_delta") {
              fullText += chunk.text;
            } else if (chunk.type === "tool_call") {
              toolCalls.push({ action: chunk.action, detail: chunk.detail });
            } else if (chunk.type === "result" && !fullText) {
              fullText = chunk.text;
            }

            // Stream to client
            controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
          }
        } catch (err) {
          const errorChunk: SupervisorChunk = {
            type: "error",
            error: String(err),
          };
          controller.enqueue(encoder.encode(JSON.stringify(errorChunk) + "\n"));
        }

        // Persist the supervisor response
        if (fullText.trim() || toolCalls.length > 0) {
          await addProjectSupervisorMessage(id, {
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

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  await clearProjectSupervisorChatLog(id);
  return NextResponse.json({ ok: true });
}
