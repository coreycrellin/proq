import type WebSocket from "ws";
import { getSession, attachClient, detachClient, stopSession, continueSession } from "./agent-session";
import { getTask, getProject, updateTask, getTaskAgentBlocks } from "./db";
import { emitTaskUpdate } from "./task-events";
import type { AgentWsClientMsg } from "./types";

/**
 * Poll DB for new blocks when no in-memory session exists but the task
 * is still running (e.g. after HMR lost the session reference).
 * Blocks are persisted incrementally by scheduleBlockFlush, so we can
 * pick up new ones by comparing lengths.
 *
 * @param initialBlockCount — number of blocks already sent to this client
 *   via the initial replay. Prevents re-sending those blocks as individual
 *   messages on the first poll iteration.
 */
function startDbPolling(
  taskId: string,
  projectId: string,
  ws: WebSocket,
  initialBlockCount: number,
): () => void {
  let lastBlockCount = initialBlockCount;
  const interval = setInterval(async () => {
    // Stop polling if in-memory session reappears (e.g. after continueSession)
    const liveSession = getSession(taskId);
    if (liveSession) {
      ws.send(JSON.stringify({ type: "replay", blocks: liveSession.blocks }));
      attachClient(taskId, ws);
      clearInterval(interval);
      return;
    }

    try {
      const task = await getTask(projectId, taskId);
      if (!task) { clearInterval(interval); return; }

      const blocks = task.agentBlocks || [];
      if (blocks.length > lastBlockCount) {
        // Send new blocks individually so the client appends them
        for (let i = lastBlockCount; i < blocks.length; i++) {
          ws.send(JSON.stringify({ type: "block", block: blocks[i] }));
        }
        lastBlockCount = blocks.length;
      }

      // Stop polling when task is no longer running
      if (task.agentStatus !== "running" && task.agentStatus !== "starting" && task.agentStatus !== "idle") {
        clearInterval(interval);
      }
    } catch {
      // DB read failed — try again next interval
    }
  }, 3000);

  return () => clearInterval(interval);
}

export async function attachAgentWsWithProject(
  taskId: string,
  projectId: string,
  ws: WebSocket,
): Promise<void> {
  const session = getSession(taskId);
  let stopPolling: (() => void) | null = null;

  if (session) {
    const done = session.status === "done" || session.status === "error" || session.status === "aborted";
    const replay = JSON.stringify({ type: "replay", blocks: session.blocks, contextLabel: session.contextLabel, done });
    ws.send(replay);
    attachClient(taskId, ws);
  } else {
    // Load from separate agent-blocks file, fall back to task DB
    const blocks = await getTaskAgentBlocks(taskId);
    const task = await getTask(projectId, taskId);
    const isActive = task?.agentStatus === "running" || task?.agentStatus === "starting" || task?.agentStatus === "idle";

    if (blocks.length > 0) {
      ws.send(JSON.stringify({ type: "replay", blocks, done: !isActive }));
      // If still running, poll for incremental updates — skip blocks already in the replay
      if (isActive) {
        stopPolling = startDbPolling(taskId, projectId, ws, blocks.length);
      }
    } else if (task?.agentBlocks && task.agentBlocks.length > 0) {
      // Legacy: blocks stored inline on task object
      ws.send(JSON.stringify({ type: "replay", blocks: task.agentBlocks, done: !isActive }));
      if (isActive) {
        stopPolling = startDbPolling(taskId, projectId, ws, task.agentBlocks.length);
      }
    } else if (isActive) {
      // Session not in memory yet but task is supposed to be running — poll for blocks
      ws.send(JSON.stringify({ type: "replay", blocks: [], done: false }));
      stopPolling = startDbPolling(taskId, projectId, ws, 0);
    } else {
      ws.send(JSON.stringify({ type: "error", error: "No session found" }));
    }
  }

  ws.on("message", async (raw) => {
    try {
      const msg: AgentWsClientMsg = JSON.parse(raw.toString());
      if (msg.type === "stop") {
        stopSession(taskId);
      } else if (msg.type === "followup" || msg.type === "plan-approve") {
        try {
          const task = await getTask(projectId, taskId);
          const project = await getProject(projectId);
          const projectPath = project?.path.replace(/^~/, process.env.HOME || "~") || ".";
          const cwd = task?.worktreePath || projectPath;
          const planApproved = msg.type === "plan-approve";

          // Move task back to in-progress so the card shows "Agent working"
          if (task && task.status !== "in-progress") {
            await updateTask(projectId, taskId, { status: "in-progress", agentStatus: "running" });
            emitTaskUpdate(projectId, taskId, { status: "in-progress", agentStatus: "running" });
          } else if (task && task.agentStatus !== "running") {
            await updateTask(projectId, taskId, { agentStatus: "running" });
            emitTaskUpdate(projectId, taskId, { agentStatus: "running" });
          }

          await continueSession(projectId, taskId, msg.text, cwd, ws, msg.type === "followup" ? msg.attachments : undefined, { planApproved });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          ws.send(JSON.stringify({ type: "error", error: errorMsg }));
        }
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on("close", () => {
    if (stopPolling) stopPolling();
    detachClient(taskId, ws);
  });
}
