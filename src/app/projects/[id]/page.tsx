'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { TopBar, type TabOption } from '@/components/TopBar';
import { KanbanBoard } from '@/components/KanbanBoard';
import TerminalPanel from '@/components/TerminalPanel';
import { LiveTab } from '@/components/LiveTab';
import { CodeTab } from '@/components/CodeTab';
import { ProjectTaskList } from '@/components/ProjectTaskList';
import { TaskModal } from '@/components/TaskModal';
import { TaskAgentModal } from '@/components/TaskAgentModal';
import { UndoModal } from '@/components/UndoModal';
import { ParallelModeModal } from '@/components/ParallelModeModal';
import { AlertModal } from '@/components/Modal';
import { useProjects } from '@/components/ProjectsProvider';
import { emptyColumns } from '@/components/ProjectsProvider';
import type { Task, TaskStatus, TaskColumns, ExecutionMode } from '@/lib/types';

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { projects, tasksByProject, refreshTasks, setTasksByProject } = useProjects();

  const [activeTab, setActiveTab] = useState<TabOption>('project');
  const [chatPercent, setChatPercent] = useState(60);
  const [isDragging, setIsDragging] = useState(false);
  const [terminalCollapsed, setTerminalCollapsed] = useState(true);
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [agentModalTask, setAgentModalTask] = useState<Task | null>(null);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('sequential');
  const [cleanupTimes, setCleanupTimes] = useState<Record<string, number>>({});
  const [undoEntry, setUndoEntry] = useState<{ task: Task; column: TaskStatus } | null>(null);
  const [showParallelModal, setShowParallelModal] = useState(false);
  const [showModeBlockedModal, setShowModeBlockedModal] = useState(false);
  const [currentBranch, setCurrentBranch] = useState<string>('main');
  const [branches, setBranches] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Quick capture — type on the board to create a new task
  const quickCaptureRef = useRef<{ active: boolean; buffer: string }>({ active: false, buffer: '' });
  const [quickCaptureText, setQuickCaptureText] = useState('');
  const hasModalRef = useRef(false);

  const project = projects.find((p) => p.id === projectId);
  const columns: TaskColumns = tasksByProject[projectId] || emptyColumns();

  // Update document title with project id (slug)
  useEffect(() => {
    document.title = project ? `proq | ${project.name}` : 'proq';
  }, [project?.id]);

  // Restore last tab when switching projects
  useEffect(() => {
    if (project) setActiveTab(project.activeTab || 'project');
  }, [project?.id]);

  // Restore terminal open/closed state and height from project
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/terminal-state`)
      .then((res) => res.json())
      .then((data) => {
        setTerminalCollapsed(!data.open);
        if (typeof data.height === 'number') setChatPercent(data.height);
      })
      .catch(() => {});
  }, [projectId]);

  const fetchExecutionMode = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/execution-mode`);
      const data = await res.json();
      setExecutionMode(data.mode);
      setCleanupTimes(data.cleanupTimes || {});
    } catch (e) {
      console.error('Failed to fetch execution mode:', e);
    }
  }, [projectId]);

  const fetchBranchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/git`);
      if (res.ok) {
        const data = await res.json();
        setCurrentBranch(data.current || 'main');
        setBranches(data.branches || []);
      }
    } catch {
      // git API may not be available for non-git projects
    }
  }, [projectId]);

  const refreshDetachedHead = useCallback(async () => {
    try {
      await fetch(`/api/projects/${projectId}/git`, { method: 'PATCH' });
    } catch {
      // best effort
    }
  }, [projectId]);

  const refresh = useCallback(() => {
    refreshTasks(projectId);
    fetchExecutionMode();
    fetchBranchState();
    refreshDetachedHead();
  }, [projectId, refreshTasks, fetchExecutionMode, fetchBranchState, refreshDetachedHead]);

  // Fetch execution mode and branch state on project load
  useEffect(() => {
    if (projectId) {
      fetchExecutionMode();
      fetchBranchState();
    }
  }, [projectId, fetchExecutionMode, fetchBranchState]);

  // Auto-refresh tasks every 5 seconds
  useEffect(() => {
    if (!projectId) return;
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [projectId, refresh]);

  // Cmd+Z to undo last delete — peeks without restoring
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'z' && e.metaKey && !e.shiftKey && !e.ctrlKey && !undoEntry) {
        // Don't intercept if user is typing in an input/textarea
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        e.preventDefault();
        try {
          const res = await fetch(`/api/projects/${projectId}/tasks/undo`);
          if (res.ok) {
            const data = await res.json();
            setUndoEntry({ task: data.task, column: data.column });
          }
        } catch {
          // no-op
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projectId, undoEntry]);

  // Keep hasModalRef in sync for quick capture
  useEffect(() => {
    hasModalRef.current = !!modalTask || !!agentModalTask || !!undoEntry || showParallelModal || showModeBlockedModal;
  }, [modalTask, agentModalTask, undoEntry, showParallelModal, showModeBlockedModal]);

  // Cancel quick capture if another modal opens (e.g. Cmd+Z undo)
  useEffect(() => {
    if ((undoEntry || agentModalTask || showParallelModal || showModeBlockedModal) && quickCaptureRef.current.active) {
      quickCaptureRef.current = { active: false, buffer: '' };
      setQuickCaptureText('');
    }
  }, [undoEntry, agentModalTask, showParallelModal, showModeBlockedModal]);

  // Clear quick capture state when task modal opens from capture
  useEffect(() => {
    if (modalTask && quickCaptureRef.current.active) {
      quickCaptureRef.current = { active: false, buffer: '' };
      setQuickCaptureText('');
    }
  }, [modalTask]);

  // Global keydown for quick capture — type on the board to create a task
  useEffect(() => {
    if (activeTab !== 'project') return;

    const handler = (e: KeyboardEvent) => {
      const qc = quickCaptureRef.current;

      // Continue buffering if capture is active
      if (qc.active) {
        if (hasModalRef.current) return; // modal opened, stop intercepting
        if (e.metaKey || e.ctrlKey || e.altKey) return; // let shortcuts through

        if (e.key === 'Escape') {
          e.preventDefault();
          qc.active = false;
          qc.buffer = '';
          setQuickCaptureText('');
          return;
        }
        if (e.key.length === 1) {
          e.preventDefault();
          qc.buffer += e.key;
          setQuickCaptureText(qc.buffer);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          qc.buffer = qc.buffer.slice(0, -1);
          setQuickCaptureText(qc.buffer);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          qc.buffer += '\n';
          setQuickCaptureText(qc.buffer);
        }
        return;
      }

      // Don't start capture if modal is open
      if (hasModalRef.current) return;

      // Don't start if typing in an input element
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'CANVAS') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      // Don't start on modifier combos
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Only start on printable characters
      if (e.key.length !== 1) return;

      // Start capture
      e.preventDefault();
      qc.active = true;
      qc.buffer = e.key;
      setQuickCaptureText(e.key);

      // Create task in background
      (async () => {
        try {
          const res = await fetch(`/api/projects/${projectId}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: '', description: '' }),
          });
          const newTask: Task = await res.json();

          if (!quickCaptureRef.current.active) {
            // Capture was cancelled — clean up the empty task
            await fetch(`/api/projects/${projectId}/tasks/${newTask.id}`, { method: 'DELETE' });
            refreshTasks(projectId);
            return;
          }

          setModalTask(newTask);
          refreshTasks(projectId);
        } catch {
          quickCaptureRef.current = { active: false, buffer: '' };
          setQuickCaptureText('');
        }
      })();
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      // Clean up capture state if tab switches mid-capture
      if (quickCaptureRef.current.active) {
        quickCaptureRef.current = { active: false, buffer: '' };
        setQuickCaptureText('');
      }
    };
  }, [activeTab, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep agent modal in sync with polled task data
  useEffect(() => {
    if (agentModalTask) {
      // Search across all columns
      for (const col of Object.values(columns)) {
        const updated = col.find((t) => t.id === agentModalTask.id);
        if (updated) {
          setAgentModalTask(updated);
          break;
        }
      }
    }
  }, [columns]);

  const deleteTask = async (taskId: string) => {
    await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: 'DELETE',
    });
    refresh();
  };

  const moveTask = async (taskId: string, toColumn: TaskStatus, toIndex: number) => {
    await fetch(`/api/projects/${projectId}/tasks/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, toColumn, toIndex }),
    });

    refresh();
  };

  const updateTask = async (taskId: string, data: Partial<Task>) => {
    setModalTask((prev) =>
      prev && prev.id === taskId
        ? { ...prev, ...data, updatedAt: new Date().toISOString() }
        : prev
    );
    await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    refresh();
  };

  const handleContinueToCode = async (taskId: string) => {
    // Switch mode to code, set dispatch queued, clear old agent data but keep findings (the plan)
    await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'code', dispatch: 'queued', humanSteps: '', agentLog: '' }),
    });
    // Move to in-progress — processQueue will pick up the queued task
    await fetch(`/api/projects/${projectId}/tasks/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, toColumn: 'in-progress', toIndex: 0 }),
    });
    setAgentModalTask(null);
    refresh();
  };

  // Build map of proq/* branch → task title for the branch switcher
  const taskBranchMap: Record<string, string> = {};
  for (const col of Object.values(columns)) {
    for (const t of col) {
      if (t.branch) {
        taskBranchMap[t.branch] = t.title || t.description.slice(0, 40);
      }
    }
  }

  const handleSwitchBranch = useCallback(async (branch: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/git`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentBranch(data.current || branch);
      }
    } catch {
      // best effort
    }
  }, [projectId]);

  const hasTasksInFlight = columns['in-progress'].length > 0 || columns['verify'].length > 0;

  const handleExecutionModeChange = async (mode: ExecutionMode) => {
    // Block mode switch if tasks are in-progress or verify
    if (hasTasksInFlight) {
      setShowModeBlockedModal(true);
      return;
    }
    // Show confirmation modal when switching to parallel
    if (mode === 'parallel' && executionMode !== 'parallel') {
      setShowParallelModal(true);
      return;
    }
    setExecutionMode(mode);
    await fetch(`/api/projects/${projectId}/execution-mode`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    refresh();
  };

  const applyParallelMode = async () => {
    setShowParallelModal(false);
    setExecutionMode('parallel');
    await fetch(`/api/projects/${projectId}/execution-mode`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'parallel' }),
    });
    refresh();
  };

  const handleAddTask = async () => {
    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '', description: '' }),
    });
    const newTask: Task = await res.json();
    setModalTask(newTask);
    refresh();
  };

  const handleTabChange = useCallback((tab: TabOption) => {
    setActiveTab(tab);
    fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeTab: tab }),
    }).catch(() => {});
  }, [projectId]);

  const patchTerminalState = useCallback((data: { open?: boolean; height?: number }) => {
    fetch(`/api/projects/${projectId}/terminal-state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {});
  }, [projectId]);

  const toggleTerminalCollapsed = useCallback(() => {
    setTerminalCollapsed((prev) => {
      const next = !prev;
      patchTerminalState({ open: !next });
      return next;
    });
  }, [patchTerminalState]);

  const expandTerminal = useCallback(() => {
    setTerminalCollapsed((prev) => {
      if (!prev) return prev; // already open
      patchTerminalState({ open: true });
      return false;
    });
    setChatPercent((prev) => Math.max(prev, 25));
  }, [patchTerminalState]);

  // Resize handle (tab bar is the drag target)
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const percent = ((rect.height - y) / rect.height) * 100;
      // Drag up from closed state → expand
      if (terminalCollapsed && percent > 5) {
        toggleTerminalCollapsed();
      }
      // Allow dragging down to 3% so snap-to-close is visible
      setChatPercent(Math.min(100, Math.max(3, percent)));
    };
    const handleMouseUp = (e: MouseEvent) => {
      // Snap closed if terminal height < 200px
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const pixelHeight = rect.height - y;
        if (pixelHeight < 200) {
          toggleTerminalCollapsed();
          setChatPercent(25); // reset for next open
        } else {
          // Persist the terminal height
          const finalPercent = Math.min(100, Math.max(3, ((rect.height - y) / rect.height) * 100));
          patchTerminalState({ height: finalPercent });
        }
      }
      setIsDragging(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, terminalCollapsed, toggleTerminalCollapsed, patchTerminalState]);

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        Project not found
      </div>
    );
  }

  return (
    <>
      <TopBar
        project={project}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        currentBranch={currentBranch}
        branches={branches}
        taskBranchMap={taskBranchMap}
        onSwitchBranch={handleSwitchBranch}
      />

      <main ref={containerRef} className="flex-1 flex flex-col overflow-hidden relative">
        {activeTab === 'project' && (
          <>
            <div
              className="flex-1 min-h-0 overflow-hidden"
              style={terminalCollapsed ? undefined : { flexBasis: `${100 - chatPercent}%` }}
            >
              <KanbanBoard
                tasks={columns}
                onMoveTask={moveTask}
                onAddTask={handleAddTask}
                onDeleteTask={deleteTask}
                onClickTask={(task) => {
                  if (task.status === 'todo') {
                    setModalTask(task);
                  } else {
                    setAgentModalTask(task);
                  }
                }}
                onRefreshTasks={refresh}
                executionMode={executionMode}
                onExecutionModeChange={handleExecutionModeChange}
              />
            </div>

            <TerminalPanel
              projectId={projectId}
              projectPath={project.path}
              style={{ flexBasis: `${chatPercent}%` }}
              collapsed={terminalCollapsed}
              onToggleCollapsed={toggleTerminalCollapsed}
              onExpand={expandTerminal}
              cleanupTimes={cleanupTimes}
              onResizeStart={handleResizeStart}
              isDragging={isDragging}
              onTaskCreated={refresh}
            />
          </>
        )}

        {activeTab === 'list' && project && (
          <ProjectTaskList
            projectId={projectId}
            projectName={project.name || project.path.replace(/\/+$/, '').split('/').pop() || projectId}
            columns={columns}
            onClickTask={(task) => {
              if (task.status === 'todo') {
                setModalTask(task);
              } else {
                setAgentModalTask(task);
              }
            }}
            onStatusChange={async (taskId, newStatus) => {
              if (newStatus === 'in-progress') {
                await fetch(`/api/projects/${projectId}/tasks/reorder`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ taskId, toColumn: 'in-progress', toIndex: 0 }),
                });
              } else if (newStatus === 'done') {
                await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'done' }),
                });
              } else if (newStatus === 'todo') {
                await fetch(`/api/projects/${projectId}/tasks/reorder`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ taskId, toColumn: 'todo', toIndex: 0 }),
                });
              }
              refresh();
            }}
            onContinueToCode={handleContinueToCode}
            onRefresh={refresh}
          />
        )}

        {activeTab === 'live' && project && <LiveTab project={project} />}
        {activeTab === 'code' && project && <CodeTab project={project} />}
      </main>

      {isDragging && <div className="fixed inset-0 z-50 cursor-grabbing" />}

      {agentModalTask && (
        <TaskAgentModal
          task={agentModalTask}
          projectId={projectId}
          isQueued={agentModalTask.dispatch === 'queued'}
          cleanupExpiresAt={cleanupTimes[agentModalTask.id]}
          onClose={() => setAgentModalTask(null)}
          onComplete={async (taskId) => {
            await updateTask(taskId, { status: 'done' });
            setAgentModalTask(null);
            fetchBranchState();
          }}
          onContinueToCode={handleContinueToCode}
          parallelMode={executionMode === 'parallel'}
          currentBranch={currentBranch}
          onSwitchBranch={handleSwitchBranch}
        />
      )}

      {undoEntry && (
        <UndoModal
          task={undoEntry.task}
          column={undoEntry.column}
          isOpen={true}
          onRestore={async () => {
            await fetch(`/api/projects/${projectId}/tasks/undo`, { method: 'POST' });
            setUndoEntry(null);
            refresh();
          }}
          onDiscard={() => {
            setUndoEntry(null);
          }}
        />
      )}

      {/* Quick capture floating indicator */}
      {quickCaptureText && !modalTask && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div
            className="bg-zinc-900/95 border border-zinc-700/50 rounded-xl px-5 py-3.5 shadow-2xl backdrop-blur-sm opacity-0"
            style={{ animation: 'quick-capture-in 100ms ease-out 150ms forwards' }}
          >
            <div className="text-sm text-zinc-200 whitespace-pre-wrap">
              {quickCaptureText}
              <span
                className="inline-block w-[2px] h-[1.1em] bg-zinc-400 ml-[1px] align-text-bottom"
                style={{ animation: 'cursor-blink 1s step-end infinite' }}
              />
            </div>
          </div>
        </div>
      )}

      {modalTask && (
        <TaskModal
          task={modalTask}
          isOpen={true}
          initialDescription={quickCaptureRef.current.active ? quickCaptureRef.current.buffer : undefined}
          onClose={async (isEmpty: boolean, data?: { title: string; description: string }) => {
            if (isEmpty) {
              await deleteTask(modalTask.id);
            } else if (data?.description?.trim() && !data?.title?.trim()) {
              // Wait for the save to persist before generating title
              await fetch(`/api/projects/${projectId}/tasks/${modalTask.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: data.title, description: data.description }),
              });
              // Background-generate a title from the description
              fetch(`/api/projects/${projectId}/tasks/${modalTask.id}/generate-title`, { method: 'POST' });
            }
            setModalTask(null);
            refresh();
          }}
          onSave={updateTask}
          onMoveToInProgress={async (taskId, currentData) => {
            // Save task content while modal still shows spinner
            await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(currentData),
            });
            // Background-generate a title if missing
            if (currentData.description?.trim() && !currentData.title?.trim()) {
              fetch(`/api/projects/${projectId}/tasks/${taskId}/generate-title`, { method: 'POST' });
            }
            // Close modal and optimistically update
            setModalTask(null);
            setTasksByProject((prev) => {
              const cols = prev[projectId] || emptyColumns();
              const todoCol = cols.todo.filter((t) => t.id !== taskId);
              const task = cols.todo.find((t) => t.id === taskId);
              if (!task) return prev;
              const updatedTask = { ...task, ...currentData, status: 'in-progress' as const, dispatch: 'starting' as const };
              return {
                ...prev,
                [projectId]: {
                  ...cols,
                  todo: todoCol,
                  "in-progress": [updatedTask, ...cols["in-progress"]],
                },
              };
            });
            // Dispatch via moveTask API
            await fetch(`/api/projects/${projectId}/tasks/reorder`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ taskId, toColumn: 'in-progress', toIndex: 0 }),
            });
            refresh();
          }}
        />
      )}

      <ParallelModeModal
        isOpen={showParallelModal}
        onConfirm={applyParallelMode}
        onCancel={() => setShowParallelModal(false)}
      />

      <AlertModal
        isOpen={showModeBlockedModal}
        onClose={() => setShowModeBlockedModal(false)}
        title="Can't switch execution mode"
      >
        Complete or move all in-progress and verify tasks back to Todo before switching modes.
      </AlertModal>
    </>
  );
}
