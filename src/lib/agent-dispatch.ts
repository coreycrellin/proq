import { execSync } from "child_process";

const OPENCLAW = "/opt/homebrew/bin/openclaw";

export function dispatchTask(
  projectId: string,
  taskId: string,
  taskTitle: string,
  taskDescription: string
) {
  const message = `mission-control:dispatch:${projectId}:${taskId} — ${taskTitle}\n${taskDescription}`;
  try {
    execSync(`${OPENCLAW} system event --text "${message.replace(/"/g, '\\"')}" --mode now`, {
      timeout: 10_000,
    });
    console.log(`[agent-dispatch] dispatched ${taskId}`);
  } catch (err) {
    console.error(`[agent-dispatch] failed to dispatch ${taskId}:`, err);
  }
}

export function abortTask(projectId: string, taskId: string) {
  const message = `mission-control:abort:${projectId}:${taskId}`;
  try {
    execSync(`${OPENCLAW} system event --text "${message}" --mode now`, {
      timeout: 10_000,
    });
    console.log(`[agent-dispatch] aborted ${taskId}`);
  } catch (err) {
    console.error(`[agent-dispatch] failed to abort ${taskId}:`, err);
  }
}
