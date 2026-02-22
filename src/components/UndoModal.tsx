'use client';

import { useEffect } from 'react';
import type { Task, TaskStatus } from '@/lib/types';

interface UndoModalProps {
  task: Task;
  column: TaskStatus;
  isOpen: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}

export function UndoModal({ task, column, isOpen, onRestore, onDiscard }: UndoModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDiscard();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onRestore();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onRestore, onDiscard]);

  if (!isOpen) return null;

  const label = task.title || task.description.slice(0, 50) || 'Untitled';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onDiscard} />
      <div className="relative bg-gunmetal-50 dark:bg-zinc-900 border border-gunmetal-300 dark:border-zinc-800 rounded-lg shadow-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in-95 duration-150">
        <p className="text-sm text-gunmetal-800 dark:text-zinc-200 mb-4">
          Restore &ldquo;<span className="font-medium">{label}</span>&rdquo; to <span className="font-medium">{column}</span>?
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onDiscard}
            className="btn-secondary px-3 py-1.5 text-xs rounded-md"
          >
            Discard
          </button>
          <button
            onClick={onRestore}
            className="btn-primary px-3 py-1.5 text-xs rounded-md"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}
