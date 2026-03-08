'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Loader2Icon,
  ClockIcon,
  CheckCircle2Icon,
  SearchCheckIcon,
  ArrowLeftIcon,
  RadioTowerIcon,
  ArrowDownIcon,
} from 'lucide-react';
import type { Task, TaskColumns, ExecutionMode, AgentBlock, FollowUpDraft } from '@/lib/types';
import { useAgentSession } from '@/hooks/useAgentSession';
import { StructuredPane } from './StructuredPane';
import { TextBlock } from './blocks/TextBlock';
import { ThinkingBlock } from './blocks/ThinkingBlock';
import { ToolBlock } from './blocks/ToolBlock';
import { ToolGroupBlock } from './blocks/ToolGroupBlock';
import type { ToolGroupItem } from './blocks/ToolGroupBlock';
import { StatusBlock } from './blocks/StatusBlock';
import { TaskUpdateBlock } from './blocks/TaskUpdateBlock';
import { UserBlock } from './blocks/UserBlock';
import { ScrambleText } from './ScrambleText';

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
    ...columns['done'],
  ];

  return allTasks
    .sort((a, b) => {
      const score = (t: Task) =>
        t.agentStatus === 'running' ? 0
        : t.agentStatus === 'starting' ? 1
        : t.agentStatus === 'queued' ? 2
        : t.status === 'verify' ? 3
        : 4;
      return score(a) - score(b);
    })
    .slice(0, 6);
}

function getGridClass(count: number): string {
  if (count <= 1) return 'grid-cols-1 grid-rows-1';
  if (count === 2) return 'grid-cols-2 grid-rows-1';
  if (count === 3) return 'grid-cols-3 grid-rows-1';
  if (count === 4) return 'grid-cols-2 grid-rows-2';
  return 'grid-cols-3 grid-rows-2';
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
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const streamTasks = useMemo(() => getStreamTasks(tasks), [tasks]);

  // Escape to unfocus
  useEffect(() => {
    if (!focusedTaskId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusedTaskId(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusedTaskId]);

  const focusedTask = focusedTaskId
    ? streamTasks.find((t) => t.id === focusedTaskId) ?? null
    : null;

  if (streamTasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-tertiary gap-3">
        <RadioTowerIcon className="w-8 h-8 opacity-30" />
        <p className="text-sm">No active streams</p>
        <p className="text-xs opacity-60">Start a task to see agent output here</p>
      </div>
    );
  }

  // Focused view: sidebar + expanded pane
  if (focusedTask) {
    return (
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar: thin strip of other tasks */}
        <div className="w-48 flex-shrink-0 border-r border-border-default bg-surface-primary overflow-y-auto">
          <button
            onClick={() => setFocusedTaskId(null)}
            className="flex items-center gap-1.5 w-full px-3 py-2.5 text-xs text-text-chrome hover:text-text-chrome-hover hover:bg-surface-hover border-b border-border-default"
          >
            <ArrowLeftIcon className="w-3 h-3" />
            All streams
          </button>
          {streamTasks.map((task) => (
            <button
              key={task.id}
              onClick={() => setFocusedTaskId(task.id)}
              className={`flex items-center gap-2 w-full px-3 py-2.5 text-left border-b border-border-default hover:bg-surface-hover ${
                task.id === focusedTaskId ? 'bg-surface-hover' : ''
              }`}
            >
              {statusIcon(task)}
              <span className="text-xs text-text-secondary truncate flex-1">
                {task.title || task.description?.slice(0, 40) || 'Untitled'}
              </span>
            </button>
          ))}
        </div>

        {/* Expanded pane: full StructuredPane */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border-default bg-surface-primary">
            {statusIcon(focusedTask)}
            <span className="text-sm font-medium text-text-primary truncate">
              {focusedTask.title || focusedTask.description?.slice(0, 60) || 'Untitled'}
            </span>
            {focusedTask.status === 'verify' && onComplete && (
              <button
                onClick={() => onComplete(focusedTask.id)}
                className="ml-auto text-xs px-2.5 py-1 rounded-md border border-emerald/40 text-emerald hover:bg-emerald/10"
              >
                Complete
              </button>
            )}
            {focusedTask.status === 'done' && onResumeEditing && (
              <button
                onClick={() => onResumeEditing(focusedTask.id)}
                className="ml-auto text-xs px-2.5 py-1 rounded-md border border-border-default text-text-secondary hover:bg-surface-hover"
              >
                Resume editing
              </button>
            )}
          </div>
          <StructuredPane
            taskId={focusedTask.id}
            projectId={projectId}
            visible={true}
            taskStatus={focusedTask.status}
            agentBlocks={
              (focusedTask.status === 'done' || focusedTask.status === 'verify') && !focusedTask.agentStatus
                ? focusedTask.agentBlocks
                : undefined
            }
            followUpDraft={followUpDraftsRef?.current.get(focusedTask.id)}
            onFollowUpDraftChange={(draft) => onFollowUpDraftChange?.(focusedTask.id, draft)}
            onTaskStatusChange={(status) => {
              if (status === 'verify' && onResumeEditing) onResumeEditing(focusedTask.id);
            }}
          />
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className={`flex-1 grid ${getGridClass(streamTasks.length)} gap-px bg-border-default overflow-hidden`}>
      {streamTasks.map((task) => (
        <StreamCell
          key={task.id}
          task={task}
          projectId={projectId}
          onClick={() => setFocusedTaskId(task.id)}
        />
      ))}
    </div>
  );
}

// ── Stream Cell ─────────────────────────────────────────

interface StreamCellProps {
  task: Task;
  projectId: string;
  onClick: () => void;
}

function StreamCell({ task, projectId, onClick }: StreamCellProps) {
  const isLive = task.agentStatus === 'running' || task.agentStatus === 'starting';
  const staticBlocks =
    !isLive && (task.status === 'verify' || task.status === 'done') && task.agentBlocks
      ? task.agentBlocks
      : undefined;

  const { blocks, sessionDone } = useAgentSession(task.id, projectId, staticBlocks);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // Auto-scroll
  useEffect(() => {
    if (!userScrolledUp && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [blocks, userScrolledUp]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setUserScrolledUp(!isAtBottom);
  }, []);

  const isRunning = !sessionDone;
  const lastBlock = blocks.length > 0 ? blocks[blocks.length - 1] : null;
  const isThinking = isRunning && blocks.length > 0 && (
    (lastBlock?.type === 'status' && lastBlock.subtype === 'init') ||
    (lastBlock?.type === 'tool_result') ||
    (lastBlock?.type === 'text') ||
    (lastBlock?.type === 'user')
  );

  // Build render items (same grouping logic as StructuredPane but simplified)
  const renderItems = useMemo(() => buildRenderItems(blocks), [blocks]);

  return (
    <div
      className={`flex flex-col min-h-0 bg-surface-deep border-l-[3px] ${statusBorderColor(task)} cursor-pointer hover:bg-surface-deep/80 transition-colors`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default bg-surface-primary/60 shrink-0">
        {statusIcon(task)}
        <span className="text-xs font-medium text-text-secondary truncate flex-1">
          {task.title || task.description?.slice(0, 40) || 'Untitled'}
        </span>
        <span className="text-[10px] font-mono text-text-placeholder">
          {task.id.slice(0, 8)}
        </span>
      </div>

      {/* Compact block stream */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto px-3 py-2 space-y-0.5"
        >
          {blocks.length === 0 && !sessionDone && (
            <div className="flex items-center gap-2 py-2 text-xs text-text-tertiary">
              <Loader2Icon className="w-3 h-3 text-bronze-500 animate-spin" />
              <span>Starting session...</span>
            </div>
          )}

          {renderItems.map((item, ri) => {
            if (item.kind === 'tool_group') {
              if (item.items.length === 1) {
                const t = item.items[0];
                return (
                  <ToolBlock
                    key={`tool-${t.idx}`}
                    toolId={t.toolId}
                    name={t.name}
                    input={t.input}
                    result={t.result}
                    forceCollapsed={true}
                  />
                );
              }
              return (
                <ToolGroupBlock
                  key={`tg-${ri}`}
                  toolName={item.toolName}
                  items={item.items}
                  forceCollapsed={true}
                />
              );
            }

            const block = item.block;
            const idx = item.idx;

            switch (block.type) {
              case 'text':
                return <TextBlock key={idx} text={block.text} />;
              case 'thinking':
                return <ThinkingBlock key={idx} thinking={block.thinking} forceCollapsed={true} />;
              case 'user':
                return <UserBlock key={idx} text={block.text} attachments={block.attachments} />;
              case 'status':
                return (
                  <StatusBlock
                    key={idx}
                    subtype={block.subtype}
                    sessionId={block.sessionId}
                    model={block.model}
                    durationMs={block.durationMs}
                    turns={block.turns}
                    error={block.error}
                  />
                );
              case 'task_update':
                return (
                  <TaskUpdateBlock
                    key={idx}
                    findings={block.findings}
                    humanSteps={block.humanSteps}
                  />
                );
              case 'stream_delta':
                return (
                  <span key={idx} className="text-xs text-text-secondary">
                    {block.text}
                  </span>
                );
              default:
                return null;
            }
          })}

          {isThinking && (
            <div className="py-1">
              <ScrambleText text="Thinking..." />
            </div>
          )}
        </div>

        {/* Jump to bottom */}
        {userScrolledUp && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                setUserScrolledUp(false);
              }
            }}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 text-[9px] font-medium text-text-secondary bg-surface-hover border border-border-strong rounded-full shadow-lg hover:bg-border-strong z-10"
          >
            <ArrowDownIcon className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Block Grouping ──────────────────────────────────────

type CompactRenderItem =
  | { kind: 'block'; block: AgentBlock; idx: number }
  | { kind: 'tool_group'; toolName: string; items: (ToolGroupItem & { idx: number })[] };

function buildRenderItems(blocks: AgentBlock[]): CompactRenderItem[] {
  const toolResultMap = new Map<string, Extract<AgentBlock, { type: 'tool_result' }>>();
  for (const block of blocks) {
    if (block.type === 'tool_result') {
      toolResultMap.set(block.toolId, block);
    }
  }

  const items: CompactRenderItem[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === 'tool_result') continue;

    if (block.type === 'tool_use') {
      // Skip interactive blocks in compact view
      if (block.name === 'AskUserQuestion' || block.name === 'ExitPlanMode') {
        continue;
      }

      // Render proq update_task as TaskUpdateBlock
      if (block.name === 'mcp__proq__update_task' && typeof block.input.findings === 'string') {
        items.push({
          kind: 'block',
          block: {
            type: 'task_update',
            findings: block.input.findings as string,
            humanSteps: block.input.humanSteps as string | undefined,
            timestamp: new Date().toISOString(),
          },
          idx: i,
        });
        continue;
      }

      const last = items[items.length - 1];
      if (last?.kind === 'tool_group' && last.toolName === block.name) {
        last.items.push({
          toolId: block.toolId,
          name: block.name,
          input: block.input,
          result: toolResultMap.get(block.toolId),
          idx: i,
        });
      } else {
        items.push({
          kind: 'tool_group',
          toolName: block.name,
          items: [{
            toolId: block.toolId,
            name: block.name,
            input: block.input,
            result: toolResultMap.get(block.toolId),
            idx: i,
          }],
        });
      }
    } else {
      items.push({ kind: 'block', block, idx: i });
    }
  }
  return items;
}
