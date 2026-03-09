'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Loader2Icon,
  ClockIcon,
  CheckCircle2Icon,
  SearchCheckIcon,
  RadioTowerIcon,
  MaximizeIcon,
  MinimizeIcon,
  PlusIcon,
  XIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListOrderedIcon,
  LayersIcon,
  PlayIcon,
} from 'lucide-react';
import type { Task, TaskColumns, ExecutionMode, FollowUpDraft } from '@/lib/types';
import { StructuredPane } from './StructuredPane';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

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
  onAddTask?: () => void;
  onStartTask?: (taskId: string) => void;
}

function getStreamTasks(
  columns: TaskColumns,
  pinnedDoneIds: Set<string>,
  hiddenIds: Set<string>,
): Task[] {
  const pinnedDone = columns['done'].filter((t) => pinnedDoneIds.has(t.id));
  const allTasks = [
    ...columns['in-progress'],
    ...columns['verify'],
    ...pinnedDone,
  ].filter((t) => !hiddenIds.has(t.id));

  return allTasks
    .sort((a, b) => {
      const score = (t: Task) =>
        t.agentStatus === 'running' ? 0
        : t.agentStatus === 'starting' ? 1
        : t.agentStatus === 'queued' ? 2
        : t.status === 'verify' ? 3
        : 4;
      return score(a) - score(b);
    });
}

/** For <=6 tasks, compute rows and cols */
function getGridDimensions(count: number): { rows: number; cols: number } {
  if (count <= 1) return { rows: 1, cols: 1 };
  if (count === 2) return { rows: 1, cols: 2 };
  if (count === 3) return { rows: 1, cols: 3 };
  if (count === 4) return { rows: 2, cols: 2 };
  return { rows: 2, cols: 3 };
}

// ── Resize Handle ──────────────────────────────────────────

function ResizeHandle({
  direction,
  onDrag,
}: {
  direction: 'horizontal' | 'vertical';
  onDrag: (delta: number) => void;
}) {
  const startRef = useRef(0);
  const lastRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const pos = direction === 'vertical' ? e.clientX : e.clientY;
    startRef.current = pos;
    lastRef.current = pos;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const current = direction === 'vertical' ? moveEvent.clientX : moveEvent.clientY;
      const delta = current - lastRef.current;
      lastRef.current = current;
      onDrag(delta);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [direction, onDrag]);

  if (direction === 'vertical') {
    return (
      <div
        onMouseDown={handleMouseDown}
        className="w-[1.5px] shrink-0 bg-zinc-700 hover:bg-zinc-500 cursor-col-resize transition-colors relative group"
        title="Drag to resize"
      />
    );
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      className="h-[3px] shrink-0 bg-zinc-500 hover:bg-zinc-400 cursor-row-resize transition-colors relative group"
      title="Drag to resize"
    />
  );
}

// ── Resizable Grid ─────────────────────────────────────────

function ResizableGrid({
  children,
  rows,
  cols,
}: {
  children: React.ReactNode[];
  rows: number;
  cols: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [colSizes, setColSizes] = useState<number[]>(() => Array(cols).fill(1 / cols));
  const [rowSizes, setRowSizes] = useState<number[]>(() => Array(rows).fill(1 / rows));

  // Reset sizes when grid dimensions change
  useEffect(() => {
    setColSizes(Array(cols).fill(1 / cols));
  }, [cols]);
  useEffect(() => {
    setRowSizes(Array(rows).fill(1 / rows));
  }, [rows]);

  const handleColResize = useCallback((colIndex: number, deltaPx: number) => {
    const container = containerRef.current;
    if (!container) return;
    const totalWidth = container.clientWidth;
    const deltaFrac = deltaPx / totalWidth;
    setColSizes(prev => {
      const next = [...prev];
      const minSize = 0.1;
      const newLeft = next[colIndex] + deltaFrac;
      const newRight = next[colIndex + 1] - deltaFrac;
      if (newLeft < minSize || newRight < minSize) return prev;
      next[colIndex] = newLeft;
      next[colIndex + 1] = newRight;
      return next;
    });
  }, []);

  const handleRowResize = useCallback((rowIndex: number, deltaPx: number) => {
    const container = containerRef.current;
    if (!container) return;
    const totalHeight = container.clientHeight;
    const deltaFrac = deltaPx / totalHeight;
    setRowSizes(prev => {
      const next = [...prev];
      const minSize = 0.1;
      const newTop = next[rowIndex] + deltaFrac;
      const newBottom = next[rowIndex + 1] - deltaFrac;
      if (newTop < minSize || newBottom < minSize) return prev;
      next[rowIndex] = newTop;
      next[rowIndex + 1] = newBottom;
      return next;
    });
  }, []);

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full overflow-hidden">
      {Array.from({ length: rows }, (_, rowIdx) => (
        <React.Fragment key={rowIdx}>
          {rowIdx > 0 && (
            <ResizeHandle
              direction="horizontal"
              onDrag={(delta) => handleRowResize(rowIdx - 1, delta)}
            />
          )}
          <div className="flex min-h-0 overflow-hidden" style={{ flex: rowSizes[rowIdx] }}>
            {Array.from({ length: cols }, (_, colIdx) => {
              const childIndex = rowIdx * cols + colIdx;
              if (childIndex >= children.length) return null;
              return (
                <React.Fragment key={colIdx}>
                  {colIdx > 0 && (
                    <ResizeHandle
                      direction="vertical"
                      onDrag={(delta) => handleColResize(colIdx - 1, delta)}
                    />
                  )}
                  <div className="min-w-0 min-h-0 overflow-hidden" style={{ flex: colSizes[colIdx] }}>
                    {children[childIndex]}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function statusBorderColor(task: Task): string {
  if (task.agentStatus === 'running') return 'border-l-zinc-500';
  if (task.agentStatus === 'starting') return 'border-l-zinc-500';
  if (task.agentStatus === 'queued') return 'border-l-zinc-600';
  if (task.status === 'verify') return 'border-l-zinc-500';
  if (task.status === 'done') return 'border-l-zinc-600';
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
  onAddTask,
  executionMode = 'sequential',
  onExecutionModeChange,
  onStartTask,
}: StreamsViewProps) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [pinnedDoneIds, setPinnedDoneIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Close add menu when clicking outside
  useEffect(() => {
    if (!showAddMenu) return;
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAddMenu]);

  // Track scroll position for arrow visibility
  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  const scrollBy = useCallback((dir: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    // Scroll by one "page" (3 columns worth)
    const pageWidth = el.clientWidth;
    el.scrollBy({ left: dir === 'left' ? -pageWidth : pageWidth, behavior: 'smooth' });
  }, []);

  // Clean up pinned IDs for tasks that no longer exist in done
  const validPinnedIds = useMemo(() => {
    const doneIds = new Set(tasks['done'].map((t) => t.id));
    const valid = new Set<string>();
    pinnedDoneIds.forEach((id) => { if (doneIds.has(id)) valid.add(id); });
    return valid;
  }, [tasks, pinnedDoneIds]);

  // Clean up hidden IDs for tasks that are no longer in-progress/verify
  const validHiddenIds = useMemo(() => {
    const activeIds = new Set([
      ...tasks['in-progress'].map((t) => t.id),
      ...tasks['verify'].map((t) => t.id),
    ]);
    const valid = new Set<string>();
    hiddenIds.forEach((id) => { if (activeIds.has(id)) valid.add(id); });
    return valid;
  }, [tasks, hiddenIds]);

  const streamTasks = useMemo(
    () => getStreamTasks(tasks, validPinnedIds, validHiddenIds),
    [tasks, validPinnedIds, validHiddenIds],
  );

  // Done tasks available to add (not already pinned)
  const addableDoneTasks = useMemo(
    () => tasks['done'].filter((t) => !validPinnedIds.has(t.id)),
    [tasks, validPinnedIds],
  );

  const handleRemoveStream = (taskId: string) => {
    // If it's a pinned done task, unpin it
    if (validPinnedIds.has(taskId)) {
      setPinnedDoneIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    } else {
      // Hide an in-progress/verify task
      setHiddenIds((prev) => new Set(prev).add(taskId));
    }
    if (expandedTaskId === taskId) setExpandedTaskId(null);
  };

  const handleAddDoneTask = (taskId: string) => {
    setPinnedDoneIds((prev) => new Set(prev).add(taskId));
    // Unhide if it was hidden
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    setShowAddMenu(false);
  };

  const handleRestoreHidden = (taskId: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    setShowAddMenu(false);
  };

  // Hidden active tasks that can be restored
  const hiddenActiveTasks = useMemo(
    () => [...tasks['in-progress'], ...tasks['verify']].filter((t) => validHiddenIds.has(t.id)),
    [tasks, validHiddenIds],
  );

  const hasAddableItems = addableDoneTasks.length > 0 || hiddenActiveTasks.length > 0;

  // Add button for top-right corner
  const addStreamButton = hasAddableItems ? (
    <div className="relative" ref={addMenuRef}>
      <button
        onClick={() => setShowAddMenu((v) => !v)}
        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors"
        title="Add task to streams"
      >
        <PlusIcon className="w-3 h-3" />
        <ChevronDownIcon className="w-2.5 h-2.5" />
      </button>
      {showAddMenu && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 max-h-72 overflow-y-auto rounded-lg border border-border-default bg-surface-primary shadow-xl">
          {hiddenActiveTasks.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-text-placeholder uppercase tracking-wider border-b border-border-default">
                Hidden
              </div>
              {hiddenActiveTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => handleRestoreHidden(task.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-hover text-left"
                >
                  {statusIcon(task)}
                  <span className="truncate">{task.title || task.description?.slice(0, 40) || 'Untitled'}</span>
                </button>
              ))}
            </>
          )}
          {addableDoneTasks.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-text-placeholder uppercase tracking-wider border-b border-border-default">
                Done
              </div>
              {addableDoneTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => handleAddDoneTask(task.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-hover text-left"
                >
                  <CheckCircle2Icon className="w-3 h-3 text-emerald shrink-0" />
                  <span className="truncate">{task.title || task.description?.slice(0, 40) || 'Untitled'}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  ) : null;

  const todoTasks = tasks['todo'];

  // Execution mode dropdown element
  const modeDropdown = onExecutionModeChange ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium text-text-tertiary hover:text-text-secondary hover:bg-surface-hover"
        >
          {executionMode === 'sequential' ? (
            <ListOrderedIcon className="w-3 h-3" />
          ) : (
            <LayersIcon className="w-3 h-3" />
          )}
          <span>{executionMode === 'sequential' ? 'Sequential' : 'Parallel'}</span>
          <ChevronDownIcon className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="exec-mode-dropdown min-w-[140px]">
        <DropdownMenuItem
          onSelect={() => onExecutionModeChange('sequential')}
          className={`gap-2 text-xs ${executionMode === 'sequential' ? 'exec-mode-selected' : ''}`}
        >
          <ListOrderedIcon className="w-3.5 h-3.5" />
          Sequential
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onExecutionModeChange('parallel')}
          className={`gap-2 text-xs ${executionMode === 'parallel' ? 'exec-mode-selected' : ''}`}
        >
          <LayersIcon className="w-3.5 h-3.5" />
          Parallel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  // Todo task queue - shows tasks waiting to be started
  const todoQueue = todoTasks.length > 0 && onStartTask ? (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
      <span className="text-[10px] text-text-placeholder shrink-0">Queue:</span>
      {todoTasks.map((task) => (
        <button
          key={task.id}
          onClick={() => onStartTask(task.id)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-text-tertiary hover:text-text-secondary bg-surface-secondary hover:bg-surface-hover border border-border-default transition-colors shrink-0 max-w-[180px] group"
          title={`Start: ${task.title || task.description?.slice(0, 50) || 'Untitled'}`}
        >
          <PlayIcon className="w-2.5 h-2.5 text-emerald shrink-0 opacity-60 group-hover:opacity-100" />
          <span className="truncate">{task.title || task.description?.slice(0, 30) || 'Untitled'}</span>
        </button>
      ))}
    </div>
  ) : null;

  if (streamTasks.length === 0) {
    return (
      <div className="h-full flex flex-col text-text-tertiary relative">
        {/* Toolbar even when empty */}
        <div className="flex items-center px-2 py-1 shrink-0 gap-2">
          {onAddTask && (
            <button
              onClick={onAddTask}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-blue-400 hover:bg-blue-500/10 transition-colors"
              title="New Task"
            >
              <PlusIcon className="w-3 h-3" />
              New Task
            </button>
          )}
          {modeDropdown}
          <div className="flex-1 min-w-0">{todoQueue}</div>
          <div className="flex items-center gap-1 shrink-0">
            {addStreamButton}
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <RadioTowerIcon className="w-8 h-8 opacity-30" />
          <p className="text-sm">No active streams</p>
          <p className="text-xs opacity-60">Start a task to see agent output here</p>
        </div>
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
          onRemove={() => handleRemoveStream(task.id)}
          onComplete={onComplete}
          onResumeEditing={onResumeEditing}
          followUpDraft={followUpDraftsRef?.current.get(task.id)}
          onFollowUpDraftChange={(draft) => onFollowUpDraftChange?.(task.id, draft)}
        />
      </div>
    );
  }

  const useScrollLayout = streamTasks.length > 6;

  // For >6 tasks: horizontal scrollable 2-row layout
  if (useScrollLayout) {
    // Split into 2 rows: top row gets ceil(n/2), bottom gets the rest
    const half = Math.ceil(streamTasks.length / 2);
    const topRow = streamTasks.slice(0, half);
    const bottomRow = streamTasks.slice(half);
    // Each column is 33.333% of container width (3 visible columns × 2 rows = 6 visible)
    const colCount = Math.max(topRow.length, bottomRow.length);

    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center px-2 py-1 shrink-0 gap-2">
          {onAddTask && (
            <button
              onClick={onAddTask}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-blue-400 hover:bg-blue-500/10 transition-colors"
              title="New Task"
            >
              <PlusIcon className="w-3 h-3" />
              New Task
            </button>
          )}
          {modeDropdown}
          <span className="text-[10px] text-text-placeholder">
            {streamTasks.length} streams
          </span>
          <div className="flex-1 min-w-0">{todoQueue}</div>
          <div className="flex items-center gap-1 shrink-0">
            {addStreamButton}
          </div>
        </div>
        {/* Scrollable area with navigation arrows */}
        <div className="flex-1 relative min-h-0">
          {/* Left scroll arrow */}
          {canScrollLeft && (
            <button
              onClick={() => scrollBy('left')}
              className="absolute left-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-r from-zinc-950/80 to-transparent hover:from-zinc-950 transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5 text-text-secondary" />
            </button>
          )}
          {/* Right scroll arrow */}
          {canScrollRight && (
            <button
              onClick={() => scrollBy('right')}
              className="absolute right-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-l from-zinc-950/80 to-transparent hover:from-zinc-950 transition-colors"
            >
              <ChevronRightIcon className="w-5 h-5 text-text-secondary" />
            </button>
          )}
          {/* Scroll container */}
          <div
            ref={scrollContainerRef}
            className="h-full overflow-x-auto overflow-y-hidden scrollbar-thin"
            style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
          >
            <div
              className="h-full flex flex-col"
              style={{
                minWidth: `${(colCount / 3) * 100}%`,
              }}
            >
              {/* Top row */}
              <div className="flex flex-1 min-h-0">
                {topRow.map((task, i) => (
                  <React.Fragment key={task.id}>
                    {i > 0 && (
                      <div className="w-[1.5px] shrink-0 bg-zinc-700" />
                    )}
                    <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
                      <StreamCellFull
                        task={task}
                        projectId={projectId}
                        compact
                        onExpand={() => setExpandedTaskId(task.id)}
                        onRemove={() => handleRemoveStream(task.id)}
                        onComplete={onComplete}
                        onResumeEditing={onResumeEditing}
                        followUpDraft={followUpDraftsRef?.current.get(task.id)}
                        onFollowUpDraftChange={(draft) => onFollowUpDraftChange?.(task.id, draft)}
                      />
                    </div>
                  </React.Fragment>
                ))}
              </div>
              {/* Horizontal divider */}
              <div className="h-[3px] shrink-0 bg-zinc-500" />
              {/* Bottom row */}
              <div className="flex flex-1 min-h-0">
                {bottomRow.map((task, i) => (
                  <React.Fragment key={task.id}>
                    {i > 0 && (
                      <div className="w-[1.5px] shrink-0 bg-zinc-700" />
                    )}
                    <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
                      <StreamCellFull
                        task={task}
                        projectId={projectId}
                        compact
                        onExpand={() => setExpandedTaskId(task.id)}
                        onRemove={() => handleRemoveStream(task.id)}
                        onComplete={onComplete}
                        onResumeEditing={onResumeEditing}
                        followUpDraft={followUpDraftsRef?.current.get(task.id)}
                        onFollowUpDraftChange={(draft) => onFollowUpDraftChange?.(task.id, draft)}
                      />
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // <=6 tasks: resizable grid
  const { rows: gridRows, cols: gridCols } = getGridDimensions(streamTasks.length);

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center px-2 py-1 shrink-0 gap-2">
        {onAddTask && (
          <button
            onClick={onAddTask}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-blue-400 hover:bg-blue-500/10 transition-colors"
            title="New Task"
          >
            <PlusIcon className="w-3 h-3" />
            New Task
          </button>
        )}
        {modeDropdown}
        <div className="flex-1 min-w-0">{todoQueue}</div>
        <div className="flex items-center gap-1 shrink-0">
          {addStreamButton}
        </div>
      </div>
      <div className="flex-1 overflow-hidden min-h-0">
        <ResizableGrid rows={gridRows} cols={gridCols}>
          {streamTasks.map((task) => (
            <StreamCellFull
              key={task.id}
              task={task}
              projectId={projectId}
              compact
              onExpand={() => setExpandedTaskId(task.id)}
              onRemove={() => handleRemoveStream(task.id)}
              onComplete={onComplete}
              onResumeEditing={onResumeEditing}
              followUpDraft={followUpDraftsRef?.current.get(task.id)}
              onFollowUpDraftChange={(draft) => onFollowUpDraftChange?.(task.id, draft)}
            />
          ))}
        </ResizableGrid>
      </div>
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
  onRemove?: () => void;
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
  onRemove,
  onComplete,
  onResumeEditing,
  followUpDraft,
  onFollowUpDraftChange,
}: StreamCellFullProps) {
  const isLive = task.agentStatus === 'running' || task.agentStatus === 'starting';
  // Only use static blocks for "done" tasks — verify tasks need a live WS connection for follow-ups
  const staticBlocks =
    !isLive && task.status === 'done' && task.agentBlocks
      ? task.agentBlocks
      : undefined;

  return (
    <div className={`flex flex-col min-h-0 h-full bg-surface-deep border-l-[3px] ${statusBorderColor(task)}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-default bg-surface-primary/60 shrink-0">
        {statusIcon(task)}
        <span className="text-sm font-medium text-text-secondary truncate flex-1">
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
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1 rounded text-text-placeholder hover:text-red-400 hover:bg-red-500/10"
            title="Remove from streams"
          >
            <XIcon className="w-3 h-3" />
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
