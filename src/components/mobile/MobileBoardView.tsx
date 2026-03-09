'use client';

import React from 'react';
import type { TaskColumns, TaskStatus } from '@/lib/types';

interface MobileBoardViewProps {
  tasks: TaskColumns;
}

const COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'todo', label: 'Todo', color: 'text-text-tertiary' },
  { key: 'in-progress', label: 'In Progress', color: 'text-blue-400' },
  { key: 'verify', label: 'Verify', color: 'text-amber-400' },
  { key: 'done', label: 'Done', color: 'text-green-400' },
];

export function MobileBoardView({ tasks }: MobileBoardViewProps) {
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
            </div>
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
