// ── Project ──────────────────────────────────────────────
export type ProjectStatus = 'active' | 'review' | 'idle' | 'error';

export type ProjectTab = 'project' | 'list' | 'timeline' | 'live' | 'code';

export interface Project {
  id: string;
  name: string;
  path: string;
  status?: ProjectStatus;
  serverUrl?: string;
  order?: number;
  pathValid?: boolean;
  activeTab?: ProjectTab;
  liveViewport?: 'desktop' | 'tablet' | 'mobile';
  createdAt: string;
}

export interface WorkspaceData {
  projects: Project[];
}

// ── Task ─────────────────────────────────────────────────
export type TaskStatus = "todo" | "in-progress" | "verify" | "done";

export interface TaskAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
}

export type TaskMode = 'code' | 'plan' | 'answer' | 'auto';
export type TaskOutputMode = 'pretty' | 'raw';

export interface Task {
  id: string;
  title?: string;
  description: string;
  status: TaskStatus;
  priority?: 'low' | 'medium' | 'high';
  mode?: TaskMode;
  order?: number; // deprecated — kept for migration only
  findings?: string;
  humanSteps?: string;
  agentLog?: string;
  dispatch?: "queued" | "starting" | "running" | null;
  worktreePath?: string;
  branch?: string;
  mergeConflict?: {
    error: string;
    files: string[];
    branch: string;
  };
  attachments?: TaskAttachment[];
  outputMode?: TaskOutputMode;
  events?: TaskEvent[];
  createdAt: string;
  updatedAt: string;
}

export type TaskEventType =
  | 'created'
  | 'status_changed'
  | 'dispatched'
  | 'dispatch_cleared'
  | 'edited'
  | 'merged';

export interface TaskEvent {
  type: TaskEventType;
  timestamp: string;
  from?: string;
  to?: string;
  detail?: string;
}

export type TaskColumns = Record<TaskStatus, Task[]>;

// ── Chat ─────────────────────────────────────────────────
export interface ToolCall {
  action: string;
  detail: string;
}

export interface ChatLogEntry {
  role: "proq" | "user";
  message: string;
  timestamp: string;
  toolCalls?: ToolCall[];
}

// ── Agent session ────────────────────────────────────────
export interface AgentSession {
  sessionKey: string;
  status: string;
}

// ── Deleted task entry (for undo) ────────────────────────
export interface DeletedTaskEntry {
  task: Task;
  column: TaskStatus;
  index: number;
  deletedAt: string; // ISO timestamp
}

// ── Settings ─────────────────────────────────────────
export interface ProqSettings {
  // System
  port: number;

  // Agent
  claudeBin: string;
  defaultModel: string;
  systemPromptAdditions: string;
  executionMode: 'sequential' | 'parallel';

  // Git
  autoCommit: boolean;
  commitStyle: string;
  autoPush: boolean;
  showGitBranches: boolean;

  // Appearance
  theme: 'dark' | 'light';

  // Notifications
  notificationMethod: 'none' | 'slack' | 'system' | 'sound';
  openclawBin: string;
  slackChannel: string;
  webhooks: string;

  // Process
  cleanupDelay: number;
  taskPollInterval: number;
  deletedTaskRetention: number;
  terminalScrollback: number;
}

// ── Per-project state ────────────────────────────────────
export type ExecutionMode = 'sequential' | 'parallel';

export interface TerminalTabInfo {
  id: string;
  label: string;
  type?: 'shell' | 'supervisor';
}

export interface ProjectState {
  columns: TaskColumns;
  chatLog: ChatLogEntry[];
  agentSession?: AgentSession;
  executionMode?: ExecutionMode;
  terminalOpen?: boolean;
  terminalHeight?: number;
  terminalTabs?: TerminalTabInfo[];
  terminalActiveTabId?: string;
  recentlyDeleted?: DeletedTaskEntry[];
  supervisorChatLog?: ChatLogEntry[];
  supervisorDraft?: string;
  // Legacy field — present only in unmigrated files
  tasks?: Task[];
}

// ── Timeline ──────────────────────────────────────────
export interface TimelineBullet {
  text: string;
  authors: string[];
  commits: number;
}

export interface TimelineWeek {
  weekStart: string;     // ISO date of Monday (YYYY-MM-DD)
  weekEnd: string;       // ISO date of Sunday
  commitCount: number;
  authors: string[];
  bullets: TimelineBullet[];
  types: string[];       // 'feature' | 'fix' | 'infra' | 'chore' etc.
  hasMilestone: boolean;
}

export interface TimelineData {
  weeks: TimelineWeek[];
  generatedAt: string;
}
