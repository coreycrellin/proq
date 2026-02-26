'use client';

import React from 'react';
import {
  Loader2Icon,
  ClockIcon,
  CheckCircle2Icon,
  CircleIcon,
  AlertTriangleIcon,
} from 'lucide-react';
import type { Task } from '@/lib/types';
import { parseLines } from '@/lib/utils';

interface TaskListItemProps {
  task: Task;
  projectName: string;
  isSelected: boolean;
  onClick: () => void;
}

function StatusIcon({ task }: { task: Task }) {
  if (task.dispatch === 'running') {
    return <Loader2Icon className="w-3.5 h-3.5 text-steel animate-spin shrink-0" />;
  }
  if (task.dispatch === 'starting') {
    return <Loader2Icon className="w-3.5 h-3.5 text-zinc-400 animate-spin shrink-0" />;
  }
  if (task.dispatch === 'queued') {
    return <ClockIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
  }
  switch (task.status) {
    case 'in-progress':
      return <Loader2Icon className="w-3.5 h-3.5 text-steel animate-[spin_3s_linear_infinite] shrink-0" />;
    case 'verify':
      return <CheckCircle2Icon className="w-3.5 h-3.5 text-gold shrink-0" />;
    case 'done':
      return <CheckCircle2Icon className="w-3.5 h-3.5 text-patina shrink-0" />;
    default:
      return <CircleIcon className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600 shrink-0" />;
  }
}

function statusLabel(task: Task): string {
  if (task.dispatch === 'running') return 'Running';
  if (task.dispatch === 'starting') return 'Starting';
  if (task.dispatch === 'queued') return 'Queued';
  switch (task.status) {
    case 'in-progress': return 'In Progress';
    case 'verify': return 'Verify';
    case 'done': return 'Done';
    default: return 'Todo';
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function TaskListItem({ task, projectName, isSelected, onClick }: TaskListItemProps) {
  const steps = parseLines(task.humanSteps);
  const isRunning = task.dispatch === 'running';

  return (
    <div
      onClick={onClick}
      className={`px-4 py-3 cursor-pointer border-b border-border-subtle transition-colors ${
        isSelected
          ? 'bg-bronze-300/80 dark:bg-zinc-800/60'
          : 'hover:bg-bronze-200/60 dark:hover:bg-zinc-800/30'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5">
          <StatusIcon task={task} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2">
            <span className={`text-sm truncate ${
              isSelected
                ? 'text-bronze-900 dark:text-zinc-100 font-medium'
                : 'text-bronze-800 dark:text-zinc-200'
            }`}>
              {task.title || task.description?.slice(0, 60) || 'Untitled'}
            </span>
          </div>

          {/* Description preview if title exists */}
          {task.title && task.description && (
            <p className="text-xs text-bronze-600 dark:text-zinc-500 truncate mt-0.5">
              {task.description.slice(0, 80)}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] font-medium uppercase tracking-wide ${
              isRunning ? 'text-steel' :
              task.status === 'verify' ? 'text-gold' :
              task.status === 'done' ? 'text-patina' :
              'text-bronze-500 dark:text-zinc-500'
            }`}>
              {statusLabel(task)}
            </span>

            <span className="text-bronze-400 dark:text-zinc-700">·</span>

            <span className="text-[10px] text-bronze-500 dark:text-zinc-600 font-mono">
              {projectName}
            </span>

            {steps.length > 0 && task.status !== 'done' && (
              <>
                <span className="text-bronze-400 dark:text-zinc-700">·</span>
                <span className="flex items-center gap-1 text-[10px] text-gold font-medium">
                  <AlertTriangleIcon className="w-2.5 h-2.5" />
                  {steps.length} step{steps.length !== 1 ? 's' : ''}
                </span>
              </>
            )}

            <span className="ml-auto text-[10px] text-bronze-400 dark:text-zinc-600">
              {timeAgo(task.updatedAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
