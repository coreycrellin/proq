import { execSync } from "child_process";
import { getAllProjects } from "./db";

const OPENCLAW = "/opt/homebrew/bin/openclaw";
const MC_API = "http://localhost:3000";
const CLAUDE = "claude";

export async function dispatchTask(
  projectId: string,
  taskId: string,
  taskTitle: string,
  taskDescription: string
) {
  // Look up project path
  const projects = await getAllProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) {
    console.error(`[agent-dispatch] project not found: ${projectId}`);
    return;
  }

  // Resolve ~ in path
  const projectPath = project.path.replace(/^~/, process.env.HOME || "~");
  const shortId = taskId.slice(0, 8);
  const sessionName = `mc-${shortId}`;

  // Build the callback curl that the agent runs when done
  const callbackCurl = `curl -s -X PATCH ${MC_API}/api/projects/${projectId}/tasks/${taskId} -H 'Content-Type: application/json' -d '{"status":"verify","locked":false}'`;

  // Build the agent prompt
  const prompt = `${taskDescription}

When completely finished:
1. git add -A && git commit -m "<descriptive message>"
2. Run this to update the task board: ${callbackCurl}`;

  // Escape for shell
  const escapedPrompt = prompt.replace(/'/g, "'\\''");

  // Launch Claude Code in tmux
  const tmuxCmd = `tmux new-session -d -s ${sessionName} -c '${projectPath}' ${CLAUDE} --dangerously-skip-permissions '${escapedPrompt}'`;

  try {
    execSync(tmuxCmd, { timeout: 10_000 });
    console.log(`[agent-dispatch] launched tmux session ${sessionName} for task ${taskId}`);

    // Notify Slack that task was dispatched
    try {
      execSync(
        `${OPENCLAW} message send --channel slack --target C0AEY4GBCGM --message "🚀 *${taskTitle.replace(/"/g, '\\"')}* dispatched → \`tmux attach -t ${sessionName}\`"`,
        { timeout: 10_000 }
      );
    } catch (e) {
      console.error(`[agent-dispatch] slack notify failed:`, e);
    }
  } catch (err) {
    console.error(`[agent-dispatch] failed to launch tmux for ${taskId}:`, err);
  }
}

export function abortTask(projectId: string, taskId: string) {
  const shortId = taskId.slice(0, 8);
  const sessionName = `mc-${shortId}`;
  try {
    execSync(`tmux kill-session -t ${sessionName} 2>/dev/null || true`, {
      timeout: 5_000,
    });
    console.log(`[agent-dispatch] killed tmux session ${sessionName}`);
  } catch (err) {
    console.error(`[agent-dispatch] failed to kill tmux ${sessionName}:`, err);
  }
}
