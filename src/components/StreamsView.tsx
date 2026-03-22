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
  TypeIcon,
  TagIcon,
  SettingsIcon,
  UserIcon,
  MessageSquareIcon,
  GripVerticalIcon,
} from 'lucide-react';
import type { Task, TaskColumns, ExecutionMode, FollowUpDraft } from '@/lib/types';
import { StructuredPane } from './StructuredPane';
import { TerminalPane } from './TerminalPane';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

interface StreamsViewProps {
  tasks: TaskColumns;
  projectId: string;
  executionMode?: ExecutionMode;
  onExecutionModeChange?: (mode: ExecutionMode) => void;
  followUpDraftsRef?: React.MutableRefObject<Map<string, FollowUpDraft>>;
  onFollowUpDraftChange?: (taskId: string, draft: FollowUpDraft | null) => void;
  onComplete?: (taskId: string) => void;
  onResumeEditing?: (taskId: string) => void;
  onAddTask?: () => void;
  onStartTask?: (taskId: string) => void;
  onUpdateTitle?: (taskId: string, title: string) => void;
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
        : t.agentStatus === 'idle' ? 0.5
        : t.agentStatus === 'starting' ? 1
        : t.agentStatus === 'queued' ? 2
        : t.status === 'verify' ? 3
        : 4;
      const diff = score(a) - score(b);
      if (diff !== 0) return diff;
      // Stable tiebreaker: older tasks first, then by id
      const timeA = a.createdAt || '';
      const timeB = b.createdAt || '';
      return timeA.localeCompare(timeB) || a.id.localeCompare(b.id);
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
        className="w-px shrink-0 bg-white/10 hover:bg-white/30 cursor-col-resize transition-colors relative group"
        title="Drag to resize"
      />
    );
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      className="h-px shrink-0 bg-white/10 hover:bg-white/30 cursor-row-resize transition-colors relative group"
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
                  <div className="min-w-0 min-h-0 overflow-hidden relative" style={{ flex: colSizes[colIdx] }}>
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

function statusIcon(task: Task): React.ReactNode {
  if (task.agentStatus === 'running' || task.agentStatus === 'starting') {
    return <Loader2Icon className="w-3 h-3 text-blue-400 animate-spin" />;
  }
  if (task.agentStatus === 'idle') {
    return <span className="w-2 h-2 rounded-full bg-blue-400/60 inline-block" />;
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
  onUpdateTitle,
}: StreamsViewProps) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [streamFontSize, setStreamFontSize] = useState(() => {
    if (typeof window === 'undefined') return 9;
    const v = parseInt(localStorage.getItem('proq-stream-fontSize') ?? '', 10);
    return isNaN(v) ? 9 : v;
  });
  const [pinnedDoneIds, setPinnedDoneIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  // Persistent ordering: preserves task positions across status changes AND remounts.
  // Stored in localStorage per project so positions survive page reloads.
  // Uses a ref (not state) to avoid re-render loops — the memo reads it without depending on it.
  const orderStorageKey = `proq-stream-order-${projectId}`;
  const manualOrderRef = useRef<string[]>(
    typeof window === 'undefined' ? [] : (() => {
      try {
        const stored = localStorage.getItem(orderStorageKey);
        return stored ? JSON.parse(stored) : [];
      } catch { return []; }
    })()
  );
  // Trigger re-render when order changes via drag reorder
  const [orderVersion, setOrderVersion] = useState(0);
  const setManualOrder = useCallback((order: string[]) => {
    manualOrderRef.current = order;
    localStorage.setItem(orderStorageKey, JSON.stringify(order));
  }, [orderStorageKey]);
  // Drag state for reordering
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [labelFontSize, setLabelFontSize] = useState(() => {
    if (typeof window === 'undefined') return 10;
    const v = parseInt(localStorage.getItem('proq-stream-labelFontSize') ?? '', 10);
    return isNaN(v) ? 10 : v;
  });
  const [userFontSize, setUserFontSize] = useState(() => {
    if (typeof window === 'undefined') return 15;
    const v = parseInt(localStorage.getItem('proq-structured-userFontSize') ?? '', 10);
    return isNaN(v) ? 15 : v;
  });
  const [responseFontSize, setResponseFontSize] = useState(() => {
    if (typeof window === 'undefined') return 19;
    const v = parseInt(localStorage.getItem('proq-structured-responseFontSize') ?? '', 10);
    return isNaN(v) ? 19 : v;
  });
  const [hideLabels, setHideLabels] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('proq-stream-hideLabels') === 'true';
  });
  const [showToolbarSettings, setShowToolbarSettings] = useState(() => {
    if (typeof window === 'undefined') return true;
    const v = localStorage.getItem('proq-stream-showSettings');
    return v === null ? true : v === 'true';
  });
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Persist settings to localStorage
  useEffect(() => { localStorage.setItem('proq-stream-fontSize', String(streamFontSize)); }, [streamFontSize]);
  useEffect(() => { localStorage.setItem('proq-stream-labelFontSize', String(labelFontSize)); }, [labelFontSize]);
  useEffect(() => { localStorage.setItem('proq-stream-hideLabels', String(hideLabels)); }, [hideLabels]);
  useEffect(() => { localStorage.setItem('proq-structured-userFontSize', String(userFontSize)); }, [userFontSize]);
  useEffect(() => { localStorage.setItem('proq-structured-responseFontSize', String(responseFontSize)); }, [responseFontSize]);
  useEffect(() => { localStorage.setItem('proq-stream-showSettings', String(showToolbarSettings)); }, [showToolbarSettings]);

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

  // eslint-disable-next-line react-hooks/exhaustive-deps -- orderVersion triggers re-eval when drag reorder changes the ref
  const resolvedStreamTasks = useMemo(() => {
    const manualOrder = manualOrderRef.current;
    const sorted = getStreamTasks(tasks, validPinnedIds, validHiddenIds);
    const newIds = new Set(sorted.map((t) => t.id));
    const prevIds = new Set(manualOrder);
    const taskMap = new Map(sorted.map((t) => [t.id, t]));

    // If same set of task IDs, preserve manual order (just update task objects)
    // This prevents grid position swaps when only agentStatus changes
    const sameSet =
      newIds.size === prevIds.size && [...newIds].every((id) => prevIds.has(id));

    if (sameSet && manualOrder.length > 0) {
      return manualOrder.map((id) => taskMap.get(id)!).filter(Boolean);
    }

    // Different set — prepend new tasks to the front, keep existing order for the rest
    const addedIds = [...newIds].filter((id) => !prevIds.has(id));
    const keptIds = manualOrder.filter((id) => newIds.has(id));
    const mergedOrder = [...addedIds, ...keptIds];
    setManualOrder(mergedOrder);
    return mergedOrder.map((id) => taskMap.get(id)!).filter(Boolean);
  }, [tasks, validPinnedIds, validHiddenIds, setManualOrder, orderVersion]);

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

  const handleReorder = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    const order = [...manualOrderRef.current];
    const fromIdx = order.indexOf(fromId);
    const toIdx = order.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) return;
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, fromId);
    setManualOrder(order);
    setOrderVersion((v) => v + 1);
  }, [setManualOrder]);

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

  const toolbar = (extra?: React.ReactNode) => (
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
      <button
        onClick={() => setShowToolbarSettings((v) => !v)}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
          showToolbarSettings
            ? 'text-blue-400 bg-blue-500/10'
            : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-hover'
        }`}
        title={showToolbarSettings ? 'Hide settings' : 'Show settings'}
      >
        <SettingsIcon className="w-3 h-3" />
      </button>
      {showToolbarSettings && (
        <>
          {modeDropdown}
          {/* Text size input */}
          <div className="flex items-center gap-1 shrink-0">
            <TypeIcon className="w-3 h-3 text-text-placeholder" />
            <input
              type="number"
              min={8}
              max={32}
              value={streamFontSize}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 8 && v <= 32) setStreamFontSize(v);
              }}
              className="w-10 px-1 py-0.5 rounded text-[10px] text-text-secondary bg-surface-secondary border border-border-default text-center focus:outline-none focus:border-blue-500"
              title="Stream text size (px)"
            />
            <span className="text-[10px] text-text-placeholder">px</span>
          </div>
          {/* Label text size input */}
          <div className="flex items-center gap-1 shrink-0">
            <TagIcon className="w-3 h-3 text-text-placeholder" />
            <input
              type="number"
              min={8}
              max={32}
              value={labelFontSize}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 8 && v <= 32) setLabelFontSize(v);
              }}
              className="w-10 px-1 py-0.5 rounded text-[10px] text-text-secondary bg-surface-secondary border border-border-default text-center focus:outline-none focus:border-blue-500"
              title="Label text size (px)"
            />
            <span className="text-[10px] text-text-placeholder">px</span>
          </div>
          {/* User text size input */}
          <div className="flex items-center gap-1 shrink-0">
            <UserIcon className="w-3 h-3 text-text-placeholder" />
            <input
              type="number"
              min={8}
              max={32}
              value={userFontSize}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 8 && v <= 32) setUserFontSize(v);
              }}
              className="w-10 px-1 py-0.5 rounded text-[10px] text-text-secondary bg-surface-secondary border border-border-default text-center focus:outline-none focus:border-blue-500"
              title="User message text size (px)"
            />
            <span className="text-[10px] text-text-placeholder">px</span>
          </div>
          {/* Response text size input */}
          <div className="flex items-center gap-1 shrink-0">
            <MessageSquareIcon className="w-3 h-3 text-text-placeholder" />
            <input
              type="number"
              min={8}
              max={32}
              value={responseFontSize}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 8 && v <= 32) setResponseFontSize(v);
              }}
              className="w-10 px-1 py-0.5 rounded text-[10px] text-text-secondary bg-surface-secondary border border-border-default text-center focus:outline-none focus:border-blue-500"
              title="Response text size (px)"
            />
            <span className="text-[10px] text-text-placeholder">px</span>
          </div>
          {/* Hide labels toggle */}
          <button
            onClick={() => setHideLabels((v) => !v)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
              hideLabels
                ? 'text-blue-400 bg-blue-500/10'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-hover'
            }`}
            title={hideLabels ? 'Show task labels' : 'Hide task labels'}
          >
            <TagIcon className="w-3 h-3" />
            <span>{hideLabels ? 'Labels hidden' : 'Labels'}</span>
          </button>
          {extra}
        </>
      )}
      {!showToolbarSettings && extra}
      <div className="flex-1 min-w-0" />
      <div className="flex items-center gap-1 shrink-0">
        {addStreamButton}
      </div>
    </div>
  );

  // Clear expanded task if it's no longer in the stream
  const expandedTask = expandedTaskId ? resolvedStreamTasks.find((t) => t.id === expandedTaskId) : null;
  useEffect(() => {
    if (expandedTaskId && !expandedTask) setExpandedTaskId(null);
  }, [expandedTaskId, expandedTask]);

  if (resolvedStreamTasks.length === 0) {
    return (
      <div className="h-full flex flex-col text-text-tertiary relative">
        {toolbar()}
        <div
          className={`flex-1 flex flex-col items-center justify-center gap-3${onAddTask ? ' cursor-pointer' : ''}`}
          onClick={onAddTask}
        >
          <RadioTowerIcon className="w-8 h-8 opacity-30" />
          <p className="text-sm">No active streams</p>
          <p className="text-xs opacity-60">{onAddTask ? 'Click anywhere to create a task' : 'Start a task to see agent output here'}</p>
        </div>
      </div>
    );
  }

  // Single expanded cell
  if (expandedTask) {
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        {toolbar()}
        <StreamCellFull
          task={expandedTask}
          projectId={projectId}
          fontSize={streamFontSize}
          hideLeftBorder
          hideLabel={hideLabels}
          labelFontSize={labelFontSize}
          userFontSize={userFontSize}
          responseFontSize={responseFontSize}
          onCollapse={() => setExpandedTaskId(null)}
          onRemove={() => handleRemoveStream(expandedTask.id)}
          onComplete={onComplete}
          onResumeEditing={onResumeEditing}
          onUpdateTitle={onUpdateTitle}
          followUpDraft={followUpDraftsRef?.current.get(expandedTask.id)}
          onFollowUpDraftChange={(draft) => onFollowUpDraftChange?.(expandedTask.id, draft)}
        />
      </div>
    );
  }

  // Helper: drag props for a task cell
  const dragProps = (task: Task) => ({
    onDragStart: () => setDragSourceId(task.id),
    onDragEnd: () => { setDragSourceId(null); setDragOverId(null); },
    onDragOver: () => setDragOverId(task.id),
    onDrop: () => { if (dragSourceId && dragSourceId !== task.id) handleReorder(dragSourceId, task.id); setDragSourceId(null); setDragOverId(null); },
    isDragSource: dragSourceId === task.id,
    isDragOver: dragOverId === task.id,
  });

  const useScrollLayout = resolvedStreamTasks.length > 6;

  // For >6 tasks: horizontal scrollable 2-row layout
  if (useScrollLayout) {
    // Split into 2 rows: top row gets ceil(n/2), bottom gets the rest
    const half = Math.ceil(resolvedStreamTasks.length / 2);
    const topRow = resolvedStreamTasks.slice(0, half);
    const bottomRow = resolvedStreamTasks.slice(half);
    // Each column is 33.333% of container width (3 visible columns × 2 rows = 6 visible)
    const colCount = Math.max(topRow.length, bottomRow.length);

    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        {toolbar(
          <span className="text-[10px] text-text-placeholder">
            {resolvedStreamTasks.length} streams
          </span>
        )}
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
                      <div className="w-px shrink-0 bg-white/10" />
                    )}
                    <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
                      <StreamCellFull
                        task={task}
                        projectId={projectId}
                        compact
                        fontSize={streamFontSize}
                        hideLeftBorder={i === 0}
                        hideLabel={hideLabels}
                        labelFontSize={labelFontSize}
                        userFontSize={userFontSize}
                        responseFontSize={responseFontSize}
                        onExpand={() => setExpandedTaskId(task.id)}
                        onRemove={() => handleRemoveStream(task.id)}
                        onComplete={onComplete}
                        onResumeEditing={onResumeEditing}
                        onUpdateTitle={onUpdateTitle}
                        followUpDraft={followUpDraftsRef?.current.get(task.id)}
                        onFollowUpDraftChange={(draft) => onFollowUpDraftChange?.(task.id, draft)}
                        {...dragProps(task)}
                      />
                    </div>
                  </React.Fragment>
                ))}
              </div>
              {/* Horizontal divider */}
              <div className="h-px shrink-0 bg-white/10" />
              {/* Bottom row */}
              <div className="flex flex-1 min-h-0">
                {bottomRow.map((task, i) => (
                  <React.Fragment key={task.id}>
                    {i > 0 && (
                      <div className="w-px shrink-0 bg-white/10" />
                    )}
                    <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
                      <StreamCellFull
                        task={task}
                        projectId={projectId}
                        compact
                        fontSize={streamFontSize}
                        hideLeftBorder={i === 0}
                        hideLabel={hideLabels}
                        labelFontSize={labelFontSize}
                        userFontSize={userFontSize}
                        responseFontSize={responseFontSize}
                        onExpand={() => setExpandedTaskId(task.id)}
                        onRemove={() => handleRemoveStream(task.id)}
                        onComplete={onComplete}
                        onResumeEditing={onResumeEditing}
                        onUpdateTitle={onUpdateTitle}
                        followUpDraft={followUpDraftsRef?.current.get(task.id)}
                        onFollowUpDraftChange={(draft) => onFollowUpDraftChange?.(task.id, draft)}
                        {...dragProps(task)}
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
  const { rows: gridRows, cols: gridCols } = getGridDimensions(resolvedStreamTasks.length);

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {toolbar()}
      <div className="flex-1 overflow-hidden min-h-0">
        <ResizableGrid rows={gridRows} cols={gridCols}>
          {resolvedStreamTasks.map((task, i) => (
            <StreamCellFull
              key={task.id}
              task={task}
              projectId={projectId}
              compact
              fontSize={streamFontSize}
              hideLeftBorder={i % gridCols === 0}
              hideLabel={hideLabels}
              labelFontSize={labelFontSize}
              userFontSize={userFontSize}
              responseFontSize={responseFontSize}
              onExpand={() => setExpandedTaskId(task.id)}
              onRemove={() => handleRemoveStream(task.id)}
              onComplete={onComplete}
              onResumeEditing={onResumeEditing}
              onUpdateTitle={onUpdateTitle}
              followUpDraft={followUpDraftsRef?.current.get(task.id)}
              onFollowUpDraftChange={(draft) => onFollowUpDraftChange?.(task.id, draft)}
              {...dragProps(task)}
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
  hideLeftBorder?: boolean;
  hideLabel?: boolean;
  fontSize?: number;
  labelFontSize?: number;
  userFontSize?: number;
  responseFontSize?: number;
  onExpand?: () => void;
  onCollapse?: () => void;
  onRemove?: () => void;
  onComplete?: (taskId: string) => void;
  onResumeEditing?: (taskId: string) => void;
  onUpdateTitle?: (taskId: string, title: string) => void;
  followUpDraft?: FollowUpDraft;
  onFollowUpDraftChange?: (draft: FollowUpDraft | null) => void;
  // Drag-to-reorder
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: () => void;
  onDrop?: () => void;
  isDragSource?: boolean;
  isDragOver?: boolean;
}

function StreamCellFull({
  task,
  projectId,
  compact,
  hideLeftBorder,
  hideLabel,
  fontSize,
  labelFontSize,
  userFontSize,
  responseFontSize,
  onExpand,
  onCollapse,
  onRemove,
  onComplete,
  onResumeEditing,
  onUpdateTitle,
  followUpDraft,
  onFollowUpDraftChange,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragSource,
  isDragOver,
}: StreamCellFullProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title || '');
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setEditValue(task.title || '');
  }, [task.title, editing]);

  const commitEdit = () => {
    const trimmed = editValue.trim();
    setEditing(false);
    if (trimmed && trimmed !== task.title) {
      onUpdateTitle?.(task.id, trimmed);
    }
  };

  const isLive = task.agentStatus === 'running' || task.agentStatus === 'starting' || task.agentStatus === 'idle';
  const isStructured = task.renderMode !== 'cli';
  const terminalTabId = `task-${task.id.slice(0, 8)}`;
  // Only use static blocks for "done" tasks — verify tasks need a live WS connection for follow-ups
  const staticBlocks =
    !isLive && task.status === 'done' && task.agentBlocks
      ? task.agentBlocks
      : undefined;

  return (
    <div className={`flex flex-col min-h-0 h-full bg-surface-deep`}>
      {/* Header */}
      {!hideLabel && (
        <div
          className={`flex items-center gap-1 px-1 py-1.5 border-b border-border-default bg-surface-primary/60 shrink-0 transition-colors ${
            isDragOver && !isDragSource ? 'bg-blue-500/20 border-blue-400/40' : ''
          } ${isDragSource ? 'opacity-40' : ''}`}
          onDragOver={onDragOver ? (e) => { e.preventDefault(); onDragOver(); } : undefined}
          onDrop={onDrop ? (e) => { e.preventDefault(); onDrop(); } : undefined}
        >
          {/* Drag handle */}
          {onDragStart && (
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', task.id);
                onDragStart();
              }}
              onDragEnd={onDragEnd}
              className="cursor-grab active:cursor-grabbing p-0.5 rounded text-text-placeholder hover:text-text-secondary hover:bg-surface-hover"
              title="Drag to reorder"
            >
              <GripVerticalIcon className="w-3 h-3" />
            </div>
          )}
          {statusIcon(task)}
          {editing ? (
            <input
              ref={titleInputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') { setEditing(false); setEditValue(task.title || ''); }
              }}
              className="font-medium text-text-secondary bg-transparent border-b border-blue-400 outline-none flex-1 min-w-0"
              style={{ fontSize: labelFontSize ? `${labelFontSize}px` : undefined }}
            />
          ) : (
            <span
              className={`font-medium text-text-secondary truncate flex-1 ${onUpdateTitle ? 'cursor-pointer hover:text-text-primary' : ''}`}
              style={{ fontSize: labelFontSize ? `${labelFontSize}px` : undefined }}
              onClick={onUpdateTitle ? () => setEditing(true) : undefined}
            >
              {task.title || task.description?.slice(0, 50) || 'Untitled'}
            </span>
          )}
          {onComplete && task.status !== 'done' && (
            <button
              onClick={() => onComplete(task.id)}
              className="p-1 rounded text-text-placeholder hover:text-emerald hover:bg-emerald/10"
              title="Mark as done"
            >
              <CheckCircle2Icon className="w-3 h-3" />
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
      )}

      {/* Agent output — StructuredPane (Pretty) or TerminalPane (CLI) */}
      {isStructured ? (
        <div className="flex-1 min-h-0 flex flex-col" style={fontSize && fontSize !== 9 ? { zoom: fontSize / 9 } : undefined}>
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
            userFontSize={userFontSize}
            responseFontSize={responseFontSize}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 relative" onDrop={(e) => e.stopPropagation()}>
          <TerminalPane tabId={terminalTabId} visible={true} enableDrop />
        </div>
      )}
    </div>
  );
}
