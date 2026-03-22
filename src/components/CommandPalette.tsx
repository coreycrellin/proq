'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutGrid, List, MonitorPlay, Columns3, PanelBottom,
  GitBranch, GitCommitHorizontal, ArrowUpFromLine, ArrowDownToLine,
  Plus, Undo2, Settings, MessageSquare, FileText, Code, Eye,
  Layers, GitFork, Check,
} from 'lucide-react';
import type { Project, ViewType, ExecutionMode } from '@/lib/types';

/* ─── Types ───────────────────────────────────────────────── */

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  section: string;
  icon?: React.ReactNode;
  action: () => void;
  /** Current item indicator (e.g. active tab, current branch) */
  active?: boolean;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

/* ─── Fuzzy match ─────────────────────────────────────────── */

function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

/* ─── Component ───────────────────────────────────────────── */

export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    return commands.filter(c => fuzzyMatch(query, c.label) || fuzzyMatch(query, c.section));
  }, [query, commands]);

  // Group by section
  const grouped = useMemo(() => {
    const groups: { section: string; items: Command[] }[] = [];
    const seen = new Set<string>();
    for (const cmd of filtered) {
      if (!seen.has(cmd.section)) {
        seen.add(cmd.section);
        groups.push({ section: cmd.section, items: [] });
      }
      groups.find(g => g.section === cmd.section)!.items.push(cmd);
    }
    return groups;
  }, [filtered]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Clamp index
  useEffect(() => {
    if (selectedIndex >= filtered.length) setSelectedIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, selectedIndex]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-selected="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const execute = useCallback((cmd: Command) => {
    onClose();
    cmd.action();
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      execute(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [filtered, selectedIndex, execute, onClose]);

  if (!isOpen) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] electron-no-drag" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-md bg-surface-modal border border-border-default rounded-lg shadow-2xl animate-in fade-in zoom-in-95 duration-75 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center border-b border-border-default px-3">
          <svg className="w-4 h-4 text-text-tertiary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-placeholder px-3 py-3 outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="text-[10px] text-text-tertiary bg-surface-secondary border border-border-default rounded px-1.5 py-0.5 shrink-0">esc</kbd>
        </div>

        {/* Command list */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
          {grouped.length === 0 && (
            <div className="text-xs text-text-tertiary text-center py-6">No matching commands</div>
          )}
          {grouped.map(group => (
            <div key={group.section}>
              <div className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider px-2 pt-2 pb-1">
                {group.section}
              </div>
              {group.items.map(cmd => {
                const idx = flatIndex++;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    data-selected={isSelected}
                    onClick={() => execute(cmd)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-blue-500/15 text-text-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {cmd.icon && <span className="w-4 h-4 shrink-0 opacity-60">{cmd.icon}</span>}
                    <span className="flex-1 truncate">{cmd.label}</span>
                    {cmd.active && <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                    {cmd.shortcut && (
                      <kbd className="text-[10px] text-text-tertiary bg-surface-secondary border border-border-default rounded px-1.5 py-0.5 shrink-0">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Hook: build command list ────────────────────────────── */

interface UseCommandsOptions {
  projects: Project[];
  currentProjectId: string;
  activeTab: string;
  viewType: ViewType;
  executionMode: ExecutionMode;
  currentBranch: string;
  branches: string[];
  workbenchCollapsed: boolean;
  onTabChange: (tab: 'project' | 'live' | 'code' | 'docs') => void;
  onViewTypeChange: (vt: ViewType) => void;
  onExecutionModeChange: (mode: ExecutionMode) => void;
  onSwitchBranch: (branch: string) => void;
  onAddTask: () => void;
  onPush: () => void;
  onPull: () => void;
  onOpenCommit: () => void;
  onOpenProjectSettings: () => void;
  onToggleWorkbench: () => void;
  onUndo: () => void;
}

export function useCommands(opts: UseCommandsOptions): Command[] {
  const router = useRouter();

  return useMemo(() => {
    const cmds: Command[] = [];

    // ── Navigation ──
    const tabs = [
      { id: 'project', label: 'Project', shortcut: '⌘1', icon: <LayoutGrid className="w-4 h-4" /> },
      { id: 'live', label: 'Live', shortcut: '⌘2', icon: <MonitorPlay className="w-4 h-4" /> },
      { id: 'code', label: 'Code', shortcut: '⌘3', icon: <Code className="w-4 h-4" /> },
      { id: 'docs', label: 'Memory', shortcut: '⌘4', icon: <FileText className="w-4 h-4" /> },
    ] as const;
    for (const tab of tabs) {
      cmds.push({
        id: `tab-${tab.id}`,
        label: `Go to ${tab.label} tab`,
        shortcut: tab.shortcut,
        section: 'Navigation',
        icon: tab.icon,
        action: () => opts.onTabChange(tab.id),
        active: opts.activeTab === tab.id,
      });
    }
    cmds.push({
      id: 'nav-supervisor',
      label: 'Go to Supervisor',
      section: 'Navigation',
      icon: <MessageSquare className="w-4 h-4" />,
      action: () => router.push('/supervisor'),
    });
    cmds.push({
      id: 'nav-settings',
      label: 'Go to Settings',
      section: 'Navigation',
      icon: <Settings className="w-4 h-4" />,
      action: () => router.push('/settings'),
    });

    // ── Projects ──
    for (const p of opts.projects) {
      if (p.id === opts.currentProjectId) continue;
      cmds.push({
        id: `project-${p.id}`,
        label: `Switch to ${p.name}`,
        section: 'Projects',
        icon: <Layers className="w-4 h-4" />,
        action: () => router.push(`/projects/${p.id}`),
      });
    }

    // ── Tasks ──
    cmds.push({
      id: 'task-new',
      label: 'New task',
      shortcut: '⌘N',
      section: 'Tasks',
      icon: <Plus className="w-4 h-4" />,
      action: opts.onAddTask,
    });
    cmds.push({
      id: 'task-undo',
      label: 'Undo delete',
      shortcut: '⌘Z',
      section: 'Tasks',
      icon: <Undo2 className="w-4 h-4" />,
      action: opts.onUndo,
    });

    // ── View ──
    const views: { id: ViewType; label: string; icon: React.ReactNode }[] = [
      { id: 'kanban', label: 'Kanban view', icon: <Columns3 className="w-4 h-4" /> },
      { id: 'list', label: 'List view', icon: <List className="w-4 h-4" /> },
      { id: 'streams', label: 'Streams view', icon: <MonitorPlay className="w-4 h-4" /> },
      { id: 'grid', label: 'Grid view', icon: <LayoutGrid className="w-4 h-4" /> },
    ];
    for (const v of views) {
      cmds.push({
        id: `view-${v.id}`,
        label: v.label,
        section: 'View',
        icon: v.icon,
        action: () => opts.onViewTypeChange(v.id),
        active: opts.viewType === v.id,
      });
    }
    cmds.push({
      id: 'view-workbench',
      label: opts.workbenchCollapsed ? 'Show workbench' : 'Hide workbench',
      shortcut: '⌘`',
      section: 'View',
      icon: <PanelBottom className="w-4 h-4" />,
      action: opts.onToggleWorkbench,
    });

    // ── Git ──
    cmds.push({
      id: 'git-commit',
      label: 'Commit...',
      shortcut: '⌘S',
      section: 'Git',
      icon: <GitCommitHorizontal className="w-4 h-4" />,
      action: opts.onOpenCommit,
    });
    cmds.push({
      id: 'git-push',
      label: 'Push',
      section: 'Git',
      icon: <ArrowUpFromLine className="w-4 h-4" />,
      action: opts.onPush,
    });
    cmds.push({
      id: 'git-pull',
      label: 'Pull',
      section: 'Git',
      icon: <ArrowDownToLine className="w-4 h-4" />,
      action: opts.onPull,
    });
    for (const branch of opts.branches) {
      cmds.push({
        id: `branch-${branch}`,
        label: `Switch to ${branch}`,
        section: 'Branches',
        icon: <GitBranch className="w-4 h-4" />,
        action: () => opts.onSwitchBranch(branch),
        active: branch === opts.currentBranch,
      });
    }

    // ── Project ──
    cmds.push({
      id: 'project-settings',
      label: 'Project settings',
      section: 'Project',
      icon: <Settings className="w-4 h-4" />,
      action: opts.onOpenProjectSettings,
    });
    const modes: { id: ExecutionMode; label: string }[] = [
      { id: 'sequential', label: 'Sequential mode' },
      { id: 'parallel', label: 'Parallel mode' },
      { id: 'worktrees', label: 'Worktrees mode' },
    ];
    for (const m of modes) {
      cmds.push({
        id: `mode-${m.id}`,
        label: m.label,
        section: 'Project',
        icon: <GitFork className="w-4 h-4" />,
        action: () => opts.onExecutionModeChange(m.id),
        active: opts.executionMode === m.id,
      });
    }

    return cmds;
  }, [
    opts.projects, opts.currentProjectId, opts.activeTab, opts.viewType,
    opts.executionMode, opts.currentBranch, opts.branches, opts.workbenchCollapsed,
    opts.onTabChange, opts.onViewTypeChange, opts.onExecutionModeChange,
    opts.onSwitchBranch, opts.onAddTask, opts.onPush, opts.onPull,
    opts.onOpenCommit, opts.onOpenProjectSettings, opts.onToggleWorkbench,
    opts.onUndo, router,
  ]);
}
