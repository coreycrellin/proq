'use client';

import React, { useState, useCallback } from 'react';
import { PlusIcon } from 'lucide-react';
import type { TaskColumns, TaskStatus } from '@/lib/types';

interface MobileBoardViewProps {
  tasks: TaskColumns;
  projectId: string;
  onTaskCreated?: () => void;
}

const COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'todo', label: 'Todo', color: 'text-text-tertiary' },
  { key: 'in-progress', label: 'In Progress', color: 'text-blue-400' },
  { key: 'verify', label: 'Verify', color: 'text-amber-400' },
  { key: 'done', label: 'Done', color: 'text-green-400' },
];

export function MobileBoardView({ tasks, projectId, onTaskCreated }: MobileBoardViewProps) {
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateTask = useCallback(async () => {
    if (!newTaskTitle.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTaskTitle.trim(), description: '' }),
      });
      if (res.ok) {
        setNewTaskTitle('');
        setShowNewTask(false);
        onTaskCreated?.();
      }
    } catch {
      // best effort
    } finally {
      setCreating(false);
    }
  }, [newTaskTitle, creating, projectId, onTaskCreated]);

  return (
    <div className="h-full overflow-y-auto px-4 py-3 space-y-4">
      {COLUMNS.map(({ key, label, color }) => {
        const items = tasks[key] || [];
        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${color}`}>
                {label}
              </h3>
              <span className="text-xs text-text-tertiary">({items.length})</span>
              {key === 'todo' && (
                <button
                  onClick={() => setShowNewTask((v) => !v)}
                  className="ml-auto p-0.5 rounded text-text-tertiary hover:text-text-primary transition-colors"
                  aria-label="Add task"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              )}
            </div>
            {key === 'todo' && showNewTask && (
              <div className="mb-2 flex gap-2">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
                  placeholder="Task title..."
                  autoFocus
                  className="flex-1 bg-surface-hover/50 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary/50 outline-none focus:border-bronze-400/50"
                />
                <button
                  onClick={handleCreateTask}
                  disabled={creating || !newTaskTitle.trim()}
                  className="px-3 py-2 bg-bronze-400/20 text-bronze-400 rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity"
                >
                  {creating ? '...' : 'Add'}
                </button>
              </div>
            )}
            {items.length === 0 ? (
              <p className="text-xs text-text-tertiary/50 py-2">No tasks</p>
            ) : (
              <div className="space-y-1.5">
                {items.map((task) => (
                  <div
                    key={task.id}
                    className="bg-surface-hover/50 rounded-lg px-3 py-2.5 border border-border-default"
                  >
                    <p className="text-sm text-text-primary truncate">
                      {task.title || task.description?.slice(0, 60)}
                    </p>
                    {task.priority && (
                      <span className={`text-[10px] mt-0.5 inline-block ${
                        task.priority === 'high' ? 'text-red-400' :
                        task.priority === 'medium' ? 'text-amber-400' :
                        'text-text-tertiary'
                      }`}>
                        {task.priority}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
