import { spawn, type ChildProcess } from "child_process";
import { join } from "path";
import { readFile } from "fs/promises";
import type { AgentBlock, TaskAttachment, TaskMode } from "./types";
import { claudeOneShot } from "./claude-cli";
import { updateTask, getTask, getProject, getSettings, setTaskAgentBlocks, readAgentBlocksFile } from "./db";
import {
  notify,
  buildProqSystemPrompt,
  writeMcpConfig,
} from "./agent-dispatch";
import { emitTaskUpdate } from "./task-events";
import { autoCommitIfDirty } from "./worktree";
import { getClaudeBin } from "./claude-bin";
import type WebSocket from "ws";

export interface PendingFollowUp {
  text: string;
  attachments?: TaskAttachment[];
  planApproved?: boolean;
  userBlockAlreadyAppended?: boolean;
}

export interface AgentRuntimeSession {
  taskId: string;
  projectId: string;
  sessionId?: string;
  mcpConfig?: string;
  queryHandle: ChildProcess | null;
  blocks: AgentBlock[];
  clients: Set<WebSocket>;
  status: "running" | "done" | "error" | "aborted" | "killing";
  pendingFollowUp?: PendingFollowUp;
  /** Promise that resolves when an async ExitPlanMode block read completes */
  pendingPlanRead?: Promise<void>;
  /**
   * Tracks the number of content blocks already processed from the current
   * assistant message. With --include-partial-messages, each partial `assistant`
   * event includes ALL content blocks so far. Without this counter, the same
   * text/thinking blocks would be appended multiple times.
   */
  assistantBlocksProcessed: number;
  /**
   * Maps content block index (within the current assistant message) to the
   * index in session.blocks where that block was stored. Used to update
   * text/thinking blocks in-place when their content grows via partial messages,
   * ensuring replays show the final text rather than the first partial.
   */
  contentToBlockIdx: Map<number, number>;
  /**
   * Short label describing what Claude is currently working on, generated
   * by Haiku after each turn. Displayed near the input in the chat UI.
   */
  contextLabel?: string;
  /** Tracks last emitted agentStatus to avoid redundant updates */
  _lastAgentStatus?: "running" | "idle";
}

// ── Singleton attached to globalThis to survive HMR ──
const g = globalThis as unknown as {
  __proqAgentRuntimeSessions?: Map<string, AgentRuntimeSession>;
  __proqBlockFlushTimers?: Map<string, ReturnType<typeof setTimeout>>;
};
if (!g.__proqAgentRuntimeSessions) g.__proqAgentRuntimeSessions = new Map();
if (!g.__proqBlockFlushTimers) g.__proqBlockFlushTimers = new Map();

const sessions = g.__proqAgentRuntimeSessions;
const flushTimers = g.__proqBlockFlushTimers;

function broadcast(session: AgentRuntimeSession, msg: object) {
  const data = JSON.stringify(msg);
  for (const ws of session.clients) {
    try {
      if (ws.readyState === 1) {
        ws.send(data);
      } else if (ws.readyState >= 2) {
        // CLOSING or CLOSED — remove stale client to prevent duplicate broadcasts
        session.clients.delete(ws);
      }
    } catch {
      session.clients.delete(ws);
    }
  }
}

/**
 * Debounced persistence of blocks to DB.
 * Ensures blocks survive HMR / server restarts so the WS fallback
 * path (reading agentBlocks from DB) has data.
 */
function scheduleBlockFlush(session: AgentRuntimeSession) {
  const key = session.taskId;
  if (flushTimers.has(key)) return; // already scheduled
  flushTimers.set(
    key,
    setTimeout(async () => {
      flushTimers.delete(key);
      try {
        await updateTask(session.projectId, session.taskId, {
          agentBlocks: session.blocks,
        });
      } catch {
        // DB write failed — will retry on next append
      }
    }, 2000),
  );
}

function appendBlock(session: AgentRuntimeSession, block: AgentBlock) {
  // Dedup guard: check recent blocks (not just the last one) for identical
  // text/thinking content.  Tool results can sit between the original and a
  // duplicate, so scanning only the last block is insufficient.
  if (block.type === "text" || block.type === "thinking") {
    const searchKey = block.type === "text" ? "text" : "thinking";
    const blockContent = block.type === "text" ? block.text : block.thinking;
    // Scan backwards through recent blocks (up to 30) looking for a match
    for (let i = session.blocks.length - 1; i >= 0 && i >= session.blocks.length - 30; i--) {
      const prev = session.blocks[i];
      if (prev.type === block.type && (prev as Record<string, unknown>)[searchKey] === blockContent) return;
      // Stop scanning past status/user blocks — those mark turn boundaries
      if (prev.type === "status" || prev.type === "user") break;
    }
  }
  session.blocks.push(block);
  broadcast(session, { type: "block", block });
  scheduleBlockFlush(session);
}

// ── Shared process wiring ──
// Handles stdout parsing, stderr capture, close/error handlers.
function wireProcess(
  session: AgentRuntimeSession,
  proc: ChildProcess,
  opts: { startTime: number; projectId: string; taskId: string },
) {
  const { startTime, projectId, taskId } = opts;

  let stdoutBuffer = "";

  proc.stdout!.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(trimmed);
      } catch {
        continue;
      }

      processStreamEvent(session, event);
    }
  });

  let stderrOutput = "";
  proc.stderr!.on("data", (chunk: Buffer) => {
    stderrOutput += chunk.toString();
  });

  proc.on("close", async (code, signal) => {
    // Process any remaining buffered data
    if (stdoutBuffer.trim()) {
      try {
        const event = JSON.parse(stdoutBuffer.trim());
        processStreamEvent(session, event);
      } catch {
        // ignore
      }
    }

    if (session.status === "aborted") {
      await setTaskAgentBlocks(taskId, session.blocks);
      return;
    }

    // Check for queued follow-up messages — process them before finalizing
    if (session.pendingFollowUp && session.status === "running") {
      const pending = session.pendingFollowUp;
      session.pendingFollowUp = undefined;
      session.status = "done"; // Reset so continueSession doesn't re-queue
      session.queryHandle = null;
      try {
        const task = await getTask(projectId, taskId);
        const project = await getProject(projectId);
        const projectPath = project?.path.replace(/^~/, process.env.HOME || "~") || ".";
        const effectiveCwd = task?.worktreePath || projectPath;
        await continueSession(
          projectId,
          taskId,
          pending.text,
          effectiveCwd,
          undefined,
          pending.attachments,
          { planApproved: pending.planApproved, skipUserBlock: pending.userBlockAlreadyAppended },
        );
        return; // Don't finalize — the new session will handle that
      } catch (err) {
        console.error("[agent-session] Failed to process pending follow-up:", err);
        // Fall through to normal finalization
      }
    }

    // Check if this was an intentional SIGTERM kill (e.g. ExitPlanMode or AskUserQuestion)
    // When killed with SIGTERM, code is null and signal is "SIGTERM".
    // But if the process handles SIGTERM itself and exits, code is 143 (128+15)
    // with signal null — treat both cases the same.
    const intentionalKill =
      (code === null && signal === "SIGTERM") || code === 143;

    if (code !== 0 && !intentionalKill && session.status === "running") {
      session.status = "error";
      const errorMsg = stderrOutput.trim() || `CLI exited with code ${code}`;
      appendBlock(session, {
        type: "status",
        subtype: "error",
        error: errorMsg,
        durationMs: Date.now() - startTime,
      });
    } else if (session.status === "running" || session.status === "killing") {
      session.status = "done";
      appendBlock(session, {
        type: "status",
        subtype: "complete",
        durationMs: Date.now() - startTime,
      });
    }

    // Update context label / task title (safety net — the result event handler
    // also calls this, but it can be missed if the CLI exits before emitting
    // a result event, e.g. with --resume on short responses)
    generateContextLabel(session);

    // Check if the last tool_use was AskUserQuestion or ExitPlanMode — surface to human
    const lastToolUse = [...session.blocks]
      .reverse()
      .find((b) => b.type === "tool_use");
    const endedOnQuestion =
      lastToolUse?.type === "tool_use" &&
      lastToolUse.name === "AskUserQuestion";
    const endedOnPlanExit =
      lastToolUse?.type === "tool_use" && lastToolUse.name === "ExitPlanMode";
    let questionFields: { nextSteps?: string; summary?: string } = {};
    if (endedOnQuestion) {
      const input = lastToolUse.input as Record<string, unknown>;
      const questions = Array.isArray(input.questions)
        ? (input.questions as { question: string }[])
        : [];
      const questionText = questions.map((q) => q.question).join("\n");
      if (questionText) {
        questionFields = {
          nextSteps: questionText,
          summary: "Agent has a question — respond in chat window ←.",
        };
      }
    } else if (endedOnPlanExit) {
      questionFields = {
        nextSteps:
          "Agent has a plan ready for approval — review plan in chat window ←.",
        summary: "Agent created a plan and is waiting for approval.",
      };
    }

    // Check if task is still in-progress (agent didn't call update_task)
    const task = await getTask(projectId, taskId);
    const stillInProgress = task?.status === "in-progress";

    // Plan mode safety net: if a plan-mode task completed without calling
    // ExitPlanMode (agent just output the plan as text), synthesize an
    // ExitPlanMode block so the PlanApprovalBlock UI renders.
    if (task?.mode === "plan" && !endedOnPlanExit && !endedOnQuestion) {
      // Gather text blocks from the last turn as the plan content
      const textParts: string[] = [];
      for (let i = session.blocks.length - 1; i >= 0; i--) {
        const b = session.blocks[i];
        if (b.type === "text" && b.text) {
          textParts.unshift(b.text);
        } else if (b.type === "user" || (b.type === "status" && b.subtype === "init")) {
          break;
        }
      }
      if (textParts.length > 0) {
        appendBlock(session, {
          type: "tool_use",
          toolId: `synthetic-plan-${Date.now()}`,
          name: "ExitPlanMode",
          input: { _planContent: textParts.join("\n\n") },
        });
        questionFields = {
          nextSteps: "Agent has a plan ready for approval — review plan in chat window ←.",
          summary: "Agent created a plan and is waiting for approval.",
        };
      }
    }

    // Safety net: auto-commit any leftover uncommitted changes
    if (task && !endedOnQuestion && !endedOnPlanExit) {
      const effectivePath = task.worktreePath || await (async () => {
        const proj = await getProject(projectId);
        return proj?.path.replace(/^~/, process.env.HOME || "~");
      })();
      if (effectivePath) {
        autoCommitIfDirty(effectivePath, task.title);
      }
    }

    // Wait for any pending async plan file read before persisting blocks,
    // otherwise the ExitPlanMode block (with plan content) can be lost.
    if (session.pendingPlanRead) {
      await session.pendingPlanRead;
      session.pendingPlanRead = undefined;
    }

    // Persist agent blocks to separate file
    await setTaskAgentBlocks(taskId, session.blocks, session.sessionId);

    if (stillInProgress) {
      // Safety net: move to verify and clear agentStatus
      const closeUpdate: Record<string, unknown> = {
        status: "verify",
        agentStatus: null,
        ...questionFields,
        sessionId: session.sessionId,
      };
      if (session.status === "error") {
        closeUpdate.summary = `Error: ${stderrOutput.trim() || `CLI exited with code ${code}`}`;
      }
      await updateTask(projectId, taskId, closeUpdate as Parameters<typeof updateTask>[2]);
      notify(
        `✅ *${(task?.title || task?.description || "task").slice(0, 40).replace(/"/g, '\\"')}* → verify`,
      );
      emitTaskUpdate(projectId, taskId, {
        status: "verify",
        agentStatus: null,
      });
    } else {
      // Agent already handled status via update_task — just persist sessionId
      await updateTask(projectId, taskId, {
        sessionId: session.sessionId,
      });
    }
  });

  proc.on("error", async (err) => {
    session.status = "error";
    const errorMsg = err.message;
    appendBlock(session, {
      type: "status",
      subtype: "error",
      error: errorMsg,
      durationMs: Date.now() - startTime,
    });
    await setTaskAgentBlocks(taskId, session.blocks, session.sessionId);
    const task = await getTask(projectId, taskId);
    if (task?.status === "in-progress") {
      await updateTask(projectId, taskId, {
        status: "verify",
        agentStatus: null,
        summary: `Error: ${errorMsg}`,
      });
      emitTaskUpdate(projectId, taskId, {
        status: "verify",
        agentStatus: null,
      });
    }
  });
}

export async function startSession(
  projectId: string,
  taskId: string,
  prompt: string,
  cwd: string,
  options?: {
    model?: string;
    proqSystemPrompt?: string;
    mcpConfig?: string;
    permissionMode?: string;
  },
): Promise<void> {
  const session: AgentRuntimeSession = {
    taskId,
    projectId,
    queryHandle: null,
    blocks: [],
    clients: new Set(),
    status: "running",
    assistantBlocksProcessed: 0,
    contentToBlockIdx: new Map(),
    _lastAgentStatus: "running",
  };
  sessions.set(taskId, session);

  const settings = await getSettings();

  // Emit init status
  appendBlock(session, {
    type: "status",
    subtype: "init",
    model: settings.defaultModel || undefined,
  });

  // Show the original prompt in the chatlog
  appendBlock(session, { type: "user", text: prompt });

  const startTime = Date.now();

  // Build CLI args
  const args: string[] = [
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--verbose",
    "--max-turns",
    "200",
  ];

  // Use --dangerously-skip-permissions for non-plan tasks (the flag is more
  // reliable than --permission-mode bypassPermissions, which has race conditions
  // where permission resolution happens before all tools are registered).
  // Plan tasks use --permission-mode plan to restrict edits.
  if (options?.permissionMode === "plan") {
    args.push("--permission-mode", "plan");
  } else {
    args.push("--dangerously-skip-permissions");
  }

  if (settings.defaultModel) {
    args.push("--model", settings.defaultModel);
  }

  // Combine user's system prompt additions with proq system prompt
  const systemParts: string[] = [];
  if (settings.systemPromptAdditions)
    systemParts.push(settings.systemPromptAdditions);
  if (options?.proqSystemPrompt) systemParts.push(options.proqSystemPrompt);
  if (systemParts.length > 0) {
    args.push("--append-system-prompt", systemParts.join("\n\n"));
  }

  if (options?.mcpConfig) {
    args.push("--mcp-config", options.mcpConfig);
    session.mcpConfig = options.mcpConfig;
  }

  // Pre-allow tools to avoid race conditions where permission resolution
  // happens before tool registration completes. For plan mode, also allow
  // read-only tools that plan permission mode should permit.
  const allowedTools: string[] = [];
  if (options?.mcpConfig) {
    allowedTools.push("mcp__proq__*");
  }
  if (options?.permissionMode === "plan") {
    allowedTools.push("Read", "Glob", "Grep", "WebFetch", "WebSearch", "Agent");
  }
  if (allowedTools.length > 0) {
    args.push("--allowedTools", allowedTools.join(","));
  }

  // Spawn the CLI child process
  const claudeBin = await getClaudeBin();
  const proc = spawn(claudeBin, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CLAUDECODE: undefined, PORT: undefined, PROQ_API: `http://localhost:${process.env.PORT || 1337}` },
  });

  session.queryHandle = proc;

  wireProcess(session, proc, { startTime, projectId, taskId });
}

function processStreamEvent(
  session: AgentRuntimeSession,
  event: Record<string, unknown>,
) {
  // After ExitPlanMode or AskUserQuestion kills the process, ignore further events
  if (session.status === "killing") return;

  const type = event.type as string;

  if (type === "stream_event") {
    const inner = event.event as Record<string, unknown> | undefined;
    if (inner?.type === "content_block_delta") {
      const delta = inner.delta as Record<string, unknown> | undefined;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        broadcast(session, { type: "stream_delta", text: delta.text });
      }
    }
    return;
  }

  if (type === "system") {
    const subtype = event.subtype as string | undefined;
    if (subtype === "init") {
      session.sessionId = event.session_id as string | undefined;
      const model = event.model as string | undefined;
      if (model) {
        // Update the most recent init block's model
        const initBlocks = session.blocks.filter(
          (b) => b.type === "status" && b.subtype === "init",
        );
        const lastInit = initBlocks[initBlocks.length - 1];
        if (lastInit && lastInit.type === "status") {
          lastInit.model = model;
        }
      }
    }
  } else if (type === "assistant") {
    session.sessionId = event.session_id as string | undefined;
    // Agent started processing — mark as running (transitions from idle back to running)
    if (session._lastAgentStatus !== "running") {
      session._lastAgentStatus = "running";
      emitTaskUpdate(session.projectId, session.taskId, { agentStatus: "running" });
      updateTask(session.projectId, session.taskId, { agentStatus: "running" }).catch(() => {});
    }
    const message = event.message as { content?: unknown[] } | undefined;
    const content = message?.content;
    if (Array.isArray(content)) {
      // With --include-partial-messages, each assistant event includes ALL
      // content blocks seen so far for THE CURRENT message. After a tool
      // result, the CLI starts a NEW assistant message with content from
      // index 0. Detect this by checking if content.length dropped below
      // the counter, OR if block types at existing indices changed (which
      // catches the case where the new message has the same number of blocks).
      if (!session.contentToBlockIdx) session.contentToBlockIdx = new Map();
      const prev = session.assistantBlocksProcessed ?? 0;
      let isNewMessage = content.length < prev;
      if (!isNewMessage && prev > 0) {
        // Check for type mismatch at existing indices — indicates a new
        // assistant message even when content.length >= prev
        for (let ci = 0; ci < Math.min(prev, content.length); ci++) {
          const b = content[ci] as Record<string, unknown>;
          const blockIdx = session.contentToBlockIdx.get(ci);
          if (blockIdx === undefined) continue;
          const stored = session.blocks[blockIdx];
          if (stored && b.type !== stored.type) {
            isNewMessage = true;
            break;
          }
          // Also detect tool_use ID changes (same type but different tool)
          if (b.type === "tool_use" && stored?.type === "tool_use" &&
              b.id !== (stored as { toolId?: string }).toolId) {
            isNewMessage = true;
            break;
          }
        }
      }
      if (isNewMessage) {
        session.assistantBlocksProcessed = 0;
        session.contentToBlockIdx.clear();
      }
      const startIdx = session.assistantBlocksProcessed ?? 0;
      session.assistantBlocksProcessed = content.length;

      // Update existing text/thinking blocks if their content grew (partial messages).
      // This ensures replays show the final text, not the first partial fragment.
      for (let ci = 0; ci < Math.min(startIdx, content.length); ci++) {
        const b = content[ci] as Record<string, unknown>;
        const blockIdx = session.contentToBlockIdx.get(ci);
        if (blockIdx === undefined) continue;
        const stored = session.blocks[blockIdx];
        if (!stored) continue;
        if (b.type === "text" && stored.type === "text") {
          const newText = b.text as string;
          if (newText !== stored.text) {
            stored.text = newText;
            scheduleBlockFlush(session);
          }
        } else if (b.type === "thinking" && stored.type === "thinking") {
          const newThinking = b.thinking as string;
          if (newThinking !== stored.thinking) {
            stored.thinking = newThinking;
            scheduleBlockFlush(session);
          }
        }
      }

      for (let ci = startIdx; ci < content.length; ci++) {
        const b = content[ci] as Record<string, unknown>;
        if (b.type === "text") {
          session.contentToBlockIdx.set(ci, session.blocks.length);
          appendBlock(session, { type: "text", text: b.text as string });
        } else if (b.type === "thinking") {
          session.contentToBlockIdx.set(ci, session.blocks.length);
          appendBlock(session, {
            type: "thinking",
            thinking: b.thinking as string,
          });
        } else if (b.type === "tool_use") {
          const toolBlock: AgentBlock & { type: "tool_use" } = {
            type: "tool_use",
            toolId: b.id as string,
            name: b.name as string,
            input: b.input as Record<string, unknown>,
          };

          // Plan mode: when the agent calls ExitPlanMode, read the plan file
          // from disk and enrich the block, then kill the process.
          // The close handler will detect endedOnPlanExit and move to verify
          // for human approval. The human can then continue with full permissions.
          if (b.name === "ExitPlanMode") {
            // Mark session so no further stream events are processed
            session.status = "killing";
            // Kill immediately to prevent the agent from continuing past the plan
            if (session.queryHandle) {
              session.queryHandle.kill("SIGTERM");
            }
            // Find the plan file path by scanning backwards through blocks
            let planPath: string | undefined;
            for (let j = session.blocks.length - 1; j >= 0; j--) {
              const prev = session.blocks[j];
              if (prev.type === "tool_use" && (prev.name === "Write" || prev.name === "Edit")) {
                const fp = prev.input.file_path as string;
                if (fp && fp.endsWith(".md")) {
                  planPath = fp;
                  break;
                }
              }
            }
            // Read the plan file and enrich the block.
            // Store the promise so the close handler can await it before persisting.
            if (planPath) {
              session.pendingPlanRead = readFile(planPath, "utf-8").then((content) => {
                toolBlock.input._planContent = content;
                toolBlock.input._planFilePath = planPath;
                appendBlock(session, toolBlock);
              }).catch(() => {
                appendBlock(session, toolBlock);
              });
            } else {
              appendBlock(session, toolBlock);
            }
          } else {
            appendBlock(session, toolBlock);
          }
        }
      }
    }
  } else if (type === "user") {
    // Do NOT reset assistantBlocksProcessed here — tool_result events come
    // as "user" events mid-turn, but with --include-partial-messages the next
    // "assistant" event still includes ALL content blocks from the entire
    // message. Resetting the counter causes every pre-tool-use block to be
    // re-appended as a duplicate.  The counter is already reset when a new
    // CLI process starts (in continueSession / startSession).
    session.sessionId = event.session_id as string | undefined;
    const message = event.message as { content?: unknown[] } | undefined;
    const userContent = message?.content;
    if (Array.isArray(userContent)) {
      for (const block of userContent) {
        const b = block as Record<string, unknown>;
        if (b.type === "tool_result") {
          const output =
            typeof b.content === "string"
              ? b.content
              : Array.isArray(b.content)
                ? (b.content as { type: string; text: string }[])
                    .filter((c) => c.type === "text")
                    .map((c) => c.text)
                    .join("\n")
                : JSON.stringify(b.content);
          // Find the matching tool_use to get its name
          const matchingToolUse = session.blocks.find(
            (bl) => bl.type === "tool_use" && bl.toolId === b.tool_use_id,
          );
          appendBlock(session, {
            type: "tool_result",
            toolId: b.tool_use_id as string,
            name:
              matchingToolUse && matchingToolUse.type === "tool_use"
                ? matchingToolUse.name
                : "",
            output,
            isError: b.is_error as boolean | undefined,
          });
        }
      }
    }
  } else if (type === "result") {
    session.assistantBlocksProcessed = 0;
    if (session.contentToBlockIdx) session.contentToBlockIdx.clear();
    session.sessionId = event.session_id as string | undefined;
    // Agent finished its turn — mark as idle (process still alive, but not actively processing)
    if (session._lastAgentStatus !== "idle") {
      session._lastAgentStatus = "idle";
      emitTaskUpdate(session.projectId, session.taskId, { agentStatus: "idle" });
      updateTask(session.projectId, session.taskId, { agentStatus: "idle" }).catch(() => {});
    }
    const isError = event.is_error as boolean | undefined;
    const costUsd = event.total_cost_usd as number | undefined;
    const resultText = event.result as string | undefined;

    // With --include-partial-messages, the text response may be streamed
    // only via stream_delta events without ever appearing in an assistant
    // event's content blocks. The result event carries the final text in
    // its `result` field. If no text block was stored for this turn, create
    // one so the response persists across replays/reloads.
    if (resultText && !isError) {
      let hasTextInCurrentTurn = false;
      for (let i = session.blocks.length - 1; i >= 0; i--) {
        const b = session.blocks[i];
        if (b.type === "text") { hasTextInCurrentTurn = true; break; }
        if (b.type === "user" || (b.type === "status" && b.subtype === "init")) break;
      }
      if (!hasTextInCurrentTurn) {
        appendBlock(session, { type: "text", text: resultText });
      }
    }

    appendBlock(session, {
      type: "status",
      subtype: isError ? "error" : "complete",
      sessionId: event.session_id as string | undefined,
      costUsd,
      durationMs: event.duration_ms as number | undefined,
      turns: event.num_turns as number | undefined,
      error: isError ? resultText || "Agent error" : undefined,
    });

    // Broadcast a full replay so clients get the final text/thinking content.
    // With --include-partial-messages, text/thinking blocks are updated in place
    // on the server but those in-place updates are not broadcast individually.
    // The client relies on stream_delta for live display, but clears the buffer
    // on session completion — leaving stale partial content in the block.
    // A replay here ensures the client has the fully updated blocks.
    //
    // If there's a pending follow-up, don't broadcast done:true — the close
    // handler will start the next turn, and we don't want the client to briefly
    // show a "done" state that causes the streaming buffer to be cleared.
    const hasPending = !!session.pendingFollowUp;
    broadcast(session, { type: "replay", blocks: session.blocks, done: !hasPending, contextLabel: session.contextLabel });

    // Mark session done/error based on result — actual DB persistence happens in wireProcess close handler.
    // If there's a pending follow-up, keep status as "running" so the close
    // handler's pending follow-up check succeeds (it requires status === "running").
    if (isError) {
      session.status = "error";
    } else if (!hasPending) {
      session.status = "done";
    }

    // Generate/update context label (fire-and-forget, non-blocking)
    generateContextLabel(session);
  }
}

/**
 * Generate a short context label describing what Claude is working on.
 * Uses Haiku for speed/cost. Updates on each turn so the label stays current.
 * Also updates the task title in the DB so kanban cards reflect current focus.
 */
function generateContextLabel(session: AgentRuntimeSession) {
  // Gather context: user prompts and tool names (skip assistant text — it's too
  // verbose and causes Haiku to echo back reasoning instead of generating a title)
  const parts: string[] = [];
  for (let i = session.blocks.length - 1; i >= 0 && parts.length < 4; i--) {
    const b = session.blocks[i];
    if (b.type === "user") parts.unshift(`User: ${b.text.slice(0, 200)}`);
    else if (b.type === "tool_use") parts.unshift(`Tool: ${b.name}`);
  }
  const fs = require("fs");
  const logLine = (msg: string) => { try { fs.appendFileSync("/tmp/proq-context-label.log", `${new Date().toISOString()} ${msg}\n`); } catch {} };

  if (parts.length === 0) {
    logLine(`${session.taskId.slice(0, 8)} — no parts found, skipping`);
    console.log(`[context-label] ${session.taskId.slice(0, 8)} — no parts found, skipping`);
    return;
  }

  logLine(`${session.taskId.slice(0, 8)} — generating from ${parts.length} parts: ${JSON.stringify(parts)}`);
  console.log(`[context-label] ${session.taskId.slice(0, 8)} — generating from ${parts.length} parts:`, parts);

  const prompt = [
    "Based on this conversation, generate a very short title (3-8 words, title case) describing what is currently being worked on.",
    "Focus on the MOST RECENT direction — if the user changed course, reflect the new focus.",
    "Examples: Fix Login Page CSS, Add Dark Mode Toggle, Refactor API Routes, Debug Auth Flow",
    "Just output the title, nothing else. No quotes, no punctuation at the end.",
    "",
    parts.join("\n"),
  ].join("\n");

  claudeOneShot(prompt).then(async (raw) => {
    const title = raw.trim().split("\n")[0].replace(/^["']|["']$/g, "").replace(/\.+$/, "");
    logLine(`${session.taskId.slice(0, 8)} — haiku returned: "${title}"`);
    console.log(`[context-label] ${session.taskId.slice(0, 8)} — haiku returned: "${title}"`);
    if (!title) return;

    // kebab-case version for contextLabel (used near chat input)
    const label = title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
    if (label) {
      session.contextLabel = label;
      broadcast(session, { type: "context_label", label });
    }

    // Update task title in DB so kanban cards show current focus
    try {
      // Preserve original title on first update
      const task = await getTask(session.projectId, session.taskId);
      const updates: Record<string, string> = { title };
      if (task && !task.originalTitle && task.title) {
        updates.originalTitle = task.title;
      }
      await updateTask(session.projectId, session.taskId, updates);
      emitTaskUpdate(session.projectId, session.taskId, updates);
      logLine(`${session.taskId.slice(0, 8)} — title updated to: "${title}"`);
      console.log(`[context-label] ${session.taskId.slice(0, 8)} — title updated to: "${title}"`);
    } catch (err) {
      logLine(`${session.taskId.slice(0, 8)} — DB update failed: ${err}`);
      console.error(`[context-label] ${session.taskId.slice(0, 8)} — DB update failed:`, err);
    }
  }).catch((err) => {
    logLine(`${session.taskId.slice(0, 8)} — claudeOneShot failed: ${err}`);
    console.error(`[context-label] ${session.taskId.slice(0, 8)} — claudeOneShot failed:`, err);
  });
}

export async function continueSession(
  projectId: string,
  taskId: string,
  text: string,
  cwd: string,
  preAttachClient?: WebSocket,
  attachments?: TaskAttachment[],
  options?: { planApproved?: boolean; skipUserBlock?: boolean },
): Promise<void> {
  let session = sessions.get(taskId);
  let taskMode: string | undefined;
  let canResume = true;

  // If no in-memory session, reconstruct from DB.
  // The session was cleared (e.g. task moved to done), so the Claude CLI
  // session is likely dead.  We'll start fresh with context instead of
  // trying --resume on a stale session ID.
  if (!session) {
    const task = await getTask(projectId, taskId);
    taskMode = task?.mode;
    canResume = false;
    const stored = readAgentBlocksFile(taskId);
    session = {
      taskId,
      projectId,
      sessionId: stored.sessionId || task?.sessionId,
      queryHandle: null,
      blocks: stored.blocks,
      clients: new Set(),
      status: "done",
      assistantBlocksProcessed: 0,
      contentToBlockIdx: new Map(),
      _lastAgentStatus: "running",
    };
    sessions.set(taskId, session);
  } else {
    // Fetch task mode for system prompt
    const task = await getTask(projectId, taskId);
    taskMode = task?.mode;
  }

  // Attach client before appending any blocks so it receives the user message
  if (preAttachClient && !session.clients.has(preAttachClient)) {
    session.clients.add(preAttachClient);
  }

  if (session.status === "running") {
    // Queue the follow-up — it will be sent after the current turn finishes
    session.pendingFollowUp = {
      text,
      attachments: attachments?.length ? attachments : undefined,
      planApproved: options?.planApproved,
      userBlockAlreadyAppended: true,
    };
    // Append user block immediately so the user sees their message in the stream
    appendBlock(session, {
      type: "user",
      text,
      attachments: attachments?.length ? attachments : undefined,
    });
    return;
  }

  // Append user block so it renders immediately (skip if already appended by pending queue)
  if (!options?.skipUserBlock) {
    appendBlock(session, {
      type: "user",
      text,
      attachments: attachments?.length ? attachments : undefined,
    });
  }

  const settings = await getSettings();
  session.status = "running";
  session._lastAgentStatus = "running";
  // Reset the partial-message dedup counter and content mapping — the new
  // CLI process starts fresh, so its first assistant event has content from index 0.
  session.assistantBlocksProcessed = 0;
  if (session.contentToBlockIdx) session.contentToBlockIdx.clear();

  const startTime = Date.now();

  // Append file attachment paths to prompt
  let promptText = text;
  if (attachments?.length) {
    const imageFiles = attachments
      .filter((a) => a.filePath && a.type.startsWith("image/"))
      .map((a) => a.filePath!);
    const otherFiles = attachments
      .filter((a) => a.filePath && !a.type.startsWith("image/"))
      .map((a) => a.filePath!);
    if (imageFiles.length > 0) {
      promptText += `\n\nAttached images:\n${imageFiles.map((f) => `- ${f}`).join("\n")}\n`;
    }
    if (otherFiles.length > 0) {
      promptText += `\n\nAttached files:\n${otherFiles.map((f) => `- ${f}`).join("\n")}\n`;
    }
  }

  // Build CLI args — use --resume only if we have a live in-memory session.
  // Reconstructed sessions (from DB after clearSession) likely have a dead
  // Claude CLI session, so we start fresh with task context instead.
  const args: string[] = [];

  if (canResume && session.sessionId) {
    args.push("--resume", session.sessionId);
  }

  args.push(
    "-p",
    promptText,
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--verbose",
    "--max-turns",
    "200",
  );

  // Plan tasks stay in plan mode unless the human explicitly approved.
  // Only switch to full permissions on plan approval.
  const keepPlanMode = taskMode === "plan" && !options?.planApproved;
  if (keepPlanMode) {
    args.push("--permission-mode", "plan");
  } else {
    args.push("--dangerously-skip-permissions");
  }

  if (settings.defaultModel) {
    args.push("--model", settings.defaultModel);
  }

  // Combine user's system prompt additions with proq system prompt
  const systemParts: string[] = [];
  if (settings.systemPromptAdditions)
    systemParts.push(settings.systemPromptAdditions);
  const project = await getProject(projectId);
  const proqSysPrompt = buildProqSystemPrompt(
    projectId,
    taskId,
    taskMode as TaskMode | undefined,
    project?.name,
  );
  systemParts.push(proqSysPrompt);

  // When starting fresh (no --resume), inject previous work context so the
  // agent knows what was done before.
  if (!canResume || !session.sessionId) {
    const task = await getTask(projectId, taskId);
    const contextParts: string[] = [];
    if (task?.title) contextParts.push(`Task: ${task.title}`);
    if (task?.description)
      contextParts.push(`Description: ${task.description}`);
    if (task?.summary)
      contextParts.push(`Previous summary:\n${task.summary}`);
    if (task?.nextSteps)
      contextParts.push(`Previous next steps:\n${task.nextSteps}`);
    if (contextParts.length > 0) {
      systemParts.push(
        `## Previous work on this task\nThis task was previously worked on by an agent. Here is the context from that work:\n\n${contextParts.join("\n\n")}`,
      );
    }
  }

  if (systemParts.length > 0) {
    args.push("--append-system-prompt", systemParts.join("\n\n"));
  }

  // Ensure MCP config is available (may need to recreate after server restart)
  if (!session.mcpConfig) {
    session.mcpConfig = writeMcpConfig(projectId, taskId);
  }
  args.push("--mcp-config", session.mcpConfig);

  // Pre-allow tools to avoid race conditions with permission resolution.
  const allowedTools: string[] = [];
  if (session.mcpConfig) {
    allowedTools.push("mcp__proq__*");
  }
  if (keepPlanMode) {
    allowedTools.push("Read", "Glob", "Grep", "WebFetch", "WebSearch", "Agent");
  }
  if (allowedTools.length > 0) {
    args.push("--allowedTools", allowedTools.join(","));
  }

  // Emit init block for the new session turn
  if (!canResume || !session.sessionId) {
    appendBlock(session, {
      type: "status",
      subtype: "init",
      model: settings.defaultModel || undefined,
    });
  }

  const claudeBin = await getClaudeBin();
  const proc = spawn(claudeBin, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CLAUDECODE: undefined, PORT: undefined, PROQ_API: `http://localhost:${process.env.PORT || 1337}` },
  });

  session.queryHandle = proc;

  wireProcess(session, proc, { startTime, projectId, taskId });
}

export function stopSession(taskId: string): void {
  const session = sessions.get(taskId);
  if (session && session.status === "running" && session.queryHandle) {
    session.status = "aborted";
    appendBlock(session, {
      type: "status",
      subtype: "abort",
      error: "Session aborted",
    });
    session.queryHandle.kill("SIGTERM");
  }
}

export function getSession(taskId: string): AgentRuntimeSession | null {
  return sessions.get(taskId) ?? null;
}

export function attachClient(taskId: string, ws: WebSocket): void {
  const session = sessions.get(taskId);
  if (session) {
    session.clients.add(ws);
  }
}

export function detachClient(taskId: string, ws: WebSocket): void {
  const session = sessions.get(taskId);
  if (session) {
    session.clients.delete(ws);
  }
}

export function clearSession(taskId: string): void {
  const session = sessions.get(taskId);
  if (session) {
    session.clients.clear();
    sessions.delete(taskId);
  }
}

export function isSessionRunning(taskId: string): boolean {
  const session = sessions.get(taskId);
  return session?.status === "running";
}
