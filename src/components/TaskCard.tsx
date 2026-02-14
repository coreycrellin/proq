'use client';

import React from 'react';
import {
  AlertTriangleIcon,
  Trash2Icon,
  Loader2Icon,
} from 'lucide-react';
import type { Task } from '@/lib/types';

interface TaskCardProps {
  task: Task;
  isDragOverlay?: boolean;
  onDelete?: (taskId: string) => void;
  onClick?: (task: Task) => void;
}

export function TaskCard({ task, isDragOverlay, onDelete, onClick }: TaskCardProps) {
  const steps = task.humanSteps?.split('\n').filter(Boolean) || [];
  const priority = task.priority || 'medium';
  const isLocked = task.status === 'in-progress' && task.locked;

  return (
    <div
      className={`
        group relative bg-zinc-800/30 border rounded-md overflow-hidden
        ${isLocked
          ? 'border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.15)] animate-pulse-subtle'
          : 'border-zinc-800'}
        ${isDragOverlay ? 'ring-1 ring-blue-500 shadow-lg shadow-black/40' : 'hover:bg-zinc-900 hover:border-zinc-700 cursor-pointer'}
      `}
      onClick={() => !isDragOverlay && onClick?.(task)}
    >
      {/* Delete button */}
      {onDelete && !isDragOverlay && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="absolute top-2 right-2 p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <Trash2Icon className="w-3.5 h-3.5" />
        </button>
      )}

      <div className="p-3 min-h-[80px]">
        <div className="flex items-start justify-between pr-6">
          <h4 className="text-sm text-zinc-200 leading-snug font-normal">
            {task.title}
          </h4>
          {isLocked && (
            <Loader2Icon className="w-3.5 h-3.5 text-blue-400 animate-spin flex-shrink-0 mt-0.5" />
          )}
        </div>

        {task.description && (
          <p className="text-xs text-zinc-500 leading-relaxed mt-2 line-clamp-2">
            {task.description}
          </p>
        )}

        {steps.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <AlertTriangleIcon className="w-3 h-3 text-amber-500 flex-shrink-0" />
            <span className="text-[10px] text-amber-500 font-medium uppercase tracking-wide">
              {steps.length} step{steps.length !== 1 ? 's' : ''} for you
            </span>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-800/50">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider ${
              priority === 'high'
                ? 'border-red-500/20 text-red-400 bg-red-500/5'
                : priority === 'medium'
                  ? 'border-blue-500/20 text-blue-400 bg-blue-500/5'
                  : 'border-zinc-700 text-zinc-500 bg-zinc-800/50'
            }`}
          >
            {priority}
          </span>
          <span className="text-[10px] text-zinc-600 font-mono">
            {task.id.slice(0, 8)}
          </span>
        </div>
      </div>
    </div>
  );
}
