'use client';

import React, { useState, useMemo } from 'react';
import {
  Loader2Icon,
  ClockIcon,
  CheckCircle2Icon,
  SearchCheckIcon,
  RadioTowerIcon,
  MaximizeIcon,
  MinimizeIcon,
} from 'lucide-react';
import type { Task, TaskColumns, ExecutionMode, FollowUpDraft } from '@/lib/types';
import { StructuredPane } from './StructuredPane';

interface StreamsViewProps {
  tasks: TaskColumns;
  projectId: string;
  onClickTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  executionMode?: ExecutionMode;
  onExecutionModeChange?: (mode: ExecutionMode) => void;
  cleanupTimes?: Record<string, number>;
  followUpDraftsRef?: React.MutableRefObject<Map<string, FollowUpDraft>>;
  onFollowUpDraftChange?: (taskId: string, draft: FollowUpDraft | null) => void;
  onComplete?: (taskId: string) => void;
  onResumeEditing?: (taskId: string) => void;
  onUpdateTitle?: (taskId: string, title: string) => void;
  parallelMode?: boolean;
  currentBranch?: string;
  onSwitchBranch?: (branch: string) => void;
  defaultBranch?: string;
}

function getStreamTasks(columns: TaskColumns): Task[] {
  const allTasks = [
    ...columns['in-progress'],
    ...columns['verify'],
  ];

  return allTasks
    .sort((a, b) => {
      const score = (t: Task) =>
        t.agentStatus === 'running' ? 0
        : t.agentStatus === 'starting' ? 1
        : t.agentStatus === 'queued' ? 2
        : 3;
      return score(a) - score(b);
    })
    .slice(0, 6);
}

function getGridStyle(count: number): React.CSSProperties {
  if (count <= 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
  if (count === 2) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' };
  if (count === 3) return { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr' };
  if (count === 4) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
  return { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr' };
}

function statusBorderColor(task: Task): string {
  if (task.agentStatus === 'running') return 'border-l-blue-500';
  if (task.agentStatus === 'starting') return 'border-l-amber-500';
  if (task.agentStatus === 'queued') return 'border-l-amber-500/60';
  if (task.status === 'verify') return 'border-l-lazuli';
  if (task.status === 'done') return 'border-l-emerald';
  return 'border-l-zinc-600';
}

function statusIcon(task: Task): React.ReactNode {
  if (task.agentStatus === 'running' || task.agentStatus === 'starting') {
    return <Loader2Icon className="w-3 h-3 text-blue-400 animate-spin" />;
  }
  if (task.agentStatus === 'queued') {
    return <ClockIcon className="w-3 h-3 text-amber-400" />;
  }
  if (task.status === 'verify') {
    return <SearchCheckIcon className="w-3 h-3 text-lazuli" />;
  }
  if (task.status === 'done') {
    return <CheckCircle2Icon className="w-3 h-3 text-emerald" />;
  }
  return null;
}

export function StreamsView({
  tasks,
  projectId,
  onComplete,
  onResumeEditing,
  followUpDraftsRef,
  onFollowUpDraftChange,
}: StreamsViewProps) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const streamTasks = useMemo(() => getStreamTasks(tasks), [tasks]);

  if (streamTasks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-tertiary gap-3">
        <RadioTowerIcon className="w-8 h-8 opacity-30" />
        <p className="text-sm">No active streams</p>
        <p className="text-xs opacity-60">Start a task to see agent output here</p>
      </div>
    );
  }

  // Single expanded cell
  if (expandedTaskId) {
    const task = streamTasks.find((t) => t.id === expandedTaskId);
    if (!task) {
      setExpandedTaskId(null);
      return null;
    }
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        <StreamCellFull
          task={task}
          projectId={projectId}
          onCollapse={() => setExpandedTaskId(null)}
          onComplete={onComplete}
          onResumeEditing={onResumeEditing}
          followUpDraft={followUpDraftsRef?.current.get(task.id)}
          onFollowUpDraftChange={(draft) => onFollowUpDraftChange?.(task.id, draft)}
        />
      </div>
    );
  }

  // Grid: all streams visible at once, each with its own StructuredPane
  return (
    <div
      className="h-full grid gap-px bg-border-default overflow-hidden"
      style={getGridStyle(streamTasks.length)}
    >
      {streamTasks.map((task) => (
        <StreamCellFull
          key={task.id}
          task={task}
          projectId={projectId}
          compact
          onExpand={() => setExpandedTaskId(task.id)}
          onComplete={onComplete}
          onResumeEditing={onResumeEditing}
          followUpDraft={followUpDraftsRef?.current.get(task.id)}
          onFollowUpDraftChange={(draft) => onFollowUpDraftChange?.(task.id, draft)}
        />
      ))}
    </div>
  );
}

// ── Stream Cell with full StructuredPane ──────────────────

interface StreamCellFullProps {
  task: Task;
  projectId: string;
  compact?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
  onComplete?: (taskId: string) => void;
  onResumeEditing?: (taskId: string) => void;
  followUpDraft?: FollowUpDraft;
  onFollowUpDraftChange?: (draft: FollowUpDraft | null) => void;
}

function StreamCellFull({
  task,
  projectId,
  compact,
  onExpand,
  onCollapse,
  onComplete,
  onResumeEditing,
  followUpDraft,
  onFollowUpDraftChange,
}: StreamCellFullProps) {
  const isLive = task.agentStatus === 'running' || task.agentStatus === 'starting';
  const staticBlocks =
    !isLive && (task.status === 'verify' || task.status === 'done') && task.agentBlocks
      ? task.agentBlocks
      : undefined;

  return (
    <div className={`flex flex-col min-h-0 bg-surface-deep border-l-[3px] ${statusBorderColor(task)}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-default bg-surface-primary/60 shrink-0">
        {statusIcon(task)}
        <span className="text-xs font-medium text-text-secondary truncate flex-1">
          {task.title || task.description?.slice(0, 50) || 'Untitled'}
        </span>
        {task.status === 'verify' && onComplete && (
          <button
            onClick={() => onComplete(task.id)}
            className="text-[10px] px-2 py-0.5 rounded border border-emerald/40 text-emerald hover:bg-emerald/10"
          >
            Complete
          </button>
        )}
        {onExpand && (
          <button
            onClick={onExpand}
            className="p-1 rounded text-text-placeholder hover:text-text-chrome hover:bg-surface-hover"
            title="Expand"
          >
            <MaximizeIcon className="w-3 h-3" />
          </button>
        )}
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="p-1 rounded text-text-placeholder hover:text-text-chrome hover:bg-surface-hover"
            title="Back to grid"
          >
            <MinimizeIcon className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Full StructuredPane — scrollable stream + input area */}
      <StructuredPane
        taskId={task.id}
        projectId={projectId}
        visible={true}
        taskStatus={task.status}
        agentBlocks={staticBlocks}
        followUpDraft={followUpDraft}
        onFollowUpDraftChange={onFollowUpDraftChange ?? undefined}
        onTaskStatusChange={(status) => {
          if (status === 'verify' && onResumeEditing) onResumeEditing(task.id);
        }}
        compact={compact}
      />
    </div>
  );
}
