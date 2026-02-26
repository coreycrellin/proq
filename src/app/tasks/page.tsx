'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SearchIcon, XIcon, ListTodoIcon } from 'lucide-react';
import { useProjects } from '@/components/ProjectsProvider';
import { TaskListItem } from '@/components/TaskListItem';
import { TaskDetailPanel } from '@/components/TaskDetailPanel';
import type { Task, TaskStatus } from '@/lib/types';

type SortOption = 'updated' | 'created' | 'status' | 'project';

const STATUS_ORDER: Record<TaskStatus, number> = {
  'in-progress': 0,
  'verify': 1,
  'todo': 2,
  'done': 3,
};

interface FlatTask {
  task: Task;
  projectId: string;
  projectName: string;
}

export default function TaskListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projects, tasksByProject, refreshTasks } = useProjects();

  // Read filters from URL
  const selectedId = searchParams.get('selected') || null;
  const urlStatuses = searchParams.get('status');
  const urlProjects = searchParams.get('project');
  const urlSearch = searchParams.get('q') || '';
  const urlSort = (searchParams.get('sort') as SortOption) || 'updated';

  // Local state mirrors URL for responsive UI
  const [search, setSearch] = useState(urlSearch);
  const [sort, setSort] = useState<SortOption>(urlSort);
  const [activeStatuses, setActiveStatuses] = useState<Set<TaskStatus>>(() => {
    if (urlStatuses) return new Set(urlStatuses.split(',') as TaskStatus[]);
    return new Set(['todo', 'in-progress', 'verify', 'done']);
  });
  const [activeProjects, setActiveProjects] = useState<Set<string>>(() => {
    if (urlProjects) return new Set(urlProjects.split(','));
    return new Set<string>(); // empty = all
  });

  // Update document title
  useEffect(() => {
    document.title = 'proq | Tasks';
  }, []);

  // Auto-refresh all tasks every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      projects.forEach((p) => refreshTasks(p.id));
    }, 5000);
    return () => clearInterval(interval);
  }, [projects, refreshTasks]);

  // Sync URL params (debounced for search)
  const updateUrl = useCallback((overrides: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(overrides)) {
      if (val === null || val === '') params.delete(key);
      else params.set(key, val);
    }
    router.replace(`/tasks?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Flatten all tasks across projects
  const allTasks: FlatTask[] = useMemo(() => {
    const result: FlatTask[] = [];
    for (const project of projects) {
      const cols = tasksByProject[project.id];
      if (!cols) continue;
      for (const status of Object.keys(cols) as TaskStatus[]) {
        for (const task of cols[status]) {
          result.push({
            task,
            projectId: project.id,
            projectName: project.name || project.path.split('/').pop() || project.id,
          });
        }
      }
    }
    return result;
  }, [projects, tasksByProject]);

  // Filter & sort
  const filteredTasks = useMemo(() => {
    let tasks = allTasks;

    // Status filter
    tasks = tasks.filter((t) => activeStatuses.has(t.task.status));

    // Project filter
    if (activeProjects.size > 0) {
      tasks = tasks.filter((t) => activeProjects.has(t.projectId));
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      tasks = tasks.filter((t) =>
        (t.task.title || '').toLowerCase().includes(q) ||
        (t.task.description || '').toLowerCase().includes(q)
      );
    }

    // Sort
    tasks.sort((a, b) => {
      switch (sort) {
        case 'updated':
          return new Date(b.task.updatedAt).getTime() - new Date(a.task.updatedAt).getTime();
        case 'created':
          return new Date(b.task.createdAt).getTime() - new Date(a.task.createdAt).getTime();
        case 'status':
          return (STATUS_ORDER[a.task.status] ?? 9) - (STATUS_ORDER[b.task.status] ?? 9);
        case 'project':
          return a.projectName.localeCompare(b.projectName);
        default:
          return 0;
      }
    });

    return tasks;
  }, [allTasks, activeStatuses, activeProjects, search, sort]);

  // Selected task detail
  const selectedTask = useMemo(() => {
    if (!selectedId) return null;
    return filteredTasks.find((t) => t.task.id === selectedId) || null;
  }, [selectedId, filteredTasks]);

  const toggleStatus = (status: TaskStatus) => {
    const next = new Set(activeStatuses);
    if (next.has(status)) {
      if (next.size > 1) next.delete(status);
    } else {
      next.add(status);
    }
    setActiveStatuses(next);
    updateUrl({ status: [...next].join(',') });
  };

  const toggleProject = (projectId: string) => {
    const next = new Set(activeProjects);
    if (next.has(projectId)) {
      next.delete(projectId);
    } else {
      next.add(projectId);
    }
    setActiveProjects(next);
    updateUrl({ project: next.size > 0 ? [...next].join(',') : null });
  };

  const selectTask = (taskId: string) => {
    updateUrl({ selected: taskId });
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const flat = allTasks.find((t) => t.task.id === taskId);
    if (!flat) return;

    if (newStatus === 'in-progress') {
      await fetch(`/api/projects/${flat.projectId}/tasks/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, toColumn: 'in-progress', toIndex: 0 }),
      });
    } else if (newStatus === 'done') {
      await fetch(`/api/projects/${flat.projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      });
    } else if (newStatus === 'todo') {
      await fetch(`/api/projects/${flat.projectId}/tasks/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, toColumn: 'todo', toIndex: 0 }),
      });
    }

    refreshTasks(flat.projectId);
  };

  const statusChips: { status: TaskStatus; label: string }[] = [
    { status: 'todo', label: 'Todo' },
    { status: 'in-progress', label: 'In Progress' },
    { status: 'verify', label: 'Verify' },
    { status: 'done', label: 'Done' },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 h-12 flex items-center gap-3 px-4 border-b border-border-default bg-surface-primary">
        <ListTodoIcon className="w-4 h-4 text-text-chrome" />
        <span className="text-sm font-medium text-bronze-900 dark:text-zinc-100">All Tasks</span>
        <span className="text-xs text-bronze-500 dark:text-zinc-500">{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Filters bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border-subtle bg-surface-base">
        {/* Search */}
        <div className="relative flex-shrink-0 w-48">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-bronze-400 dark:text-zinc-600" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              updateUrl({ q: e.target.value || null });
            }}
            className="w-full pl-7 pr-7 py-1.5 text-xs bg-surface-secondary border border-border-default rounded-md text-bronze-800 dark:text-zinc-200 placeholder-bronze-400 dark:placeholder-zinc-600 outline-none focus:border-steel/50"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); updateUrl({ q: null }); }}
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

        {/* Project filter */}
        {projects.length > 1 && (
          <div className="flex items-center gap-1 ml-1 border-l border-border-subtle pl-2">
            {projects.map((p) => {
              const name = p.name || p.path.split('/').pop() || p.id;
              const isActive = activeProjects.size === 0 || activeProjects.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProject(p.id)}
                  className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors border ${
                    isActive
                      ? 'bg-surface-secondary border-border-default text-bronze-800 dark:text-zinc-200'
                      : 'bg-transparent border-transparent text-bronze-400 dark:text-zinc-600 hover:text-bronze-600 dark:hover:text-zinc-400'
                  }`}
                  title={name}
                >
                  {name.length > 12 ? name.slice(0, 12) + '...' : name}
                </button>
              );
            })}
          </div>
        )}

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => {
            const val = e.target.value as SortOption;
            setSort(val);
            updateUrl({ sort: val === 'updated' ? null : val });
          }}
          className="ml-auto text-[11px] bg-surface-secondary border border-border-default rounded-md px-2 py-1.5 text-bronze-700 dark:text-zinc-300 outline-none cursor-pointer"
        >
          <option value="updated">Recently updated</option>
          <option value="created">Recently created</option>
          <option value="status">Status</option>
          <option value="project">Project</option>
        </select>
      </div>

      {/* Content: list + detail */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Task list */}
        <div className={`${selectedTask ? 'w-[55%]' : 'w-full'} border-r border-border-subtle overflow-y-auto transition-all`}>
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              {allTasks.length === 0 ? (
                <>
                  <ListTodoIcon className="w-8 h-8 text-bronze-400 dark:text-zinc-700" />
                  <p className="text-sm text-bronze-500 dark:text-zinc-500">No tasks yet</p>
                  <p className="text-xs text-bronze-400 dark:text-zinc-600">Create tasks from a project board.</p>
                </>
              ) : (
                <>
                  <SearchIcon className="w-8 h-8 text-bronze-400 dark:text-zinc-700" />
                  <p className="text-sm text-bronze-500 dark:text-zinc-500">No tasks match your filters</p>
                  <button
                    onClick={() => {
                      setSearch('');
                      setActiveStatuses(new Set(['todo', 'in-progress', 'verify', 'done']));
                      setActiveProjects(new Set());
                      updateUrl({ q: null, status: null, project: null });
                    }}
                    className="text-xs text-steel hover:text-steel-light transition-colors"
                  >
                    Clear filters
                  </button>
                </>
              )}
            </div>
          ) : (
            filteredTasks.map((flat) => (
              <TaskListItem
                key={flat.task.id}
                task={flat.task}
                projectName={flat.projectName}
                isSelected={flat.task.id === selectedId}
                onClick={() => selectTask(flat.task.id)}
              />
            ))
          )}
        </div>

        {/* Detail panel */}
        {selectedTask ? (
          <div className="w-[45%] bg-surface-primary overflow-hidden">
            <TaskDetailPanel
              task={selectedTask.task}
              projectId={selectedTask.projectId}
              projectName={selectedTask.projectName}
              onStatusChange={handleStatusChange}
            />
          </div>
        ) : filteredTasks.length > 0 ? (
          <div className="w-[45%] bg-surface-primary flex items-center justify-center">
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
