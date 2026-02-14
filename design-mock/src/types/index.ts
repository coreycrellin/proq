export type ProjectStatus = 'active' | 'review' | 'idle' | 'error';

export type TaskStatus = 'todo' | 'in-progress' | 'verify' | 'done';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high';
  steps?: string[]; // Action items for "Steps for you"
  findings?: string[]; // Bullet points for "Findings"
}

export interface Message {
  id: string;
  role: 'twin' | 'brian';
  content: string;
  timestamp: string;
  logEntries?: string[]; // Short work log lines for AI messages
}

export interface Project {
  id: string;
  name: string;
  path: string; // e.g., ~/dev/mission-control
  status: ProjectStatus;
  tasks: Task[];
  messages: Message[];
  liveUrl?: string;
}

export type TabOption = 'project' | 'live' | 'code';