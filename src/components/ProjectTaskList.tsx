'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { SearchIcon, XIcon, ListTodoIcon } from 'lucide-react';
import { TaskListItem } from '@/components/TaskListItem';
import { TaskDetailPanel } from '@/components/TaskDetailPanel';
import type { Task, TaskStatus, TaskColumns } from '@/lib/types';

type SortOption = 'updated' | 'created' | 'status';

const STATUS_ORDER: Record<TaskStatus, number> = {
  'in-progress': 0,
  'verify': 1,
  'todo': 2,
  'done': 3,
};

interface ProjectTaskListProps {
  projectId: string;
  projectName: string;
  columns: TaskColumns;
  onClickTask: (task: Task) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onContinueToCode?: (taskId: string) => void;
  onRefresh: () => void;
}

export function ProjectTaskList({
  projectId,
  projectName,
  columns,
  onClickTask,
  onStatusChange,
  onContinueToCode,
}: ProjectTaskListProps) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('status');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeStatuses, setActiveStatuses] = useState<Set<TaskStatus>>(
    () => new Set(['todo', 'in-progress', 'verify', 'done'])
  );
  const [listPercent, setListPercent] = useState(55);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const container = containerRef.current;
    if (!container) return;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !container) return;
      const rect = container.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setListPercent(Math.min(Math.max(pct, 25), 75));
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // Flatten all tasks from columns
  const allTasks = useMemo(() => {
    const result: Task[] = [];
    for (const status of Object.keys(columns) as TaskStatus[]) {
      for (const task of columns[status]) {
        result.push(task);
      }
    }
    return result;
  }, [columns]);

  // Filter & sort
  const filteredTasks = useMemo(() => {
    let tasks = allTasks;

    // Status filter
    tasks = tasks.filter((t) => activeStatuses.has(t.status));

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q)
      );
    }

    // Sort
    tasks.sort((a, b) => {
      switch (sort) {
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'status':
          return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
        default:
          return 0;
      }
    });

    return tasks;
  }, [allTasks, activeStatuses, search, sort]);

  const selectedTask = useMemo(() => {
    if (!selectedId) return null;
    return filteredTasks.find((t) => t.id === selectedId) || null;
  }, [selectedId, filteredTasks]);

  const toggleStatus = (status: TaskStatus) => {
    const next = new Set(activeStatuses);
    if (next.has(status)) {
      if (next.size > 1) next.delete(status);
    } else {
      next.add(status);
    }
    setActiveStatuses(next);
  };

  const statusChips: { status: TaskStatus; label: string }[] = [
    { status: 'todo', label: 'Todo' },
    { status: 'in-progress', label: 'In Progress' },
    { status: 'verify', label: 'Verify' },
    { status: 'done', label: 'Done' },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Filters bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border-subtle bg-surface-base">
        {/* Search */}
        <div className="relative flex-shrink-0 w-48">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-bronze-400 dark:text-zinc-600" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-7 py-1.5 text-xs bg-surface-secondary border border-border-default rounded-md text-bronze-800 dark:text-zinc-200 placeholder-bronze-400 dark:placeholder-zinc-600 outline-none focus:border-steel/50"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-bronze-400 dark:text-zinc-600 hover:text-bronze-600 dark:hover:text-zinc-400"
            >
              <XIcon className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Status chips */}
        <div className="flex items-center gap-1">
          {statusChips.map(({ status, label }) => (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors border ${
                activeStatuses.has(status)
                  ? 'bg-surface-secondary border-border-default text-bronze-800 dark:text-zinc-200'
                  : 'bg-transparent border-transparent text-bronze-400 dark:text-zinc-600 hover:text-bronze-600 dark:hover:text-zinc-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="ml-auto text-[11px] bg-surface-secondary border border-border-default rounded-md px-2 py-1.5 text-bronze-700 dark:text-zinc-300 outline-none cursor-pointer"
        >
          <option value="status">Status</option>
          <option value="updated">Recently updated</option>
          <option value="created">Recently created</option>
        </select>

        <span className="text-xs text-bronze-500 dark:text-zinc-500">
          {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content: list + detail */}
      <div ref={containerRef} className="flex-1 flex min-h-0 overflow-hidden">
        {/* Task list */}
        <div
          style={selectedTask || filteredTasks.length > 0 ? { width: `${listPercent}%` } : undefined}
          className={`${!selectedTask && filteredTasks.length === 0 ? 'w-full' : ''} overflow-y-auto`}
        >
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              {allTasks.length === 0 ? (
                <>
                  <ListTodoIcon className="w-8 h-8 text-bronze-400 dark:text-zinc-700" />
                  <p className="text-sm text-bronze-500 dark:text-zinc-500">No tasks yet</p>
                </>
              ) : (
                <>
                  <SearchIcon className="w-8 h-8 text-bronze-400 dark:text-zinc-700" />
                  <p className="text-sm text-bronze-500 dark:text-zinc-500">No tasks match your filters</p>
                  <button
                    onClick={() => {
                      setSearch('');
                      setActiveStatuses(new Set(['todo', 'in-progress', 'verify', 'done']));
                    }}
                    className="text-xs text-steel hover:text-steel-light transition-colors"
                  >
                    Clear filters
                  </button>
                </>
              )}
            </div>
          ) : (
            filteredTasks.map((task) => (
              <TaskListItem
                key={task.id}
                task={task}
                projectName={projectName}
                isSelected={task.id === selectedId}
                onClick={() => {
                  setSelectedId(task.id === selectedId ? null : task.id);
                }}
              />
            ))
          )}
        </div>

        {/* Draggable vertical divider */}
        {(selectedTask || filteredTasks.length > 0) && (
          <div
            className="relative flex-shrink-0 cursor-col-resize group/divider"
            onMouseDown={handleDividerMouseDown}
          >
            <div className="absolute inset-y-0 -left-2 -right-2" />
            <div className="w-px h-full bg-bronze-300 dark:bg-zinc-800 group-hover/divider:bg-steel dark:group-hover/divider:bg-zinc-600 transition-colors" />
          </div>
        )}

        {/* Detail panel */}
        {selectedTask ? (
          <div style={{ width: `${100 - listPercent}%` }} className="bg-surface-primary overflow-hidden">
            <TaskDetailPanel
              task={selectedTask}
              projectId={projectId}
              projectName={projectName}
              onStatusChange={onStatusChange}
              onContinueToCode={onContinueToCode}
              onClickTask={onClickTask}
            />
          </div>
        ) : filteredTasks.length > 0 ? (
          <div style={{ width: `${100 - listPercent}%` }} className="bg-surface-primary flex items-center justify-center">
            <div className="text-center">
              <ListTodoIcon className="w-8 h-8 text-bronze-300 dark:text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-bronze-400 dark:text-zinc-600">Select a task to see details</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
